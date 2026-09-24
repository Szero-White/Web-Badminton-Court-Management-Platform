package handler

import (
	"net/http"
	"strconv"

	"badminton-platform/backend/internal/middleware"
	"badminton-platform/backend/internal/models"
	"badminton-platform/backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type createStaffRequest struct {
	FullName string `json:"full_name" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Phone    string `json:"phone" binding:"required"`
	Password string `json:"password" binding:"required,min=8"`
	Role     string `json:"role" binding:"required"`
}

type updateStaffRequest struct {
	FullName string `json:"full_name" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Phone    string `json:"phone" binding:"required"`
	Role     string `json:"role" binding:"required"`
	Password string `json:"password"`
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

func (h *AdminHandler) UpdateStaff(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "invalid staff id")
		return
	}
	var req updateStaffRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	actorID, ok := currentUserID(c)
	if !ok {
		return
	}
	user, err := h.auth.UpdateStaff(actorID, uint(id), req.FullName, req.Email, req.Phone, models.Role(req.Role), req.Password)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "UPDATE_STAFF_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusOK, user)
}

func (h *AdminHandler) DeleteStaff(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "invalid staff id")
		return
	}
	actorID, ok := currentUserID(c)
	if !ok {
		return
	}
	if err := h.auth.DeleteStaff(actorID, uint(id)); err != nil {
		response.Error(c, http.StatusBadRequest, "DELETE_STAFF_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusOK, gin.H{"message": "staff deleted"})
}

func currentUserID(c *gin.Context) (uint, bool) {
	value, exists := c.Get(middleware.ContextUserIDKey)
	userID, ok := value.(uint)
	if !exists || !ok || userID == 0 {
		response.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "missing user context")
		return 0, false
	}
	return userID, true
}
