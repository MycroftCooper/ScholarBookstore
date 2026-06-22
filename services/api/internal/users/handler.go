package users

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"scholarbookstore/services/api/internal/http/response"
	"scholarbookstore/services/api/internal/session"
)

type Handler struct {
	service *Service
}

type updateAdminUserRequest struct {
	Role   *string `json:"role"`
	Status *string `json:"status"`
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) PublicAuthorProfile(w http.ResponseWriter, r *http.Request) {
	username := chi.URLParam(r, "username")
	page, pageSize, ok := parsePagination(r)
	if !ok {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "分页参数不合法", nil)
		return
	}

	result, err := h.service.FindPublicAuthorProfile(r.Context(), username, page, pageSize)
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "用户不存在", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}

	response.JSON(w, http.StatusOK, result.Author, map[string]interface{}{
		"page":     result.Number,
		"pageSize": result.Size,
		"total":    result.Total,
	})
}

func (h *Handler) ListAdmin(w http.ResponseWriter, r *http.Request) {
	page, pageSize, ok := parsePagination(r)
	if !ok {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "分页参数不合法", nil)
		return
	}
	result, err := h.service.ListAdmin(r.Context(), AdminUserFilter{
		Query:  r.URL.Query().Get("q"),
		Role:   r.URL.Query().Get("role"),
		Status: r.URL.Query().Get("status"),
	}, page, pageSize)
	if errors.Is(err, ErrInvalidInput) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "查询参数不合法", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}
	response.JSON(w, http.StatusOK, result.Users, map[string]interface{}{
		"page":     result.Number,
		"pageSize": result.Size,
		"total":    result.Total,
	})
}

func (h *Handler) UpdateAdmin(w http.ResponseWriter, r *http.Request) {
	actor, ok := session.UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "请先登录", nil)
		return
	}
	id, idOK := parseIDParam(r, "id")
	if !idOK {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "用户不存在", nil)
		return
	}
	var req updateAdminUserRequest
	if err := decodeJSON(r, &req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "请求参数不合法", nil)
		return
	}
	item, err := h.service.UpdateAdmin(r.Context(), id, UpdateAdminUserInput{
		Role:    req.Role,
		Status:  req.Status,
		ActorID: actor.ID,
	})
	if errors.Is(err, ErrInvalidInput) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "请求参数不合法", nil)
		return
	}
	if errors.Is(err, ErrForbidden) {
		response.Error(w, http.StatusForbidden, "FORBIDDEN", "不能禁用自己", nil)
		return
	}
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "用户不存在", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}
	response.JSON(w, http.StatusOK, item, nil)
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

func decodeJSON(r *http.Request, dst interface{}) error {
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	return decoder.Decode(dst)
}
