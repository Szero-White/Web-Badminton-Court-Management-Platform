package db

import (
	"badminton-platform/backend/internal/models"

	"gorm.io/gorm"
)

func migrateSchema(connection *gorm.DB) error {
	if err := connection.AutoMigrate(
		&models.User{},
		&models.Court{},
		&models.CourtPriceRule{},
		&models.TimeSlot{},
		&models.Booking{},
		&models.Payment{},
		&models.Beverage{},
		&models.Transaction{},
		&models.AuditLog{},
	); err != nil {
		return err
	}

	// Backfill reporting dates for installations that rely on AutoMigrate rather
	// than versioned SQL migrations. New records always set this value explicitly.
	dateExpression := "DATE(created_at)"
	if connection.Dialector.Name() == "postgres" {
		dateExpression = "(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date"
	}
	if err := connection.Exec("UPDATE transactions SET business_date = " + dateExpression + " WHERE business_date IS NULL").Error; err != nil {
		return err
	}
	if err := connection.Exec("UPDATE payments SET business_date = " + dateExpression + " WHERE business_date IS NULL").Error; err != nil {
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
