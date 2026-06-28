package handler



import (

	"net/http"

	"strconv"



	"badminton-platform/backend/internal/middleware"

	"badminton-platform/backend/internal/models"

	"badminton-platform/backend/internal/service"

	"badminton-platform/backend/pkg/response"



	"github.com/gin-gonic/gin"

)



type AdminHandler struct {

	auth     *service.AuthService

	beverage *service.BeverageService

}



func NewAdminHandler(auth *service.AuthService, beverage *service.BeverageService) *AdminHandler {

	return &AdminHandler{auth: auth, beverage: beverage}

}



type createStaffRequest struct {

	FullName string `json:"full_name" binding:"required"`

	Email    string `json:"email" binding:"required,email"`

	Phone    string `json:"phone" binding:"required"`

	Password string `json:"password" binding:"required,min=6"`

	Role     string `json:"role" binding:"required"`

}



func (h *AdminHandler) CreateStaff(c *gin.Context) {

	var req createStaffRequest

	if err := c.ShouldBindJSON(&req); err != nil {

		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())

		return

	}

	user, err := h.auth.CreateStaff(req.FullName, req.Email, req.Phone, req.Password, models.Role(req.Role))

	if err != nil {

		response.Error(c, http.StatusBadRequest, "CREATE_STAFF_FAILED", err.Error())

		return

	}

	response.JSON(c, http.StatusCreated, user)

}



func (h *AdminHandler) ListStaff(c *gin.Context) {

	users, err := h.auth.ListStaff()

	if err != nil {

		response.Error(c, http.StatusInternalServerError, "LIST_STAFF_FAILED", err.Error())

		return

	}

	response.JSON(c, http.StatusOK, users)

}



type updateStaffRequest struct {

	FullName string `json:"full_name" binding:"required"`

	Email    string `json:"email" binding:"required,email"`

	Phone    string `json:"phone" binding:"required"`

	Role     string `json:"role" binding:"required"`

	Password string `json:"password"`

}



func (h *AdminHandler) UpdateStaff(c *gin.Context) {

	idStr := c.Param("id")

	id, err := strconv.ParseUint(idStr, 10, 32)

	if err != nil {

		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "Invalid staff ID")

		return

	}

	var req updateStaffRequest

	if err := c.ShouldBindJSON(&req); err != nil {

		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())

		return

	}

	user, err := h.auth.UpdateStaff(uint(id), req.FullName, req.Email, req.Phone, models.Role(req.Role), req.Password)

	if err != nil {

		response.Error(c, http.StatusBadRequest, "UPDATE_STAFF_FAILED", err.Error())

		return

	}

	response.JSON(c, http.StatusOK, user)

}



func (h *AdminHandler) DeleteStaff(c *gin.Context) {

	idStr := c.Param("id")

	id, err := strconv.ParseUint(idStr, 10, 32)

	if err != nil {

		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "Invalid staff ID")

		return

	}

	if err := h.auth.DeleteStaff(uint(id)); err != nil {

		response.Error(c, http.StatusBadRequest, "DELETE_STAFF_FAILED", err.Error())

		return

	}

	response.JSON(c, http.StatusOK, gin.H{"message": "Staff deleted successfully"})

}



type createBeverageRequest struct {

	Name        string `json:"name" binding:"required"`

	Price       int64  `json:"price" binding:"required"`

	Stock       int    `json:"stock" binding:"required"`

	Unit        string `json:"unit"`

	Description string `json:"description"`

}



func (h *AdminHandler) CreateBeverage(c *gin.Context) {

	var req createBeverageRequest

	if err := c.ShouldBindJSON(&req); err != nil {

		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())

		return

	}

	if req.Unit == "" {

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



type updateBeverageRequest struct {

	Name  *string `json:"name"`

	Price *int64 `json:"price"`

	Stock *int   `json:"stock"`

	Note  string `json:"note"`

}



func (h *AdminHandler) UpdateBeverage(c *gin.Context) {

	id, err := strconv.ParseUint(c.Param("beverage_id"), 10, 64)

	if err != nil {

		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "invalid beverage_id")

		return

	}



	var req updateBeverageRequest

	if err := c.ShouldBindJSON(&req); err != nil {

		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())

		return

	}



	uidVal, exists := c.Get(middleware.ContextUserIDKey)

	if !exists {

		response.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "missing user context")

		return

	}



	drink, err := h.beverage.UpdateByAdmin(uidVal.(uint), uint(id), req.Name, req.Price, req.Stock, req.Note)

	if err != nil {

		response.Error(c, http.StatusBadRequest, "UPDATE_BEVERAGE_FAILED", err.Error())

		return

	}



	response.JSON(c, http.StatusOK, drink)

}



func (h *AdminHandler) DeleteBeverage(c *gin.Context) {

	id, err := strconv.ParseUint(c.Param("beverage_id"), 10, 64)

	if err != nil {

		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "invalid beverage_id")

		return

	}



	uidVal, exists := c.Get(middleware.ContextUserIDKey)

	if !exists {

		response.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "missing user context")

		return

	}



	note := c.Query("note")

	if note == "" {

		note = "Admin xoa mat hang"

	}



	if err := h.beverage.DeleteByAdmin(uidVal.(uint), uint(id), note); err != nil {

		response.Error(c, http.StatusBadRequest, "DELETE_BEVERAGE_FAILED", err.Error())

		return

	}



	response.JSON(c, http.StatusOK, gin.H{"ok": true})

}



type adjustBeverageStockRequest struct {

	Delta int    `json:"delta" binding:"required"`

	Note  string `json:"note"`

}



func (h *AdminHandler) AdjustBeverageStock(c *gin.Context) {

	id, err := strconv.ParseUint(c.Param("beverage_id"), 10, 64)

	if err != nil {

		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "invalid beverage_id")

		return

	}



	var req adjustBeverageStockRequest

	if err := c.ShouldBindJSON(&req); err != nil {

		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())

		return

	}



	uidVal, exists := c.Get(middleware.ContextUserIDKey)

	if !exists {

		response.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "missing user context")

		return

	}



	drink, err := h.beverage.AdjustStockByAdmin(uidVal.(uint), uint(id), req.Delta, req.Note)

	if err != nil {

		response.Error(c, http.StatusBadRequest, "ADJUST_STOCK_FAILED", err.Error())

		return

	}



	response.JSON(c, http.StatusOK, drink)

}



func (h *AdminHandler) BeverageHistory(c *gin.Context) {

	id, err := strconv.ParseUint(c.Param("beverage_id"), 10, 64)

	if err != nil {

		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "invalid beverage_id")

		return

	}



	limit := 30

	if qs := c.Query("limit"); qs != "" {

		if parsed, parseErr := strconv.Atoi(qs); parseErr == nil {

			limit = parsed

		}

	}



	logs, err := h.beverage.HistoryByAdmin(uint(id), limit)

	if err != nil {

		response.Error(c, http.StatusInternalServerError, "LIST_BEVERAGE_HISTORY_FAILED", err.Error())

		return

	}



	response.JSON(c, http.StatusOK, logs)

}

