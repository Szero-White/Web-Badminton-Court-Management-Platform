package models

import "time"

type Role string

const (
	RoleCustomer Role = "customer"
	RoleStaff    Role = "staff"
	RoleAdmin    Role = "admin"
)

type BookingStatus string

const (
	BookingPending   BookingStatus = "pending"
	BookingConfirmed BookingStatus = "confirmed"
	BookingCheckedIn BookingStatus = "checked_in"
	BookingCompleted BookingStatus = "completed"
	BookingCanceled  BookingStatus = "canceled"
	BookingNoShow    BookingStatus = "no_show"
)

type BookingCustomerType string

const (
	BookingCustomerWalkIn  BookingCustomerType = "walk_in"
	BookingCustomerMonthly BookingCustomerType = "monthly"
)

type User struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	FullName     string    `gorm:"size:120;not null" json:"full_name"`
	Email        string    `gorm:"size:180;uniqueIndex;not null" json:"email"`
	Phone        string    `gorm:"size:30;uniqueIndex;not null" json:"phone"`
	PasswordHash string    `gorm:"size:255;not null" json:"-"`
	Role         Role      `gorm:"size:20;not null;default:'customer'" json:"role"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type Court struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	Name          string    `gorm:"size:80;uniqueIndex;not null" json:"name"`
	CourtType     string    `gorm:"size:20;not null" json:"court_type"`
	OpenTime      string    `gorm:"size:5;not null" json:"open_time"`
	CloseTime     string    `gorm:"size:5;not null" json:"close_time"`
	BasePrice     int64     `gorm:"not null" json:"base_price"`
	IsActive      bool      `gorm:"default:true" json:"is_active"`
	IsMaintenance bool      `gorm:"default:false" json:"is_maintenance"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	TimeSlots     []TimeSlot
}

type TimeSlot struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	CourtID   uint      `gorm:"index;not null" json:"court_id"`
	Court     Court     `json:"court"`
	StartTime time.Time `gorm:"index;not null" json:"start_time"`
	EndTime   time.Time `gorm:"not null" json:"end_time"`
	Price     int64     `gorm:"not null" json:"price"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Booking struct {
	ID           uint          `gorm:"primaryKey" json:"id"`
	BookingCode  string        `gorm:"size:40;uniqueIndex;not null" json:"booking_code"`
	UserID       uint          `gorm:"index;not null" json:"user_id"`
	User         User          `json:"user"`
	CourtID      uint          `gorm:"index;not null" json:"court_id"`
	Court        Court         `json:"court"`
	TimeSlotID   uint          `gorm:"index;not null" json:"time_slot_id"`
	TimeSlot     TimeSlot      `json:"time_slot"`
	CustomerType BookingCustomerType `gorm:"size:20;not null;default:'walk_in'" json:"customer_type"`
	Notes        string        `gorm:"type:text" json:"notes"`
	Status       BookingStatus `gorm:"size:20;index;not null;default:'pending'" json:"status"`
	TotalPrice   int64         `gorm:"not null" json:"total_price"`
	DepositPaid  int64         `gorm:"not null;default:0" json:"deposit_paid"`
	RemainingDue int64         `gorm:"not null;default:0" json:"remaining_due"`
	ExpiresAt    *time.Time    `json:"expires_at"`
	CanceledAt   *time.Time    `json:"canceled_at"`
	CancelReason *string       `gorm:"size:255" json:"cancel_reason"`
	CreatedAt    time.Time     `json:"created_at"`
	UpdatedAt    time.Time     `json:"updated_at"`
}

type Payment struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	BookingID  uint      `gorm:"index;not null" json:"booking_id"`
	Booking    Booking   `json:"booking"`
	Amount     int64     `gorm:"not null" json:"amount"`
	PaymentFor string    `gorm:"size:30;not null" json:"payment_for"`
	Method     string    `gorm:"size:30;not null" json:"method"`
	Status     string    `gorm:"size:30;not null" json:"status"`
	Reference  string    `gorm:"size:120;index" json:"reference"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type Beverage struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"size:120;uniqueIndex;not null" json:"name"`
	Price       int64     `gorm:"not null" json:"price"`
	Stock       int       `gorm:"not null;default:0" json:"stock"`
	Unit        string    `gorm:"size:20;not null;default:'chai'" json:"unit"`
	Description string    `gorm:"size:255" json:"description"`
	IsActive    bool      `gorm:"default:true" json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Transaction struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	StaffID       uint      `gorm:"index;not null" json:"staff_id"`
	Type          string    `gorm:"size:30;not null" json:"type"` // 'sale', 'refund', 'adjust'
	Description   string    `gorm:"size:255" json:"description"`
	Amount        int64     `gorm:"not null" json:"amount"` // VND, positive for income, negative for refund
	PaymentMethod string    `gorm:"size:30" json:"payment_method"` // 'cash', 'transfer', etc.
	Notes         string    `gorm:"type:text" json:"notes"`
	Shift         string    `gorm:"size:50" json:"shift"` // 'morning', 'afternoon', 'evening' or date+time
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type Promotion struct {
	ID           uint       `gorm:"primaryKey" json:"id"`
	Name         string     `gorm:"size:100;not null" json:"name"`
	Code         string     `gorm:"size:30;uniqueIndex;not null" json:"code"`
	DiscountType string     `gorm:"size:20;not null" json:"discount_type"`
	Value        int64      `gorm:"not null" json:"value"`
	StartDate    time.Time  `json:"start_date"`
	EndDate      *time.Time `json:"end_date"`
}

type Membership struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	UserID        uint      `gorm:"index;not null" json:"user_id"`
	Tier          string    `gorm:"size:30;not null" json:"tier"`
	DiscountPct   int       `gorm:"not null" json:"discount_pct"`
	EffectiveFrom time.Time `json:"effective_from"`
	EffectiveTo   time.Time `json:"effective_to"`
}

type AuditLog struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	ActorID    uint      `gorm:"index" json:"actor_id"`
	Action     string    `gorm:"size:100;not null" json:"action"`
	TargetType string    `gorm:"size:100;not null" json:"target_type"`
	TargetID   string    `gorm:"size:100;not null" json:"target_id"`
	Payload    string    `gorm:"type:text" json:"payload"`
	CreatedAt  time.Time `json:"created_at"`
}
