package db

import (
	"database/sql"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type PoolConfig struct {
	MaxOpenConns       int
	MaxIdleConns       int
	ConnMaxLifetimeMin int
}

func ConnectPostgres(dsn, appEnv string, pool PoolConfig) (*gorm.DB, error) {
	connection, err := gorm.Open(postgres.Open(dsn), gormConfig(appEnv))
	if err != nil {
		return nil, err
	}
	if err := configurePool(connection, pool); err != nil {
		return nil, err
	}
	if err := migrateSchema(connection); err != nil {
		return nil, err
	}
	log.Println("database connected: postgres")
	return connection, nil
}

func ConnectSQLite(path, appEnv string) (*gorm.DB, error) {
	connection, err := gorm.Open(sqlite.Open(path), gormConfig(appEnv))
	if err != nil {
		return nil, err
	}
	// SQLite is a development fallback only. A single writer avoids lock storms.
	if err := configurePool(connection, PoolConfig{MaxOpenConns: 1, MaxIdleConns: 1, ConnMaxLifetimeMin: 30}); err != nil {
		return nil, err
	}
	if err := migrateSchema(connection); err != nil {
		return nil, err
	}
	log.Printf("database connected: sqlite (%s)", path)
	return connection, nil
}

func ConnectRedis(addr, password string, dbIndex int) *redis.Client {
	return redis.NewClient(&redis.Options{
		Addr:         addr,
		Password:     password,
		DB:           dbIndex,
		PoolSize:     20,
		MinIdleConns: 2,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	})
}

func SQLDB(connection *gorm.DB) (*sql.DB, error) {
	return connection.DB()
}

func gormConfig(appEnv string) *gorm.Config {
	mode := logger.Warn
	if appEnv == "development" {
		mode = logger.Info
	}
	return &gorm.Config{Logger: logger.Default.LogMode(mode)}
}

func configurePool(connection *gorm.DB, pool PoolConfig) error {
	sqlDB, err := connection.DB()
	if err != nil {
		return err
	}
	sqlDB.SetMaxOpenConns(pool.MaxOpenConns)
	sqlDB.SetMaxIdleConns(pool.MaxIdleConns)
	sqlDB.SetConnMaxLifetime(time.Duration(pool.ConnMaxLifetimeMin) * time.Minute)
	sqlDB.SetConnMaxIdleTime(10 * time.Minute)
	return nil
}
