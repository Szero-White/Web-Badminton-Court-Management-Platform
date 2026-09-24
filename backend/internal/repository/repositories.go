package repository

import "gorm.io/gorm"

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
