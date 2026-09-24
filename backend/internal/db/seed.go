package db

import (
	"errors"

	"badminton-platform/backend/internal/models"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type demoUser struct {
	FullName string
	Email    string
	Phone    string
	Password string
	Role     models.Role
}

func SeedDemoData(connection *gorm.DB) error {
	users := []demoUser{
		{FullName: "Demo Administrator", Email: "admin@badminton.demo", Phone: "0900000001", Password: "Admin@12345", Role: models.RoleAdmin},
		{FullName: "Demo Staff", Email: "staff@badminton.demo", Phone: "0900000002", Password: "Staff@12345", Role: models.RoleStaff},
		{FullName: "Demo Customer", Email: "customer@badminton.demo", Phone: "0900000003", Password: "Customer@12345", Role: models.RoleCustomer},
	}
	for _, item := range users {
		if err := ensureDemoUser(connection, item); err != nil {
			return err
		}
	}

	var courtCount int64
	if err := connection.Model(&models.Court{}).Count(&courtCount).Error; err != nil {
		return err
	}
	if courtCount == 0 {
		courts := []models.Court{
			{Name: "Sân 1", CourtType: "standard", OpenTime: "06:00", CloseTime: "23:00", BasePrice: 80000, IsActive: true},
			{Name: "Sân 2", CourtType: "standard", OpenTime: "06:00", CloseTime: "23:00", BasePrice: 80000, IsActive: true},
			{Name: "Sân 3", CourtType: "vip", OpenTime: "06:00", CloseTime: "23:00", BasePrice: 100000, IsActive: true},
			{Name: "Sân 4", CourtType: "vip", OpenTime: "06:00", CloseTime: "23:00", BasePrice: 100000, IsActive: true},
		}
		if err := connection.Create(&courts).Error; err != nil {
			return err
		}
	}

	var beverageCount int64
	if err := connection.Model(&models.Beverage{}).Count(&beverageCount).Error; err != nil {
		return err
	}
	if beverageCount == 0 {
		beverages := []models.Beverage{
			{Name: "Nước suối", Price: 10000, Stock: 48, Unit: "chai", Description: "Nước uống đóng chai", IsActive: true},
			{Name: "Nước điện giải", Price: 20000, Stock: 24, Unit: "chai", Description: "Bổ sung điện giải sau khi chơi", IsActive: true},
			{Name: "Khăn lạnh", Price: 5000, Stock: 50, Unit: "cái", Description: "Khăn lạnh dùng tại sân", IsActive: true},
		}
		if err := connection.Create(&beverages).Error; err != nil {
			return err
		}
	}
	return nil
}

func ensureDemoUser(connection *gorm.DB, item demoUser) error {
	var existing models.User
	err := connection.Where("email = ?", item.Email).First(&existing).Error
	if err == nil {
		return nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(item.Password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	return connection.Create(&models.User{
		FullName:     item.FullName,
		Email:        item.Email,
		Phone:        item.Phone,
		PasswordHash: string(hash),
		Role:         item.Role,
	}).Error
}
