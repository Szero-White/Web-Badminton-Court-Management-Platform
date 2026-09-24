package handler

import (
	"net/http"

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
	summary, err := h.dashboard.Summary(timeutil.Now())
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "DASHBOARD_FAILED", err.Error())
		return
	}
	response.JSON(c, http.StatusOK, summary)
}
