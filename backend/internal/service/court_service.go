package service

import (
	"fmt"
	"time"

	"badminton-platform/backend/internal/models"
	"badminton-platform/backend/internal/repository"
)

type CourtService struct {
	courts *repository.CourtRepository
	slots  *repository.SlotRepository
}

func NewCourtService(courts *repository.CourtRepository, slots *repository.SlotRepository) *CourtService {
	return &CourtService{courts: courts, slots: slots}
}

func (s *CourtService) CreateCourt(name, courtType, openTime, closeTime string, basePrice int64) (*models.Court, error) {
	court := &models.Court{
		Name:      name,
		CourtType: courtType,
		OpenTime:  openTime,
		CloseTime: closeTime,
		BasePrice: basePrice,
		IsActive:  true,
	}
	if err := s.courts.Create(court); err != nil {
		return nil, err
	}
	return court, nil
}

func (s *CourtService) ListCourts() ([]models.Court, error) {
	return s.courts.ListActive()
}

func (s *CourtService) ListAllCourts() ([]models.Court, error) {
	return s.courts.ListAll()
}

func (s *CourtService) UpdateCourt(id uint, name, courtType, openTime, closeTime string, basePrice *int64, isActive, isMaintenance bool) (*models.Court, error) {
	court, err := s.courts.FindByID(id)
	if err != nil {
		return nil, err
	}
	priceSyncRequested := false
	
	if name != "" {
		court.Name = name
	}
	if courtType != "" {
		court.CourtType = courtType
	}
	if openTime != "" {
		court.OpenTime = openTime
	}
	if closeTime != "" {
		court.CloseTime = closeTime
	}
	if basePrice != nil {
		if *basePrice < 0 {
			return nil, fmt.Errorf("base_price must be >= 0")
		}
		priceSyncRequested = true
		court.BasePrice = *basePrice
	}
	court.IsActive = isActive
	court.IsMaintenance = isMaintenance
	
	if err := s.courts.Update(court); err != nil {
		return nil, err
	}

	if priceSyncRequested {
		if err := s.slots.RepriceUnbookedByCourtFromDay(court.ID, time.Now(), court.BasePrice, 17, 21, 1.2); err != nil {
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
		// Skip if court is under maintenance
		if court.IsMaintenance {
			continue
		}

		existing, err := s.slots.ListByCourtAndDate(court.ID, day)
		if err != nil {
			return err
		}

		existingStart := make(map[time.Time]bool, len(existing))
		for _, slot := range existing {
			existingStart[slot.StartTime] = true
		}

		// Create slots for 24 hours (00:00 - 23:30)
		start := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, day.Location())
		end := time.Date(day.Year(), day.Month(), day.Day(), 23, 30, 0, 0, day.Location())

		var missing []models.TimeSlot
		for cur := start; cur.Before(end); cur = cur.Add(time.Duration(intervalMin) * time.Minute) {
			next := cur.Add(time.Duration(intervalMin) * time.Minute)
			if next.After(end) {
				break
			}
			if existingStart[cur] {
				continue
			}

			price := court.BasePrice
			hour := cur.Hour()
			if hour >= peakStart && hour < peakEnd {
				price = int64(float64(price) * peakMultiplier)
			}

			missing = append(missing, models.TimeSlot{
				CourtID:   court.ID,
				StartTime: cur,
				EndTime:   next,
				Price:     price,
			})
		}

		if len(missing) > 0 {
			if err := s.slots.BulkCreate(missing); err != nil {
				return err
			}
		}
	}

	return nil
}
