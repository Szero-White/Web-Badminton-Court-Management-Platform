package handler

import (
	"net/http"
	"time"

	"badminton-platform/backend/internal/service"
	"badminton-platform/backend/internal/timeutil"
	"badminton-platform/backend/pkg/response"

	"github.com/gin-gonic/gin"
)

type DashboardHandler struct {
	dashboard *service.DashboardService
}

func NewDashboardHandler(dashboard *service.DashboardService) *DashboardHandler {
	return &DashboardHandler{dashboard: dashboard}
}

func (h *DashboardHandler) Summary(c *gin.Context) {
	start := timeutil.StartOfDay(timeutil.Now())
	end := start.AddDate(0, 0, 1)

	if fromText := c.Query("from"); fromText != "" {
		parsed, err := timeutil.ParseDate(fromText)
		if err != nil {
			response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "invalid from date")
			return
		}
		start = parsed
	}
	if toText := c.Query("to"); toText != "" {
		parsed, err := timeutil.ParseDate(toText)
		if err != nil {
			response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "invalid to date")
			return
		}
		end = parsed.AddDate(0, 0, 1)
	} else if c.Query("from") != "" {
		end = start.AddDate(0, 0, 1)
	}
	if !end.After(start) || end.Sub(start) > 366*24*time.Hour {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "date range must be between 1 and 366 days")
		return
	}

	summary, err := h.dashboard.SummaryRange(start, end)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "DASHBOARD_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusOK, summary)
}
