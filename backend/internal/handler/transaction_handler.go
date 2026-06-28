package handler

import (
	"badminton-platform/backend/internal/middleware"
	"badminton-platform/backend/internal/service"
	"github.com/gin-gonic/gin"
	"net/http"
)

type CreateTransactionRequest struct {
	Type          string `json:"type" binding:"required,oneof=sale refund adjust stock_in owner_withdraw"`
	Description   string `json:"description" binding:"required"`
	Amount        int64  `json:"amount" binding:"required"`
	PaymentMethod string `json:"payment_method" binding:"required,oneof=cash transfer"`
	Notes         string `json:"notes"`
	Shift         string `json:"shift" binding:"required"`
}

type RecordRefundRequest struct {
	Description string `json:"description" binding:"required"`
	Amount      int64  `json:"amount" binding:"required"`
	Notes       string `json:"notes"`
	Shift       string `json:"shift" binding:"required"`
}

type TransactionHandler struct {
	transactionService *service.TransactionService
}

func NewTransactionHandler(transactionService *service.TransactionService) *TransactionHandler {
	return &TransactionHandler{
		transactionService: transactionService,
	}
}

// CreateTransaction godoc
// @Summary Record a new transaction (beverage sale, adjustment)
// @Security Bearer
// @Tags Staff - Transactions
// @Accept json
// @Produce json
// @Param request body CreateTransactionRequest true "Transaction details"
// @Success 201 {object} models.Transaction
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /staff/transactions [post]
func (h *TransactionHandler) CreateTransaction(c *gin.Context) {
	var req CreateTransactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Get staff ID from context (set by middleware)
	staffID, exists := c.Get(middleware.ContextUserIDKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	txn, err := h.transactionService.CreateTransaction(
		staffID.(uint),
		req.Type,
		req.Description,
		req.PaymentMethod,
		req.Notes,
		req.Shift,
		req.Amount,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create transaction"})
		return
	}

	c.JSON(http.StatusCreated, txn)
}

// RecordRefund godoc
// @Summary Record a refund transaction
// @Security Bearer
// @Tags Staff - Transactions
// @Accept json
// @Produce json
// @Param request body RecordRefundRequest true "Refund details"
// @Success 201 {object} models.Transaction
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /staff/transactions/refund [post]
func (h *TransactionHandler) RecordRefund(c *gin.Context) {
	var req RecordRefundRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	staffID, exists := c.Get(middleware.ContextUserIDKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	txn, err := h.transactionService.RecordRefund(
		staffID.(uint),
		req.Description,
		req.Notes,
		req.Shift,
		req.Amount,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record refund"})
		return
	}

	c.JSON(http.StatusCreated, txn)
}

// GetShiftSummary godoc
// @Summary Get shift financial summary and reconciliation data
// @Security Bearer
// @Tags Staff - Transactions
// @Produce json
// @Param shift query string true "Shift name (morning/afternoon/evening)"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /staff/shift-summary [get]
func (h *TransactionHandler) GetShiftSummary(c *gin.Context) {
	shift := c.Query("shift")
	if shift == "" {
		// Use current shift if not provided
		shift = service.GetCurrentShift()
	}

	staffID, exists := c.Get(middleware.ContextUserIDKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	summary, err := h.transactionService.ShiftSummary(staffID.(uint), shift)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get shift summary"})
		return
	}

	// Get transaction list for detailed view
	txns, err := h.transactionService.ListByShift(staffID.(uint), shift)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list transactions"})
		return
	}

	summary["transactions"] = txns
	c.JSON(http.StatusOK, summary)
}

// ListTransactions godoc
// @Summary List transactions for a shift (detailed view)
// @Security Bearer
// @Tags Staff - Transactions
// @Produce json
// @Param shift query string true "Shift name"
// @Success 200 {object} []models.Transaction
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /staff/transactions [get]
func (h *TransactionHandler) ListTransactions(c *gin.Context) {
	shift := c.Query("shift")
	if shift == "" {
		shift = service.GetCurrentShift()
	}

	staffID, exists := c.Get(middleware.ContextUserIDKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	txns, err := h.transactionService.ListByShift(staffID.(uint), shift)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list transactions"})
		return
	}

	c.JSON(http.StatusOK, txns)
}
