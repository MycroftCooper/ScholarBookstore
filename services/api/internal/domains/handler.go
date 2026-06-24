package domains

import (
	"encoding/json"
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

type createDomainRequest struct {
	Slug        string `json:"slug"`
	Name        string `json:"name"`
	Description string `json:"description"`
	SortOrder   int    `json:"sortOrder"`
	IsActive    *bool  `json:"isActive"`
}

type updateDomainRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	SortOrder   *int    `json:"sortOrder"`
	IsActive    *bool   `json:"isActive"`
}

type ownerRequest struct {
	UserID int64 `json:"userId"`
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	includeInactive := false
	if r.URL.Query().Get("includeInactive") == "true" {
		user, ok := auth.UserFromContext(r.Context())
		if !ok || user.Role != "admin" {
			response.Error(w, http.StatusForbidden, "FORBIDDEN", "权限不足", nil)
			return
		}
		includeInactive = true
	}

	items, err := h.service.List(r.Context(), includeInactive)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}
	response.JSON(w, http.StatusOK, items, nil)
}

func (h *Handler) Detail(w http.ResponseWriter, r *http.Request) {
	id, ok := parseIDParam(r, "id")
	if !ok {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "领域不存在", nil)
		return
	}
	item, err := h.service.FindByID(r.Context(), id, false)
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "领域不存在", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}
	response.JSON(w, http.StatusOK, item, nil)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req createDomainRequest
	if err := decodeJSON(r, &req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "请求参数不合法", nil)
		return
	}
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}
	item, err := h.service.Create(r.Context(), CreateDomainInput{
		Slug:        req.Slug,
		Name:        req.Name,
		Description: req.Description,
		SortOrder:   req.SortOrder,
		IsActive:    isActive,
	})
	if errors.Is(err, ErrInvalidInput) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "请求参数不合法", nil)
		return
	}
	if errors.Is(err, ErrConflict) {
		response.Error(w, http.StatusConflict, "CONFLICT", "领域标识已存在", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}
	response.JSON(w, http.StatusCreated, item, nil)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id, ok := parseIDParam(r, "id")
	if !ok {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "领域不存在", nil)
		return
	}
	var req updateDomainRequest
	if err := decodeJSON(r, &req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "请求参数不合法", nil)
		return
	}
	item, err := h.service.Update(r.Context(), id, UpdateDomainInput{
		Name:        req.Name,
		Description: req.Description,
		SortOrder:   req.SortOrder,
		IsActive:    req.IsActive,
	})
	if errors.Is(err, ErrInvalidInput) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "请求参数不合法", nil)
		return
	}
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "领域不存在", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}
	response.JSON(w, http.StatusOK, item, nil)
}

func (h *Handler) AddOwner(w http.ResponseWriter, r *http.Request) {
	id, ok := parseIDParam(r, "id")
	if !ok {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "domain not found", nil)
		return
	}
	var req ownerRequest
	if err := decodeJSON(r, &req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request", nil)
		return
	}

	owner, err := h.service.AddOwner(r.Context(), id, req.UserID)
	if respondOwnerError(w, err) {
		return
	}
	response.JSON(w, http.StatusOK, owner, nil)
}

func (h *Handler) RemoveOwner(w http.ResponseWriter, r *http.Request) {
	domainID, ok := parseIDParam(r, "id")
	if !ok {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "domain not found", nil)
		return
	}
	userID, ok := parseIDParam(r, "userId")
	if !ok {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "user not found", nil)
		return
	}

	err := h.service.RemoveOwner(r.Context(), domainID, userID)
	if respondOwnerError(w, err) {
		return
	}
	response.JSON(w, http.StatusOK, map[string]bool{"ok": true}, nil)
}

func respondOwnerError(w http.ResponseWriter, err error) bool {
	if errors.Is(err, ErrInvalidInput) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request", nil)
		return true
	}
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "domain or user not found", nil)
		return true
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "service unavailable", nil)
		return true
	}
	return false
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
