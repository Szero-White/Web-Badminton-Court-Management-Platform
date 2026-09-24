package handler

import "badminton-platform/backend/internal/service"

type AdminHandler struct {
	auth     *service.AuthService
	beverage *service.BeverageService
}

func NewAdminHandler(auth *service.AuthService, beverage *service.BeverageService) *AdminHandler {
	return &AdminHandler{auth: auth, beverage: beverage}
}
