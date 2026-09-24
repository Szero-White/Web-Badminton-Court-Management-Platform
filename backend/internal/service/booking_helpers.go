package service

import (
	"fmt"
	"strings"
	"time"
)

func combineBookingNote(startAt, endAt time.Time, notes string) string {
	base := fmt.Sprintf("Đặt từ %s đến %s", formatBookingClock(startAt), formatBookingClock(endAt))
	notes = strings.TrimSpace(notes)
	if notes == "" {
		return base
	}
	return base + " | Ghi chú: " + notes
}

func formatBookingClock(at time.Time) string {
	location, err := time.LoadLocation("Asia/Ho_Chi_Minh")
	if err != nil {
		return at.Local().Format("15:04")
	}
	return at.In(location).Format("15:04")
}
