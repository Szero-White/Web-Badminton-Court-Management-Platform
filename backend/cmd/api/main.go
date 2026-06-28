package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"time"

	"badminton-platform/backend/internal/config"
	"badminton-platform/backend/internal/db"
	"badminton-platform/backend/internal/handler"
	"badminton-platform/backend/internal/middleware"
	"badminton-platform/backend/internal/models"
	"badminton-platform/backend/internal/repository"
	"badminton-platform/backend/internal/service"
	"badminton-platform/backend/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	postgres, err := db.ConnectPostgres(cfg.PostgresDSN)
	if err != nil {
		log.Printf("connect postgres failed, fallback to sqlite: %v", err)
		sqlitePath := resolveSQLitePath()
		log.Printf("using sqlite fallback path: %s", sqlitePath)
		postgres, err = db.ConnectSQLite(sqlitePath)
		if err != nil {
			log.Fatalf("connect sqlite fallback failed: %v", err)
		}
	}

	var redisClient *redis.Client
	redisProbe := db.ConnectRedis(cfg.RedisAddr, cfg.RedisPassword, cfg.RedisDB)
	if err := redisProbe.Ping(context.Background()).Err(); err != nil {
		log.Printf("connect redis failed, use in-memory lock fallback: %v", err)
		redisClient = nil
	} else {
		redisClient = redisProbe
	}

	repos := repository.New(postgres)
	authSvc := service.NewAuthService(repos.Users, cfg)
	beverageSvc := service.NewBeverageService(repos.Drinks)
	courtSvc := service.NewCourtService(repos.Courts, repos.Slots)
	bookingSvc := service.NewBookingService(postgres, cfg, repos.Users, repos.Slots, repos.Bookings, repos.Payments, redisClient)
	dashboardSvc := service.NewDashboardService(repos.Bookings, repos.Payments)
	transactionSvc := service.NewTransactionService(repos.Transactions)

	authHandler := handler.NewAuthHandler(authSvc)
	adminHandler := handler.NewAdminHandler(authSvc, beverageSvc)
	staffBeverageHandler := handler.NewStaffBeverageHandler(beverageSvc)
	courtHandler := handler.NewCourtHandler(courtSvc)
	bookingHandler := handler.NewBookingHandler(bookingSvc)
	dashboardHandler := handler.NewDashboardHandler(dashboardSvc)
	transactionHandler := handler.NewTransactionHandler(transactionSvc)

	r := gin.Default()
	r.Use(corsMiddleware())

	r.GET("/health", func(c *gin.Context) {
		response.JSON(c, http.StatusOK, gin.H{"status": "ok", "time": time.Now()})
	})

	api := r.Group("/api/v1")
	{
		auth := api.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
			auth.POST("/refresh", authHandler.Refresh)
		}

		api.GET("/courts", courtHandler.ListCourts)
		api.GET("/slots/available", courtHandler.AvailableSlots)
		api.GET("/slots/day", courtHandler.DaySlots)
		api.GET("/beverages", adminHandler.ListBeverages)

		secured := api.Group("")
		secured.Use(middleware.AuthRequired(cfg.JWTSecret))
		{
			secured.POST("/bookings/pending", middleware.RequireRoles(models.RoleCustomer), bookingHandler.CreatePending)
			secured.GET("/bookings/me", middleware.RequireRoles(models.RoleCustomer), bookingHandler.UserBookings)
			secured.POST("/bookings/:booking_id/deposit", middleware.RequireRoles(models.RoleCustomer, models.RoleStaff, models.RoleAdmin), bookingHandler.ConfirmDeposit)
			secured.POST("/bookings/:booking_id/cancel", middleware.RequireRoles(models.RoleCustomer, models.RoleStaff, models.RoleAdmin), bookingHandler.Cancel)

			staff := secured.Group("/staff")
			staff.Use(middleware.RequireRoles(models.RoleStaff, models.RoleAdmin))
			{
				staff.POST("/checkin", bookingHandler.CheckIn)
				staff.POST("/bookings/create", bookingHandler.CreatePendingForCustomer)
				staff.PUT("/bookings/:booking_id", bookingHandler.StaffUpdateBooking)
				staff.GET("/beverages", staffBeverageHandler.ListBeverages)
				staff.POST("/beverages/sell", staffBeverageHandler.Sell)
				staff.POST("/beverages/restock", staffBeverageHandler.Restock)
							staff.POST("/transactions", transactionHandler.CreateTransaction)
							staff.POST("/transactions/refund", transactionHandler.RecordRefund)
							staff.GET("/shift-summary", transactionHandler.GetShiftSummary)
							staff.GET("/transactions", transactionHandler.ListTransactions)
			}

			admin := secured.Group("/admin")
			admin.Use(middleware.RequireRoles(models.RoleAdmin))
			{
				admin.POST("/staff", adminHandler.CreateStaff)
				admin.GET("/staff", adminHandler.ListStaff)
				admin.PUT("/staff/:id", adminHandler.UpdateStaff)
				admin.DELETE("/staff/:id", adminHandler.DeleteStaff)
				admin.GET("/bookings", bookingHandler.AdminListBookings)
				admin.POST("/bookings", bookingHandler.CreatePendingForCustomer)
				admin.PUT("/bookings/:booking_id", bookingHandler.AdminUpdateBooking)
				admin.DELETE("/bookings/:booking_id", bookingHandler.AdminDeleteBooking)
				admin.POST("/beverages", adminHandler.CreateBeverage)
				admin.GET("/beverages", adminHandler.ListBeverages)
				admin.PUT("/beverages/:beverage_id", adminHandler.UpdateBeverage)
				admin.DELETE("/beverages/:beverage_id", adminHandler.DeleteBeverage)
				admin.POST("/beverages/:beverage_id/adjust-stock", adminHandler.AdjustBeverageStock)
				admin.GET("/beverages/:beverage_id/history", adminHandler.BeverageHistory)
				admin.GET("/courts", courtHandler.ListAllCourts)
				admin.POST("/courts", courtHandler.CreateCourt)
				admin.PUT("/courts/:court_id", courtHandler.UpdateCourt)
				admin.GET("/dashboard/summary", dashboardHandler.Summary)
			}
		}
	}

	addr := ":" + cfg.AppPort
	log.Printf("server running on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func resolveSQLitePath() string {
	if explicit := os.Getenv("SQLITE_PATH"); explicit != "" {
		if abs, err := filepath.Abs(explicit); err == nil {
			return abs
		}
		return explicit
	}

	_, file, _, ok := runtime.Caller(0)
	if ok {
		backendRoot := filepath.Clean(filepath.Join(filepath.Dir(file), "..", ".."))
		return filepath.Join(backendRoot, "badminton_dev.db")
	}

	if abs, err := filepath.Abs("badminton_dev.db"); err == nil {
		return abs
	}
	return "badminton_dev.db"
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
