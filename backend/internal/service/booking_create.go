package service

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"badminton-platform/backend/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

func (s *BookingService) CreatePendingBookingForPhone(ctx context.Context, phone, fullName, customerType string, slotID uint, notes string) (*models.Booking, error) {
	user, err := s.ensureCustomerByPhone(phone, fullName)
	if err != nil {
		return nil, err
	}
	return s.CreatePendingBooking(ctx, user.ID, slotID, customerType, notes)
}

func (s *BookingService) CreatePendingBookingRangeForPhone(ctx context.Context, phone, fullName, customerType string, startSlotID, endSlotID uint, notes string) ([]*models.Booking, error) {
	user, err := s.ensureCustomerByPhone(phone, fullName)
	if err != nil {
		return nil, err
	}
	return s.CreatePendingBookingRange(ctx, user.ID, startSlotID, endSlotID, customerType, notes)
}

func (s *BookingService) createPendingBookingWithTx(tx *gorm.DB, userID uint, slot *models.TimeSlot, customerType, notes string) (*models.Booking, error) {
	booking := &models.Booking{
		BookingCode:  fmt.Sprintf("BK-%s", strings.ToUpper(uuid.NewString()[:8])),
		UserID:       userID,
		CourtID:      slot.CourtID,
		TimeSlotID:   slot.ID,
		CustomerType: normalizeCustomerType(customerType),
		Notes:        strings.TrimSpace(notes),
		Status:       models.BookingPending,
		TotalPrice:   slot.Price,
		DepositPaid:  0,
		RemainingDue: slot.Price,
	}
	expiresAt := time.Now().Add(time.Duration(s.cfg.BookingHoldMinutes) * time.Minute)
	booking.ExpiresAt = &expiresAt
	if err := tx.Create(booking).Error; err != nil {
		return nil, err
	}
	return booking, nil
}

func (s *BookingService) reserveLock(ctx context.Context, slotID uint) (string, error) {
	if s.redis == nil {
		s.lockMu.Lock()
		defer s.lockMu.Unlock()
		now := time.Now()
		if expires, exists := s.locks[slotID]; exists && expires.After(now) {
			return "", errors.New("slot already held by another user")
		}
		s.locks[slotID] = now.Add(time.Duration(s.cfg.BookingHoldMinutes) * time.Minute)
		return fmt.Sprintf("mem:%d", slotID), nil
	}

	key := fmt.Sprintf("lock:slot:%d", slotID)
	ok, err := s.redis.SetNX(ctx, key, "locked", time.Duration(s.cfg.BookingHoldMinutes)*time.Minute).Result()
	if err != nil {
		return "", err
	}
	if !ok {
		return "", errors.New("slot already held by another user")
	}
	return key, nil
}

func (s *BookingService) releaseLock(ctx context.Context, key string) {
	if key == "" {
		return
	}
	if strings.HasPrefix(key, "mem:") {
		slotID, err := strconv.ParseUint(strings.TrimPrefix(key, "mem:"), 10, 64)
		if err != nil {
			return
		}
		s.lockMu.Lock()
		delete(s.locks, uint(slotID))
		s.lockMu.Unlock()
		return
	}
	if s.redis != nil {
		_ = s.redis.Del(ctx, key).Err()
	}
}

func (s *BookingService) CreatePendingBooking(ctx context.Context, userID, slotID uint, customerType, notes string) (*models.Booking, error) {
	if err := s.bookings.ExpirePendingByTimeSlot(slotID, time.Now()); err != nil {
		return nil, err
	}
	slot, err := s.slots.FindByID(slotID)
	if err != nil {
		return nil, err
	}
	if !slot.Court.IsActive || slot.Court.IsMaintenance {
		return nil, errors.New("court is not available")
	}
	if slot.StartTime.Before(time.Now()) {
		return nil, errors.New("cannot book a past time slot")
	}

	lockKey, err := s.reserveLock(ctx, slotID)
	if err != nil {
		return nil, err
	}
	var created *models.Booking
	err = s.db.Transaction(func(tx *gorm.DB) error {
		bookings := s.bookings.WithTx(tx)
		if existing, findErr := bookings.FindActiveByTimeSlotIDExcludeBooking(slot.ID, 0); findErr != nil {
			return findErr
		} else if existing != nil {
			return errors.New("slot already booked")
		}
		created, err = s.createPendingBookingWithTx(tx, userID, slot, customerType, notes)
		return err
	})
	if err != nil {
		s.releaseLock(ctx, lockKey)
		return nil, err
	}
	return created, nil
}

func (s *BookingService) CreatePendingBookingRange(ctx context.Context, userID, startSlotID, endSlotID uint, customerType, notes string) ([]*models.Booking, error) {
	if startSlotID == 0 || endSlotID == 0 {
		return nil, errors.New("start and end slot are required")
	}
	startSlot, err := s.slots.FindByID(startSlotID)
	if err != nil {
		return nil, err
	}
	endSlot, err := s.slots.FindByID(endSlotID)
	if err != nil {
		return nil, err
	}
	if startSlot.CourtID != endSlot.CourtID {
		return nil, errors.New("start and end slot must be on the same court")
	}
	if !startSlot.Court.IsActive || startSlot.Court.IsMaintenance {
		return nil, errors.New("court is not available")
	}
	if !startSlot.StartTime.Before(endSlot.StartTime) {
		return nil, errors.New("end time must be after start time")
	}
	if startSlot.StartTime.Before(time.Now()) {
		return nil, errors.New("cannot book a past time slot")
	}

	allSlots, err := s.slots.ListByCourtAndDate(startSlot.CourtID, startSlot.StartTime)
	if err != nil {
		return nil, err
	}
	selected := make([]models.TimeSlot, 0)
	for _, slot := range allSlots {
		if !slot.StartTime.Before(startSlot.StartTime) && slot.StartTime.Before(endSlot.StartTime) {
			selected = append(selected, slot)
		}
	}
	if len(selected) == 0 {
		return nil, errors.New("no slots found in selected range")
	}

	combinedNote := combineBookingNote(selected[0].StartTime, selected[len(selected)-1].EndTime, notes)
	lockKeys := make([]string, 0, len(selected))
	for _, slot := range selected {
		if err := s.bookings.ExpirePendingByTimeSlot(slot.ID, time.Now()); err != nil {
			releaseLocks(ctx, s, lockKeys)
			return nil, err
		}
		key, lockErr := s.reserveLock(ctx, slot.ID)
		if lockErr != nil {
			releaseLocks(ctx, s, lockKeys)
			return nil, lockErr
		}
		lockKeys = append(lockKeys, key)
	}

	created := make([]*models.Booking, 0, len(selected))
	err = s.db.Transaction(func(tx *gorm.DB) error {
		bookings := s.bookings.WithTx(tx)
		for _, slot := range selected {
			if existing, findErr := bookings.FindActiveByTimeSlotIDExcludeBooking(slot.ID, 0); findErr != nil {
				return findErr
			} else if existing != nil {
				return fmt.Errorf("slot %s is already booked", formatBookingClock(slot.StartTime))
			}
			booking, createErr := s.createPendingBookingWithTx(tx, userID, &slot, customerType, combinedNote)
			if createErr != nil {
				return createErr
			}
			created = append(created, booking)
		}
		return nil
	})
	if err != nil {
		releaseLocks(ctx, s, lockKeys)
		return nil, err
	}
	return created, nil
}

func releaseLocks(ctx context.Context, service *BookingService, keys []string) {
	for _, key := range keys {
		service.releaseLock(ctx, key)
	}
}
