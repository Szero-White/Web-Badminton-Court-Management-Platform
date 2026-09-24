package repository

import "time"

type BeverageEditLog struct {
	ID        uint      `json:"id"`
	ActorID   uint      `json:"actor_id"`
	ActorName string    `json:"actor_name"`
	Action    string    `json:"action"`
	Payload   string    `json:"payload"`
	CreatedAt time.Time `json:"created_at"`
}

type SlotDayView struct {
	ID            uint      `json:"id"`
	CourtID       uint      `json:"court_id"`
	CourtName     string    `json:"court_name"`
	CourtType     string    `json:"court_type"`
	StartTime     time.Time `json:"start_time"`
	EndTime       time.Time `json:"end_time"`
	Price         int64     `json:"price"`
	Booked        bool      `json:"booked"`
	BookingID     *uint     `json:"booking_id,omitempty"`
	BookingCode   *string   `json:"booking_code,omitempty"`
	CustomerName  *string   `json:"customer_name,omitempty"`
	CustomerPhone *string   `json:"customer_phone,omitempty"`
	CustomerType  *string   `json:"customer_type,omitempty"`
	BookingNote   *string   `json:"booking_note,omitempty"`
	DepositPaid   *int64    `json:"deposit_paid,omitempty"`
	RemainingDue  *int64    `json:"remaining_due,omitempty"`
	Status        string    `json:"status"`
}

type PublicSlotDayView struct {
	ID        uint      `json:"id"`
	CourtID   uint      `json:"court_id"`
	CourtName string    `json:"court_name"`
	CourtType string    `json:"court_type"`
	StartTime time.Time `json:"start_time"`
	EndTime   time.Time `json:"end_time"`
	Price     int64     `json:"price"`
	Booked    bool      `json:"booked"`
	Status    string    `json:"status"`
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
