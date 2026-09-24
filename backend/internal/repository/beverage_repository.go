package repository

import (
	"errors"
	"fmt"
	"strings"

	"badminton-platform/backend/internal/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type BeverageRepository struct{ db *gorm.DB }

func (r *BeverageRepository) Create(drink *models.Beverage) error {
	return r.db.Create(drink).Error
}

func (r *BeverageRepository) ListActive() ([]models.Beverage, error) {
	var drinks []models.Beverage
	err := r.db.Where("is_active = ?", true).Order("id asc").Find(&drinks).Error
	return drinks, err
}

func (r *BeverageRepository) FindByID(id uint) (*models.Beverage, error) {
	var drink models.Beverage
	if err := r.db.First(&drink, id).Error; err != nil {
		return nil, err
	}
	return &drink, nil
}

func (r *BeverageRepository) Update(drink *models.Beverage) error {
	return r.db.Save(drink).Error
}

func (r *BeverageRepository) UpdateByAdmin(adminID, beverageID uint, name *string, price *int64, stock *int, unit, description *string, note string) (*models.Beverage, error) {
	var updated models.Beverage
	err := r.db.Transaction(func(tx *gorm.DB) error {
		var drink models.Beverage
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&drink, beverageID).Error; err != nil {
			return err
		}

		beforeName, beforePrice, beforeStock, beforeUnit, beforeDescription := drink.Name, drink.Price, drink.Stock, drink.Unit, drink.Description
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
		if unit != nil {
			nextUnit := strings.TrimSpace(*unit)
			if nextUnit == "" {
				return errors.New("unit must not be empty")
			}
			drink.Unit = nextUnit
		}
		if description != nil {
			drink.Description = strings.TrimSpace(*description)
		}
		if err := tx.Save(&drink).Error; err != nil {
			return err
		}

		payload := fmt.Sprintf("before_name=%s; after_name=%s; before_price=%d; after_price=%d; before_stock=%d; after_stock=%d; before_unit=%s; after_unit=%s; before_description=%s; after_description=%s; note=%s", beforeName, drink.Name, beforePrice, drink.Price, beforeStock, drink.Stock, beforeUnit, drink.Unit, beforeDescription, drink.Description, note)
		if err := createBeverageAudit(tx, adminID, drink.ID, "beverage_update", payload); err != nil {
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
		return createBeverageAudit(tx, adminID, drink.ID, "beverage_delete", payload)
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
		if err := createBeverageAudit(tx, adminID, drink.ID, action, payload); err != nil {
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
	return logs, err
}

func (r *BeverageRepository) Sell(staffID, beverageID uint, qty int, paymentMethod, shift, notes string) (*models.Transaction, *models.Beverage, error) {
	if qty <= 0 {
		return nil, nil, errors.New("quantity must be greater than 0")
	}
	if paymentMethod != "cash" && paymentMethod != "transfer" {
		return nil, nil, errors.New("payment_method must be cash or transfer")
	}

	var updatedDrink models.Beverage
	var transaction models.Transaction
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

		transaction = models.Transaction{
			StaffID:       staffID,
			Type:          "sale",
			Description:   fmt.Sprintf("Bán %d %s %s", qty, drink.Unit, drink.Name),
			Amount:        int64(qty) * drink.Price,
			PaymentMethod: paymentMethod,
			Notes:         notes,
			Shift:         shift,
		}
		if err := tx.Create(&transaction).Error; err != nil {
			return err
		}
		updatedDrink = drink
		return nil
	})
	if err != nil {
		return nil, nil, err
	}
	return &transaction, &updatedDrink, nil
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
	var transaction models.Transaction
	err := r.db.Transaction(func(tx *gorm.DB) error {
		var drink models.Beverage
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&drink, beverageID).Error; err != nil {
			return err
		}
		drink.Stock += qty
		if err := tx.Save(&drink).Error; err != nil {
			return err
		}
		transaction = models.Transaction{
			StaffID:       staffID,
			Type:          "stock_in",
			Description:   fmt.Sprintf("Nhập kho %d %s %s", qty, drink.Unit, drink.Name),
			Amount:        -costAmount,
			PaymentMethod: paymentMethod,
			Notes:         notes,
			Shift:         shift,
		}
		if err := tx.Create(&transaction).Error; err != nil {
			return err
		}
		updatedDrink = drink
		return nil
	})
	if err != nil {
		return nil, nil, err
	}
	return &transaction, &updatedDrink, nil
}

func createBeverageAudit(tx *gorm.DB, actorID, beverageID uint, action, payload string) error {
	return tx.Create(&models.AuditLog{
		ActorID:    actorID,
		Action:     action,
		TargetType: "beverage",
		TargetID:   fmt.Sprintf("%d", beverageID),
		Payload:    payload,
	}).Error
}
