package handler

import (
	"net/http"
	"strconv"
	"time"

	"badminton-platform/backend/internal/service"
	"badminton-platform/backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type CourtHandler struct {
	courts *service.CourtService
}

func NewCourtHandler(courts *service.CourtService) *CourtHandler {
	return &CourtHandler{courts: courts}
}

type createCourtRequest struct {
	Name      string `json:"name" binding:"required"`
	CourtType string `json:"court_type" binding:"required"`
	OpenTime  string `json:"open_time" binding:"required"`
	CloseTime string `json:"close_time" binding:"required"`
	BasePrice int64  `json:"base_price" binding:"required"`
}

func (h *CourtHandler) CreateCourt(c *gin.Context) {
	var req createCourtRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	court, err := h.courts.CreateCourt(req.Name, req.CourtType, req.OpenTime, req.CloseTime, req.BasePrice)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "CREATE_COURT_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusCreated, court)
}

func (h *CourtHandler) ListCourts(c *gin.Context) {
	courts, err := h.courts.ListCourts()
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "LIST_COURTS_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusOK, courts)
}

func (h *CourtHandler) ListAllCourts(c *gin.Context) {
	courts, err := h.courts.ListAllCourts()
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "LIST_ALL_COURTS_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusOK, courts)
}

type updateCourtRequest struct {
	Name          string `json:"name"`
	CourtType     string `json:"court_type"`
	OpenTime      string `json:"open_time"`
	CloseTime     string `json:"close_time"`
	BasePrice     *int64 `json:"base_price"`
	IsActive      *bool  `json:"is_active"`
	IsMaintenance *bool  `json:"is_maintenance"`
}

func (h *CourtHandler) UpdateCourt(c *gin.Context) {
	courtID, err := strconv.ParseUint(c.Param("court_id"), 10, 64)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "invalid court_id")
		return
	}
	var req updateCourtRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	
	isActive := true
	isMaintenance := false
	if req.IsActive != nil {
		isActive = *req.IsActive
	}
	if req.IsMaintenance != nil {
		isMaintenance = *req.IsMaintenance
	}
	
	court, err := h.courts.UpdateCourt(uint(courtID), req.Name, req.CourtType, req.OpenTime, req.CloseTime, req.BasePrice, isActive, isMaintenance)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "UPDATE_COURT_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusOK, court)
}

func (h *CourtHandler) AvailableSlots(c *gin.Context) {
	dayStr := c.Query("day")
	if dayStr == "" {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "day is required (YYYY-MM-DD)")
		return
	}
	day, err := time.Parse("2006-01-02", dayStr)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "invalid day format")
		return
	}
	slots, err := h.courts.AvailableSlots(day)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "LIST_SLOTS_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusOK, slots)
}

func (h *CourtHandler) DaySlots(c *gin.Context) {
	dayStr := c.Query("day")
	if dayStr == "" {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "day is required (YYYY-MM-DD)")
		return
	}
	day, err := time.Parse("2006-01-02", dayStr)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "invalid day format")
		return
	}

	today := time.Now()
	todayStart := time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, today.Location())
	dayStart := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, day.Location())
	if !dayStart.Before(todayStart) {
		if err := h.courts.EnsureDaySlots(dayStart, 30, 17, 21, 1.2); err != nil {
			response.Error(c, http.StatusInternalServerError, "ENSURE_DAY_SLOTS_FAILED", err.Error())
			return
		}
	}

	slots, err := h.courts.DaySlots(day)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "LIST_DAY_SLOTS_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusOK, slots)
}
