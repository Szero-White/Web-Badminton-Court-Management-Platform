package service

import "testing"

func TestAuditCategory(t *testing.T) {
	cases := map[string]string{
		"booking_canceled":               "booking",
		"booking_payment_adjusted":       "payment",
		"beverage_adjust_stock_decrease": "beverage",
		"staff_updated":                  "staff",
		"price_rule_updated":             "court",
	}
	for action, want := range cases {
		if got := auditCategory(action); got != want {
			t.Fatalf("auditCategory(%q) = %q, want %q", action, got, want)
		}
	}
}

func TestAuditSummaryForBookingLifecycle(t *testing.T) {
	for action, want := range map[string]string{
		"booking_canceled":   "Hủy booking",
		"booking_checked_in": "Check-in khách",
	} {
		if got := auditSummary(action); got != want {
			t.Fatalf("auditSummary(%q) = %q, want %q", action, got, want)
		}
	}
}
