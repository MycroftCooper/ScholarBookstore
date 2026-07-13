package observability

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"scholarbookstore/services/api/internal/auth"
	"scholarbookstore/services/api/internal/http/request"
	"scholarbookstore/services/api/internal/http/response"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

type createClientErrorLogRequest struct {
	Message        string            `json:"message"`
	Stack          string            `json:"stack"`
	Level          string            `json:"level"`
	Path           string            `json:"path"`
	ComponentStack string            `json:"componentStack"`
	Metadata       map[string]string `json:"metadata"`
}

func (h *Handler) CreateClientErrorLog(w http.ResponseWriter, r *http.Request) {
	var req createClientErrorLogRequest
	if err := request.DecodeJSON(r, &req); err != nil {
		response.Error(w, http.StatusBadRequest, "INVALID_JSON", "Invalid request body", nil)
		return
	}
	var userID *int64
	if user, ok := auth.UserFromContext(r.Context()); ok {
		userID = &user.ID
	}
	metadata := req.Metadata
	if metadata == nil {
		metadata = map[string]string{}
	}
	if req.ComponentStack != "" {
		metadata["componentStack"] = req.ComponentStack
	}

	err := h.service.CreateErrorLog(r.Context(), ErrorLogInput{
		Source:    "client",
		Level:     req.Level,
		Message:   req.Message,
		Stack:     req.Stack,
		UserID:    userID,
		RequestID: middleware.GetReqID(r.Context()),
		Method:    r.Method,
		Path:      firstNonEmpty(req.Path, r.URL.Path),
		IP:        r.RemoteAddr,
		UserAgent: r.UserAgent(),
		Metadata:  metadata,
	})
	if errors.Is(err, ErrInvalidInput) {
		response.Error(w, http.StatusBadRequest, "INVALID_INPUT", "Log message is required", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "SERVER_ERROR", "Failed to write error log", nil)
		return
	}
	response.JSON(w, http.StatusCreated, map[string]bool{"ok": true}, nil)
}

func (h *Handler) ListErrorLogs(w http.ResponseWriter, r *http.Request) {
	page, pageSize, ok := request.Pagination(r)
	if !ok {
		response.Error(w, http.StatusBadRequest, "INVALID_PAGINATION", "Invalid pagination parameters", nil)
		return
	}
	filter := ErrorLogFilter{
		Source: r.URL.Query().Get("source"),
	}
	if raw := r.URL.Query().Get("userId"); raw != "" {
		userID, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || userID <= 0 {
			response.Error(w, http.StatusBadRequest, "INVALID_USER_ID", "Invalid user ID", nil)
			return
		}
		filter.UserID = &userID
	}
	result, err := h.service.ListErrorLogs(r.Context(), filter, page, pageSize)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "SERVER_ERROR", "Failed to query error logs", nil)
		return
	}
	response.JSON(w, http.StatusOK, result.Logs, map[string]interface{}{
		"page":     result.Number,
		"pageSize": result.Size,
		"total":    result.Total,
	})
}

func (h *Handler) DeleteErrorLog(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || id <= 0 {
		response.Error(w, http.StatusBadRequest, "INVALID_ID", "Invalid error log ID", nil)
		return
	}
	deleted, err := h.service.DeleteErrorLog(r.Context(), id)
	if errors.Is(err, ErrInvalidInput) {
		response.Error(w, http.StatusBadRequest, "INVALID_ID", "Invalid error log ID", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "SERVER_ERROR", "Failed to delete error log", nil)
		return
	}
	response.JSON(w, http.StatusOK, map[string]int64{"deleted": deleted}, nil)
}

func (h *Handler) DeleteAllErrorLogs(w http.ResponseWriter, r *http.Request) {
	deleted, err := h.service.DeleteAllErrorLogs(r.Context())
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "SERVER_ERROR", "Failed to delete error logs", nil)
		return
	}
	response.JSON(w, http.StatusOK, map[string]int64{"deleted": deleted}, nil)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
