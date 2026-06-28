package service

import (
	"errors"
	"badminton-platform/backend/internal/models"
	"badminton-platform/backend/internal/repository"
	"time"
)

type TransactionService struct {
	transactionRepo *repository.TransactionRepository
}

func NewTransactionService(transactionRepo *repository.TransactionRepository) *TransactionService {
	return &TransactionService{
		transactionRepo: transactionRepo,
	}
}

// CreateTransaction records a new sale or adjustment transaction
func (s *TransactionService) CreateTransaction(staffID uint, txnType, description, paymentMethod, notes, shift string, amount int64) (*models.Transaction, error) {
	if txnType == "" {
		return nil, errors.New("transaction type is required")
	}

	if shift == "" {
		shift = GetCurrentShift()
	}

	if txnType == "stock_in" || txnType == "owner_withdraw" || txnType == "refund" {
		if amount > 0 {
			amount = -amount
		}
		if paymentMethod == "" {
			paymentMethod = "cash"
		}
	}

	if txnType == "sale" && amount < 0 {
		amount = -amount
	}

	txn := &models.Transaction{
		StaffID:       staffID,
		Type:          txnType,
		Description:   description,
		Amount:        amount,
		PaymentMethod: paymentMethod,
		Notes:         notes,
		Shift:         shift,
	}

	if err := s.transactionRepo.Create(txn); err != nil {
		return nil, err
	}
	return txn, nil
}

// RecordRefund records a refund transaction (negative amount)
func (s *TransactionService) RecordRefund(staffID uint, description, notes, shift string, amount int64) (*models.Transaction, error) {
	// Refund is stored as negative amount
	refund := &models.Transaction{
		StaffID:     staffID,
		Type:        "refund",
		Description: description,
		Amount:      -amount, // Always negative for refunds
		Notes:       notes,
		Shift:       shift,
	}

	if err := s.transactionRepo.Create(refund); err != nil {
		return nil, err
	}
	return refund, nil
}

// ListByShift gets all transactions for a staff member in a shift
func (s *TransactionService) ListByShift(staffID uint, shift string) ([]models.Transaction, error) {
	return s.transactionRepo.ListByStaffAndShift(staffID, shift)
}

// ShiftSummary calculates financial summary for a shift (income, cash, transfer, refund, net total)
func (s *TransactionService) ShiftSummary(staffID uint, shift string) (map[string]interface{}, error) {
	return s.transactionRepo.SummaryByStaffAndShift(staffID, shift)
}

// GetCurrentShift returns the current shift name based on time of day
// morning: 06:00-12:00, afternoon: 12:00-18:00, evening: 18:00-06:00
func GetCurrentShift() string {
	now := time.Now()
	hour := now.Hour()

	if hour >= 6 && hour < 12 {
		return "morning"
	} else if hour >= 12 && hour < 18 {
		return "afternoon"
	}
	return "evening"
}
