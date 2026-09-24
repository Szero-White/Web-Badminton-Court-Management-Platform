package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

const defaultDevJWTSecret = "dev-only-change-me"

type Config struct {
	AppPort              string
	AppEnv               string
	JWTSecret            string
	JWTAccessExpireMin   int
	JWTRefreshExpireHrs  int
	BookingHoldMinutes   int
	CancelPolicyHours    int
	PostgresDSN          string
	SQLitePath           string
	AllowSQLiteFallback  bool
	RedisAddr            string
	RedisPassword        string
	RedisDB              int
	RequireRedis         bool
	CORSAllowedOrigins   []string
	DBMaxOpenConns       int
	DBMaxIdleConns       int
	DBConnMaxLifetimeMin int
	HTTPReadTimeoutSec   int
	HTTPWriteTimeoutSec  int
	HTTPIdleTimeoutSec   int
	DemoSeedEnabled      bool
}

func Load() (*Config, error) {
	_ = godotenv.Load()

	cfg := &Config{
		AppPort:              getEnv("APP_PORT", "8080"),
		AppEnv:               strings.ToLower(getEnv("APP_ENV", "development")),
		JWTSecret:            getEnv("JWT_SECRET", defaultDevJWTSecret),
		JWTAccessExpireMin:   getEnvAsInt("JWT_ACCESS_EXPIRE_MIN", 30),
		JWTRefreshExpireHrs:  getEnvAsInt("JWT_REFRESH_EXPIRE_HOUR", 168),
		BookingHoldMinutes:   getEnvAsInt("BOOKING_HOLD_MINUTES", 10),
		CancelPolicyHours:    getEnvAsInt("CANCEL_POLICY_HOURS", 12),
		SQLitePath:           getEnv("SQLITE_PATH", "badminton_dev.db"),
		AllowSQLiteFallback:  getEnvAsBool("ALLOW_SQLITE_FALLBACK", true),
		RedisAddr:            getEnv("REDIS_ADDR", "localhost:6379"),
		RedisPassword:        getEnv("REDIS_PASSWORD", ""),
		RedisDB:              getEnvAsInt("REDIS_DB", 0),
		RequireRedis:         getEnvAsBool("REQUIRE_REDIS", false),
		CORSAllowedOrigins:   getEnvAsCSV("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"),
		DBMaxOpenConns:       getEnvAsInt("DB_MAX_OPEN_CONNS", 40),
		DBMaxIdleConns:       getEnvAsInt("DB_MAX_IDLE_CONNS", 10),
		DBConnMaxLifetimeMin: getEnvAsInt("DB_CONN_MAX_LIFETIME_MIN", 30),
		HTTPReadTimeoutSec:   getEnvAsInt("HTTP_READ_TIMEOUT_SEC", 15),
		HTTPWriteTimeoutSec:  getEnvAsInt("HTTP_WRITE_TIMEOUT_SEC", 30),
		HTTPIdleTimeoutSec:   getEnvAsInt("HTTP_IDLE_TIMEOUT_SEC", 60),
		DemoSeedEnabled:      getEnvAsBool("DEMO_SEED_ENABLED", false),
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

	if err := cfg.validate(); err != nil {
		return nil, err
	}
	return cfg, nil
}

func (c *Config) IsProduction() bool { return c.AppEnv == "production" }
func (c *Config) IsDemo() bool       { return c.AppEnv == "demo" }

func (c *Config) validate() error {
	if strings.TrimSpace(c.JWTSecret) == "" {
		return fmt.Errorf("JWT_SECRET is required")
	}
	if (c.IsProduction() || c.IsDemo()) && (c.JWTSecret == defaultDevJWTSecret || len(c.JWTSecret) < 32) {
		return fmt.Errorf("JWT_SECRET must be a random value of at least 32 characters in production/demo")
	}
	if c.BookingHoldMinutes <= 0 {
		return fmt.Errorf("BOOKING_HOLD_MINUTES must be greater than 0")
	}
	if c.DBMaxOpenConns <= 0 || c.DBMaxIdleConns < 0 || c.DBMaxIdleConns > c.DBMaxOpenConns {
		return fmt.Errorf("invalid database pool settings")
	}
	if c.IsProduction() && c.AllowSQLiteFallback {
		return fmt.Errorf("ALLOW_SQLITE_FALLBACK must be false in production")
	}
	if c.IsProduction() && c.DemoSeedEnabled {
		return fmt.Errorf("DEMO_SEED_ENABLED must be false in production")
	}
	if c.DemoSeedEnabled && !c.IsDemo() && c.AppEnv != "development" {
		return fmt.Errorf("DEMO_SEED_ENABLED is allowed only in demo/development")
	}
	return nil
}

func getEnv(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func getEnvAsInt(key string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func getEnvAsBool(key string, fallback bool) bool {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func getEnvAsCSV(key, fallback string) []string {
	raw := getEnv(key, fallback)
	parts := strings.Split(raw, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		if value := strings.TrimSpace(part); value != "" {
			result = append(result, value)
		}
	}
	return result
}
