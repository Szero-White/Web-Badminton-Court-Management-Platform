package handler

import (
	"net/http"
	"strconv"
	"strings"

	"badminton-platform/backend/internal/service"
	"badminton-platform/backend/internal/timeutil"
	"badminton-platform/backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type ActivityHandler struct{ activity *service.ActivityService }

func NewActivityHandler(activity *service.ActivityService) *ActivityHandler {
	return &ActivityHandler{activity: activity}
}

func (h *ActivityHandler) Actors(c *gin.Context) {
	actors, err := h.activity.Actors()
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "LIST_ACTIVITY_ACTORS_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusOK, actors)
}

func (h *ActivityHandler) List(c *gin.Context) {
	input := service.ActivityListInput{Category: c.Query("category"), Search: c.Query("q")}

	if raw := strings.TrimSpace(c.Query("actor_id")); raw != "" {
		value, err := strconv.ParseUint(raw, 10, 32)
		if err != nil {
			response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "actor_id không hợp lệ")
			return
		}
		input.ActorID = uint(value)
	}
	if raw := strings.TrimSpace(c.Query("limit")); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil {
			response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "limit không hợp lệ")
			return
		}
		input.Limit = value
	}
	if raw := strings.TrimSpace(c.Query("offset")); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil {
			response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "offset không hợp lệ")
			return
		}
		input.Offset = value
	}
	if raw := strings.TrimSpace(c.Query("from")); raw != "" {
		value, err := timeutil.ParseDate(raw)
		if err != nil {
			response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "Ngày bắt đầu không hợp lệ")
			return
		}
		input.From = &value
	}
	if raw := strings.TrimSpace(c.Query("to")); raw != "" {
		value, err := timeutil.ParseDate(raw)
		if err != nil {
			response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "Ngày kết thúc không hợp lệ")
			return
		}
		exclusive := value.AddDate(0, 0, 1)
		input.To = &exclusive
	}

	result, err := h.activity.List(input)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "LIST_ACTIVITY_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusOK, result)
}
