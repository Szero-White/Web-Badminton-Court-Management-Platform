package models

import "time"

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

type Booking struct {
	ID             uint                `gorm:"primaryKey" json:"id"`
	BookingCode    string              `gorm:"size:40;uniqueIndex;not null" json:"booking_code"`
	BookingGroupID string              `gorm:"size:64;index;not null;default:''" json:"booking_group_id"`
	DisplayColor   string              `gorm:"size:16;not null;default:'#6f9f94'" json:"display_color"`
	UserID         uint                `gorm:"index;not null" json:"user_id"`
	User           User                `json:"user"`
	CourtID        uint                `gorm:"index;not null" json:"court_id"`
	Court          Court               `json:"court"`
	TimeSlotID     uint                `gorm:"index;not null" json:"time_slot_id"`
	TimeSlot       TimeSlot            `json:"time_slot"`
	CustomerType   BookingCustomerType `gorm:"size:20;not null;default:'walk_in'" json:"customer_type"`
	Notes          string              `gorm:"type:text" json:"notes"`
	Status         BookingStatus       `gorm:"size:20;index;not null;default:'pending'" json:"status"`
	TotalPrice     int64               `gorm:"not null" json:"total_price"`
	DepositPaid    int64               `gorm:"not null;default:0" json:"deposit_paid"`
	RemainingDue   int64               `gorm:"not null;default:0" json:"remaining_due"`
	ExpiresAt      *time.Time          `gorm:"index" json:"expires_at"`
	CanceledAt     *time.Time          `json:"canceled_at"`
	CancelReason   *string             `gorm:"size:255" json:"cancel_reason"`
	CreatedAt      time.Time           `json:"created_at"`
	UpdatedAt      time.Time           `json:"updated_at"`
}

type Payment struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	BookingID    uint      `gorm:"index;not null" json:"booking_id"`
	Booking      Booking   `json:"booking"`
	Amount       int64     `gorm:"not null" json:"amount"`
	PaymentFor   string    `gorm:"size:30;not null" json:"payment_for"`
	Method       string    `gorm:"size:30;not null" json:"method"`
	Status       string    `gorm:"size:30;not null;index" json:"status"`
	Reference    string    `gorm:"size:120;index" json:"reference"`
	ActorID      uint      `gorm:"index;not null;default:0" json:"actor_id"`
	ActorRole    string    `gorm:"size:20;index;not null;default:''" json:"actor_role"`
	Shift        string    `gorm:"size:50;index;not null;default:''" json:"shift"`
	BusinessDate time.Time `gorm:"type:date;index" json:"business_date"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}
