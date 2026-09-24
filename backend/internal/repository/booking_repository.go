package repository

import (
	"errors"
	"time"

	"badminton-platform/backend/internal/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type BookingRepository struct{ db *gorm.DB }

func (r *BookingRepository) WithTx(tx *gorm.DB) *BookingRepository {
	return &BookingRepository{db: tx}
}

func (r *BookingRepository) Create(booking *models.Booking) error {
	return r.db.Create(booking).Error
}

func (r *BookingRepository) Update(booking *models.Booking) error {
	return r.db.Save(booking).Error
}

func (r *BookingRepository) FindByID(id uint) (*models.Booking, error) {
	var booking models.Booking
	if err := r.db.Preload("TimeSlot").Preload("Court").Preload("User").First(&booking, id).Error; err != nil {
		return nil, err
	}
	return &booking, nil
}

func (r *BookingRepository) FindByIDForUpdate(id uint) (*models.Booking, error) {
	var booking models.Booking
	if err := r.db.Clauses(clause.Locking{Strength: "UPDATE"}).Preload("TimeSlot").Preload("Court").Preload("User").First(&booking, id).Error; err != nil {
		return nil, err
	}
	return &booking, nil
}

func (r *BookingRepository) FindActiveByTimeSlotIDExcludeBooking(slotID, excludeBookingID uint) (*models.Booking, error) {
	var booking models.Booking
	err := r.db.
		Where("time_slot_id = ?", slotID).
		Where("status IN ? OR (status = ? AND (expires_at IS NULL OR expires_at > ?))",
			[]models.BookingStatus{models.BookingConfirmed, models.BookingCheckedIn, models.BookingCompleted},
			models.BookingPending,
			time.Now(),
		).
		Where("id <> ?", excludeBookingID).
		First(&booking).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &booking, nil
}

func (r *BookingRepository) ExpirePending(now time.Time) (int64, error) {
	reason := "booking hold expired"
	result := r.db.Model(&models.Booking{}).
		Where("status = ? AND expires_at IS NOT NULL AND expires_at <= ?", models.BookingPending, now).
		Updates(map[string]any{
			"status":        models.BookingCanceled,
			"canceled_at":   now,
			"cancel_reason": reason,
		})
	return result.RowsAffected, result.Error
}

func (r *BookingRepository) ExpirePendingByTimeSlot(slotID uint, now time.Time) error {
	reason := "booking hold expired"
	return r.db.Model(&models.Booking{}).
		Where("time_slot_id = ? AND status = ? AND expires_at IS NOT NULL AND expires_at <= ?", slotID, models.BookingPending, now).
		Updates(map[string]any{
			"status":        models.BookingCanceled,
			"canceled_at":   now,
			"cancel_reason": reason,
		}).Error
}

func (r *BookingRepository) ListByDateWithDetails(day time.Time) ([]BookingAdminView, error) {
	start, end := dayBounds(day)
	type row struct {
		ID            uint
		BookingCode   string
		UserID        uint
		CustomerName  string
		CustomerPhone string
		CourtID       uint
		CourtName     string
		CourtType     string
		TimeSlotID    uint
		StartTime     time.Time
		EndTime       time.Time
		CustomerType  string
		Notes         string
		Status        string
		TotalPrice    int64
		DepositPaid   int64
		RemainingDue  int64
		ExpiresAt     *time.Time
		CanceledAt    *time.Time
		CancelReason  *string
		CreatedAt     time.Time
		UpdatedAt     time.Time
	}

	var rows []row
	err := r.db.Raw(`
		SELECT b.id, b.booking_code, b.user_id,
		       u.full_name AS customer_name, u.phone AS customer_phone,
		       b.court_id, c.name AS court_name, c.court_type,
		       b.time_slot_id, ts.start_time, ts.end_time,
		       b.customer_type, b.notes, b.status,
		       b.total_price, b.deposit_paid, b.remaining_due,
		       b.expires_at, b.canceled_at, b.cancel_reason,
		       b.created_at, b.updated_at
		FROM bookings b
		JOIN users u ON u.id = b.user_id
		JOIN courts c ON c.id = b.court_id
		JOIN time_slots ts ON ts.id = b.time_slot_id
		WHERE ts.start_time >= ? AND ts.start_time < ?
		ORDER BY c.id ASC, ts.start_time ASC, b.id ASC`, start, end).Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	views := make([]BookingAdminView, 0, len(rows))
	for _, row := range rows {
		views = append(views, BookingAdminView{
			ID:            row.ID,
			BookingCode:   row.BookingCode,
			UserID:        row.UserID,
			CustomerName:  row.CustomerName,
			CustomerPhone: row.CustomerPhone,
			CourtID:       row.CourtID,
			CourtName:     row.CourtName,
			CourtType:     row.CourtType,
			TimeSlotID:    row.TimeSlotID,
			StartTime:     row.StartTime,
			EndTime:       row.EndTime,
			CustomerType:  row.CustomerType,
			Notes:         row.Notes,
			Status:        row.Status,
			TotalPrice:    row.TotalPrice,
			DepositPaid:   row.DepositPaid,
			RemainingDue:  row.RemainingDue,
			ExpiresAt:     row.ExpiresAt,
			CanceledAt:    row.CanceledAt,
			CancelReason:  row.CancelReason,
			CreatedAt:     row.CreatedAt,
			UpdatedAt:     row.UpdatedAt,
		})
	}
	return views, nil
}

func (r *BookingRepository) FindByCodeOrPhone(query string) (*models.Booking, error) {
	var booking models.Booking
	err := r.db.
		Joins("JOIN users ON users.id = bookings.user_id").
		Where("bookings.booking_code = ? OR users.phone = ?", query, query).
		Where("bookings.status IN ?", []models.BookingStatus{models.BookingPending, models.BookingConfirmed, models.BookingCheckedIn}).
		Where("bookings.status <> ? OR bookings.expires_at IS NULL OR bookings.expires_at > ?", models.BookingPending, time.Now()).
		Preload("TimeSlot").
		Preload("Court").
		Preload("User").
		Order("bookings.id DESC").
		First(&booking).Error
	if err != nil {
		return nil, err
	}
	return &booking, nil
}

func (r *BookingRepository) ListByUser(userID uint) ([]models.Booking, error) {
	var bookings []models.Booking
	err := r.db.Where("user_id = ?", userID).
		Preload("TimeSlot").
		Preload("Court").
		Order("id desc").
		Find(&bookings).Error
	return bookings, err
}

func (r *BookingRepository) CancellationRate() (float64, error) {
	var total int64
	var canceled int64
	if err := r.db.Model(&models.Booking{}).Count(&total).Error; err != nil {
		return 0, err
	}
	if total == 0 {
		return 0, nil
	}
	if err := r.db.Model(&models.Booking{}).
		Where("status IN ?", []models.BookingStatus{models.BookingCanceled, models.BookingNoShow}).
		Where("cancel_reason IS NULL OR cancel_reason <> ?", "booking hold expired").
		Count(&canceled).Error; err != nil {
		return 0, err
	}
	return (float64(canceled) / float64(total)) * 100, nil
}

func (r *BookingRepository) OccupancyByCourt(day time.Time) (map[uint]float64, error) {
	start, end := dayBounds(day)
	type row struct {
		CourtID uint
		Total   int64
		Used    int64
	}
	var rows []row
	err := r.db.Raw(`
		SELECT ts.court_id,
		       COUNT(ts.id) AS total,
		       SUM(CASE WHEN b.id IS NOT NULL THEN 1 ELSE 0 END) AS used
		FROM time_slots ts
		LEFT JOIN bookings b ON b.time_slot_id = ts.id
		 AND (b.status IN ('confirmed','checked_in','completed')
		      OR (b.status = 'pending' AND (b.expires_at IS NULL OR b.expires_at > ?)))
		WHERE ts.start_time >= ? AND ts.start_time < ?
		GROUP BY ts.court_id`, time.Now(), start, end).Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	result := make(map[uint]float64, len(rows))
	for _, row := range rows {
		if row.Total == 0 {
			result[row.CourtID] = 0
			continue
		}
		result[row.CourtID] = (float64(row.Used) / float64(row.Total)) * 100
	}
	return result, nil
}

func (r *BookingRepository) PeakHours(day time.Time) (map[int]int64, error) {
	start, end := dayBounds(day)
	var slots []models.TimeSlot
	err := r.db.Model(&models.TimeSlot{}).
		Joins("JOIN bookings ON bookings.time_slot_id = time_slots.id").
		Where("time_slots.start_time >= ? AND time_slots.start_time < ?", start, end).
		Where("bookings.status IN ?", []models.BookingStatus{models.BookingConfirmed, models.BookingCheckedIn, models.BookingCompleted}).
		Select("time_slots.start_time").
		Scan(&slots).Error
	if err != nil {
		return nil, err
	}

	result := make(map[int]int64)
	for _, slot := range slots {
		result[slot.StartTime.Hour()]++
	}
	return result, nil
}
