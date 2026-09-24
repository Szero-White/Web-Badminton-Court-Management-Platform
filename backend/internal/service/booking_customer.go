package service

import (
	"errors"
	"fmt"
	"strings"

	"badminton-platform/backend/internal/models"
	"badminton-platform/backend/internal/repository"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func (s *BookingService) ensureCustomerByPhone(phone, fullName string) (*models.User, error) {
	return s.ensureCustomerByPhoneWithRepo(s.users, phone, fullName)
}

func (s *BookingService) ensureCustomerByPhoneWithRepo(users *repository.UserRepository, phone, fullName string) (*models.User, error) {
	phone = normalizePhone(phone)
	fullName = strings.TrimSpace(fullName)
	if phone == "" {
		return nil, errors.New("phone is required")
	}
	if fullName == "" {
		fullName = "Khách tại quầy"
	}

	user, err := users.FindByPhone(phone)
	if err == nil {
		if fullName != "" && user.FullName != fullName {
			user.FullName = fullName
			if updateErr := users.Update(user); updateErr != nil {
				return nil, updateErr
			}
		}
		return user, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	email := fmt.Sprintf("guest_%s@bcm.local", strings.NewReplacer(" ", "", "+", "").Replace(phone))
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
	if err := users.Create(newUser); err != nil {
		// A concurrent request may have created this customer first.
		if existing, findErr := users.FindByPhone(phone); findErr == nil {
			return existing, nil
		}
		return nil, err
	}
	return newUser, nil
}
