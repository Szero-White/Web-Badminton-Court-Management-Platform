package models

import "time"

type Court struct {
	ID            uint       `gorm:"primaryKey" json:"id"`
	Name          string     `gorm:"size:80;uniqueIndex;not null" json:"name"`
	CourtType     string     `gorm:"size:20;not null" json:"court_type"`
	OpenTime      string     `gorm:"size:5;not null" json:"open_time"`
	CloseTime     string     `gorm:"size:5;not null" json:"close_time"`
	BasePrice     int64      `gorm:"not null" json:"base_price"`
	IsActive      bool       `gorm:"default:true;index" json:"is_active"`
	IsMaintenance bool       `gorm:"default:false;index" json:"is_maintenance"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
	TimeSlots     []TimeSlot `json:"-"`
}

type TimeSlot struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	CourtID   uint      `gorm:"index:idx_timeslot_court_start,priority:1;not null" json:"court_id"`
	Court     Court     `json:"court"`
	StartTime time.Time `gorm:"index;index:idx_timeslot_court_start,priority:2;not null" json:"start_time"`
	EndTime   time.Time `gorm:"not null" json:"end_time"`
	Price     int64     `gorm:"not null" json:"price"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
