package handler

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"badminton-platform/backend/internal/models"
	"badminton-platform/backend/internal/service"
	"badminton-platform/backend/internal/timeutil"
	"badminton-platform/backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type CourtHandler struct{ courts *service.CourtService }

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
	courtID, ok := parseUintParam(c, "court_id")
	if !ok {
		return
	}
	var req updateCourtRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	court, err := h.courts.UpdateCourt(courtID, req.Name, req.CourtType, req.OpenTime, req.CloseTime, req.BasePrice, req.IsActive, req.IsMaintenance)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "UPDATE_COURT_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusOK, court)
}

type priceRuleRequest struct {
	Name          string `json:"name" binding:"required"`
	DaysMask      int    `json:"days_mask" binding:"required"`
	StartTime     string `json:"start_time" binding:"required"`
	EndTime       string `json:"end_time" binding:"required"`
	Price         int64  `json:"price"`
	Priority      int    `json:"priority"`
	EffectiveFrom string `json:"effective_from"`
	EffectiveTo   string `json:"effective_to"`
	IsActive      *bool  `json:"is_active"`
}

func (h *CourtHandler) ListPriceRules(c *gin.Context) {
	courtID, ok := parseUintParam(c, "court_id")
	if !ok {
		return
	}
	rules, err := h.courts.ListPriceRules(courtID)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "LIST_PRICE_RULES_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusOK, rules)
}

func (h *CourtHandler) CreatePriceRule(c *gin.Context) {
	courtID, ok := parseUintParam(c, "court_id")
	if !ok {
		return
	}
	var req priceRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	rule, err := priceRuleFromRequest(courtID, req)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	created, err := h.courts.CreatePriceRule(rule)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "CREATE_PRICE_RULE_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusCreated, created)
}

func (h *CourtHandler) UpdatePriceRule(c *gin.Context) {
	ruleID, ok := parseUintParam(c, "rule_id")
	if !ok {
		return
	}
	var req priceRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	rule, err := priceRuleFromRequest(0, req)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	updated, err := h.courts.UpdatePriceRule(ruleID, rule)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "UPDATE_PRICE_RULE_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusOK, updated)
}

func (h *CourtHandler) DeletePriceRule(c *gin.Context) {
	ruleID, ok := parseUintParam(c, "rule_id")
	if !ok {
		return
	}
	if err := h.courts.DeletePriceRule(ruleID); err != nil {
		response.Error(c, http.StatusBadRequest, "DELETE_PRICE_RULE_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusOK, gin.H{"deleted": true})
}

func priceRuleFromRequest(courtID uint, req priceRuleRequest) (*models.CourtPriceRule, error) {
	effectiveFrom, err := parseOptionalDate(req.EffectiveFrom)
	if err != nil {
		return nil, err
	}
	effectiveTo, err := parseOptionalDate(req.EffectiveTo)
	if err != nil {
		return nil, err
	}
	active := true
	if req.IsActive != nil {
		active = *req.IsActive
	}
	priority := req.Priority
	if priority == 0 {
		priority = 100
	}
	return &models.CourtPriceRule{
		CourtID:       courtID,
		Name:          strings.TrimSpace(req.Name),
		DaysMask:      req.DaysMask,
		StartTime:     req.StartTime,
		EndTime:       req.EndTime,
		Price:         req.Price,
		Priority:      priority,
		EffectiveFrom: effectiveFrom,
		EffectiveTo:   effectiveTo,
		IsActive:      active,
	}, nil
}

func parseOptionalDate(value string) (*time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, nil
	}
	parsed, err := timeutil.ParseDate(value)
	if err != nil {
		return nil, strconv.ErrSyntax
	}
	day := timeutil.StartOfDay(parsed)
	return &day, nil
}

func parseUintParam(c *gin.Context, key string) (uint, bool) {
	value, err := strconv.ParseUint(c.Param(key), 10, 64)
	if err != nil || value == 0 {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "invalid "+key)
		return 0, false
	}
	return uint(value), true
}

func (h *CourtHandler) AvailableSlots(c *gin.Context) {
	day, ok := h.ensureSlotsForRequestedDay(c)
	if !ok {
		return
	}
	slots, err := h.courts.AvailableSlots(day)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "LIST_SLOTS_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusOK, slots)
}

func (h *CourtHandler) PublicDaySlots(c *gin.Context) {
	day, ok := h.ensureSlotsForRequestedDay(c)
	if !ok {
		return
	}
	slots, err := h.courts.PublicDaySlots(day)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "LIST_DAY_SLOTS_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusOK, slots)
}

func (h *CourtHandler) DaySlots(c *gin.Context) {
	day, ok := h.ensureSlotsForRequestedDay(c)
	if !ok {
		return
	}
	slots, err := h.courts.DaySlots(day)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "LIST_DAY_SLOTS_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusOK, slots)
}

func (h *CourtHandler) ensureSlotsForRequestedDay(c *gin.Context) (time.Time, bool) {
	day, ok := parseDayQuery(c)
	if !ok {
		return time.Time{}, false
	}
	dayStart := timeutil.StartOfDay(day)
	if !dayStart.Before(timeutil.StartOfDay(timeutil.Now())) {
		if err := h.courts.EnsureDaySlots(dayStart, 30); err != nil {
			response.Error(c, http.StatusInternalServerError, "ENSURE_DAY_SLOTS_FAILED", err.Error())
			return time.Time{}, false
		}
	}
	return dayStart, true
}

func parseDayQuery(c *gin.Context) (day time.Time, ok bool) {
	dayStr := c.Query("day")
	if dayStr == "" {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "day is required (YYYY-MM-DD)")
		return time.Time{}, false
	}
	day, err := timeutil.ParseDate(dayStr)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "invalid day format")
		return time.Time{}, false
	}
	return day, true
}
