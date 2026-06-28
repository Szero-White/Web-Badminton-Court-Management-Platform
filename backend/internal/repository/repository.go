package repository

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"badminton-platform/backend/internal/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Repositories struct {
	Users        *UserRepository
	Courts       *CourtRepository
	Slots        *SlotRepository
	Bookings     *BookingRepository
	Payments     *PaymentRepository
	Drinks       *BeverageRepository
	Transactions *TransactionRepository
}

func New(db *gorm.DB) *Repositories {
	return &Repositories{
		Users:        &UserRepository{db: db},
		Courts:       &CourtRepository{db: db},
		Slots:        &SlotRepository{db: db},
		Bookings:     &BookingRepository{db: db},
		Payments:     &PaymentRepository{db: db},
		Drinks:       &BeverageRepository{db: db},
		Transactions: &TransactionRepository{db: db},
	}
}

type UserRepository struct{ db *gorm.DB }

type CourtRepository struct{ db *gorm.DB }

type SlotRepository struct{ db *gorm.DB }

type BookingRepository struct{ db *gorm.DB }

type PaymentRepository struct{ db *gorm.DB }
type BeverageRepository struct{ db *gorm.DB }

type BeverageEditLog struct {
	ID          uint      `json:"id"`
	ActorID     uint      `json:"actor_id"`
	ActorName   string    `json:"actor_name"`
	Action      string    `json:"action"`
	Payload     string    `json:"payload"`
	CreatedAt   time.Time `json:"created_at"`
}

type SlotDayView struct {
	ID          uint      `json:"id"`
	CourtID     uint      `json:"court_id"`
	CourtName   string    `json:"court_name"`
	CourtType   string    `json:"court_type"`
	StartTime   time.Time `json:"start_time"`
	EndTime     time.Time `json:"end_time"`
	Price       int64     `json:"price"`
	Booked      bool      `json:"booked"`
	BookingID   *uint     `json:"booking_id,omitempty"`
	BookingCode *string   `json:"booking_code,omitempty"`
	CustomerName *string  `json:"customer_name,omitempty"`
	CustomerPhone *string `json:"customer_phone,omitempty"`
	CustomerType *string  `json:"customer_type,omitempty"`
	BookingNote *string   `json:"booking_note,omitempty"`
	DepositPaid *int64    `json:"deposit_paid,omitempty"`
	RemainingDue *int64   `json:"remaining_due,omitempty"`
	Status      string    `json:"status"`
}

type BookingAdminView struct {
	ID            uint       `json:"id"`
	BookingCode   string     `json:"booking_code"`
	UserID        uint       `json:"user_id"`
	CustomerName  string     `json:"customer_name"`
	CustomerPhone string     `json:"customer_phone"`
	CourtID       uint       `json:"court_id"`
	CourtName     string     `json:"court_name"`
	CourtType     string     `json:"court_type"`
	TimeSlotID    uint       `json:"time_slot_id"`
	StartTime     time.Time  `json:"start_time"`
	EndTime       time.Time  `json:"end_time"`
	CustomerType  string     `json:"customer_type"`
	Notes         string     `json:"notes"`
	Status        string     `json:"status"`
	TotalPrice    int64      `json:"total_price"`
	DepositPaid   int64      `json:"deposit_paid"`
	RemainingDue  int64      `json:"remaining_due"`
	ExpiresAt     *time.Time `json:"expires_at"`
	CanceledAt    *time.Time `json:"canceled_at"`
	CancelReason  *string    `json:"cancel_reason"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

func (r *UserRepository) Create(user *models.User) error {
	return r.db.Create(user).Error
}

func (r *UserRepository) FindByEmail(email string) (*models.User, error) {
	var user models.User
	err := r.db.Where("email = ?", email).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) FindByPhone(phone string) (*models.User, error) {
	var user models.User
	err := r.db.Where("phone = ?", phone).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) FindByID(id uint) (*models.User, error) {
	var user models.User
	err := r.db.First(&user, id).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) Update(user *models.User) error {
	return r.db.Save(user).Error
}

func (r *UserRepository) ListStaff() ([]models.User, error) {
	var users []models.User
	err := r.db.Where("role = ?", "staff").Find(&users).Error
	return users, err
}

func (r *UserRepository) Delete(id uint) error {
	return r.db.Delete(&models.User{}, id).Error
}

func (r *CourtRepository) Create(court *models.Court) error {
	return r.db.Create(court).Error
}

func (r *CourtRepository) ListActive() ([]models.Court, error) {
	var courts []models.Court
	err := r.db.Where("is_active = true").Order("id asc").Find(&courts).Error
	return courts, err
}

func (r *CourtRepository) ListAll() ([]models.Court, error) {
	var courts []models.Court
	err := r.db.Order("id asc").Find(&courts).Error
	return courts, err
}

func (r *CourtRepository) FindByID(id uint) (*models.Court, error) {
	var court models.Court
	err := r.db.First(&court, id).Error
	if err != nil {
		return nil, err
	}
	return &court, nil
}

func (r *CourtRepository) Update(court *models.Court) error {
	return r.db.Save(court).Error
}

func (r *SlotRepository) BulkCreate(slots []models.TimeSlot) error {
	if len(slots) == 0 {
		return nil
	}
	return r.db.Create(&slots).Error
}

func (r *SlotRepository) ListAvailableByDate(day time.Time) ([]models.TimeSlot, error) {
	start := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, day.Location())
	end := start.Add(24 * time.Hour)

	var slots []models.TimeSlot
	err := r.db.
		Preload("Court").
		Where("start_time >= ? AND start_time < ?", start, end).
		Where("id NOT IN (?)", r.db.Model(&models.Booking{}).
			Select("time_slot_id").
			Where("status IN ?", []models.BookingStatus{models.BookingPending, models.BookingConfirmed, models.BookingCheckedIn, models.BookingCompleted}),
		).
		Order("start_time asc").
		Find(&slots).Error
	return slots, err
}

func (r *SlotRepository) FindByID(id uint) (*models.TimeSlot, error) {
	var slot models.TimeSlot
	err := r.db.Preload("Court").First(&slot, id).Error
	if err != nil {
		return nil, err
	}
	return &slot, nil
}

func (r *SlotRepository) ListByDateWithStatus(day time.Time) ([]SlotDayView, error) {
	start := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, day.Location())
	end := start.Add(24 * time.Hour)
	type row struct {
		ID          uint
		CourtID     uint
		CourtName   string
		CourtType   string
		StartTime   time.Time
		EndTime     time.Time
		Price       int64
		BookingID   *uint
		BookingCode *string
		BookingStat *string
		CustomerName *string
		CustomerPhone *string
		CustomerType *string
		BookingNote *string
		DepositPaid *int64
		RemainingDue *int64
	}
	var rows []row
	err := r.db.Raw(`
		SELECT ts.id, ts.court_id, c.name AS court_name, c.court_type,
		       ts.start_time, ts.end_time, ts.price,
		       b.id AS booking_id, b.booking_code, b.status AS booking_stat,
		       u.full_name AS customer_name, u.phone AS customer_phone, b.customer_type, b.notes AS booking_note,
		       b.deposit_paid, b.remaining_due
		FROM time_slots ts
		JOIN courts c ON c.id = ts.court_id
		LEFT JOIN bookings b ON b.time_slot_id = ts.id AND b.status IN ('pending','confirmed','checked_in','completed')
		LEFT JOIN users u ON u.id = b.user_id
		WHERE ts.start_time >= ? AND ts.start_time < ?
		ORDER BY c.id ASC, ts.start_time ASC`, start, end).Scan(&rows).Error
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
	start := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, day.Location())
	end := start.Add(24 * time.Hour)

	var slots []models.TimeSlot
	err := r.db.
		Where("court_id = ? AND start_time >= ? AND start_time < ?", courtID, start, end).
		Order("start_time asc").
		Find(&slots).Error
	return slots, err
}

func (r *SlotRepository) DeleteByDateAndCourt(courtID uint, day time.Time) error {
	start := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, day.Location())
	end := start.Add(24 * time.Hour)
	return r.db.Where("court_id = ? AND start_time >= ? AND start_time < ?", courtID, start, end).Delete(&models.TimeSlot{}).Error
}

func (r *SlotRepository) RepriceUnbookedByCourtFromDay(courtID uint, fromDay time.Time, basePrice int64, peakStart, peakEnd int, peakMultiplier float64) error {
	start := fromDay
	if start.IsZero() {
		start = time.Now()
	}
	start = start.Truncate(time.Minute)

	normalPrice := basePrice
	peakPrice := int64(float64(basePrice) * peakMultiplier)

	return r.db.Exec(`
		UPDATE time_slots
		SET price = CASE
			WHEN CAST(strftime('%H', start_time) AS INTEGER) >= ?
			 AND CAST(strftime('%H', start_time) AS INTEGER) < ?
			THEN ?
			ELSE ?
		END
		WHERE court_id = ?
		  AND start_time >= ?
		  AND id NOT IN (
			SELECT time_slot_id FROM bookings
			WHERE status IN ('pending','confirmed','checked_in','completed')
		  )
	`, peakStart, peakEnd, peakPrice, normalPrice, courtID, start).Error
}

func (r *BookingRepository) WithTx(tx *gorm.DB) *BookingRepository {
	return &BookingRepository{db: tx}
}

func (r *PaymentRepository) WithTx(tx *gorm.DB) *PaymentRepository {
	return &PaymentRepository{db: tx}
}

func (r *BookingRepository) Create(booking *models.Booking) error {
	return r.db.Create(booking).Error
}

func (r *BookingRepository) Update(booking *models.Booking) error {
	return r.db.Save(booking).Error
}

func (r *BookingRepository) FindByID(id uint) (*models.Booking, error) {
	var booking models.Booking
	err := r.db.Preload("TimeSlot").Preload("Court").Preload("User").First(&booking, id).Error
	if err != nil {
		return nil, err
	}
	return &booking, nil
}

func (r *BookingRepository) FindActiveByTimeSlotIDExcludeBooking(slotID, excludeBookingID uint) (*models.Booking, error) {
	var booking models.Booking
	err := r.db.
		Where("time_slot_id = ?", slotID).
		Where("status IN ?", []models.BookingStatus{models.BookingPending, models.BookingConfirmed, models.BookingCheckedIn, models.BookingCompleted}).
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

func (r *BookingRepository) ListByDateWithDetails(day time.Time) ([]BookingAdminView, error) {
	start := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, day.Location())
	end := start.Add(24 * time.Hour)

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

func (r *PaymentRepository) Create(payment *models.Payment) error {
	return r.db.Create(payment).Error
}

func (r *BeverageRepository) Create(drink *models.Beverage) error {
	return r.db.Create(drink).Error
}

func (r *BeverageRepository) ListActive() ([]models.Beverage, error) {
	var drinks []models.Beverage
	err := r.db.Where("is_active = true").Order("id asc").Find(&drinks).Error
	return drinks, err
}

func (r *BeverageRepository) FindByID(id uint) (*models.Beverage, error) {
	var drink models.Beverage
	err := r.db.First(&drink, id).Error
	if err != nil {
		return nil, err
	}
	return &drink, nil
}

func (r *BeverageRepository) Update(drink *models.Beverage) error {
	return r.db.Save(drink).Error
}

func (r *BeverageRepository) UpdateByAdmin(adminID, beverageID uint, name *string, price *int64, stock *int, note string) (*models.Beverage, error) {
	var updated models.Beverage

	err := r.db.Transaction(func(tx *gorm.DB) error {
		var drink models.Beverage
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&drink, beverageID).Error; err != nil {
			return err
		}

		beforeName := drink.Name
		beforePrice := drink.Price
		beforeStock := drink.Stock

		if name != nil {
			nextName := strings.TrimSpace(*name)
			if nextName == "" {
				return errors.New("name must not be empty")
			}
			drink.Name = nextName
		}

		if price != nil {
			if *price < 0 {
				return errors.New("price must be >= 0")
			}
			drink.Price = *price
		}

		if stock != nil {
			if *stock < 0 {
				return errors.New("stock must be >= 0")
			}
			drink.Stock = *stock
		}

		if err := tx.Save(&drink).Error; err != nil {
			return err
		}

		payload := fmt.Sprintf("before_name=%s; after_name=%s; before_price=%d; after_price=%d; before_stock=%d; after_stock=%d; note=%s", beforeName, drink.Name, beforePrice, drink.Price, beforeStock, drink.Stock, note)
		log := models.AuditLog{
			ActorID:    adminID,
			Action:     "beverage_update",
			TargetType: "beverage",
			TargetID:   fmt.Sprintf("%d", drink.ID),
			Payload:    payload,
		}
		if err := tx.Create(&log).Error; err != nil {
			return err
		}

		updated = drink
		return nil
	})
	if err != nil {
		return nil, err
	}

	return &updated, nil
}

func (r *BeverageRepository) DeleteByAdmin(adminID, beverageID uint, note string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var drink models.Beverage
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&drink, beverageID).Error; err != nil {
			return err
		}
		if !drink.IsActive {
			return errors.New("beverage already deleted")
		}

		drink.IsActive = false
		if err := tx.Save(&drink).Error; err != nil {
			return err
		}

		payload := fmt.Sprintf("name=%s; before_active=true; after_active=false; note=%s", drink.Name, note)
		log := models.AuditLog{
			ActorID:    adminID,
			Action:     "beverage_delete",
			TargetType: "beverage",
			TargetID:   fmt.Sprintf("%d", drink.ID),
			Payload:    payload,
		}
		if err := tx.Create(&log).Error; err != nil {
			return err
		}

		return nil
	})
}

func (r *BeverageRepository) AdjustStockByAdmin(adminID, beverageID uint, delta int, note string) (*models.Beverage, error) {
	if delta == 0 {
		return nil, errors.New("delta must not be 0")
	}

	var updated models.Beverage
	err := r.db.Transaction(func(tx *gorm.DB) error {
		var drink models.Beverage
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&drink, beverageID).Error; err != nil {
			return err
		}

		before := drink.Stock
		after := before + delta
		if after < 0 {
			return errors.New("stock would become negative")
		}

		drink.Stock = after
		if err := tx.Save(&drink).Error; err != nil {
			return err
		}

		action := "beverage_adjust_stock_increase"
		if delta < 0 {
			action = "beverage_adjust_stock_decrease"
		}
		payload := fmt.Sprintf("name=%s; before_stock=%d; delta=%d; after_stock=%d; note=%s", drink.Name, before, delta, after, note)
		log := models.AuditLog{
			ActorID:    adminID,
			Action:     action,
			TargetType: "beverage",
			TargetID:   fmt.Sprintf("%d", drink.ID),
			Payload:    payload,
		}
		if err := tx.Create(&log).Error; err != nil {
			return err
		}

		updated = drink
		return nil
	})
	if err != nil {
		return nil, err
	}

	return &updated, nil
}

func (r *BeverageRepository) ListEditHistory(beverageID uint, limit int) ([]BeverageEditLog, error) {
	if limit <= 0 || limit > 100 {
		limit = 30
	}

	var logs []BeverageEditLog
	err := r.db.Raw(`
		SELECT a.id, a.actor_id, COALESCE(u.full_name, '') AS actor_name,
		       a.action, a.payload, a.created_at
		FROM audit_logs a
		LEFT JOIN users u ON u.id = a.actor_id
		WHERE a.target_type = 'beverage' AND a.target_id = ?
		ORDER BY a.created_at DESC
		LIMIT ?`, fmt.Sprintf("%d", beverageID), limit).Scan(&logs).Error
	if err != nil {
		return nil, err
	}

	return logs, nil
}

func (r *BeverageRepository) Sell(staffID, beverageID uint, qty int, paymentMethod, shift, notes string) (*models.Transaction, *models.Beverage, error) {
	if qty <= 0 {
		return nil, nil, errors.New("quantity must be greater than 0")
	}

	if paymentMethod != "cash" && paymentMethod != "transfer" {
		return nil, nil, errors.New("payment_method must be cash or transfer")
	}

	var updatedDrink models.Beverage
	var txn models.Transaction

	err := r.db.Transaction(func(tx *gorm.DB) error {
		var drink models.Beverage
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&drink, beverageID).Error; err != nil {
			return err
		}

		if !drink.IsActive {
			return errors.New("beverage is inactive")
		}

		if drink.Stock < qty {
			return errors.New("insufficient stock")
		}

		drink.Stock -= qty
		if err := tx.Save(&drink).Error; err != nil {
			return err
		}

		amount := int64(qty) * drink.Price
		txn = models.Transaction{
			StaffID:       staffID,
			Type:          "sale",
			Description:   fmt.Sprintf("Ban %d %s %s", qty, drink.Unit, drink.Name),
			Amount:        amount,
			PaymentMethod: paymentMethod,
			Notes:         notes,
			Shift:         shift,
		}

		if err := tx.Create(&txn).Error; err != nil {
			return err
		}

		updatedDrink = drink
		return nil
	})
	if err != nil {
		return nil, nil, err
	}

	return &txn, &updatedDrink, nil
}

func (r *BeverageRepository) Restock(staffID, beverageID uint, qty int, costAmount int64, paymentMethod, shift, notes string) (*models.Transaction, *models.Beverage, error) {
	if qty <= 0 {
		return nil, nil, errors.New("quantity must be greater than 0")
	}
	if paymentMethod == "" {
		paymentMethod = "cash"
	}
	if paymentMethod != "cash" && paymentMethod != "transfer" {
		return nil, nil, errors.New("payment_method must be cash or transfer")
	}
	if costAmount < 0 {
		return nil, nil, errors.New("cost_amount must be >= 0")
	}

	var updatedDrink models.Beverage
	var txn models.Transaction

	err := r.db.Transaction(func(tx *gorm.DB) error {
		var drink models.Beverage
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&drink, beverageID).Error; err != nil {
			return err
		}

		drink.Stock += qty
		if err := tx.Save(&drink).Error; err != nil {
			return err
		}

		txn = models.Transaction{
			StaffID:       staffID,
			Type:          "stock_in",
			Description:   fmt.Sprintf("Nhap kho %d %s %s", qty, drink.Unit, drink.Name),
			Amount:        -costAmount,
			PaymentMethod: paymentMethod,
			Notes:         notes,
			Shift:         shift,
		}

		if err := tx.Create(&txn).Error; err != nil {
			return err
		}

		updatedDrink = drink
		return nil
	})
	if err != nil {
		return nil, nil, err
	}

	return &txn, &updatedDrink, nil
}

func (r *PaymentRepository) RevenueByRange(start, end time.Time) (int64, error) {
	var revenue int64
	err := r.db.Model(&models.Payment{}).
		Where("status = 'success' AND created_at >= ? AND created_at <= ?", start, end).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&revenue).Error
	return revenue, err
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
	if err := r.db.Model(&models.Booking{}).Where("status IN ?", []models.BookingStatus{models.BookingCanceled, models.BookingNoShow}).Count(&canceled).Error; err != nil {
		return 0, err
	}
	return (float64(canceled) / float64(total)) * 100, nil
}

func (r *BookingRepository) OccupancyByCourt(day time.Time) (map[uint]float64, error) {
	start := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, day.Location())
	end := start.Add(24 * time.Hour)
	type row struct {
		CourtID uint
		Total   int64
		Used    int64
	}
	var rows []row
	err := r.db.Raw(`
		SELECT ts.court_id,
		       COUNT(ts.id) AS total,
		       SUM(CASE WHEN b.id IS NOT NULL AND b.status IN ('pending','confirmed','checked_in','completed') THEN 1 ELSE 0 END) AS used
		FROM time_slots ts
		LEFT JOIN bookings b ON b.time_slot_id = ts.id
		WHERE ts.start_time >= ? AND ts.start_time < ?
		GROUP BY ts.court_id`, start, end).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	result := make(map[uint]float64, len(rows))
	for _, r := range rows {
		if r.Total == 0 {
			result[r.CourtID] = 0
			continue
		}
		result[r.CourtID] = (float64(r.Used) / float64(r.Total)) * 100
	}
	return result, nil
}

func (r *BookingRepository) PeakHours(day time.Time) (map[int]int64, error) {
	start := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, day.Location())
	end := start.Add(24 * time.Hour)
	type row struct {
		Hour  int
		Count int64
	}
	var rows []row
	err := r.db.Raw(`
		SELECT CAST(strftime('%H', ts.start_time) AS INTEGER) AS hour,
		       COUNT(b.id) AS count
		FROM time_slots ts
		LEFT JOIN bookings b ON b.time_slot_id = ts.id AND b.status IN ('confirmed','checked_in','completed')
		WHERE ts.start_time >= ? AND ts.start_time < ?
		GROUP BY CAST(strftime('%H', ts.start_time) AS INTEGER)
		ORDER BY hour`, start, end).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	result := map[int]int64{}
	for _, r := range rows {
		result[r.Hour] = r.Count
	}
	return result, nil
}

type TransactionRepository struct{ db *gorm.DB }

func (r *TransactionRepository) Create(txn *models.Transaction) error {
	return r.db.Create(txn).Error
}

func (r *TransactionRepository) ListByStaffAndShift(staffID uint, shift string) ([]models.Transaction, error) {
	var transactions []models.Transaction
	err := r.db.Where("staff_id = ? AND shift = ?", staffID, shift).
		Order("created_at DESC").
		Find(&transactions).Error
	return transactions, err
}

func (r *TransactionRepository) SummaryByStaffAndShift(staffID uint, shift string) (map[string]interface{}, error) {
	var salesIncome int64
	var cashSales int64
	var transferSales int64
	var refundSum int64
	var stockInCostSum int64
	var ownerWithdrawSum int64

	if err := r.db.Model(&models.Transaction{}).
		Where("staff_id = ? AND shift = ? AND type = 'sale'", staffID, shift).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&salesIncome).Error; err != nil {
		return nil, err
	}

	if err := r.db.Model(&models.Transaction{}).
		Where("staff_id = ? AND shift = ? AND type = 'sale' AND payment_method = 'cash'", staffID, shift).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&cashSales).Error; err != nil {
		return nil, err
	}

	if err := r.db.Model(&models.Transaction{}).
		Where("staff_id = ? AND shift = ? AND type = 'sale' AND payment_method = 'transfer'", staffID, shift).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&transferSales).Error; err != nil {
		return nil, err
	}

	if err := r.db.Model(&models.Transaction{}).
		Where("staff_id = ? AND shift = ? AND type = 'refund'", staffID, shift).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&refundSum).Error; err != nil {
		return nil, err
	}

	if err := r.db.Model(&models.Transaction{}).
		Where("staff_id = ? AND shift = ? AND type = 'stock_in'", staffID, shift).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&stockInCostSum).Error; err != nil {
		return nil, err
	}

	if err := r.db.Model(&models.Transaction{}).
		Where("staff_id = ? AND shift = ? AND type = 'owner_withdraw'", staffID, shift).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&ownerWithdrawSum).Error; err != nil {
		return nil, err
	}

	refundOut := -refundSum
	if refundOut < 0 {
		refundOut = 0
	}
	stockInCost := -stockInCostSum
	if stockInCost < 0 {
		stockInCost = 0
	}
	ownerWithdraw := -ownerWithdrawSum
	if ownerWithdraw < 0 {
		ownerWithdraw = 0
	}

	netRevenue := salesIncome - refundOut - stockInCost
	cashBalance := cashSales - refundOut - stockInCost - ownerWithdraw

	return map[string]interface{}{
		"income":               salesIncome,
		"cash":                 cashSales,
		"transfer":             transferSales,
		"refund":               refundOut,
		"stock_in_cost":        stockInCost,
		"owner_withdraw":       ownerWithdraw,
		"net_revenue":          netRevenue,
		"cash_balance":         cashBalance,
		"total":                netRevenue,
	}, nil
}
