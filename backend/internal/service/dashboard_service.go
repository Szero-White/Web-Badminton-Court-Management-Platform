package service

import (
	"time"

	"badminton-platform/backend/internal/repository"
)

type DashboardService struct {
	bookings     *repository.BookingRepository
	payments     *repository.PaymentRepository
	transactions *repository.TransactionRepository
}

type DashboardSummary struct {
	From           time.Time                      `json:"from"`
	To             time.Time                      `json:"to"`
	BookingIncome  int64                          `json:"booking_income"`
	BeverageIncome int64                          `json:"beverage_income"`
	GrossIncome    int64                          `json:"gross_income"`
	CashIncome     int64                          `json:"cash_income"`
	TransferIncome int64                          `json:"transfer_income"`
	Refunds        int64                          `json:"refunds"`
	StockInCost    int64                          `json:"stock_in_cost"`
	OwnerWithdraw  int64                          `json:"owner_withdraw"`
	NetRevenue     int64                          `json:"net_revenue"`
	CashBalance    int64                          `json:"cash_balance"`
	BookedValue    int64                          `json:"booked_value"`
	OutstandingDue int64                          `json:"outstanding_due"`
	BookedSlots    int64                          `json:"booked_slots"`
	TotalSlots     int64                          `json:"total_slots"`
	CanceledSlots  int64                          `json:"canceled_slots"`
	OccupancyRate  float64                        `json:"occupancy_rate"`
	CourtBreakdown []repository.CourtRangeSummary `json:"court_breakdown"`
}

func NewDashboardService(bookings *repository.BookingRepository, payments *repository.PaymentRepository, transactions *repository.TransactionRepository) *DashboardService {
	return &DashboardService{bookings: bookings, payments: payments, transactions: transactions}
}

func (s *DashboardService) SummaryRange(start, end time.Time) (*DashboardSummary, error) {
	payment, err := s.payments.SummaryByRange(start, end)
	if err != nil {
		return nil, err
	}
	transaction, err := s.transactions.SummaryByRange(start, end)
	if err != nil {
		return nil, err
	}
	booking, err := s.bookings.RangeSummary(start, end)
	if err != nil {
		return nil, err
	}
	courts, err := s.bookings.CourtRangeSummaries(start, end)
	if err != nil {
		return nil, err
	}

	bookingIncome := payment.Income
	beverageIncome := transaction.SalesIncome
	grossIncome := bookingIncome + beverageIncome
	refunds := payment.Refund + nonNegative(-transaction.RefundSum)
	stockInCost := nonNegative(-transaction.StockInCostSum)
	ownerWithdraw := nonNegative(-transaction.OwnerWithdrawSum)
	cashIncome := payment.Cash + transaction.CashSales
	transferIncome := payment.Transfer + transaction.TransferSales
	netRevenue := grossIncome - refunds - stockInCost
	cashBalance := cashIncome - refunds - stockInCost - ownerWithdraw
	occupancy := 0.0
	if booking.TotalSlots > 0 {
		occupancy = float64(booking.BookedSlots) / float64(booking.TotalSlots) * 100
	}

	return &DashboardSummary{
		From: start, To: end,
		BookingIncome: bookingIncome, BeverageIncome: beverageIncome, GrossIncome: grossIncome,
		CashIncome: cashIncome, TransferIncome: transferIncome, Refunds: refunds,
		StockInCost: stockInCost, OwnerWithdraw: ownerWithdraw, NetRevenue: netRevenue, CashBalance: cashBalance,
		BookedValue: booking.BookedValue, OutstandingDue: booking.OutstandingDue,
		BookedSlots: booking.BookedSlots, TotalSlots: booking.TotalSlots, CanceledSlots: booking.CanceledSlots,
		OccupancyRate: occupancy, CourtBreakdown: courts,
	}, nil
}
