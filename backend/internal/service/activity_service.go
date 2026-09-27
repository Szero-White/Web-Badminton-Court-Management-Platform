package service

import (
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"badminton-platform/backend/internal/models"
	"badminton-platform/backend/internal/repository"
)

type ActivityListInput struct {
	ActorID  uint
	From     *time.Time
	To       *time.Time
	Category string
	Search   string
	Limit    int
	Offset   int
}

type ActivityEntry struct {
	Key        string         `json:"key"`
	Source     string         `json:"source"`
	Category   string         `json:"category"`
	Action     string         `json:"action"`
	ActorID    uint           `json:"actor_id"`
	ActorName  string         `json:"actor_name"`
	ActorRole  string         `json:"actor_role"`
	TargetType string         `json:"target_type"`
	TargetID   string         `json:"target_id"`
	Summary    string         `json:"summary"`
	Details    map[string]any `json:"details,omitempty"`
	CreatedAt  time.Time      `json:"created_at"`
}

type ActivityListResult struct {
	Entries []ActivityEntry `json:"entries"`
	Total   int             `json:"total"`
	Limit   int             `json:"limit"`
	Offset  int             `json:"offset"`
}

type ActivityService struct {
	repo *repository.ActivityRepository
}

func NewActivityService(repo *repository.ActivityRepository) *ActivityService {
	return &ActivityService{repo: repo}
}

func (s *ActivityService) Actors() ([]repository.ActivityActor, error) {
	return s.repo.ListActorsIncludingDeleted()
}

func (s *ActivityService) List(input ActivityListInput) (*ActivityListResult, error) {
	if input.Limit <= 0 || input.Limit > 200 {
		input.Limit = 50
	}
	if input.Offset < 0 {
		input.Offset = 0
	}

	filter := repository.ActivityFilter{ActorID: input.ActorID, From: input.From, To: input.To}
	audits, err := s.repo.ListAuditLogs(filter)
	if err != nil {
		return nil, err
	}
	txns, err := s.repo.ListTransactions(filter)
	if err != nil {
		return nil, err
	}
	payments, err := s.repo.ListPayments(filter)
	if err != nil {
		return nil, err
	}

	actorIDs := map[uint]struct{}{}
	for _, row := range audits {
		if row.ActorID > 0 {
			actorIDs[row.ActorID] = struct{}{}
		}
	}
	for _, row := range txns {
		if row.StaffID > 0 {
			actorIDs[row.StaffID] = struct{}{}
		}
	}
	for _, row := range payments {
		if row.ActorID > 0 {
			actorIDs[row.ActorID] = struct{}{}
		}
	}
	ids := make([]uint, 0, len(actorIDs))
	for id := range actorIDs {
		ids = append(ids, id)
	}
	actors, err := s.repo.FindActorsIncludingDeleted(ids)
	if err != nil {
		return nil, err
	}

	entries := make([]ActivityEntry, 0, len(audits)+len(txns)+len(payments))
	for _, row := range audits {
		entry := activityFromAudit(row, actors[row.ActorID])
		if activityMatches(entry, input.Category, input.Search) {
			entries = append(entries, entry)
		}
	}
	for _, row := range txns {
		entry := activityFromTransaction(row, actors[row.StaffID])
		if activityMatches(entry, input.Category, input.Search) {
			entries = append(entries, entry)
		}
	}
	for _, row := range payments {
		entry := activityFromPayment(row, actors[row.ActorID])
		if activityMatches(entry, input.Category, input.Search) {
			entries = append(entries, entry)
		}
	}

	sort.SliceStable(entries, func(i, j int) bool { return entries[i].CreatedAt.After(entries[j].CreatedAt) })
	total := len(entries)
	start := input.Offset
	if start > total {
		start = total
	}
	end := start + input.Limit
	if end > total {
		end = total
	}

	return &ActivityListResult{Entries: entries[start:end], Total: total, Limit: input.Limit, Offset: input.Offset}, nil
}

func activityFromAudit(row models.AuditLog, actor models.User) ActivityEntry {
	details := map[string]any{}
	if strings.TrimSpace(row.Payload) != "" {
		if err := json.Unmarshal([]byte(row.Payload), &details); err != nil {
			details["raw"] = row.Payload
		}
	}
	return ActivityEntry{
		Key: fmt.Sprintf("audit-%d", row.ID), Source: "audit", Category: auditCategory(row.Action), Action: row.Action,
		ActorID: row.ActorID, ActorName: actorName(actor, row.ActorID), ActorRole: string(actor.Role),
		TargetType: row.TargetType, TargetID: row.TargetID, Summary: auditSummary(row.Action), Details: details, CreatedAt: row.CreatedAt,
	}
}

func activityFromTransaction(row models.Transaction, actor models.User) ActivityEntry {
	action := "transaction_" + row.Type
	category := "finance"
	if row.Type == "sale" || row.Type == "stock_in" {
		category = "beverage"
	}
	details := map[string]any{"amount": row.Amount, "payment_method": row.PaymentMethod, "shift": row.Shift, "notes": row.Notes, "business_date": row.BusinessDate}
	return ActivityEntry{
		Key: fmt.Sprintf("transaction-%d", row.ID), Source: "transaction", Category: category, Action: action,
		ActorID: row.StaffID, ActorName: actorName(actor, row.StaffID), ActorRole: string(actor.Role),
		TargetType: "transaction", TargetID: strconv.FormatUint(uint64(row.ID), 10), Summary: row.Description, Details: details, CreatedAt: row.CreatedAt,
	}
}

func activityFromPayment(row models.Payment, actor models.User) ActivityEntry {
	action := "booking_payment_" + row.PaymentFor
	details := map[string]any{"amount": row.Amount, "method": row.Method, "reference": row.Reference, "shift": row.Shift, "business_date": row.BusinessDate}
	summary := "Ghi nhận thanh toán booking"
	if row.PaymentFor == "refund" {
		summary = "Hoàn tiền booking"
	}
	if row.PaymentFor == "deposit" {
		summary = "Thu tiền/cọc booking"
	}
	return ActivityEntry{
		Key: fmt.Sprintf("payment-%d", row.ID), Source: "payment", Category: "payment", Action: action,
		ActorID: row.ActorID, ActorName: actorName(actor, row.ActorID), ActorRole: firstNonEmpty(row.ActorRole, string(actor.Role)),
		TargetType: "booking", TargetID: strconv.FormatUint(uint64(row.BookingID), 10), Summary: summary, Details: details, CreatedAt: row.CreatedAt,
	}
}

func actorName(actor models.User, id uint) string {
	if strings.TrimSpace(actor.FullName) != "" {
		return actor.FullName
	}
	return fmt.Sprintf("Tài khoản #%d", id)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func activityMatches(entry ActivityEntry, category, search string) bool {
	if category = strings.TrimSpace(strings.ToLower(category)); category != "" && category != "all" && entry.Category != category {
		return false
	}
	search = strings.TrimSpace(strings.ToLower(search))
	if search == "" {
		return true
	}
	haystack := strings.ToLower(strings.Join([]string{entry.ActorName, entry.Action, entry.Summary, entry.TargetType, entry.TargetID}, " "))
	return strings.Contains(haystack, search)
}

func auditCategory(action string) string {
	switch {
	case strings.HasPrefix(action, "booking_"):
		if strings.Contains(action, "payment") {
			return "payment"
		}
		return "booking"
	case strings.HasPrefix(action, "beverage_"):
		return "beverage"
	case strings.HasPrefix(action, "staff_"):
		return "staff"
	case strings.HasPrefix(action, "court_") || strings.HasPrefix(action, "price_rule_"):
		return "court"
	default:
		return "system"
	}
}

func auditSummary(action string) string {
	labels := map[string]string{
		"booking_confirmed_at_counter":   "Tạo/xác nhận booking tại quầy",
		"booking_updated":                "Cập nhật thông tin booking",
		"booking_group_rescheduled":      "Đổi sân/ngày/khung giờ booking",
		"booking_payment_adjusted":       "Điều chỉnh thanh toán booking",
		"booking_payment_received":       "Thu tiền booking",
		"booking_canceled":               "Hủy booking",
		"booking_checked_in":             "Check-in khách",
		"beverage_update":                "Cập nhật mặt hàng",
		"beverage_delete":                "Ngừng kinh doanh mặt hàng",
		"beverage_adjust_stock_increase": "Điều chỉnh tăng tồn kho",
		"beverage_adjust_stock_decrease": "Điều chỉnh giảm tồn kho",
	}
	if label, ok := labels[action]; ok {
		return label
	}
	return action
}
