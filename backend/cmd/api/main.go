package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"badminton-platform/backend/internal/config"
	"badminton-platform/backend/internal/db"
	"badminton-platform/backend/internal/handler"
	"badminton-platform/backend/internal/repository"
	"badminton-platform/backend/internal/server"
	"badminton-platform/backend/internal/service"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}
	database := connectDatabase(cfg)
	redisClient := connectRedis(cfg)
	if cfg.DemoSeedEnabled {
		if err := db.SeedDemoData(database); err != nil {
			log.Fatalf("seed demo data: %v", err)
		}
	}

	repos := repository.New(database)
	authSvc := service.NewAuthService(repos.Users, cfg)
	beverageSvc := service.NewBeverageService(repos.Drinks)
	courtSvc := service.NewCourtService(repos.Courts, repos.Slots)
	bookingSvc := service.NewBookingService(database, cfg, repos.Users, repos.Slots, repos.Bookings, repos.Payments, redisClient)
	dashboardSvc := service.NewDashboardService(repos.Bookings, repos.Payments)
	transactionSvc := service.NewTransactionService(repos.Transactions)

	handlers := server.Handlers{
		Auth: handler.NewAuthHandler(authSvc), Admin: handler.NewAdminHandler(authSvc, beverageSvc), StaffBeverage: handler.NewStaffBeverageHandler(beverageSvc),
		Court: handler.NewCourtHandler(courtSvc), Booking: handler.NewBookingHandler(bookingSvc), Dashboard: handler.NewDashboardHandler(dashboardSvc), Transaction: handler.NewTransactionHandler(transactionSvc),
	}
	router := server.NewRouter(server.RouterDependencies{Config: cfg, Database: database, Redis: redisClient, Handlers: handlers})

	workerCtx, stopWorkers := context.WithCancel(context.Background())
	defer stopWorkers()
	bookingSvc.StartExpiryWorker(workerCtx, time.Minute)

	httpServer := &http.Server{Addr: ":" + cfg.AppPort, Handler: router, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: time.Duration(cfg.HTTPReadTimeoutSec) * time.Second, WriteTimeout: time.Duration(cfg.HTTPWriteTimeoutSec) * time.Second, IdleTimeout: time.Duration(cfg.HTTPIdleTimeoutSec) * time.Second, MaxHeaderBytes: 1 << 20}
	go func() {
		log.Printf("API server listening on %s (env=%s)", httpServer.Addr, cfg.AppEnv)
		if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	stopWorkers()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		log.Printf("graceful shutdown: %v", err)
	}
	if redisClient != nil {
		_ = redisClient.Close()
	}
	if sqlDB, err := database.DB(); err == nil {
		_ = sqlDB.Close()
	}
	log.Println("server stopped")
}

func connectDatabase(cfg *config.Config) *gorm.DB {
	pool := db.PoolConfig{MaxOpenConns: cfg.DBMaxOpenConns, MaxIdleConns: cfg.DBMaxIdleConns, ConnMaxLifetimeMin: cfg.DBConnMaxLifetimeMin}
	database, err := db.ConnectPostgres(cfg.PostgresDSN, cfg.AppEnv, pool)
	if err == nil {
		return database
	}
	if cfg.IsProduction() || !cfg.AllowSQLiteFallback {
		log.Fatalf("connect postgres: %v", err)
	}
	log.Printf("postgres unavailable; using development SQLite fallback: %v", err)
	database, sqliteErr := db.ConnectSQLite(cfg.SQLitePath, cfg.AppEnv)
	if sqliteErr != nil {
		log.Fatalf("connect sqlite fallback: %v", sqliteErr)
	}
	return database
}

func connectRedis(cfg *config.Config) *redis.Client {
	client := db.ConnectRedis(cfg.RedisAddr, cfg.RedisPassword, cfg.RedisDB)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		_ = client.Close()
		if cfg.RequireRedis {
			log.Fatalf("redis required but unavailable: %v", err)
		}
		log.Printf("redis unavailable; using in-memory booking locks: %v", err)
		return nil
	}
	return client
}
