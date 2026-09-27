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
	courts     *repository.CourtRepository
	slots      *repository.SlotRepository
	priceRules *repository.PriceRuleRepository
}

func NewCourtService(courts *repository.CourtRepository, slots *repository.SlotRepository, priceRules *repository.PriceRuleRepository) *CourtService {
	return &CourtService{courts: courts, slots: slots, priceRules: priceRules}
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
		if err := s.repriceFutureUnbooked(court.ID, from); err != nil {
			return nil, err
		}
	}
	return court, nil
}

func (s *CourtService) ListPriceRules(courtID uint) ([]models.CourtPriceRule, error) {
	if _, err := s.courts.FindByID(courtID); err != nil {
		return nil, err
	}
	return s.priceRules.ListByCourt(courtID)
}

func (s *CourtService) CreatePriceRule(rule *models.CourtPriceRule) (*models.CourtPriceRule, error) {
	if _, err := s.courts.FindByID(rule.CourtID); err != nil {
		return nil, err
	}
	if err := s.validatePriceRule(rule, 0); err != nil {
		return nil, err
	}
	if err := s.priceRules.Create(rule); err != nil {
		return nil, err
	}
	if err := s.repriceFutureUnbooked(rule.CourtID, timeutil.Now()); err != nil {
		return nil, err
	}
	return rule, nil
}

func (s *CourtService) UpdatePriceRule(ruleID uint, incoming *models.CourtPriceRule) (*models.CourtPriceRule, error) {
	current, err := s.priceRules.FindByID(ruleID)
	if err != nil {
		return nil, err
	}
	incoming.ID = current.ID
	incoming.CourtID = current.CourtID
	incoming.CreatedAt = current.CreatedAt
	if err := s.validatePriceRule(incoming, ruleID); err != nil {
		return nil, err
	}
	if err := s.priceRules.Update(incoming); err != nil {
		return nil, err
	}
	if err := s.repriceFutureUnbooked(incoming.CourtID, timeutil.Now()); err != nil {
		return nil, err
	}
	return incoming, nil
}

func (s *CourtService) DeletePriceRule(ruleID uint) error {
	rule, err := s.priceRules.FindByID(ruleID)
	if err != nil {
		return err
	}
	if err := s.priceRules.Delete(rule); err != nil {
		return err
	}
	return s.repriceFutureUnbooked(rule.CourtID, timeutil.Now())
}

func (s *CourtService) validatePriceRule(rule *models.CourtPriceRule, excludeID uint) error {
	rule.Name = strings.TrimSpace(rule.Name)
	if rule.Name == "" {
		return fmt.Errorf("rule name is required")
	}
	if rule.DaysMask <= 0 || rule.DaysMask > pricing.AllWeekdaysMask {
		return fmt.Errorf("days_mask must select at least one valid weekday")
	}
	if rule.Price < 0 {
		return fmt.Errorf("price must be >= 0")
	}
	if rule.Priority < 0 || rule.Priority > 10000 {
		return fmt.Errorf("priority must be between 0 and 10000")
	}
	if err := validateOperatingHours(rule.StartTime, rule.EndTime); err != nil {
		return fmt.Errorf("price rule time range: %w", err)
	}
	if rule.EffectiveFrom != nil && rule.EffectiveTo != nil && rule.EffectiveTo.Before(*rule.EffectiveFrom) {
		return fmt.Errorf("effective_to must be on or after effective_from")
	}

	existing, err := s.priceRules.ListByCourt(rule.CourtID)
	if err != nil {
		return err
	}
	for _, other := range existing {
		if other.ID == excludeID || !rule.IsActive || !other.IsActive || other.Priority != rule.Priority {
			continue
		}
		if rule.DaysMask&other.DaysMask == 0 || !clockRangesOverlap(rule.StartTime, rule.EndTime, other.StartTime, other.EndTime) {
			continue
		}
		if dateRangesOverlap(rule.EffectiveFrom, rule.EffectiveTo, other.EffectiveFrom, other.EffectiveTo) {
			return fmt.Errorf("price rule overlaps %q at the same priority", other.Name)
		}
	}
	return nil
}

func clockRangesOverlap(aStart, aEnd, bStart, bEnd string) bool {
	return aStart < bEnd && bStart < aEnd
}

func dateRangesOverlap(aFrom, aTo, bFrom, bTo *time.Time) bool {
	if aTo != nil && bFrom != nil && aTo.Before(*bFrom) {
		return false
	}
	if bTo != nil && aFrom != nil && bTo.Before(*aFrom) {
		return false
	}
	return true
}

func (s *CourtService) priceForSlot(court models.Court, start time.Time, rules []models.CourtPriceRule) int64 {
	return pricing.ResolveRulePrice(court.BasePrice, start, rules)
}

func (s *CourtService) repriceFutureUnbooked(courtID uint, from time.Time) error {
	court, err := s.courts.FindByID(courtID)
	if err != nil {
		return err
	}
	slots, err := s.slots.ListFutureUnbookedByCourt(courtID, from)
	if err != nil {
		return err
	}

	rulesByDay := map[string][]models.CourtPriceRule{}
	for _, slot := range slots {
		key := slot.StartTime.Format("2006-01-02")
		rules, ok := rulesByDay[key]
		if !ok {
			rules, err = s.priceRules.ListActiveForCourtAndDate(courtID, slot.StartTime)
			if err != nil {
				return err
			}
			rulesByDay[key] = rules
		}
		price := s.priceForSlot(*court, slot.StartTime, rules)
		if slot.Price != price {
			if err := s.slots.UpdatePrice(slot.ID, price); err != nil {
				return err
			}
		}
	}
	return nil
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
		result = append(result, toPublicSlotDayView(row))
	}
	return result, nil
}

func toPublicSlotDayView(row repository.SlotDayView) repository.PublicSlotDayView {
	status := "available"
	customerType := ""
	if row.Booked {
		status = row.Status
		if row.CustomerType != nil {
			customerType = *row.CustomerType
		}
	}
	displayColor := ""
	if row.DisplayColor != nil {
		displayColor = *row.DisplayColor
	}
	return repository.PublicSlotDayView{
		ID: row.ID, CourtID: row.CourtID, CourtName: row.CourtName, CourtType: row.CourtType,
		StartTime: row.StartTime, EndTime: row.EndTime, Price: row.Price, Booked: row.Booked,
		CustomerType: customerType, DisplayColor: displayColor, Status: status,
	}
}

func (s *CourtService) EnsureDaySlots(day time.Time, intervalMin int) error {
	if intervalMin <= 0 {
		intervalMin = 30
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
		rules, err := s.priceRules.ListActiveForCourtAndDate(court.ID, day)
		if err != nil {
			return err
		}

		existing, err := s.slots.ListByCourtAndDate(court.ID, day)
		if err != nil {
			return err
		}
		existingStart := make(map[int64]models.TimeSlot, len(existing))
		for _, slot := range existing {
			existingStart[slot.StartTime.Unix()] = slot
		}

		missing := make([]models.TimeSlot, 0, int(end.Sub(start)/(time.Duration(intervalMin)*time.Minute)))
		for cur := start; cur.Add(time.Duration(intervalMin)*time.Minute).Compare(end) <= 0; cur = cur.Add(time.Duration(intervalMin) * time.Minute) {
			next := cur.Add(time.Duration(intervalMin) * time.Minute)
			if _, ok := existingStart[cur.Unix()]; ok {
				continue
			}
			price := s.priceForSlot(court, cur, rules)
			missing = append(missing, models.TimeSlot{CourtID: court.ID, StartTime: cur, EndTime: next, Price: price})
		}
		if err := s.slots.BulkCreate(missing); err != nil {
			return err
		}

		// Only unbooked current/future slots are repriced. Booking totals remain
		// immutable snapshots of the price accepted at booking time.
		if err := s.repriceFutureUnbooked(court.ID, timeutil.Now()); err != nil {
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
