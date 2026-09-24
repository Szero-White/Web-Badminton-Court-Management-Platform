package service

import (
	"errors"
	"strings"

	"badminton-platform/backend/internal/models"
	"badminton-platform/backend/internal/repository"
	"badminton-platform/backend/internal/timeutil"
)

var validTransactionTypes = map[string]struct{}{
	"sale":           {},
	"refund":         {},
	"adjust":         {},
	"stock_in":       {},
	"owner_withdraw": {},
}

var validPaymentMethods = map[string]struct{}{
	"cash":     {},
	"transfer": {},
}

var validShifts = map[string]struct{}{
	"morning":   {},
	"afternoon": {},
	"evening":   {},
}

type TransactionService struct {
	transactionRepo *repository.TransactionRepository
}

func NewTransactionService(transactionRepo *repository.TransactionRepository) *TransactionService {
	return &TransactionService{transactionRepo: transactionRepo}
}

// CreateTransaction records a staff-side sale or cash-flow adjustment.
func (s *TransactionService) CreateTransaction(staffID uint, txnType, description, paymentMethod, notes, shift string, amount int64) (*models.Transaction, error) {
	txnType = strings.TrimSpace(txnType)
	description = strings.TrimSpace(description)
	paymentMethod = strings.TrimSpace(paymentMethod)
	shift = strings.TrimSpace(shift)

	if staffID == 0 {
		return nil, errors.New("staff id is required")
	}
	if _, ok := validTransactionTypes[txnType]; !ok {
		return nil, errors.New("invalid transaction type")
	}
	if description == "" {
		return nil, errors.New("transaction description is required")
	}
	if amount == 0 {
		return nil, errors.New("transaction amount must be non-zero")
	}
	if _, ok := validPaymentMethods[paymentMethod]; !ok {
		return nil, errors.New("invalid payment method")
	}
	if shift == "" {
		shift = GetCurrentShift()
	}
	if _, ok := validShifts[shift]; !ok {
		return nil, errors.New("invalid shift")
	}

	if txnType == "stock_in" || txnType == "owner_withdraw" || txnType == "refund" {
		amount = -absoluteInt64(amount)
	}
	if txnType == "sale" {
		amount = absoluteInt64(amount)
	}

	txn := &models.Transaction{
		StaffID:       staffID,
		Type:          txnType,
		Description:   description,
		Amount:        amount,
		PaymentMethod: paymentMethod,
		Notes:         strings.TrimSpace(notes),
		Shift:         shift,
	}

	if err := s.transactionRepo.Create(txn); err != nil {
		return nil, err
	}
	return txn, nil
}

// RecordRefund records a refund as a negative transaction amount.
func (s *TransactionService) RecordRefund(staffID uint, description, notes, shift string, amount int64) (*models.Transaction, error) {
	if staffID == 0 {
		return nil, errors.New("staff id is required")
	}
	if strings.TrimSpace(description) == "" {
		return nil, errors.New("refund description is required")
	}
	if amount <= 0 {
		return nil, errors.New("refund amount must be greater than zero")
	}
	if shift == "" {
		shift = GetCurrentShift()
	}
	if _, ok := validShifts[shift]; !ok {
		return nil, errors.New("invalid shift")
	}

	refund := &models.Transaction{
		StaffID:       staffID,
		Type:          "refund",
		Description:   strings.TrimSpace(description),
		Amount:        -amount,
		PaymentMethod: "cash",
		Notes:         strings.TrimSpace(notes),
		Shift:         shift,
	}

	if err := s.transactionRepo.Create(refund); err != nil {
		return nil, err
	}
	return refund, nil
}

func (s *TransactionService) ListByShift(staffID uint, shift string) ([]models.Transaction, error) {
	return s.transactionRepo.ListByStaffAndShift(staffID, shift)
}

func (s *TransactionService) ShiftSummary(staffID uint, shift string) (map[string]interface{}, error) {
	return s.transactionRepo.SummaryByStaffAndShift(staffID, shift)
}

// GetCurrentShift maps local time to the operating shift.
func GetCurrentShift() string {
	hour := timeutil.Now().Hour()
	if hour >= 6 && hour < 12 {
		return "morning"
	}
	if hour >= 12 && hour < 18 {
		return "afternoon"
	}
	return "evening"
}

func absoluteInt64(value int64) int64 {
	if value < 0 {
		return -value
	}
	return value
}
