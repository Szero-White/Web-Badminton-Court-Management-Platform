package pricing

import (
	"testing"
	"time"

	"badminton-platform/backend/internal/models"
)

func TestResolveRulePriceUsesHighestPriorityMatchingRule(t *testing.T) {
	start := time.Date(2026, 9, 26, 18, 0, 0, 0, time.FixedZone("ICT", 7*3600)) // Saturday
	rules := []models.CourtPriceRule{
		{ID: 1, DaysMask: 1 << 5, StartTime: "17:00", EndTime: "22:00", Price: 120000, Priority: 100, IsActive: true},
		{ID: 2, DaysMask: 1 << 5, StartTime: "18:00", EndTime: "20:00", Price: 150000, Priority: 200, IsActive: true},
	}
	if got := ResolveRulePrice(80000, start, rules); got != 150000 {
		t.Fatalf("expected 150000, got %d", got)
	}
}

func TestResolveRulePriceFallsBackToBasePrice(t *testing.T) {
	start := time.Date(2026, 9, 28, 10, 0, 0, 0, time.FixedZone("ICT", 7*3600)) // Monday
	rules := []models.CourtPriceRule{
		{ID: 1, DaysMask: 1 << 5, StartTime: "17:00", EndTime: "22:00", Price: 120000, Priority: 100, IsActive: true},
	}
	if got := ResolveRulePrice(80000, start, rules); got != 80000 {
		t.Fatalf("expected base price 80000, got %d", got)
	}
}
