package notifications

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"scholarbookstore/services/api/internal/auth"
	"scholarbookstore/services/api/internal/http/response"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) ListMine(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "请先登录", nil)
		return
	}
	page, pageSize, valid := parsePagination(r)
	if !valid {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "分页参数不合法", nil)
		return
	}

	unreadOnly := r.URL.Query().Get("unreadOnly") == "true"
	result, err := h.service.ListMine(r.Context(), user.ID, unreadOnly, page, pageSize)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}

	response.JSON(w, http.StatusOK, result.Notifications, pageMeta(result))
}

func (h *Handler) UnreadCount(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "请先登录", nil)
		return
	}

	count, err := h.service.UnreadCount(r.Context(), user.ID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}

	response.JSON(w, http.StatusOK, map[string]int64{"count": count}, nil)
}

func (h *Handler) MarkRead(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "请先登录", nil)
		return
	}
	id, idOK := parseIDParam(r, "id")
	if !idOK {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "通知不存在", nil)
		return
	}

	err := h.service.MarkRead(r.Context(), user.ID, id)
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "通知不存在", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}

	response.JSON(w, http.StatusOK, map[string]bool{"ok": true}, nil)
}

func (h *Handler) MarkAllRead(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "请先登录", nil)
		return
	}

	count, err := h.service.MarkAllRead(r.Context(), user.ID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}

	response.JSON(w, http.StatusOK, map[string]int64{"count": count}, nil)
}

func parsePagination(r *http.Request) (int, int, bool) {
	page := 1
	pageSize := 20
	var err error
	if raw := r.URL.Query().Get("page"); raw != "" {
		page, err = strconv.Atoi(raw)
		if err != nil {
			return 0, 0, false
		}
	}
	if raw := r.URL.Query().Get("pageSize"); raw != "" {
		pageSize, err = strconv.Atoi(raw)
		if err != nil {
			return 0, 0, false
		}
	}
	if page < 1 || pageSize < 1 || pageSize > 100 {
		return 0, 0, false
	}
	return page, pageSize, true
}

func parseIDParam(r *http.Request, name string) (int64, bool) {
	id, err := strconv.ParseInt(chi.URLParam(r, name), 10, 64)
	return id, err == nil && id > 0
}

func pageMeta(page Page) map[string]interface{} {
	return map[string]interface{}{
		"page":     page.Number,
		"pageSize": page.Size,
		"total":    page.Total,
	}
}
