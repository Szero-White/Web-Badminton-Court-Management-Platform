package service

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"badminton-platform/backend/internal/config"
	"badminton-platform/backend/internal/models"
	"badminton-platform/backend/internal/repository"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type BookingService struct {
	db       *gorm.DB
	cfg      *config.Config
	users    *repository.UserRepository
	slots    *repository.SlotRepository
	bookings *repository.BookingRepository
	payments *repository.PaymentRepository
	redis    *redis.Client
	lockMu   sync.Mutex
	locks    map[uint]time.Time
}

type BookingUpdateInput struct {
	TimeSlotID    *uint
	CustomerPhone *string
	CustomerName  *string
	CustomerType  *string
	Notes         *string
	DepositTotal  *int64
}

func NewBookingService(db *gorm.DB, cfg *config.Config, users *repository.UserRepository, slots *repository.SlotRepository, bookings *repository.BookingRepository, payments *repository.PaymentRepository, redis *redis.Client) *BookingService {
	return &BookingService{
		db:       db,
		cfg:      cfg,
		users:    users,
		slots:    slots,
		bookings: bookings,
		payments: payments,
		redis:    redis,
		locks:    map[uint]time.Time{},
	}
}

func normalizeCustomerType(value string) models.BookingCustomerType {
	switch strings.TrimSpace(strings.ToLower(value)) {
	case string(models.BookingCustomerMonthly):
		return models.BookingCustomerMonthly
	default:
		return models.BookingCustomerWalkIn
	}
}

func (s *BookingService) ensureCustomerByPhone(phone, fullName string) (*models.User, error) {
	phone = strings.TrimSpace(phone)
	fullName = strings.TrimSpace(fullName)
	if phone == "" {
		return nil, errors.New("phone is required")
	}

	if fullName == "" {
		fullName = "Khach tai quay"
	}

	user, err := s.users.FindByPhone(phone)
	if err == nil {
		// Keep customer name in sync with the latest name entered by staff.
		if fullName != "" && user.FullName != fullName {
			user.FullName = fullName
			if updateErr := s.users.Update(user); updateErr != nil {
				return nil, updateErr
			}
		}
		return user, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	email := fmt.Sprintf("guest_%s@bcm.local", strings.ReplaceAll(phone, " ", ""))
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(uuid.NewString()), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	newUser := &models.User{
		FullName:     fullName,
		Email:        email,
		Phone:        phone,
		PasswordHash: string(passwordHash),
		Role:         models.RoleCustomer,
	}

	if err := s.users.Create(newUser); err != nil {
		// If concurrently created, fetch again by phone.
		if user2, findErr := s.users.FindByPhone(phone); findErr == nil {
			return user2, nil
		}
		return nil, err
	}

	return newUser, nil
}

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

func combineBookingNote(startAt, endAt time.Time, notes string) string {
	base := fmt.Sprintf("Đặt từ %s đến %s", formatBookingClock(startAt), formatBookingClock(endAt))
	notes = strings.TrimSpace(notes)
	if notes == "" {
		return base
	}
	return base + " | Ghi chú: " + notes
}

func formatBookingClock(at time.Time) string {
	loc, err := time.LoadLocation("Asia/Ho_Chi_Minh")
	if err != nil {
		return at.Local().Format("15:04")
	}
	return at.In(loc).Format("15:04")
}

func (s *BookingService) createPendingBookingWithTx(tx *gorm.DB, userID uint, slot *models.TimeSlot, customerType, notes string) (*models.Booking, error) {
	booking := &models.Booking{
		BookingCode:  fmt.Sprintf("BK-%s", uuid.NewString()[:8]),
		UserID:       userID,
		CourtID:      slot.CourtID,
		TimeSlotID:   slot.ID,
		CustomerType: normalizeCustomerType(customerType),
		Notes:        notes,
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
		expires, exists := s.locks[slotID]
		if exists && expires.After(now) {
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

	if s.redis == nil {
		return
	}
	_ = s.redis.Del(ctx, key).Err()
}

func (s *BookingService) CreatePendingBooking(ctx context.Context, userID uint, slotID uint, customerType string, notes string) (*models.Booking, error) {
	slot, err := s.slots.FindByID(slotID)
	if err != nil {
		return nil, err
	}

	lockKey, err := s.reserveLock(ctx, slotID)
	if err != nil {
		return nil, err
	}

	var createdBooking *models.Booking
	err = s.db.Transaction(func(tx *gorm.DB) error {
		if existing, existingErr := s.bookings.WithTx(tx).FindActiveByTimeSlotIDExcludeBooking(slot.ID, 0); existingErr != nil {
			return existingErr
		} else if existing != nil {
			return errors.New("slot already booked")
		}

		booking, createErr := s.createPendingBookingWithTx(tx, userID, slot, customerType, notes)
		if createErr != nil {
			return createErr
		}
		if booking == nil {
			return errors.New("failed to create booking")
		}
		createdBooking = booking
		return nil
	})
	if err != nil {
		s.releaseLock(ctx, lockKey)
		return nil, err
	}

	return createdBooking, nil
}

func (s *BookingService) CreatePendingBookingRange(ctx context.Context, userID uint, startSlotID, endSlotID uint, customerType, notes string) ([]*models.Booking, error) {
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
	if !startSlot.StartTime.Before(endSlot.StartTime) {
		return nil, errors.New("end time must be after start time")
	}

	allSlots, err := s.slots.ListByCourtAndDate(startSlot.CourtID, startSlot.StartTime)
	if err != nil {
		return nil, err
	}

	selectedSlots := make([]models.TimeSlot, 0)
	for _, slot := range allSlots {
		if (slot.StartTime.Equal(startSlot.StartTime) || slot.StartTime.After(startSlot.StartTime)) && slot.StartTime.Before(endSlot.StartTime) {
			selectedSlots = append(selectedSlots, slot)
		}
	}
	if len(selectedSlots) == 0 {
		return nil, errors.New("no slots found in selected range")
	}

	rangeStart := selectedSlots[0].StartTime
	rangeEnd := selectedSlots[len(selectedSlots)-1].EndTime
	combinedNote := combineBookingNote(rangeStart, rangeEnd, notes)
	lockKeys := make([]string, 0, len(selectedSlots))
	for _, slot := range selectedSlots {
		lockKey, lockErr := s.reserveLock(ctx, slot.ID)
		if lockErr != nil {
			for _, key := range lockKeys {
				s.releaseLock(ctx, key)
			}
			return nil, lockErr
		}
		lockKeys = append(lockKeys, lockKey)
	}

	bookings := make([]*models.Booking, 0, len(selectedSlots))
	err = s.db.Transaction(func(tx *gorm.DB) error {
		for _, slot := range selectedSlots {
			if existing, existingErr := s.bookings.WithTx(tx).FindActiveByTimeSlotIDExcludeBooking(slot.ID, 0); existingErr != nil {
				return existingErr
			} else if existing != nil {
				return fmt.Errorf("slot %s is already booked", formatBookingClock(slot.StartTime))
			}

			booking, createErr := s.createPendingBookingWithTx(tx, userID, &slot, customerType, combinedNote)
			if createErr != nil {
				return createErr
			}
			bookings = append(bookings, booking)
		}
		return nil
	})
	if err != nil {
		for _, key := range lockKeys {
			s.releaseLock(ctx, key)
		}
		return nil, err
	}

	return bookings, nil
}

func (s *BookingService) ConfirmDeposit(ctx context.Context, bookingID uint, amount int64, method, reference string) (*models.Booking, error) {
	booking, err := s.bookings.FindByID(bookingID)
	if err != nil {
		return nil, err
	}
	if amount <= 0 {
		return nil, errors.New("deposit amount must be greater than zero")
	}

	if booking.Status == models.BookingCanceled || booking.Status == models.BookingCompleted || booking.Status == models.BookingNoShow {
		return nil, errors.New("booking cannot receive deposit in current status")
	}

	err = s.db.Transaction(func(tx *gorm.DB) error {
		bRepo := s.bookings.WithTx(tx)
		pRepo := s.payments.WithTx(tx)

		payment := &models.Payment{
			BookingID:  booking.ID,
			Amount:     amount,
			PaymentFor: "deposit",
			Method:     method,
			Status:     "success",
			Reference:  reference,
		}
		if err := pRepo.Create(payment); err != nil {
			return err
		}

		if booking.Status == models.BookingPending {
			booking.Status = models.BookingConfirmed
		}
		booking.DepositPaid += amount
		booking.RemainingDue = booking.TotalPrice - booking.DepositPaid
		booking.ExpiresAt = nil
		if booking.RemainingDue < 0 {
			booking.RemainingDue = 0
		}
		if err := bRepo.Update(booking); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	lockKey := fmt.Sprintf("lock:slot:%d", booking.TimeSlotID)
	s.releaseLock(ctx, lockKey)
	return booking, nil
}

func (s *BookingService) CancelBooking(ctx context.Context, bookingID uint, reason string) (*models.Booking, int64, error) {
	booking, err := s.bookings.FindByID(bookingID)
	if err != nil {
		return nil, 0, err
	}
	if booking.Status == models.BookingCanceled || booking.Status == models.BookingCompleted {
		return nil, 0, errors.New("booking cannot be canceled")
	}

	hoursLeft := booking.TimeSlot.StartTime.Sub(time.Now()).Hours()
	refund := int64(0)
	if hoursLeft >= float64(s.cfg.CancelPolicyHours) {
		refund = booking.DepositPaid
	} else {
		refund = booking.DepositPaid / 2
	}

	now := time.Now()
	booking.Status = models.BookingCanceled
	booking.CanceledAt = &now
	booking.CancelReason = &reason

	if err := s.bookings.Update(booking); err != nil {
		return nil, 0, err
	}

	lockKey := fmt.Sprintf("lock:slot:%d", booking.TimeSlotID)
	s.releaseLock(ctx, lockKey)

	return booking, refund, nil
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

	booking.Status = models.BookingCheckedIn
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

func (s *BookingService) UpdateBooking(ctx context.Context, bookingID uint, input BookingUpdateInput) (*models.Booking, error) {
	booking, err := s.bookings.FindByID(bookingID)
	if err != nil {
		return nil, err
	}
	if booking.Status == models.BookingCanceled || booking.Status == models.BookingCompleted {
		return nil, errors.New("booking cannot be updated")
	}

	if input.CustomerPhone != nil || input.CustomerName != nil {
		phone := booking.User.Phone
		name := booking.User.FullName
		if input.CustomerPhone != nil {
			phone = strings.TrimSpace(*input.CustomerPhone)
		}
		if input.CustomerName != nil {
			name = strings.TrimSpace(*input.CustomerName)
		}

		updatedUser, userErr := s.ensureCustomerByPhone(phone, name)
		if userErr != nil {
			return nil, userErr
		}
		booking.UserID = updatedUser.ID
		booking.User = *updatedUser
	}

	var nextSlot *models.TimeSlot
	if input.TimeSlotID != nil && *input.TimeSlotID != booking.TimeSlotID {
		slot, slotErr := s.slots.FindByID(*input.TimeSlotID)
		if slotErr != nil {
			return nil, slotErr
		}
		nextSlot = slot
	}

	err = s.db.Transaction(func(tx *gorm.DB) error {
		bRepo := s.bookings.WithTx(tx)
		if nextSlot != nil {
			if nextSlot.CourtID != booking.CourtID || nextSlot.ID != booking.TimeSlotID {
				if existing, existingErr := bRepo.FindActiveByTimeSlotIDExcludeBooking(nextSlot.ID, booking.ID); existingErr != nil {
					return existingErr
				} else if existing != nil {
					return errors.New("selected slot is already booked")
				}
			}
			booking.TimeSlotID = nextSlot.ID
			booking.TimeSlot = *nextSlot
			booking.CourtID = nextSlot.CourtID
			booking.Court = nextSlot.Court
			booking.TotalPrice = nextSlot.Price
			booking.RemainingDue = booking.TotalPrice - booking.DepositPaid
			if booking.RemainingDue < 0 {
				booking.RemainingDue = 0
			}
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

				booking.DepositPaid = nextDeposit
				booking.RemainingDue = booking.TotalPrice - booking.DepositPaid
				if booking.RemainingDue < 0 {
					booking.RemainingDue = 0
				}
				if booking.DepositPaid > 0 && booking.Status == models.BookingPending {
					booking.Status = models.BookingConfirmed
					booking.ExpiresAt = nil
				}
			}

		if err := bRepo.Update(booking); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return booking, nil
}
