package repository

import (
	"badminton-platform/backend/internal/models"

	"gorm.io/gorm"
)

type CourtRepository struct{ db *gorm.DB }

func (r *CourtRepository) Create(court *models.Court) error {
	return r.db.Create(court).Error
}

func (r *CourtRepository) ListActive() ([]models.Court, error) {
	var courts []models.Court
	err := r.db.Where("is_active = ?", true).Order("id asc").Find(&courts).Error
	return courts, err
}

func (r *CourtRepository) ListAll() ([]models.Court, error) {
	var courts []models.Court
	err := r.db.Order("id asc").Find(&courts).Error
	return courts, err
}

func (r *CourtRepository) FindByID(id uint) (*models.Court, error) {
	var court models.Court
	if err := r.db.First(&court, id).Error; err != nil {
		return nil, err
	}
	return &court, nil
}

func (r *CourtRepository) Update(court *models.Court) error {
	return r.db.Save(court).Error
}
