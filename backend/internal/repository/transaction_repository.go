package repository

import (
	"time"

	"badminton-platform/backend/internal/models"

	"gorm.io/gorm"
)

type TransactionRepository struct{ db *gorm.DB }

type ShiftTransactionSummary struct {
	SalesIncome      int64
	CashSales        int64
	TransferSales    int64
	RefundSum        int64
	StockInCostSum   int64
	OwnerWithdrawSum int64
}

func (r *TransactionRepository) Create(transaction *models.Transaction) error {
	return r.db.Create(transaction).Error
}

func (r *TransactionRepository) ListByStaffShiftAndDate(staffID uint, shift string, day time.Time) ([]models.Transaction, error) {
	dayKey := day.Format("2006-01-02")
	var transactions []models.Transaction
	err := r.db.Where("staff_id = ? AND shift = ? AND DATE(business_date) = ?", staffID, shift, dayKey).
		Order("created_at DESC").
		Find(&transactions).Error
	return transactions, err
}

func (r *TransactionRepository) SummaryByStaffShiftAndDate(staffID uint, shift string, day time.Time) (ShiftTransactionSummary, error) {
	dayKey := day.Format("2006-01-02")
	var row ShiftTransactionSummary
	err := r.db.Model(&models.Transaction{}).
		Where("staff_id = ? AND shift = ? AND DATE(business_date) = ?", staffID, shift, dayKey).
		Select(`
			COALESCE(SUM(CASE WHEN type = 'sale' THEN amount ELSE 0 END), 0) AS sales_income,
			COALESCE(SUM(CASE WHEN type = 'sale' AND payment_method = 'cash' THEN amount ELSE 0 END), 0) AS cash_sales,
			COALESCE(SUM(CASE WHEN type = 'sale' AND payment_method = 'transfer' THEN amount ELSE 0 END), 0) AS transfer_sales,
			COALESCE(SUM(CASE WHEN type = 'refund' THEN amount ELSE 0 END), 0) AS refund_sum,
			COALESCE(SUM(CASE WHEN type = 'stock_in' THEN amount ELSE 0 END), 0) AS stock_in_cost_sum,
			COALESCE(SUM(CASE WHEN type = 'owner_withdraw' THEN amount ELSE 0 END), 0) AS owner_withdraw_sum`).
		Scan(&row).Error
	return row, err
}

func (r *TransactionRepository) SummaryByRange(start, end time.Time) (ShiftTransactionSummary, error) {
	var row ShiftTransactionSummary
	err := r.db.Model(&models.Transaction{}).
		Where("created_at >= ? AND created_at < ?", start, end).
		Select(`
			COALESCE(SUM(CASE WHEN type = 'sale' THEN amount ELSE 0 END), 0) AS sales_income,
			COALESCE(SUM(CASE WHEN type = 'sale' AND payment_method = 'cash' THEN amount ELSE 0 END), 0) AS cash_sales,
			COALESCE(SUM(CASE WHEN type = 'sale' AND payment_method = 'transfer' THEN amount ELSE 0 END), 0) AS transfer_sales,
			COALESCE(SUM(CASE WHEN type = 'refund' THEN amount ELSE 0 END), 0) AS refund_sum,
			COALESCE(SUM(CASE WHEN type = 'stock_in' THEN amount ELSE 0 END), 0) AS stock_in_cost_sum,
			COALESCE(SUM(CASE WHEN type = 'owner_withdraw' THEN amount ELSE 0 END), 0) AS owner_withdraw_sum`).
		Scan(&row).Error
	return row, err
}

func nonNegative(value int64) int64 {
	if value < 0 {
		return 0
	}
	return value
}
