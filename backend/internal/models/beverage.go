package models

import "time"

type Beverage struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"size:120;uniqueIndex;not null" json:"name"`
	Price       int64     `gorm:"not null" json:"price"`
	Stock       int       `gorm:"not null;default:0" json:"stock"`
	Unit        string    `gorm:"size:20;not null;default:'chai'" json:"unit"`
	Description string    `gorm:"size:255" json:"description"`
	IsActive    bool      `gorm:"default:true;index" json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
