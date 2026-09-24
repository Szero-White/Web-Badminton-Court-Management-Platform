package models

import "time"

type AuditLog struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	ActorID    uint      `gorm:"index" json:"actor_id"`
	Action     string    `gorm:"size:100;not null;index" json:"action"`
	TargetType string    `gorm:"size:100;not null;index:idx_audit_target,priority:1" json:"target_type"`
	TargetID   string    `gorm:"size:100;not null;index:idx_audit_target,priority:2" json:"target_id"`
	Payload    string    `gorm:"type:text" json:"payload"`
	CreatedAt  time.Time `gorm:"index" json:"created_at"`
}
