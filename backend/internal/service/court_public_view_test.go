package service

import (
	"testing"
	"time"

	"badminton-platform/backend/internal/repository"
)

func TestPublicSlotDayViewKeepsOnlyPublicBookingState(t *testing.T) {
	customerType := "monthly"
	customerName := "Private Customer"
	customerPhone := "0900000000"
	bookingCode := "BK-PRIVATE"
	row := repository.SlotDayView{
		ID:            10,
		CourtID:       3,
		CourtName:     "Sân 3",
		CourtType:     "vip",
		StartTime:     time.Date(2026, 9, 25, 19, 30, 0, 0, time.UTC),
		EndTime:       time.Date(2026, 9, 25, 20, 0, 0, 0, time.UTC),
		Price:         120000,
		Booked:        true,
		BookingCode:   &bookingCode,
		CustomerName:  &customerName,
		CustomerPhone: &customerPhone,
		CustomerType:  &customerType,
		Status:        "confirmed",
	}

	got := toPublicSlotDayView(row)
	if !got.Booked || got.Status != "confirmed" {
		t.Fatalf("expected confirmed booked slot, got booked=%v status=%q", got.Booked, got.Status)
	}
	if got.CustomerType != "monthly" {
		t.Fatalf("expected public customer category monthly, got %q", got.CustomerType)
	}
}

func TestPublicSlotDayViewMarksFreeSlotAvailable(t *testing.T) {
	row := repository.SlotDayView{ID: 11, Booked: false, Status: "available"}
	got := toPublicSlotDayView(row)
	if got.Booked || got.Status != "available" || got.CustomerType != "" {
		t.Fatalf("unexpected public free-slot view: %+v", got)
	}
}
