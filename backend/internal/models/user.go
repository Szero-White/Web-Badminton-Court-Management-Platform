package models

import "time"

type User struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	FullName     string    `gorm:"size:120;not null" json:"full_name"`
	Email        string    `gorm:"size:180;uniqueIndex;not null" json:"email"`
	Phone        string    `gorm:"size:30;uniqueIndex;not null" json:"phone"`
	PasswordHash string    `gorm:"size:255;not null" json:"-"`
	Role         Role      `gorm:"size:20;not null;default:'customer';index" json:"role"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
