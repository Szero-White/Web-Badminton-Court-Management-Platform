package service

import (
	"badminton-platform/backend/internal/models"
	"badminton-platform/backend/internal/repository"
)

type BeverageService struct {
	repo *repository.BeverageRepository
}

func NewBeverageService(repo *repository.BeverageRepository) *BeverageService {
	return &BeverageService{repo: repo}
}

func (s *BeverageService) Create(name string, price int64, stock int, unit, description string) (*models.Beverage, error) {
	drink := &models.Beverage{
		Name:        name,
		Price:       price,
		Stock:       stock,
		Unit:        unit,
		Description: description,
		IsActive:    true,
	}
	if err := s.repo.Create(drink); err != nil {
		return nil, err
	}
	return drink, nil
}

func (s *BeverageService) ListActive() ([]models.Beverage, error) {
	return s.repo.ListActive()
}

func (s *BeverageService) UpdateByAdmin(adminID, beverageID uint, name *string, price *int64, stock *int, unit, description *string, note string) (*models.Beverage, error) {
	return s.repo.UpdateByAdmin(adminID, beverageID, name, price, stock, unit, description, note)
}

func (s *BeverageService) DeleteByAdmin(adminID, beverageID uint, note string) error {
	return s.repo.DeleteByAdmin(adminID, beverageID, note)
}

func (s *BeverageService) AdjustStockByAdmin(adminID, beverageID uint, delta int, note string) (*models.Beverage, error) {
	return s.repo.AdjustStockByAdmin(adminID, beverageID, delta, note)
}

func (s *BeverageService) HistoryByAdmin(beverageID uint, limit int) ([]repository.BeverageEditLog, error) {
	return s.repo.ListEditHistory(beverageID, limit)
}

func (s *BeverageService) Sell(staffID, beverageID uint, qty int, paymentMethod, shift, notes string) (*models.Transaction, *models.Beverage, error) {
	if shift == "" {
		shift = GetCurrentShift()
	}
	return s.repo.Sell(staffID, beverageID, qty, paymentMethod, shift, notes)
}

func (s *BeverageService) Restock(staffID, beverageID uint, qty int, costAmount int64, paymentMethod, shift, notes string) (*models.Transaction, *models.Beverage, error) {
	if shift == "" {
		shift = GetCurrentShift()
	}
	return s.repo.Restock(staffID, beverageID, qty, costAmount, paymentMethod, shift, notes)
}
