package pricing

import (
	"testing"
	"time"
)

func TestCourtSlotPrice(t *testing.T) {
	base := int64(80000)
	location := time.FixedZone("ICT", 7*60*60)

	tests := []struct {
		name string
		hour int
		want int64
	}{
		{name: "before peak", hour: 16, want: 80000},
		{name: "peak starts", hour: 17, want: 96000},
		{name: "inside peak", hour: 20, want: 96000},
		{name: "peak ends", hour: 21, want: 80000},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			start := time.Date(2026, time.September, 25, tt.hour, 0, 0, 0, location)
			got := CourtSlotPrice(base, start, DefaultPeakStartHour, DefaultPeakEndHour, DefaultPeakMultiplier)
			if got != tt.want {
				t.Fatalf("CourtSlotPrice() = %d, want %d", got, tt.want)
			}
		})
	}
}
