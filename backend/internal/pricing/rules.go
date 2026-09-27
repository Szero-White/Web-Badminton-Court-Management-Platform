package pricing

import (
	"strings"
	"time"

	"badminton-platform/backend/internal/models"
)

const AllWeekdaysMask = 0b1111111

func WeekdayBit(day time.Weekday) int {
	switch day {
	case time.Monday:
		return 1 << 0
	case time.Tuesday:
		return 1 << 1
	case time.Wednesday:
		return 1 << 2
	case time.Thursday:
		return 1 << 3
	case time.Friday:
		return 1 << 4
	case time.Saturday:
		return 1 << 5
	case time.Sunday:
		return 1 << 6
	default:
		return 0
	}
}

// ResolveRulePrice applies the highest-priority matching rule. The input rules
// should already be filtered to active/effective rules for the requested day.
// Base price is the authoritative fallback when no rule matches.
func ResolveRulePrice(basePrice int64, start time.Time, rules []models.CourtPriceRule) int64 {
	bit := WeekdayBit(start.Weekday())
	clock := start.Format("15:04")
	bestPriority := -1 << 30
	bestID := uint(0)
	price := basePrice

	for _, rule := range rules {
		if !rule.IsActive || rule.DaysMask&bit == 0 {
			continue
		}
		if strings.Compare(clock, rule.StartTime) < 0 || strings.Compare(clock, rule.EndTime) >= 0 {
			continue
		}
		if rule.Priority > bestPriority || (rule.Priority == bestPriority && rule.ID > bestID) {
			bestPriority = rule.Priority
			bestID = rule.ID
			price = rule.Price
		}
	}
	return price
}
