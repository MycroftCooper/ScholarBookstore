package modules

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

type createModuleRequest struct {
	DomainID    int64  `json:"domainId"`
	Slug        string `json:"slug"`
	Name        string `json:"name"`
	Description string `json:"description"`
	SortOrder   int    `json:"sortOrder"`
	IsActive    *bool  `json:"isActive"`
}

type updateModuleRequest struct {
	DomainID    *int64  `json:"domainId"`
	Name        *string `json:"name"`
	Description *string `json:"description"`
	SortOrder   *int    `json:"sortOrder"`
	IsActive    *bool   `json:"isActive"`
}

type moderatorRequest struct {
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
			response.Error(w, http.StatusForbidden, "FORBIDDEN", "permission denied", nil)
			return
		}
		includeInactive = true
	}

	items, err := h.service.List(r.Context(), includeInactive)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "service unavailable", nil)
		return
	}
	response.JSON(w, http.StatusOK, items, nil)
}

func (h *Handler) Detail(w http.ResponseWriter, r *http.Request) {
	module, err := h.service.FindBySlug(r.Context(), chi.URLParam(r, "slug"))
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "module not found", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "service unavailable", nil)
		return
	}
	response.JSON(w, http.StatusOK, module, nil)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "please login", nil)
		return
	}

	var req createModuleRequest
	if err := decodeJSON(r, &req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request", nil)
		return
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	module, err := h.service.CreateManaged(r.Context(), CreateModuleInput{
		DomainID:    req.DomainID,
		Slug:        req.Slug,
		Name:        req.Name,
		Description: req.Description,
		SortOrder:   req.SortOrder,
		IsActive:    isActive,
	}, user.ID, user.Role)
	respondModuleMutation(w, http.StatusCreated, module, err)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "please login", nil)
		return
	}

	id, ok := moduleIDParam(w, r)
	if !ok {
		return
	}

	var req updateModuleRequest
	if err := decodeJSON(r, &req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request", nil)
		return
	}

	module, err := h.service.UpdateManaged(r.Context(), id, UpdateModuleInput{
		DomainID:    req.DomainID,
		Name:        req.Name,
		Description: req.Description,
		SortOrder:   req.SortOrder,
		IsActive:    req.IsActive,
	}, user.ID, user.Role)
	respondModuleMutation(w, http.StatusOK, module, err)
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "please login", nil)
		return
	}
	id, ok := moduleIDParam(w, r)
	if !ok {
		return
	}

	err := h.service.Delete(r.Context(), id, user.ID, user.Role)
	if respondModuleError(w, err) {
		return
	}
	response.JSON(w, http.StatusOK, map[string]bool{"ok": true}, nil)
}

func (h *Handler) AddModerator(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "please login", nil)
		return
	}
	id, ok := moduleIDParam(w, r)
	if !ok {
		return
	}

	var req moderatorRequest
	if err := decodeJSON(r, &req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request", nil)
		return
	}

	moderator, err := h.service.AddModerator(r.Context(), id, req.UserID, user.ID, user.Role)
	if respondModuleError(w, err) {
		return
	}
	response.JSON(w, http.StatusOK, moderator, nil)
}

func (h *Handler) RemoveModerator(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "please login", nil)
		return
	}
	moduleID, ok := moduleIDParam(w, r)
	if !ok {
		return
	}
	userID, err := strconv.ParseInt(chi.URLParam(r, "userId"), 10, 64)
	if err != nil {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "user not found", nil)
		return
	}

	err = h.service.RemoveModerator(r.Context(), moduleID, userID, user.ID, user.Role)
	if respondModuleError(w, err) {
		return
	}
	response.JSON(w, http.StatusOK, map[string]bool{"ok": true}, nil)
}

func moduleIDParam(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "module not found", nil)
		return 0, false
	}
	return id, true
}

func respondModuleMutation(w http.ResponseWriter, status int, module PublicModule, err error) {
	if respondModuleError(w, err) {
		return
	}
	response.JSON(w, status, module, nil)
}

func respondModuleError(w http.ResponseWriter, err error) bool {
	if errors.Is(err, ErrInvalidInput) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request", nil)
		return true
	}
	if errors.Is(err, ErrConflict) {
		response.Error(w, http.StatusConflict, "CONFLICT", "module slug already exists", nil)
		return true
	}
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "module not found", nil)
		return true
	}
	if errors.Is(err, ErrForbidden) {
		response.Error(w, http.StatusForbidden, "FORBIDDEN", "permission denied", nil)
		return true
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "service unavailable", nil)
		return true
	}
	return false
}

func decodeJSON(r *http.Request, dst interface{}) error {
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	return decoder.Decode(dst)
}
