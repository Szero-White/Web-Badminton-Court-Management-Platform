package timeutil

import (
	"fmt"
	"time"
	_ "time/tzdata"
)

const DateLayout = "2006-01-02"

var location = mustLoadLocation("Asia/Ho_Chi_Minh")

func mustLoadLocation(name string) *time.Location {
	loc, err := time.LoadLocation(name)
	if err != nil {
		panic(fmt.Sprintf("load timezone %s: %v", name, err))
	}
	return loc
}

func Location() *time.Location { return location }

func Now() time.Time { return time.Now().In(location) }

func ParseDate(value string) (time.Time, error) {
	return time.ParseInLocation(DateLayout, value, location)
}

func StartOfDay(value time.Time) time.Time {
	local := value.In(location)
	return time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, location)
}
