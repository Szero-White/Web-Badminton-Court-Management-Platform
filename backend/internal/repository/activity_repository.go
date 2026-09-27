package repository

import (
	"time"

	"badminton-platform/backend/internal/models"

	"gorm.io/gorm"
)

type ActivityFilter struct {
	ActorID uint
	From    *time.Time
	To      *time.Time
}

type ActivityRepository struct{ db *gorm.DB }

func (r *ActivityRepository) auditQuery(filter ActivityFilter) *gorm.DB {
	query := r.db.Model(&models.AuditLog{})
	if filter.ActorID > 0 {
		query = query.Where("actor_id = ?", filter.ActorID)
	}
	if filter.From != nil {
		query = query.Where("created_at >= ?", *filter.From)
	}
	if filter.To != nil {
		query = query.Where("created_at < ?", *filter.To)
	}
	return query
}

func (r *ActivityRepository) ListAuditLogs(filter ActivityFilter) ([]models.AuditLog, error) {
	var logs []models.AuditLog
	err := r.auditQuery(filter).Order("created_at DESC").Limit(1000).Find(&logs).Error
	return logs, err
}

func (r *ActivityRepository) ListTransactions(filter ActivityFilter) ([]models.Transaction, error) {
	var rows []models.Transaction
	query := r.db.Model(&models.Transaction{})
	if filter.ActorID > 0 {
		query = query.Where("staff_id = ?", filter.ActorID)
	}
	if filter.From != nil {
		query = query.Where("created_at >= ?", *filter.From)
	}
	if filter.To != nil {
		query = query.Where("created_at < ?", *filter.To)
	}
	err := query.Order("created_at DESC").Limit(1000).Find(&rows).Error
	return rows, err
}

func (r *ActivityRepository) ListPayments(filter ActivityFilter) ([]models.Payment, error) {
	var rows []models.Payment
	query := r.db.Model(&models.Payment{})
	if filter.ActorID > 0 {
		query = query.Where("actor_id = ?", filter.ActorID)
	}
	if filter.From != nil {
		query = query.Where("created_at >= ?", *filter.From)
	}
	if filter.To != nil {
		query = query.Where("created_at < ?", *filter.To)
	}
	err := query.Order("created_at DESC").Limit(1000).Find(&rows).Error
	return rows, err
}

type ActivityActor struct {
	ID       uint        `json:"id"`
	FullName string      `json:"full_name"`
	Role     models.Role `json:"role"`
	Deleted  bool        `json:"deleted"`
}

func (r *ActivityRepository) ListActorsIncludingDeleted() ([]ActivityActor, error) {
	var users []models.User
	if err := r.db.Unscoped().Where("role IN ?", []models.Role{models.RoleStaff, models.RoleAdmin}).Order("full_name asc").Find(&users).Error; err != nil {
		return nil, err
	}
	rows := make([]ActivityActor, 0, len(users))
	for _, user := range users {
		rows = append(rows, ActivityActor{ID: user.ID, FullName: user.FullName, Role: user.Role, Deleted: user.DeletedAt.Valid})
	}
	return rows, nil
}

func (r *ActivityRepository) FindActorsIncludingDeleted(ids []uint) (map[uint]models.User, error) {
	result := map[uint]models.User{}
	if len(ids) == 0 {
		return result, nil
	}
	var users []models.User
	if err := r.db.Unscoped().Where("id IN ?", ids).Find(&users).Error; err != nil {
		return nil, err
	}
	for _, user := range users {
		result[user.ID] = user
	}
	return result, nil
}
