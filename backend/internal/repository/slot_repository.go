package repository

import (
	"time"

	"badminton-platform/backend/internal/models"

	"gorm.io/gorm"
)

type SlotRepository struct{ db *gorm.DB }

func (r *SlotRepository) BulkCreate(slots []models.TimeSlot) error {
	if len(slots) == 0 {
		return nil
	}
	return r.db.CreateInBatches(&slots, 200).Error
}

func (r *SlotRepository) ListAvailableByDate(day time.Time) ([]models.TimeSlot, error) {
	start, end := dayBounds(day)
	now := time.Now()
	blocking := r.db.Model(&models.Booking{}).
		Select("time_slot_id").
		Where("status IN ? OR (status = ? AND (expires_at IS NULL OR expires_at > ?))",
			[]models.BookingStatus{models.BookingConfirmed, models.BookingCheckedIn, models.BookingCompleted},
			models.BookingPending,
			now,
		)

	var slots []models.TimeSlot
	err := r.db.Model(&models.TimeSlot{}).
		Joins("JOIN courts ON courts.id = time_slots.court_id").
		Preload("Court").
		Where("time_slots.start_time >= ? AND time_slots.start_time < ?", start, end).
		Where("courts.is_active = ? AND courts.is_maintenance = ?", true, false).
		Where("time_slots.id NOT IN (?)", blocking).
		Order("time_slots.start_time asc").
		Find(&slots).Error
	return slots, err
}

func (r *SlotRepository) FindByID(id uint) (*models.TimeSlot, error) {
	var slot models.TimeSlot
	if err := r.db.Preload("Court").First(&slot, id).Error; err != nil {
		return nil, err
	}
	return &slot, nil
}

func (r *SlotRepository) ListByDateWithStatus(day time.Time) ([]SlotDayView, error) {
	start, end := dayBounds(day)
	now := time.Now()
	type row struct {
		ID            uint
		CourtID       uint
		CourtName     string
		CourtType     string
		StartTime     time.Time
		EndTime       time.Time
		Price         int64
		BookingID     *uint
		BookingCode   *string
		BookingStat   *string
		CustomerName  *string
		CustomerPhone *string
		CustomerType  *string
		BookingNote   *string
		DepositPaid   *int64
		RemainingDue  *int64
	}

	var rows []row
	err := r.db.Raw(`
		SELECT ts.id, ts.court_id, c.name AS court_name, c.court_type,
		       ts.start_time, ts.end_time, ts.price,
		       b.id AS booking_id, b.booking_code, b.status AS booking_stat,
		       u.full_name AS customer_name, u.phone AS customer_phone,
		       b.customer_type, b.notes AS booking_note, b.deposit_paid, b.remaining_due
		FROM time_slots ts
		JOIN courts c ON c.id = ts.court_id
		LEFT JOIN bookings b ON b.time_slot_id = ts.id
		 AND (b.status IN ('confirmed','checked_in','completed')
		      OR (b.status = 'pending' AND (b.expires_at IS NULL OR b.expires_at > ?)))
		LEFT JOIN users u ON u.id = b.user_id
		WHERE ts.start_time >= ? AND ts.start_time < ?
		ORDER BY c.id ASC, ts.start_time ASC`, now, start, end).Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	views := make([]SlotDayView, 0, len(rows))
	for _, row := range rows {
		view := SlotDayView{
			ID:        row.ID,
			CourtID:   row.CourtID,
			CourtName: row.CourtName,
			CourtType: row.CourtType,
			StartTime: row.StartTime,
			EndTime:   row.EndTime,
			Price:     row.Price,
			Status:    "available",
		}
		if row.BookingID != nil {
			view.Booked = true
			view.BookingID = row.BookingID
			view.BookingCode = row.BookingCode
			view.CustomerName = row.CustomerName
			view.CustomerPhone = row.CustomerPhone
			view.CustomerType = row.CustomerType
			view.BookingNote = row.BookingNote
			view.DepositPaid = row.DepositPaid
			view.RemainingDue = row.RemainingDue
			if row.BookingStat != nil {
				view.Status = *row.BookingStat
			}
		}
		views = append(views, view)
	}
	return views, nil
}

func (r *SlotRepository) ListByCourtAndDate(courtID uint, day time.Time) ([]models.TimeSlot, error) {
	start, end := dayBounds(day)
	var slots []models.TimeSlot
	err := r.db.Where("court_id = ? AND start_time >= ? AND start_time < ?", courtID, start, end).
		Order("start_time asc").
		Find(&slots).Error
	return slots, err
}

func (r *SlotRepository) DeleteByDateAndCourt(courtID uint, day time.Time) error {
	start, end := dayBounds(day)
	return r.db.Where("court_id = ? AND start_time >= ? AND start_time < ?", courtID, start, end).
		Delete(&models.TimeSlot{}).Error
}

func (r *SlotRepository) DeleteFutureUnbookedByCourt(courtID uint, from time.Time) error {
	blocking := r.db.Model(&models.Booking{}).
		Select("time_slot_id").
		Where("status IN ? OR (status = ? AND (expires_at IS NULL OR expires_at > ?))",
			[]models.BookingStatus{models.BookingConfirmed, models.BookingCheckedIn, models.BookingCompleted},
			models.BookingPending,
			time.Now(),
		)

	return r.db.Where("court_id = ? AND start_time >= ?", courtID, from).
		Where("id NOT IN (?)", blocking).
		Delete(&models.TimeSlot{}).Error
}

func (r *SlotRepository) RepriceUnbookedByCourtFromDay(courtID uint, fromDay time.Time, basePrice int64, peakStart, peakEnd int, peakMultiplier float64) error {
	start := fromDay
	if start.IsZero() {
		start = time.Now()
	}
	start = start.Truncate(time.Minute)

	blocking := r.db.Model(&models.Booking{}).
		Select("time_slot_id").
		Where("status IN ? OR (status = ? AND (expires_at IS NULL OR expires_at > ?))",
			[]models.BookingStatus{models.BookingConfirmed, models.BookingCheckedIn, models.BookingCompleted},
			models.BookingPending,
			time.Now(),
		)

	var slots []models.TimeSlot
	if err := r.db.Where("court_id = ? AND start_time >= ?", courtID, start).
		Where("id NOT IN (?)", blocking).
		Find(&slots).Error; err != nil {
		return err
	}

	peakPrice := int64(float64(basePrice) * peakMultiplier)
	return r.db.Transaction(func(tx *gorm.DB) error {
		for _, slot := range slots {
			price := basePrice
			hour := slot.StartTime.Hour()
			if hour >= peakStart && hour < peakEnd {
				price = peakPrice
			}
			if slot.Price == price {
				continue
			}
			if err := tx.Model(&models.TimeSlot{}).Where("id = ?", slot.ID).Update("price", price).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func dayBounds(day time.Time) (time.Time, time.Time) {
	start := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, day.Location())
	return start, start.Add(24 * time.Hour)
}
