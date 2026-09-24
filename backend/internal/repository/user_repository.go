package repository

import (
	"strings"

	"badminton-platform/backend/internal/models"

	"gorm.io/gorm"
)

type UserRepository struct{ db *gorm.DB }

func (r *UserRepository) WithTx(tx *gorm.DB) *UserRepository {
	return &UserRepository{db: tx}
}

func (r *UserRepository) Create(user *models.User) error {
	return r.db.Create(user).Error
}

func (r *UserRepository) FindByEmail(email string) (*models.User, error) {
	var user models.User
	err := r.db.Where("LOWER(email) = ?", strings.ToLower(strings.TrimSpace(email))).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) FindByPhone(phone string) (*models.User, error) {
	var user models.User
	err := r.db.Where("phone = ?", strings.TrimSpace(phone)).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) FindByID(id uint) (*models.User, error) {
	var user models.User
	if err := r.db.First(&user, id).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) Update(user *models.User) error {
	return r.db.Save(user).Error
}

// ListStaff returns operator accounts managed from the staff administration screen.
// Admin accounts are included so promoted staff do not disappear from that screen.
func (r *UserRepository) ListStaff() ([]models.User, error) {
	var users []models.User
	err := r.db.Where("role IN ?", []models.Role{models.RoleStaff, models.RoleAdmin}).
		Order("full_name asc").
		Find(&users).Error
	return users, err
}

func (r *UserRepository) CountByRole(role models.Role) (int64, error) {
	var count int64
	err := r.db.Model(&models.User{}).Where("role = ?", role).Count(&count).Error
	return count, err
}

func (r *UserRepository) Delete(id uint) error {
	return r.db.Delete(&models.User{}, id).Error
}
