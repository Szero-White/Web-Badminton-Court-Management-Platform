package handler

import (
	"net/http"

	"badminton-platform/backend/internal/middleware"
	"badminton-platform/backend/internal/service"
	"badminton-platform/backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type StaffBeverageHandler struct {
	beverage *service.BeverageService
}

func NewStaffBeverageHandler(beverage *service.BeverageService) *StaffBeverageHandler {
	return &StaffBeverageHandler{beverage: beverage}
}

type sellBeverageRequest struct {
	BeverageID    uint   `json:"beverage_id" binding:"required"`
	Quantity      int    `json:"quantity" binding:"required"`
	PaymentMethod string `json:"payment_method" binding:"required,oneof=cash transfer"`
	Shift         string `json:"shift"`
	Notes         string `json:"notes"`
}

type restockBeverageRequest struct {
	BeverageID    uint   `json:"beverage_id" binding:"required"`
	Quantity      int    `json:"quantity" binding:"required"`
	CostAmount    int64  `json:"cost_amount"`
	PaymentMethod string `json:"payment_method" binding:"required,oneof=cash transfer"`
	Shift         string `json:"shift"`
	Notes         string `json:"notes"`
}

func (h *StaffBeverageHandler) ListBeverages(c *gin.Context) {
	drinks, err := h.beverage.ListActive()
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "LIST_BEVERAGES_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusOK, drinks)
}

func (h *StaffBeverageHandler) Sell(c *gin.Context) {
	var req sellBeverageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}

	uidVal, ok := c.Get(middleware.ContextUserIDKey)
	if !ok {
		response.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "missing user context")
		return
	}

	staffID, ok := uidVal.(uint)
	if !ok {
		response.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "invalid user context")
		return
	}

	txn, drink, err := h.beverage.Sell(staffID, req.BeverageID, req.Quantity, req.PaymentMethod, req.Shift, req.Notes)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "SELL_BEVERAGE_FAILED", err.Error())
		return
	}

	response.JSON(c, http.StatusCreated, gin.H{
		"transaction": txn,
		"beverage":    drink,
	})
}

func (h *StaffBeverageHandler) Restock(c *gin.Context) {
	var req restockBeverageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}

	uidVal, ok := c.Get(middleware.ContextUserIDKey)
	if !ok {
		response.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "missing user context")
		return
	}

	staffID, ok := uidVal.(uint)
	if !ok {
		response.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "invalid user context")
		return
	}

	txn, drink, err := h.beverage.Restock(staffID, req.BeverageID, req.Quantity, req.CostAmount, req.PaymentMethod, req.Shift, req.Notes)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "RESTOCK_BEVERAGE_FAILED", err.Error())
		return
	}

	response.JSON(c, http.StatusCreated, gin.H{
		"transaction": txn,
		"beverage":    drink,
	})
}
