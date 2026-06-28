package service

import (
	"time"

	"badminton-platform/backend/internal/repository"
)

type DashboardService struct {
	bookings *repository.BookingRepository
	payments *repository.PaymentRepository
}

type DashboardSummary struct {
	DailyRevenue   int64            `json:"daily_revenue"`
	WeeklyRevenue  int64            `json:"weekly_revenue"`
	MonthlyRevenue int64            `json:"monthly_revenue"`
	Occupancy      map[uint]float64 `json:"occupancy_by_court"`
	PeakHours      map[int]int64    `json:"peak_hours"`
	CancelRate     float64          `json:"cancel_rate"`
}

func NewDashboardService(bookings *repository.BookingRepository, payments *repository.PaymentRepository) *DashboardService {
	return &DashboardService{bookings: bookings, payments: payments}
}

func (s *DashboardService) Summary(now time.Time) (*DashboardSummary, error) {
	dayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	weekStart := dayStart.AddDate(0, 0, -int(now.Weekday()))
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	dailyRevenue, err := s.payments.RevenueByRange(dayStart, now)
	if err != nil {
		return nil, err
	}
	weeklyRevenue, err := s.payments.RevenueByRange(weekStart, now)
	if err != nil {
		return nil, err
	}
	monthlyRevenue, err := s.payments.RevenueByRange(monthStart, now)
	if err != nil {
		return nil, err
	}
	occupancy, err := s.bookings.OccupancyByCourt(now)
	if err != nil {
		return nil, err
	}
	peakHours, err := s.bookings.PeakHours(now)
	if err != nil {
		return nil, err
	}
	cancelRate, err := s.bookings.CancellationRate()
	if err != nil {
		return nil, err
	}

	return &DashboardSummary{
		DailyRevenue:   dailyRevenue,
		WeeklyRevenue:  weeklyRevenue,
		MonthlyRevenue: monthlyRevenue,
		Occupancy:      occupancy,
		PeakHours:      peakHours,
		CancelRate:     cancelRate,
	}, nil
}
