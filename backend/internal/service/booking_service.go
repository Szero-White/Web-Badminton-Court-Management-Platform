package service

import (
	"context"
	"errors"
	"log"
	"strings"
	"sync"
	"time"

	"badminton-platform/backend/internal/config"
	"badminton-platform/backend/internal/models"
	"badminton-platform/backend/internal/pricing"
	"badminton-platform/backend/internal/repository"

	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

var ErrBookingAccessDenied = errors.New("booking access denied")

type BookingService struct {
	db         *gorm.DB
	cfg        *config.Config
	users      *repository.UserRepository
	slots      *repository.SlotRepository
	bookings   *repository.BookingRepository
	payments   *repository.PaymentRepository
	priceRules *repository.PriceRuleRepository
	redis      *redis.Client
	lockMu     sync.Mutex
	locks      map[uint]time.Time
}

type BookingUpdateInput struct {
	TimeSlotID              *uint
	CustomerPhone           *string
	CustomerName            *string
	CustomerType            *string
	Notes                   *string
	PaymentTotal            *int64
	PaymentMethod           *string
	PaymentReference        *string
	PaymentAdjustmentReason *string
	DisplayColor            *string
}

type BookingGroupUpdateInput struct {
	TimeSlotIDs             []uint
	CustomerPhone           *string
	CustomerName            *string
	CustomerType            *string
	Notes                   *string
	PaymentTotal            *int64
	PaymentMethod           *string
	PaymentReference        *string
	PaymentAdjustmentReason *string
	DisplayColor            *string
}

func NewBookingService(
	database *gorm.DB,
	cfg *config.Config,
	users *repository.UserRepository,
	slots *repository.SlotRepository,
	bookings *repository.BookingRepository,
	payments *repository.PaymentRepository,
	priceRules *repository.PriceRuleRepository,
	redisClient *redis.Client,
) *BookingService {
	return &BookingService{
		db:         database,
		cfg:        cfg,
		users:      users,
		slots:      slots,
		bookings:   bookings,
		payments:   payments,
		priceRules: priceRules,
		redis:      redisClient,
		locks:      make(map[uint]time.Time),
	}
}

func (s *BookingService) StartExpiryWorker(ctx context.Context, interval time.Duration) {
	if interval <= 0 {
		interval = time.Minute
	}
	go func() {
		s.expirePendingBookings()
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				s.expirePendingBookings()
			}
		}
	}()
}

func (s *BookingService) expirePendingBookings() {
	if count, err := s.bookings.ExpirePending(time.Now()); err != nil {
		log.Printf("booking expiry worker: %v", err)
	} else if count > 0 {
		log.Printf("booking expiry worker: released %d expired hold(s)", count)
	}
	s.cleanupMemoryLocks()
}

func (s *BookingService) cleanupMemoryLocks() {
	now := time.Now()
	s.lockMu.Lock()
	defer s.lockMu.Unlock()
	for slotID, expiresAt := range s.locks {
		if !expiresAt.After(now) {
			delete(s.locks, slotID)
		}
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

func normalizeBookingColor(value string) string {
	value = strings.TrimSpace(strings.ToLower(value))
	if len(value) == 7 && strings.HasPrefix(value, "#") {
		for _, ch := range value[1:] {
			if !((ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f')) {
				return "#6f9f94"
			}
		}
		return value
	}
	return "#6f9f94"
}

func (s *BookingService) currentSlotPrice(slot *models.TimeSlot) (int64, error) {
	rules, err := s.priceRules.ListActiveForCourtAndDate(slot.CourtID, slot.StartTime)
	if err != nil {
		return 0, err
	}
	return pricing.ResolveRulePrice(slot.Court.BasePrice, slot.StartTime, rules), nil
}
