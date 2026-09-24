package handler

import (
	"net/http"

	"badminton-platform/backend/internal/middleware"
	"badminton-platform/backend/internal/service"
	"badminton-platform/backend/pkg/response"

	"github.com/gin-gonic/gin"
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
	Amount      int64  `json:"amount" binding:"required,gt=0"`
	Notes       string `json:"notes"`
	Shift       string `json:"shift" binding:"required"`
}

type TransactionHandler struct{ transactions *service.TransactionService }

func NewTransactionHandler(transactions *service.TransactionService) *TransactionHandler {
	return &TransactionHandler{transactions: transactions}
}

func (h *TransactionHandler) CreateTransaction(c *gin.Context) {
	var req CreateTransactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	staffID, ok := staffUserID(c)
	if !ok {
		return
	}
	txn, err := h.transactions.CreateTransaction(staffID, req.Type, req.Description, req.PaymentMethod, req.Notes, req.Shift, req.Amount)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "CREATE_TRANSACTION_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusCreated, txn)
}

func (h *TransactionHandler) RecordRefund(c *gin.Context) {
	var req RecordRefundRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	staffID, ok := staffUserID(c)
	if !ok {
		return
	}
	txn, err := h.transactions.RecordRefund(staffID, req.Description, req.Notes, req.Shift, req.Amount)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "RECORD_REFUND_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusCreated, txn)
}

func (h *TransactionHandler) GetShiftSummary(c *gin.Context) {
	staffID, ok := staffUserID(c)
	if !ok {
		return
	}
	shift := c.Query("shift")
	if shift == "" {
		shift = service.GetCurrentShift()
	}
	summary, err := h.transactions.ShiftSummary(staffID, shift)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "SHIFT_SUMMARY_FAILED", err.Error())
		return
	}
	txns, err := h.transactions.ListByShift(staffID, shift)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "LIST_TRANSACTIONS_FAILED", err.Error())
		return
	}
	summary["transactions"] = txns
	response.JSON(c, http.StatusOK, summary)
}

func (h *TransactionHandler) ListTransactions(c *gin.Context) {
	staffID, ok := staffUserID(c)
	if !ok {
		return
	}
	shift := c.Query("shift")
	if shift == "" {
		shift = service.GetCurrentShift()
	}
	txns, err := h.transactions.ListByShift(staffID, shift)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "LIST_TRANSACTIONS_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusOK, txns)
}

func staffUserID(c *gin.Context) (uint, bool) {
	value, exists := c.Get(middleware.ContextUserIDKey)
	id, ok := value.(uint)
	if !exists || !ok || id == 0 {
		response.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "missing user context")
		return 0, false
	}
	return id, true
}
