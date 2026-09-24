package handler

import (
	"net/http"
	"strconv"
	"strings"

	"badminton-platform/backend/internal/middleware"
	"badminton-platform/backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type createBeverageRequest struct {
	Name        string `json:"name" binding:"required"`
	Price       int64  `json:"price" binding:"required,gte=0"`
	Stock       int    `json:"stock" binding:"required,gte=0"`
	Unit        string `json:"unit"`
	Description string `json:"description"`
}

type updateBeverageRequest struct {
	Name        *string `json:"name"`
	Price       *int64  `json:"price"`
	Stock       *int    `json:"stock"`
	Unit        *string `json:"unit"`
	Description *string `json:"description"`
	Note        string  `json:"note"`
}
type adjustBeverageStockRequest struct {
	Delta int    `json:"delta" binding:"required"`
	Note  string `json:"note"`
}

func (h *AdminHandler) CreateBeverage(c *gin.Context) {
	var req createBeverageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	if strings.TrimSpace(req.Unit) == "" {
		req.Unit = "chai"
	}
	drink, err := h.beverage.Create(req.Name, req.Price, req.Stock, req.Unit, req.Description)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "CREATE_BEVERAGE_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusCreated, drink)
}

func (h *AdminHandler) ListBeverages(c *gin.Context) {
	drinks, err := h.beverage.ListActive()
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "LIST_BEVERAGES_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusOK, drinks)
}

func (h *AdminHandler) UpdateBeverage(c *gin.Context) {
	id, ok := beverageID(c)
	if !ok {
		return
	}
	var req updateBeverageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	actorID, ok := actorID(c)
	if !ok {
		return
	}
	drink, err := h.beverage.UpdateByAdmin(actorID, id, req.Name, req.Price, req.Stock, req.Unit, req.Description, req.Note)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "UPDATE_BEVERAGE_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusOK, drink)
}

func (h *AdminHandler) DeleteBeverage(c *gin.Context) {
	id, ok := beverageID(c)
	if !ok {
		return
	}
	actorID, ok := actorID(c)
	if !ok {
		return
	}
	note := strings.TrimSpace(c.Query("note"))
	if note == "" {
		note = "Quản trị viên xóa mặt hàng"
	}
	if err := h.beverage.DeleteByAdmin(actorID, id, note); err != nil {
		response.Error(c, http.StatusBadRequest, "DELETE_BEVERAGE_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusOK, gin.H{"ok": true})
}

func (h *AdminHandler) AdjustBeverageStock(c *gin.Context) {
	id, ok := beverageID(c)
	if !ok {
		return
	}
	var req adjustBeverageStockRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	actorID, ok := actorID(c)
	if !ok {
		return
	}
	drink, err := h.beverage.AdjustStockByAdmin(actorID, id, req.Delta, req.Note)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "ADJUST_STOCK_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusOK, drink)
}

func (h *AdminHandler) BeverageHistory(c *gin.Context) {
	id, ok := beverageID(c)
	if !ok {
		return
	}
	limit := 30
	if value := c.Query("limit"); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil {
			limit = parsed
		}
	}
	if limit < 1 {
		limit = 1
	}
	if limit > 100 {
		limit = 100
	}
	logs, err := h.beverage.HistoryByAdmin(id, limit)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "LIST_BEVERAGE_HISTORY_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusOK, logs)
}

func beverageID(c *gin.Context) (uint, bool) {
	id, err := strconv.ParseUint(c.Param("beverage_id"), 10, 64)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "invalid beverage_id")
		return 0, false
	}
	return uint(id), true
}

func actorID(c *gin.Context) (uint, bool) {
	value, exists := c.Get(middleware.ContextUserIDKey)
	id, ok := value.(uint)
	if !exists || !ok {
		response.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "missing user context")
		return 0, false
	}
	return id, true
}
