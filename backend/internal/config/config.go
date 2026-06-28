package config

import (
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	AppPort             string
	AppEnv              string
	JWTSecret           string
	JWTAccessExpireMin  int
	JWTRefreshExpireHrs int
	BookingHoldMinutes  int
	CancelPolicyHours   int
	PostgresDSN         string
	RedisAddr           string
	RedisPassword       string
	RedisDB             int
}

func Load() (*Config, error) {
	_ = godotenv.Load()

	cfg := &Config{
		AppPort:             getEnv("APP_PORT", "8080"),
		AppEnv:              getEnv("APP_ENV", "development"),
		JWTSecret:           getEnv("JWT_SECRET", "secret"),
		JWTAccessExpireMin:  getEnvAsInt("JWT_ACCESS_EXPIRE_MIN", 30),
		JWTRefreshExpireHrs: getEnvAsInt("JWT_REFRESH_EXPIRE_HOUR", 168),
		BookingHoldMinutes:  getEnvAsInt("BOOKING_HOLD_MINUTES", 10),
		CancelPolicyHours:   getEnvAsInt("CANCEL_POLICY_HOURS", 12),
		RedisAddr:           getEnv("REDIS_ADDR", "localhost:6379"),
		RedisPassword:       getEnv("REDIS_PASSWORD", ""),
		RedisDB:             getEnvAsInt("REDIS_DB", 0),
	}

	cfg.PostgresDSN = fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		getEnv("POSTGRES_HOST", "localhost"),
		getEnv("POSTGRES_PORT", "5432"),
		getEnv("POSTGRES_USER", "postgres"),
		getEnv("POSTGRES_PASSWORD", "postgres"),
		getEnv("POSTGRES_DB", "badminton"),
		getEnv("POSTGRES_SSLMODE", "disable"),
	)

	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("JWT_SECRET is required")
	}

	return cfg, nil
}

func getEnv(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func getEnvAsInt(key string, fallback int) int {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}
