package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"badminton-platform/backend/internal/models"
	"badminton-platform/backend/internal/timeutil"

	"gorm.io/gorm"
)

func (s *BookingService) UpdateBooking(_ context.Context, actorID uint, actorRole models.Role, bookingID uint, input BookingUpdateInput) (*models.Booking, error) {
	var result *models.Booking
	err := s.db.Transaction(func(tx *gorm.DB) error {
		bookings := s.bookings.WithTx(tx)
		payments := s.payments.WithTx(tx)
		users := s.users.WithTx(tx)

		booking, err := bookings.FindByIDForUpdate(bookingID)
		if err != nil {
			return err
		}
		if err := authorizeBookingActor(booking, actorID, actorRole); err != nil {
			return err
		}
		if booking.Status == models.BookingCanceled || booking.Status == models.BookingCompleted || booking.Status == models.BookingNoShow {
			return errors.New("booking cannot be updated")
		}

		before := map[string]any{
			"customer_name":  booking.User.FullName,
			"customer_phone": booking.User.Phone,
			"customer_type":  booking.CustomerType,
			"notes":          booking.Notes,
			"payment_total":  booking.DepositPaid,
			"remaining_due":  booking.RemainingDue,
			"display_color":  booking.DisplayColor,
			"time_slot_id":   booking.TimeSlotID,
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
		if input.DisplayColor != nil {
			booking.DisplayColor = normalizeBookingColor(*input.DisplayColor)
		}

		if input.PaymentTotal != nil {
			nextPaymentTotal := *input.PaymentTotal
			if nextPaymentTotal < 0 {
				return errors.New("payment total must be zero or greater")
			}
			if nextPaymentTotal > booking.TotalPrice {
				return errors.New("payment total cannot exceed total price")
			}

			delta := nextPaymentTotal - booking.DepositPaid
			method := "manual"
			if input.PaymentMethod != nil && strings.TrimSpace(*input.PaymentMethod) != "" {
				method = strings.TrimSpace(*input.PaymentMethod)
			}
			reference := ""
			if input.PaymentReference != nil {
				reference = strings.TrimSpace(*input.PaymentReference)
			}
			reason := ""
			if input.PaymentAdjustmentReason != nil {
				reason = strings.TrimSpace(*input.PaymentAdjustmentReason)
			}
			if delta < 0 && reason == "" {
				return errors.New("payment adjustment reason is required when reducing received amount")
			}

			if delta != 0 {
				paymentFor := "payment"
				if delta < 0 {
					paymentFor = "payment_adjustment"
				}
				if err := payments.Create(&models.Payment{
					BookingID:    booking.ID,
					Amount:       delta,
					PaymentFor:   paymentFor,
					Method:       method,
					Status:       "success",
					Reference:    reference,
					ActorID:      actorID,
					ActorRole:    string(actorRole),
					Shift:        GetCurrentShift(),
					BusinessDate: timeutil.StartOfDay(timeutil.Now()),
				}); err != nil {
					return err
				}
			}

			booking.DepositPaid = nextPaymentTotal
			if booking.DepositPaid > 0 && booking.Status == models.BookingPending {
				booking.Status = models.BookingConfirmed
				booking.ExpiresAt = nil
			}

			auditPayload, _ := json.Marshal(map[string]any{
				"old_payment_total": before["payment_total"],
				"new_payment_total": nextPaymentTotal,
				"delta":             delta,
				"method":            method,
				"reference":         reference,
				"reason":            reason,
				"actor_role":        actorRole,
			})
			if err := tx.Create(&models.AuditLog{
				ActorID:    actorID,
				Action:     "booking_payment_adjusted",
				TargetType: "booking",
				TargetID:   fmt.Sprint(booking.ID),
				Payload:    string(auditPayload),
			}).Error; err != nil {
				return err
			}
		}

		booking.RemainingDue = booking.TotalPrice - booking.DepositPaid
		if booking.RemainingDue < 0 {
			booking.RemainingDue = 0
		}

		if err := bookings.Update(booking); err != nil {
			return err
		}

		after := map[string]any{
			"customer_name":  booking.User.FullName,
			"customer_phone": booking.User.Phone,
			"customer_type":  booking.CustomerType,
			"notes":          booking.Notes,
			"payment_total":  booking.DepositPaid,
			"remaining_due":  booking.RemainingDue,
			"display_color":  booking.DisplayColor,
			"time_slot_id":   booking.TimeSlotID,
			"actor_role":     actorRole,
		}
		auditPayload, _ := json.Marshal(map[string]any{"before": before, "after": after})
		if err := tx.Create(&models.AuditLog{
			ActorID:    actorID,
			Action:     "booking_updated",
			TargetType: "booking",
			TargetID:   fmt.Sprint(booking.ID),
			Payload:    string(auditPayload),
		}).Error; err != nil {
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
