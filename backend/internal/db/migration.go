package db

import (
	"badminton-platform/backend/internal/models"

	"gorm.io/gorm"
)

func migrateSchema(connection *gorm.DB) error {
	if err := connection.AutoMigrate(
		&models.User{},
		&models.Court{},
		&models.TimeSlot{},
		&models.Booking{},
		&models.Payment{},
		&models.Beverage{},
		&models.Transaction{},
		&models.AuditLog{},
	); err != nil {
		return err
	}

	// Database-level protection against double-booking remains authoritative even
	// when several API requests arrive at the same time.
	if err := connection.Exec(`
		CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_unique_slot_active
		ON bookings(time_slot_id)
		WHERE status IN ('pending','confirmed','checked_in','completed')`).Error; err != nil {
		return err
	}

	return nil
}
