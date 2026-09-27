package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"

	"badminton-platform/backend/internal/models"
	"badminton-platform/backend/internal/timeutil"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

func (s *BookingService) UpdateBookingGroup(ctx context.Context, actorID uint, actorRole models.Role, bookingID uint, input BookingGroupUpdateInput) ([]*models.Booking, error) {
	if len(input.TimeSlotIDs) == 0 {
		return nil, errors.New("at least one time slot is required")
	}

	var result []*models.Booking
	err := s.db.Transaction(func(tx *gorm.DB) error {
		bookingsRepo := s.bookings.WithTx(tx)
		slotsRepo := s.slots.WithTx(tx)
		paymentsRepo := s.payments.WithTx(tx)
		usersRepo := s.users.WithTx(tx)

		anchor, err := bookingsRepo.FindByIDForUpdate(bookingID)
		if err != nil {
			return err
		}
		if err := authorizeBookingActor(anchor, actorID, actorRole); err != nil {
			return err
		}
		if anchor.Status == models.BookingCheckedIn || anchor.Status == models.BookingCompleted || anchor.Status == models.BookingCanceled || anchor.Status == models.BookingNoShow {
			return errors.New("booking cannot be rescheduled in its current status")
		}

		group, err := bookingsRepo.ListActiveGroupForUpdate(anchor.BookingGroupID, anchor.ID)
		if err != nil {
			return err
		}
		sort.Slice(group, func(i, j int) bool {
			return group[i].TimeSlot.StartTime.Before(group[j].TimeSlot.StartTime)
		})
		for i := range group {
			if err := authorizeBookingActor(&group[i], actorID, actorRole); err != nil {
				return err
			}
			if group[i].Status == models.BookingCheckedIn {
				return errors.New("checked-in booking cannot be rescheduled")
			}
		}

		excludeIDs := make([]uint, 0, len(group))
		currentPaid := int64(0)
		beforeSlots := make([]map[string]any, 0, len(group))
		for i := range group {
			excludeIDs = append(excludeIDs, group[i].ID)
			currentPaid += group[i].DepositPaid
			beforeSlots = append(beforeSlots, map[string]any{
				"booking_id": group[i].ID,
				"slot_id":    group[i].TimeSlotID,
				"court_id":   group[i].CourtID,
				"start_time": group[i].TimeSlot.StartTime,
				"end_time":   group[i].TimeSlot.EndTime,
				"price":      group[i].TotalPrice,
			})
		}

		targetSlots, err := slotsRepo.FindByIDsForUpdate(input.TimeSlotIDs)
		if err != nil {
			return err
		}
		if len(targetSlots) != len(input.TimeSlotIDs) {
			return errors.New("one or more selected time slots do not exist")
		}
		sort.Slice(targetSlots, func(i, j int) bool { return targetSlots[i].StartTime.Before(targetSlots[j].StartTime) })

		courtID := targetSlots[0].CourtID
		for i := range targetSlots {
			slot := &targetSlots[i]
			if slot.CourtID != courtID {
				return errors.New("all selected slots must belong to the same court")
			}
			if !slot.Court.IsActive || slot.Court.IsMaintenance {
				return errors.New("selected court is not available")
			}
			if slot.StartTime.Before(timeutil.Now()) {
				return errors.New("cannot move booking to a past time slot")
			}
			if i > 0 && !targetSlots[i-1].EndTime.Equal(slot.StartTime) {
				return errors.New("selected time slots must be continuous")
			}
			if targetSlots[0].StartTime.Year() != slot.StartTime.Year() || targetSlots[0].StartTime.YearDay() != slot.StartTime.YearDay() {
				return errors.New("selected time slots must be on the same day")
			}
			if existing, findErr := bookingsRepo.FindActiveByTimeSlotIDExcludeBookingIDs(slot.ID, excludeIDs); findErr != nil {
				return findErr
			} else if existing != nil {
				return fmt.Errorf("khung giờ %s đã được đặt", formatBookingClock(slot.StartTime))
			}

			price, priceErr := s.currentSlotPrice(slot)
			if priceErr != nil {
				return priceErr
			}
			slot.Price = price
			if err := slotsRepo.UpdatePrice(slot.ID, price); err != nil {
				return err
			}
		}

		phone := anchor.User.Phone
		name := anchor.User.FullName
		if input.CustomerPhone != nil {
			phone = strings.TrimSpace(*input.CustomerPhone)
		}
		if input.CustomerName != nil {
			name = strings.TrimSpace(*input.CustomerName)
		}
		customer, err := s.ensureCustomerByPhoneWithRepo(usersRepo, phone, name)
		if err != nil {
			return err
		}

		customerType := anchor.CustomerType
		if input.CustomerType != nil {
			customerType = normalizeCustomerType(*input.CustomerType)
		}
		notes := anchor.Notes
		if input.Notes != nil {
			notes = strings.TrimSpace(*input.Notes)
		}
		displayColor := anchor.DisplayColor
		if input.DisplayColor != nil {
			displayColor = normalizeBookingColor(*input.DisplayColor)
		}

		groupID := anchor.BookingGroupID
		if groupID == "" && len(targetSlots) > 1 {
			groupID = uuid.NewString()
		}

		active := make([]*models.Booking, 0, len(targetSlots))
		for i := range targetSlots {
			var booking *models.Booking
			if i < len(group) {
				booking = &group[i]
			} else {
				booking = &models.Booking{
					BookingCode:    fmt.Sprintf("BK-%s", strings.ToUpper(uuid.NewString()[:8])),
					Status:         anchor.Status,
					ExpiresAt:      anchor.ExpiresAt,
					BookingGroupID: groupID,
				}
			}

			booking.BookingGroupID = groupID
			booking.DisplayColor = displayColor
			booking.UserID = customer.ID
			booking.User = *customer
			booking.CourtID = targetSlots[i].CourtID
			booking.Court = targetSlots[i].Court
			booking.TimeSlotID = targetSlots[i].ID
			booking.TimeSlot = targetSlots[i]
			booking.CustomerType = customerType
			booking.Notes = notes
			booking.TotalPrice = targetSlots[i].Price
			booking.CanceledAt = nil
			booking.CancelReason = nil

			if booking.ID == 0 {
				if err := bookingsRepo.Create(booking); err != nil {
					return err
				}
			} else if err := bookingsRepo.Update(booking); err != nil {
				return err
			}
			active = append(active, booking)
		}

		now := timeutil.Now()
		rescheduleReason := "booking rescheduled"
		for i := len(targetSlots); i < len(group); i++ {
			group[i].Status = models.BookingCanceled
			group[i].CanceledAt = &now
			group[i].CancelReason = &rescheduleReason
			group[i].DepositPaid = 0
			group[i].RemainingDue = 0
			if err := bookingsRepo.Update(&group[i]); err != nil {
				return err
			}
		}

		newTotal := int64(0)
		for _, booking := range active {
			newTotal += booking.TotalPrice
		}
		targetPaid := currentPaid
		if input.PaymentTotal != nil {
			targetPaid = *input.PaymentTotal
		}
		if targetPaid < 0 {
			return errors.New("payment total must be zero or greater")
		}
		if targetPaid > newTotal {
			return errors.New("payment total cannot exceed updated booking total")
		}

		delta := targetPaid - currentPaid
		reason := ""
		if input.PaymentAdjustmentReason != nil {
			reason = strings.TrimSpace(*input.PaymentAdjustmentReason)
		}
		if delta < 0 && reason == "" {
			return errors.New("payment adjustment reason is required when reducing received amount")
		}
		method := "manual"
		if input.PaymentMethod != nil && strings.TrimSpace(*input.PaymentMethod) != "" {
			method = strings.TrimSpace(*input.PaymentMethod)
		}
		reference := ""
		if input.PaymentReference != nil {
			reference = strings.TrimSpace(*input.PaymentReference)
		}
		if delta != 0 {
			paymentFor := "payment"
			if delta < 0 {
				paymentFor = "payment_adjustment"
			}
			if err := paymentsRepo.Create(&models.Payment{
				BookingID:    active[0].ID,
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

		remainingPaid := targetPaid
		for _, booking := range active {
			allocated := remainingPaid
			if allocated > booking.TotalPrice {
				allocated = booking.TotalPrice
			}
			booking.DepositPaid = allocated
			booking.RemainingDue = booking.TotalPrice - allocated
			remainingPaid -= allocated
			if booking.DepositPaid > 0 && booking.Status == models.BookingPending {
				booking.Status = models.BookingConfirmed
				booking.ExpiresAt = nil
			}
			if err := bookingsRepo.Update(booking); err != nil {
				return err
			}
		}

		afterSlots := make([]map[string]any, 0, len(active))
		for _, booking := range active {
			afterSlots = append(afterSlots, map[string]any{
				"booking_id": booking.ID,
				"slot_id":    booking.TimeSlotID,
				"court_id":   booking.CourtID,
				"start_time": booking.TimeSlot.StartTime,
				"end_time":   booking.TimeSlot.EndTime,
				"price":      booking.TotalPrice,
			})
		}
		auditPayload, _ := json.Marshal(map[string]any{
			"before_slots":      beforeSlots,
			"after_slots":       afterSlots,
			"old_payment_total": currentPaid,
			"new_payment_total": targetPaid,
			"payment_delta":     delta,
			"reason":            reason,
			"actor_role":        actorRole,
		})
		if err := tx.Create(&models.AuditLog{
			ActorID:    actorID,
			Action:     "booking_group_rescheduled",
			TargetType: "booking_group",
			TargetID:   groupID,
			Payload:    string(auditPayload),
		}).Error; err != nil {
			return err
		}

		result = active
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}
