package handler

import (
	"errors"
	"net/http"
	"strconv"

	"badminton-platform/backend/internal/middleware"
	"badminton-platform/backend/internal/models"
	"badminton-platform/backend/internal/service"
	"badminton-platform/backend/internal/timeutil"
	"badminton-platform/backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type BookingHandler struct {
	booking *service.BookingService
}

func NewBookingHandler(booking *service.BookingService) *BookingHandler {
	return &BookingHandler{booking: booking}
}

type createPendingRequest struct {
	TimeSlotID uint `json:"time_slot_id" binding:"required"`
}

type createPendingForCustomerRequest struct {
	TimeSlotID      uint   `json:"time_slot_id"`
	StartTimeSlotID uint   `json:"start_time_slot_id"`
	EndTimeSlotID   uint   `json:"end_time_slot_id"`
	CustomerPhone   string `json:"customer_phone" binding:"required"`
	CustomerName    string `json:"customer_name"`
	CustomerType    string `json:"customer_type"`
	Notes           string `json:"notes"`
}

func (h *BookingHandler) CreatePending(c *gin.Context) {
	uidVal, exists := c.Get(middleware.ContextUserIDKey)
	if !exists {
		response.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "user context not found")
		return
	}
	uid := uidVal.(uint)

	var req createPendingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	booking, err := h.booking.CreatePendingBooking(c.Request.Context(), uid, req.TimeSlotID, "walk_in", "")
	if err != nil {
		response.Error(c, http.StatusConflict, "CREATE_BOOKING_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusCreated, booking)
}

func (h *BookingHandler) CreatePendingForCustomer(c *gin.Context) {
	var req createPendingForCustomerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}

	if req.StartTimeSlotID > 0 && req.EndTimeSlotID > 0 {
		bookings, err := h.booking.CreatePendingBookingRangeForPhone(c.Request.Context(), req.CustomerPhone, req.CustomerName, req.CustomerType, req.StartTimeSlotID, req.EndTimeSlotID, req.Notes)
		if err != nil {
			response.Error(c, http.StatusConflict, "CREATE_BOOKING_FAILED", err.Error())
			return
		}
		response.JSON(c, http.StatusCreated, gin.H{"bookings": bookings})
		return
	}

	if req.TimeSlotID == 0 {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "time_slot_id or start/end slot ids are required")
		return
	}

	booking, err := h.booking.CreatePendingBookingForPhone(c.Request.Context(), req.CustomerPhone, req.CustomerName, req.CustomerType, req.TimeSlotID, req.Notes)
	if err != nil {
		response.Error(c, http.StatusConflict, "CREATE_BOOKING_FAILED", err.Error())
		return
	}

	response.JSON(c, http.StatusCreated, booking)
}

type confirmDepositRequest struct {
	Amount    int64  `json:"amount" binding:"required"`
	Method    string `json:"method" binding:"required"`
	Reference string `json:"reference"`
}

func (h *BookingHandler) ConfirmDeposit(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("booking_id"), 10, 64)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "invalid booking_id")
		return
	}
	var req confirmDepositRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	actorID, actorRole, ok := bookingActor(c)
	if !ok {
		return
	}
	booking, err := h.booking.ConfirmDeposit(c.Request.Context(), actorID, actorRole, uint(id), req.Amount, req.Method, req.Reference)
	if err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, service.ErrBookingAccessDenied) {
			status = http.StatusForbidden
		}
		response.Error(c, status, "CONFIRM_DEPOSIT_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusOK, booking)
}

type cancelBookingRequest struct {
	Reason string `json:"reason" binding:"required"`
}

func (h *BookingHandler) Cancel(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("booking_id"), 10, 64)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "invalid booking_id")
		return
	}
	var req cancelBookingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	actorID, actorRole, ok := bookingActor(c)
	if !ok {
		return
	}
	booking, refund, err := h.booking.CancelBooking(c.Request.Context(), actorID, actorRole, uint(id), req.Reason)
	if err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, service.ErrBookingAccessDenied) {
			status = http.StatusForbidden
		}
		response.Error(c, status, "CANCEL_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusOK, gin.H{"booking": booking, "refund_amount": refund})
}

type checkInRequest struct {
	CodeOrPhone string `json:"code_or_phone" binding:"required"`
}

type updateBookingRequest struct {
	TimeSlotID    *uint   `json:"time_slot_id"`
	CustomerPhone *string `json:"customer_phone"`
	CustomerName  *string `json:"customer_name"`
	CustomerType  *string `json:"customer_type"`
	Notes         *string `json:"notes"`
	DepositTotal  *int64  `json:"deposit_total"`
}

type adminCancelBookingRequest struct {
	Reason string `json:"reason"`
}

func (h *BookingHandler) CheckIn(c *gin.Context) {
	var req checkInRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	booking, err := h.booking.CheckIn(req.CodeOrPhone)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "CHECKIN_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusOK, booking)
}

func (h *BookingHandler) UserBookings(c *gin.Context) {
	uidVal, exists := c.Get(middleware.ContextUserIDKey)
	if !exists {
		response.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "user context not found")
		return
	}
	uid := uidVal.(uint)
	bookings, err := h.booking.UserBookings(uid)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "LIST_BOOKINGS_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusOK, bookings)
}

func (h *BookingHandler) AdminListBookings(c *gin.Context) {
	dayStr := c.Query("day")
	day := timeutil.Now()
	if dayStr != "" {
		parsedDay, err := timeutil.ParseDate(dayStr)
		if err != nil {
			response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "invalid day format")
			return
		}
		day = parsedDay
	}

	bookings, err := h.booking.ListBookingsByDay(day)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "LIST_BOOKINGS_FAILED", err.Error())
		return
	}

	response.JSON(c, http.StatusOK, bookings)
}

func (h *BookingHandler) AdminUpdateBooking(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("booking_id"), 10, 64)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "invalid booking_id")
		return
	}

	var req updateBookingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}

	booking, err := h.booking.UpdateBooking(c.Request.Context(), uint(id), service.BookingUpdateInput{
		TimeSlotID:    req.TimeSlotID,
		CustomerPhone: req.CustomerPhone,
		CustomerName:  req.CustomerName,
		CustomerType:  req.CustomerType,
		Notes:         req.Notes,
		DepositTotal:  req.DepositTotal,
	})
	if err != nil {
		response.Error(c, http.StatusBadRequest, "UPDATE_BOOKING_FAILED", err.Error())
		return
	}

	response.JSON(c, http.StatusOK, booking)
}

func (h *BookingHandler) StaffUpdateBooking(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("booking_id"), 10, 64)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "invalid booking_id")
		return
	}

	var req updateBookingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}

	booking, err := h.booking.UpdateBooking(c.Request.Context(), uint(id), service.BookingUpdateInput{
		TimeSlotID:    req.TimeSlotID,
		CustomerPhone: req.CustomerPhone,
		CustomerName:  req.CustomerName,
		CustomerType:  req.CustomerType,
		Notes:         req.Notes,
		DepositTotal:  req.DepositTotal,
	})
	if err != nil {
		response.Error(c, http.StatusBadRequest, "UPDATE_BOOKING_FAILED", err.Error())
		return
	}

	response.JSON(c, http.StatusOK, booking)
}

func (h *BookingHandler) AdminDeleteBooking(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("booking_id"), 10, 64)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "invalid booking_id")
		return
	}

	var req adminCancelBookingRequest
	_ = c.ShouldBindJSON(&req)
	if req.Reason == "" {
		req.Reason = "Admin hủy booking"
	}

	actorID, actorRole, ok := bookingActor(c)
	if !ok {
		return
	}
	booking, refund, err := h.booking.CancelBooking(c.Request.Context(), actorID, actorRole, uint(id), req.Reason)
	if err != nil {
		response.Error(c, http.StatusBadRequest, "DELETE_BOOKING_FAILED", err.Error())
		return
	}

	response.JSON(c, http.StatusOK, gin.H{"booking": booking, "refund_amount": refund})
}

func bookingActor(c *gin.Context) (uint, models.Role, bool) {
	uidValue, uidOK := c.Get(middleware.ContextUserIDKey)
	roleValue, roleOK := c.Get(middleware.ContextRoleKey)
	uid, uidTypeOK := uidValue.(uint)
	roleText, roleTypeOK := roleValue.(string)
	if !uidOK || !roleOK || !uidTypeOK || !roleTypeOK {
		response.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "missing user context")
		return 0, "", false
	}
	return uid, models.Role(roleText), true
}
