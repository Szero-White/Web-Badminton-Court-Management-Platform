package db

import (
	"log"

	"badminton-platform/backend/internal/models"

	"github.com/redis/go-redis/v9"
	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func ConnectPostgres(dsn string) (*gorm.DB, error) {
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return nil, err
	}

	err = migrateSchema(db)
	if err != nil {
		return nil, err
	}

	log.Println("postgres connected")
	return db, nil
}

func ConnectSQLite(path string) (*gorm.DB, error) {
	db, err := gorm.Open(sqlite.Open(path), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return nil, err
	}

	err = migrateSchema(db)
	if err != nil {
		return nil, err
	}

	log.Printf("sqlite connected at %s", path)
	return db, nil
}

func migrateSchema(db *gorm.DB) error {
	err := db.AutoMigrate(
		&models.User{},
		&models.Court{},
		&models.TimeSlot{},
		&models.Booking{},
		&models.Payment{},
		&models.Beverage{},
		&models.Transaction{},
		&models.Promotion{},
		&models.Membership{},
		&models.AuditLog{},
	)
	if err != nil {
		return err
	}

	err = db.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_unique_slot_active ON bookings(time_slot_id) WHERE status IN ('pending','confirmed','checked_in','completed')").Error
	if err != nil {
		return err
	}

	return nil
}

func ConnectRedis(addr, password string, dbIndex int) *redis.Client {
	client := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       dbIndex,
	})
	return client
}
