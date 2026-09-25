package pricing

import "time"

const (
	DefaultPeakStartHour  = 17
	DefaultPeakEndHour    = 21
	DefaultPeakMultiplier = 1.2
)

// CourtSlotPrice returns the price for one slot using the configured base price
// and peak-hour policy. Bookings snapshot this value at creation time, so later
// court price changes never rewrite historical booking totals.
func CourtSlotPrice(basePrice int64, start time.Time, peakStart, peakEnd int, peakMultiplier float64) int64 {
	if peakMultiplier <= 0 {
		peakMultiplier = 1
	}
	if start.Hour() >= peakStart && start.Hour() < peakEnd {
		return int64(float64(basePrice) * peakMultiplier)
	}
	return basePrice
}
