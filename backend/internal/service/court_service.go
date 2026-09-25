package service

import (
	"fmt"
	"strings"
	"time"

	"badminton-platform/backend/internal/models"
	"badminton-platform/backend/internal/pricing"
	"badminton-platform/backend/internal/repository"
	"badminton-platform/backend/internal/timeutil"
)

const courtClockLayout = "15:04"

type CourtService struct {
	courts *repository.CourtRepository
	slots  *repository.SlotRepository
}

func NewCourtService(courts *repository.CourtRepository, slots *repository.SlotRepository) *CourtService {
	return &CourtService{courts: courts, slots: slots}
}

func (s *CourtService) CreateCourt(name, courtType, openTime, closeTime string, basePrice int64) (*models.Court, error) {
	name, courtType = strings.TrimSpace(name), strings.TrimSpace(courtType)
	if name == "" || courtType == "" {
		return nil, fmt.Errorf("name and court_type are required")
	}
	if basePrice < 0 {
		return nil, fmt.Errorf("base_price must be >= 0")
	}
	if err := validateOperatingHours(openTime, closeTime); err != nil {
		return nil, err
	}
	court := &models.Court{Name: name, CourtType: courtType, OpenTime: openTime, CloseTime: closeTime, BasePrice: basePrice, IsActive: true}
	if err := s.courts.Create(court); err != nil {
		return nil, err
	}
	return court, nil
}

func (s *CourtService) ListCourts() ([]models.Court, error)    { return s.courts.ListActive() }
func (s *CourtService) ListAllCourts() ([]models.Court, error) { return s.courts.ListAll() }

func (s *CourtService) UpdateCourt(id uint, name, courtType, openTime, closeTime string, basePrice *int64, isActive, isMaintenance *bool) (*models.Court, error) {
	court, err := s.courts.FindByID(id)
	if err != nil {
		return nil, err
	}

	hoursChanged := false
	if v := strings.TrimSpace(name); v != "" {
		court.Name = v
	}
	if v := strings.TrimSpace(courtType); v != "" {
		court.CourtType = v
	}
	if openTime != "" && openTime != court.OpenTime {
		court.OpenTime, hoursChanged = openTime, true
	}
	if closeTime != "" && closeTime != court.CloseTime {
		court.CloseTime, hoursChanged = closeTime, true
	}
	if err := validateOperatingHours(court.OpenTime, court.CloseTime); err != nil {
		return nil, err
	}

	priceChanged := false
	if basePrice != nil {
		if *basePrice < 0 {
			return nil, fmt.Errorf("base_price must be >= 0")
		}
		priceChanged = *basePrice != court.BasePrice
		court.BasePrice = *basePrice
	}
	if isActive != nil {
		court.IsActive = *isActive
	}
	if isMaintenance != nil {
		court.IsMaintenance = *isMaintenance
	}

	if err := s.courts.Update(court); err != nil {
		return nil, err
	}

	from := timeutil.Now()
	if hoursChanged {
		if err := s.slots.DeleteFutureUnbookedByCourt(court.ID, from); err != nil {
			return nil, err
		}
	}
	if priceChanged {
		if err := s.slots.RepriceUnbookedByCourtFromDay(court.ID, from, court.BasePrice, pricing.DefaultPeakStartHour, pricing.DefaultPeakEndHour, pricing.DefaultPeakMultiplier); err != nil {
			return nil, err
		}
	}
	return court, nil
}

func (s *CourtService) AvailableSlots(day time.Time) ([]models.TimeSlot, error) {
	return s.slots.ListAvailableByDate(day)
}
func (s *CourtService) DaySlots(day time.Time) ([]repository.SlotDayView, error) {
	return s.slots.ListByDateWithStatus(day)
}

func (s *CourtService) PublicDaySlots(day time.Time) ([]repository.PublicSlotDayView, error) {
	rows, err := s.slots.ListByDateWithStatus(day)
	if err != nil {
		return nil, err
	}
	result := make([]repository.PublicSlotDayView, 0, len(rows))
	for _, row := range rows {
		status := "available"
		if row.Booked {
			status = "booked"
		}
		result = append(result, repository.PublicSlotDayView{
			ID: row.ID, CourtID: row.CourtID, CourtName: row.CourtName, CourtType: row.CourtType,
			StartTime: row.StartTime, EndTime: row.EndTime, Price: row.Price, Booked: row.Booked, Status: status,
		})
	}
	return result, nil
}

func (s *CourtService) EnsureDaySlots(day time.Time, intervalMin int, peakStart, peakEnd int, peakMultiplier float64) error {
	if intervalMin <= 0 {
		intervalMin = 30
	}
	if peakMultiplier <= 0 {
		peakMultiplier = 1.2
	}
	courts, err := s.courts.ListActive()
	if err != nil {
		return err
	}

	for _, court := range courts {
		if court.IsMaintenance {
			continue
		}
		start, end, err := courtScheduleForDay(day, court.OpenTime, court.CloseTime)
		if err != nil {
			return fmt.Errorf("court %d operating hours: %w", court.ID, err)
		}
		existing, err := s.slots.ListByCourtAndDate(court.ID, day)
		if err != nil {
			return err
		}
		existingStart := make(map[int64]struct{}, len(existing))
		for _, slot := range existing {
			existingStart[slot.StartTime.Unix()] = struct{}{}
		}

		missing := make([]models.TimeSlot, 0, int(end.Sub(start)/(time.Duration(intervalMin)*time.Minute)))
		for cur := start; cur.Add(time.Duration(intervalMin)*time.Minute).Compare(end) <= 0; cur = cur.Add(time.Duration(intervalMin) * time.Minute) {
			next := cur.Add(time.Duration(intervalMin) * time.Minute)
			if _, ok := existingStart[cur.Unix()]; ok {
				continue
			}
			price := pricing.CourtSlotPrice(court.BasePrice, cur, peakStart, peakEnd, peakMultiplier)
			missing = append(missing, models.TimeSlot{CourtID: court.ID, StartTime: cur, EndTime: next, Price: price})
		}
		if err := s.slots.BulkCreate(missing); err != nil {
			return err
		}

		// Refresh only currently available slots for the requested day. Booked
		// slots are intentionally excluded so their original price snapshot is
		// preserved. This also updates a future slot that becomes available again
		// after a cancellation or expired hold.
		if err := s.slots.RepriceUnbookedByCourtForDate(court.ID, day, court.BasePrice, peakStart, peakEnd, peakMultiplier); err != nil {
			return err
		}
	}
	return nil
}

func validateOperatingHours(openTime, closeTime string) error {
	open, err := time.Parse(courtClockLayout, openTime)
	if err != nil {
		return fmt.Errorf("open_time must use HH:MM")
	}
	closeValue, err := time.Parse(courtClockLayout, closeTime)
	if err != nil {
		return fmt.Errorf("close_time must use HH:MM")
	}
	if !closeValue.After(open) {
		return fmt.Errorf("close_time must be later than open_time")
	}
	return nil
}

func courtScheduleForDay(day time.Time, openTime, closeTime string) (time.Time, time.Time, error) {
	if err := validateOperatingHours(openTime, closeTime); err != nil {
		return time.Time{}, time.Time{}, err
	}
	open, _ := time.Parse(courtClockLayout, openTime)
	closeValue, _ := time.Parse(courtClockLayout, closeTime)
	localDay := timeutil.StartOfDay(day)
	start := time.Date(localDay.Year(), localDay.Month(), localDay.Day(), open.Hour(), open.Minute(), 0, 0, timeutil.Location())
	end := time.Date(localDay.Year(), localDay.Month(), localDay.Day(), closeValue.Hour(), closeValue.Minute(), 0, 0, timeutil.Location())
	return start, end, nil
}
