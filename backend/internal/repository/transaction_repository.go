package repository

import (
	"badminton-platform/backend/internal/models"

	"gorm.io/gorm"
)

type TransactionRepository struct{ db *gorm.DB }

func (r *TransactionRepository) Create(transaction *models.Transaction) error {
	return r.db.Create(transaction).Error
}

func (r *TransactionRepository) ListByStaffAndShift(staffID uint, shift string) ([]models.Transaction, error) {
	var transactions []models.Transaction
	err := r.db.Where("staff_id = ? AND shift = ?", staffID, shift).
		Order("created_at DESC").
		Find(&transactions).Error
	return transactions, err
}

func (r *TransactionRepository) SummaryByStaffAndShift(staffID uint, shift string) (map[string]interface{}, error) {
	type totals struct {
		SalesIncome      int64
		CashSales        int64
		TransferSales    int64
		RefundSum        int64
		StockInCostSum   int64
		OwnerWithdrawSum int64
	}
	var row totals
	err := r.db.Model(&models.Transaction{}).
		Where("staff_id = ? AND shift = ?", staffID, shift).
		Select(`
			COALESCE(SUM(CASE WHEN type = 'sale' THEN amount ELSE 0 END), 0) AS sales_income,
			COALESCE(SUM(CASE WHEN type = 'sale' AND payment_method = 'cash' THEN amount ELSE 0 END), 0) AS cash_sales,
			COALESCE(SUM(CASE WHEN type = 'sale' AND payment_method = 'transfer' THEN amount ELSE 0 END), 0) AS transfer_sales,
			COALESCE(SUM(CASE WHEN type = 'refund' THEN amount ELSE 0 END), 0) AS refund_sum,
			COALESCE(SUM(CASE WHEN type = 'stock_in' THEN amount ELSE 0 END), 0) AS stock_in_cost_sum,
			COALESCE(SUM(CASE WHEN type = 'owner_withdraw' THEN amount ELSE 0 END), 0) AS owner_withdraw_sum`).
		Scan(&row).Error
	if err != nil {
		return nil, err
	}

	refundOut := nonNegative(-row.RefundSum)
	stockInCost := nonNegative(-row.StockInCostSum)
	ownerWithdraw := nonNegative(-row.OwnerWithdrawSum)
	netRevenue := row.SalesIncome - refundOut - stockInCost
	cashBalance := row.CashSales - refundOut - stockInCost - ownerWithdraw

	return map[string]interface{}{
		"income":         row.SalesIncome,
		"cash":           row.CashSales,
		"transfer":       row.TransferSales,
		"refund":         refundOut,
		"stock_in_cost":  stockInCost,
		"owner_withdraw": ownerWithdraw,
		"net_revenue":    netRevenue,
		"cash_balance":   cashBalance,
		"total":          netRevenue,
	}, nil
}

func nonNegative(value int64) int64 {
	if value < 0 {
		return 0
	}
	return value
}
