package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"badminton-platform/backend/internal/models"
	"badminton-platform/backend/internal/repository"

	"gorm.io/gorm"
)

func (s *BookingService) ConfirmDeposit(ctx context.Context, actorID uint, actorRole models.Role, bookingID uint, amount int64, method, reference string) (*models.Booking, error) {
	if amount <= 0 {
		return nil, errors.New("deposit amount must be greater than zero")
	}
	method = strings.TrimSpace(method)
	if method == "" {
		return nil, errors.New("payment method is required")
	}

	var booking *models.Booking
	err := s.db.Transaction(func(tx *gorm.DB) error {
		bookings := s.bookings.WithTx(tx)
		payments := s.payments.WithTx(tx)
		locked, err := bookings.FindByIDForUpdate(bookingID)
		if err != nil {
			return err
		}
		if err := authorizeBookingActor(locked, actorID, actorRole); err != nil {
			return err
		}
		if locked.Status == models.BookingCanceled || locked.Status == models.BookingCompleted || locked.Status == models.BookingNoShow {
			return errors.New("booking cannot receive deposit in current status")
		}
		if locked.Status == models.BookingPending && locked.ExpiresAt != nil && !locked.ExpiresAt.After(time.Now()) {
			return errors.New("booking hold has expired")
		}
		if amount > locked.RemainingDue {
			return fmt.Errorf("deposit amount cannot exceed remaining due (%d)", locked.RemainingDue)
		}

		if err := payments.Create(&models.Payment{
			BookingID:  locked.ID,
			Amount:     amount,
			PaymentFor: "deposit",
			Method:     method,
			Status:     "success",
			Reference:  strings.TrimSpace(reference),
		}); err != nil {
			return err
		}

		if locked.Status == models.BookingPending {
			locked.Status = models.BookingConfirmed
		}
		locked.DepositPaid += amount
		locked.RemainingDue = locked.TotalPrice - locked.DepositPaid
		locked.ExpiresAt = nil
		if err := bookings.Update(locked); err != nil {
			return err
		}
		booking = locked
		return nil
	})
	if err != nil {
		return nil, err
	}
	s.releaseLock(ctx, fmt.Sprintf("lock:slot:%d", booking.TimeSlotID))
	s.releaseLock(ctx, fmt.Sprintf("mem:%d", booking.TimeSlotID))
	return booking, nil
}

func (s *BookingService) CancelBooking(ctx context.Context, actorID uint, actorRole models.Role, bookingID uint, reason string) (*models.Booking, int64, error) {
	reason = strings.TrimSpace(reason)
	if reason == "" {
		reason = "Booking canceled"
	}

	var booking *models.Booking
	var refund int64
	err := s.db.Transaction(func(tx *gorm.DB) error {
		bookings := s.bookings.WithTx(tx)
		payments := s.payments.WithTx(tx)
		locked, err := bookings.FindByIDForUpdate(bookingID)
		if err != nil {
			return err
		}
		if err := authorizeBookingActor(locked, actorID, actorRole); err != nil {
			return err
		}
		if locked.Status == models.BookingCanceled || locked.Status == models.BookingCompleted || locked.Status == models.BookingNoShow {
			return errors.New("booking cannot be canceled")
		}

		hoursLeft := locked.TimeSlot.StartTime.Sub(time.Now()).Hours()
		if hoursLeft >= float64(s.cfg.CancelPolicyHours) {
			refund = locked.DepositPaid
		} else {
			refund = locked.DepositPaid / 2
		}

		now := time.Now()
		locked.Status = models.BookingCanceled
		locked.CanceledAt = &now
		locked.CancelReason = &reason
		locked.ExpiresAt = nil
		if err := bookings.Update(locked); err != nil {
			return err
		}
		if refund > 0 {
			if err := payments.Create(&models.Payment{
				BookingID:  locked.ID,
				Amount:     -refund,
				PaymentFor: "refund",
				Method:     "refund",
				Status:     "success",
				Reference:  "booking-cancel",
			}); err != nil {
				return err
			}
		}
		booking = locked
		return nil
	})
	if err != nil {
		return nil, 0, err
	}
	s.releaseLock(ctx, fmt.Sprintf("lock:slot:%d", booking.TimeSlotID))
	s.releaseLock(ctx, fmt.Sprintf("mem:%d", booking.TimeSlotID))
	return booking, refund, nil
}

func authorizeBookingActor(booking *models.Booking, actorID uint, actorRole models.Role) error {
	switch actorRole {
	case models.RoleAdmin, models.RoleStaff:
		return nil
	case models.RoleCustomer:
		if booking.UserID == actorID {
			return nil
		}
	}
	return ErrBookingAccessDenied
}

func (s *BookingService) CheckIn(codeOrPhone string) (*models.Booking, error) {
	codeOrPhone = strings.TrimSpace(codeOrPhone)
	if codeOrPhone == "" {
		return nil, errors.New("booking code or phone is required")
	}
	booking, err := s.bookings.FindByCodeOrPhone(codeOrPhone)
	if err != nil {
		return nil, err
	}
	if booking.Status == models.BookingCheckedIn {
		return booking, nil
	}
	if booking.Status != models.BookingConfirmed && booking.Status != models.BookingPending {
		return nil, errors.New("booking cannot be checked in")
	}
	if booking.Status == models.BookingPending && booking.ExpiresAt != nil && !booking.ExpiresAt.After(time.Now()) {
		return nil, errors.New("booking hold has expired")
	}
	booking.Status = models.BookingCheckedIn
	booking.ExpiresAt = nil
	if err := s.bookings.Update(booking); err != nil {
		return nil, err
	}
	return booking, nil
}

func (s *BookingService) UserBookings(userID uint) ([]models.Booking, error) {
	return s.bookings.ListByUser(userID)
}

func (s *BookingService) ListBookingsByDay(day time.Time) ([]repository.BookingAdminView, error) {
	return s.bookings.ListByDateWithDetails(day)
}
