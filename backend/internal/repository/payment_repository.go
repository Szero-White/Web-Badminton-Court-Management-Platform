package repository

import (
	"time"

	"badminton-platform/backend/internal/models"

	"gorm.io/gorm"
)

type PaymentRepository struct{ db *gorm.DB }

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
