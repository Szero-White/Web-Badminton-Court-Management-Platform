package models

import "time"

// CourtPriceRule defines one configurable price window for a court.
// DaysMask uses bit 0=Monday ... bit 6=Sunday. Higher Priority wins when
// multiple active rules match the same slot. Rules at the same priority may
// not overlap in day/time/effective-date coverage.
type CourtPriceRule struct {
	ID            uint       `gorm:"primaryKey" json:"id"`
	CourtID       uint       `gorm:"not null;index:idx_price_rule_court_active,priority:1;index" json:"court_id"`
	Name          string     `gorm:"size:120;not null" json:"name"`
	DaysMask      int        `gorm:"not null" json:"days_mask"`
	StartTime     string     `gorm:"size:5;not null" json:"start_time"`
	EndTime       string     `gorm:"size:5;not null" json:"end_time"`
	Price         int64      `gorm:"not null" json:"price"`
	Priority      int        `gorm:"not null;default:100;index" json:"priority"`
	EffectiveFrom *time.Time `gorm:"type:date" json:"effective_from,omitempty"`
	EffectiveTo   *time.Time `gorm:"type:date" json:"effective_to,omitempty"`
	IsActive      bool       `gorm:"not null;default:true;index:idx_price_rule_court_active,priority:2" json:"is_active"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}
