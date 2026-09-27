package repository

import (
	"time"

	"badminton-platform/backend/internal/models"

	"gorm.io/gorm"
)

type PriceRuleRepository struct{ db *gorm.DB }

func (r *PriceRuleRepository) Create(rule *models.CourtPriceRule) error {
	return r.db.Create(rule).Error
}

func (r *PriceRuleRepository) Update(rule *models.CourtPriceRule) error {
	return r.db.Save(rule).Error
}

func (r *PriceRuleRepository) Delete(rule *models.CourtPriceRule) error {
	return r.db.Delete(rule).Error
}

func (r *PriceRuleRepository) FindByID(id uint) (*models.CourtPriceRule, error) {
	var rule models.CourtPriceRule
	if err := r.db.First(&rule, id).Error; err != nil {
		return nil, err
	}
	return &rule, nil
}

func (r *PriceRuleRepository) ListByCourt(courtID uint) ([]models.CourtPriceRule, error) {
	var rules []models.CourtPriceRule
	err := r.db.Where("court_id = ?", courtID).
		Order("priority desc, start_time asc, id asc").
		Find(&rules).Error
	return rules, err
}

func (r *PriceRuleRepository) ListActiveForCourtAndDate(courtID uint, day time.Time) ([]models.CourtPriceRule, error) {
	date := day.Format("2006-01-02")
	var rules []models.CourtPriceRule
	err := r.db.
		Where("court_id = ? AND is_active = ?", courtID, true).
		Where("(effective_from IS NULL OR effective_from <= ?)", date).
		Where("(effective_to IS NULL OR effective_to >= ?)", date).
		Order("priority desc, id desc").
		Find(&rules).Error
	return rules, err
}
