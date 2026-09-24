package service

import (
	"context"
	"errors"
	"strings"

	"badminton-platform/backend/internal/models"

	"gorm.io/gorm"
)

func (s *BookingService) UpdateBooking(_ context.Context, bookingID uint, input BookingUpdateInput) (*models.Booking, error) {
	var result *models.Booking
	err := s.db.Transaction(func(tx *gorm.DB) error {
		bookings := s.bookings.WithTx(tx)
		payments := s.payments.WithTx(tx)
		users := s.users.WithTx(tx)

		booking, err := bookings.FindByIDForUpdate(bookingID)
		if err != nil {
			return err
		}
		if booking.Status == models.BookingCanceled || booking.Status == models.BookingCompleted || booking.Status == models.BookingNoShow {
			return errors.New("booking cannot be updated")
		}

		if input.CustomerPhone != nil || input.CustomerName != nil {
			phone, name := booking.User.Phone, booking.User.FullName
			if input.CustomerPhone != nil {
				phone = strings.TrimSpace(*input.CustomerPhone)
			}
			if input.CustomerName != nil {
				name = strings.TrimSpace(*input.CustomerName)
			}
			updatedUser, userErr := s.ensureCustomerByPhoneWithRepo(users, phone, name)
			if userErr != nil {
				return userErr
			}
			booking.UserID = updatedUser.ID
			booking.User = *updatedUser
		}

		if input.TimeSlotID != nil && *input.TimeSlotID != booking.TimeSlotID {
			nextSlot, slotErr := s.slots.FindByID(*input.TimeSlotID)
			if slotErr != nil {
				return slotErr
			}
			if !nextSlot.Court.IsActive || nextSlot.Court.IsMaintenance {
				return errors.New("selected court is not available")
			}
			if existing, existingErr := bookings.FindActiveByTimeSlotIDExcludeBooking(nextSlot.ID, booking.ID); existingErr != nil {
				return existingErr
			} else if existing != nil {
				return errors.New("selected slot is already booked")
			}
			booking.TimeSlotID = nextSlot.ID
			booking.TimeSlot = *nextSlot
			booking.CourtID = nextSlot.CourtID
			booking.Court = nextSlot.Court
			booking.TotalPrice = nextSlot.Price
		}

		if input.CustomerType != nil {
			booking.CustomerType = normalizeCustomerType(*input.CustomerType)
		}
		if input.Notes != nil {
			booking.Notes = strings.TrimSpace(*input.Notes)
		}
		if input.DepositTotal != nil {
			nextDeposit := *input.DepositTotal
			if nextDeposit < 0 {
				return errors.New("deposit total must be zero or greater")
			}
			if nextDeposit > booking.TotalPrice {
				return errors.New("deposit total cannot exceed total price")
			}
			delta := nextDeposit - booking.DepositPaid
			if delta != 0 {
				if err := payments.Create(&models.Payment{
					BookingID:  booking.ID,
					Amount:     delta,
					PaymentFor: "deposit_adjustment",
					Method:     "manual",
					Status:     "success",
					Reference:  "staff-admin-edit",
				}); err != nil {
					return err
				}
			}
			booking.DepositPaid = nextDeposit
			if booking.DepositPaid > 0 && booking.Status == models.BookingPending {
				booking.Status = models.BookingConfirmed
				booking.ExpiresAt = nil
			}
		}

		booking.RemainingDue = booking.TotalPrice - booking.DepositPaid
		if booking.RemainingDue < 0 {
			booking.RemainingDue = 0
		}
		if err := bookings.Update(booking); err != nil {
			return err
		}
		result = booking
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}
