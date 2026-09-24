package models

import "time"

type Transaction struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	StaffID       uint      `gorm:"index;not null" json:"staff_id"`
	Type          string    `gorm:"size:30;not null;index" json:"type"`
	Description   string    `gorm:"size:255" json:"description"`
	Amount        int64     `gorm:"not null" json:"amount"`
	PaymentMethod string    `gorm:"size:30;index" json:"payment_method"`
	Notes         string    `gorm:"type:text" json:"notes"`
	Shift         string    `gorm:"size:50;index" json:"shift"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}
