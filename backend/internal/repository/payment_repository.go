package repository

import (
	"time"

	"badminton-platform/backend/internal/models"

	"gorm.io/gorm"
)

type PaymentRepository struct{ db *gorm.DB }

type PaymentSummary struct {
	Income   int64
	Cash     int64
	Transfer int64
	Refund   int64
}

func (r *PaymentRepository) WithTx(tx *gorm.DB) *PaymentRepository {
	return &PaymentRepository{db: tx}
}

func (r *PaymentRepository) Create(payment *models.Payment) error {
	return r.db.Create(payment).Error
}

func (r *PaymentRepository) RevenueByRange(start, end time.Time) (int64, error) {
	var revenue int64
	err := r.db.Model(&models.Payment{}).
		Where("status = ? AND created_at >= ? AND created_at <= ?", "success", start, end).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&revenue).Error
	return revenue, err
}

func (r *PaymentRepository) ListByActorShiftAndDate(actorID uint, shift string, day time.Time) ([]models.Payment, error) {
	dayKey := day.Format("2006-01-02")
	var payments []models.Payment
	err := r.db.
		Where("status = ? AND actor_id = ? AND shift = ? AND DATE(business_date) = ?", "success", actorID, shift, dayKey).
		Preload("Booking").
		Order("created_at DESC").
		Find(&payments).Error
	return payments, err
}

func (r *PaymentRepository) SummaryByActorShiftAndDate(actorID uint, shift string, day time.Time) (PaymentSummary, error) {
	dayKey := day.Format("2006-01-02")
	var row PaymentSummary
	err := r.db.Model(&models.Payment{}).
		Where("status = ? AND actor_id = ? AND shift = ? AND DATE(business_date) = ?", "success", actorID, shift, dayKey).
		Select(`
			COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS income,
			COALESCE(SUM(CASE WHEN amount > 0 AND method = 'cash' THEN amount ELSE 0 END), 0) AS cash,
			COALESCE(SUM(CASE WHEN amount > 0 AND method = 'transfer' THEN amount ELSE 0 END), 0) AS transfer,
			COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0) AS refund`).
		Scan(&row).Error
	return row, err
}

func (r *PaymentRepository) SummaryByRange(start, end time.Time) (PaymentSummary, error) {
	var row PaymentSummary
	err := r.db.Model(&models.Payment{}).
		Where("status = ? AND created_at >= ? AND created_at < ?", "success", start, end).
		Select(`
			COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS income,
			COALESCE(SUM(CASE WHEN amount > 0 AND method = 'cash' THEN amount ELSE 0 END), 0) AS cash,
			COALESCE(SUM(CASE WHEN amount > 0 AND method = 'transfer' THEN amount ELSE 0 END), 0) AS transfer,
			COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0) AS refund`).
		Scan(&row).Error
	return row, err
}
