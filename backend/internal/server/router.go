package server

import (
	"context"
	"net/http"
	"time"

	"badminton-platform/backend/internal/config"
	"badminton-platform/backend/internal/handler"
	"badminton-platform/backend/internal/middleware"
	"badminton-platform/backend/internal/models"
	"badminton-platform/backend/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

type Handlers struct {
	Auth          *handler.AuthHandler
	Admin         *handler.AdminHandler
	StaffBeverage *handler.StaffBeverageHandler
	Court         *handler.CourtHandler
	Booking       *handler.BookingHandler
	Dashboard     *handler.DashboardHandler
	Transaction   *handler.TransactionHandler
}

type RouterDependencies struct {
	Config   *config.Config
	Database *gorm.DB
	Redis    *redis.Client
	Handlers Handlers
}

func NewRouter(dep RouterDependencies) *gin.Engine {
	if dep.Config.AppEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	}
	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery(), middleware.RequestID(), middleware.SecurityHeaders(), middleware.BodyLimit(2<<20), middleware.CORS(dep.Config.CORSAllowedOrigins))
	registerHealthRoutes(router, dep)
	registerAPIRoutes(router, dep.Config, dep.Handlers)
	return router
}

func registerHealthRoutes(router *gin.Engine, dep RouterDependencies) {
	router.GET("/health", func(c *gin.Context) { response.JSON(c, http.StatusOK, gin.H{"status": "ok", "time": time.Now().UTC()}) })
	router.GET("/ready", func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()
		sqlDB, err := dep.Database.DB()
		if err != nil || sqlDB.PingContext(ctx) != nil {
			response.Error(c, http.StatusServiceUnavailable, "NOT_READY", "database unavailable")
			return
		}
		if dep.Config.RequireRedis {
			if dep.Redis == nil || dep.Redis.Ping(ctx).Err() != nil {
				response.Error(c, http.StatusServiceUnavailable, "NOT_READY", "redis unavailable")
				return
			}
		}
		response.JSON(c, http.StatusOK, gin.H{"status": "ready"})
	})
}

func registerAPIRoutes(router *gin.Engine, cfg *config.Config, h Handlers) {
	api := router.Group("/api/v1")
	authLimiter := middleware.NewIPRateLimiter(20, time.Minute)
	auth := api.Group("/auth")
	auth.Use(authLimiter.Middleware())
	auth.POST("/register", h.Auth.Register)
	auth.POST("/login", h.Auth.Login)
	auth.POST("/refresh", h.Auth.Refresh)
	api.GET("/courts", h.Court.ListCourts)
	api.GET("/slots/available", h.Court.AvailableSlots)
	api.GET("/slots/day", h.Court.PublicDaySlots)
	api.GET("/beverages", h.Admin.ListBeverages)

	secured := api.Group("")
	secured.Use(middleware.AuthRequired(cfg.JWTSecret))
	secured.POST("/bookings/pending", middleware.RequireRoles(models.RoleCustomer), h.Booking.CreatePending)
	secured.GET("/bookings/me", middleware.RequireRoles(models.RoleCustomer), h.Booking.UserBookings)
	secured.POST("/bookings/:booking_id/deposit", middleware.RequireRoles(models.RoleStaff, models.RoleAdmin), h.Booking.ConfirmDeposit)
	secured.POST("/bookings/:booking_id/cancel", middleware.RequireRoles(models.RoleCustomer, models.RoleStaff, models.RoleAdmin), h.Booking.Cancel)

	staff := secured.Group("/staff")
	staff.Use(middleware.RequireRoles(models.RoleStaff, models.RoleAdmin))
	staff.GET("/slots/day", h.Court.DaySlots)
	staff.POST("/checkin", h.Booking.CheckIn)
	staff.POST("/bookings/create", h.Booking.CreatePendingForCustomer)
	staff.PUT("/bookings/:booking_id", h.Booking.StaffUpdateBooking)
	staff.GET("/beverages", h.StaffBeverage.ListBeverages)
	staff.POST("/beverages/sell", h.StaffBeverage.Sell)
	staff.POST("/beverages/restock", h.StaffBeverage.Restock)
	staff.POST("/transactions", h.Transaction.CreateTransaction)
	staff.POST("/transactions/refund", h.Transaction.RecordRefund)
	staff.GET("/shift-summary", h.Transaction.GetShiftSummary)
	staff.GET("/transactions", h.Transaction.ListTransactions)

	admin := secured.Group("/admin")
	admin.Use(middleware.RequireRoles(models.RoleAdmin))
	admin.GET("/slots/day", h.Court.DaySlots)
	admin.POST("/staff", h.Admin.CreateStaff)
	admin.GET("/staff", h.Admin.ListStaff)
	admin.PUT("/staff/:id", h.Admin.UpdateStaff)
	admin.DELETE("/staff/:id", h.Admin.DeleteStaff)
	admin.GET("/bookings", h.Booking.AdminListBookings)
	admin.POST("/bookings", h.Booking.CreatePendingForCustomer)
	admin.PUT("/bookings/:booking_id", h.Booking.AdminUpdateBooking)
	admin.DELETE("/bookings/:booking_id", h.Booking.AdminDeleteBooking)
	admin.POST("/beverages", h.Admin.CreateBeverage)
	admin.GET("/beverages", h.Admin.ListBeverages)
	admin.PUT("/beverages/:beverage_id", h.Admin.UpdateBeverage)
	admin.DELETE("/beverages/:beverage_id", h.Admin.DeleteBeverage)
	admin.POST("/beverages/:beverage_id/adjust-stock", h.Admin.AdjustBeverageStock)
	admin.GET("/beverages/:beverage_id/history", h.Admin.BeverageHistory)
	admin.GET("/courts", h.Court.ListAllCourts)
	admin.POST("/courts", h.Court.CreateCourt)
	admin.PUT("/courts/:court_id", h.Court.UpdateCourt)
	admin.GET("/dashboard/summary", h.Dashboard.Summary)
}
