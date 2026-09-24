package handler

import (
	"net/http"

	"badminton-platform/backend/internal/models"
	"badminton-platform/backend/internal/service"
	"badminton-platform/backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	auth *service.AuthService
}

func NewAuthHandler(auth *service.AuthService) *AuthHandler {
	return &AuthHandler{auth: auth}
}

type registerRequest struct {
	FullName string `json:"full_name" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Phone    string `json:"phone" binding:"required"`
	Password string `json:"password" binding:"required,min=8"`
	Role     string `json:"role"`
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	if req.Role != "" && req.Role != string(models.RoleCustomer) {
		response.Error(c, http.StatusForbidden, "FORBIDDEN", "public registration only allows customer accounts")
		return
	}
	user, err := h.auth.Register(req.FullName, req.Email, req.Phone, req.Password, models.Role(req.Role))
	if err != nil {
		response.Error(c, http.StatusBadRequest, "REGISTER_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusCreated, user)
}

type loginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	user, tokens, err := h.auth.Login(req.Email, req.Password)
	if err != nil {
		response.Error(c, http.StatusUnauthorized, "LOGIN_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusOK, gin.H{"user": user, "tokens": tokens})
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	var req refreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	user, tokens, err := h.auth.Refresh(req.RefreshToken)
	if err != nil {
		response.Error(c, http.StatusUnauthorized, "REFRESH_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusOK, gin.H{"user": user, "tokens": tokens})
}
