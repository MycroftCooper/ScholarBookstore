package tags

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"scholarbookstore/services/api/internal/http/response"
)

type Handler struct {
	service *Service
}

type updateRequest struct {
	Name string `json:"name"`
}

type mergeRequest struct {
	SourceIDs []int64 `json:"sourceIds"`
	TargetID  int64   `json:"targetId"`
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	page, pageSize, ok := parsePagination(r)
	if !ok {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "分页参数不合法", nil)
		return
	}
	result, err := h.service.List(r.Context(), Filter{Query: r.URL.Query().Get("q")}, page, pageSize)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}
	response.JSON(w, http.StatusOK, result.Tags, pageMeta(result))
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id, ok := parseIDParam(r, "id")
	if !ok {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "Tag 不存在", nil)
		return
	}
	var req updateRequest
	if err := decodeJSON(r, &req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "请求参数不合法", nil)
		return
	}
	item, err := h.service.Update(r.Context(), id, UpdateInput{Name: req.Name})
	if errors.Is(err, ErrInvalidInput) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "Tag 名称不合法", nil)
		return
	}
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "Tag 不存在", nil)
		return
	}
	if errors.Is(err, ErrConflict) {
		response.Error(w, http.StatusConflict, "CONFLICT", "Tag 标识已存在", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}
	response.JSON(w, http.StatusOK, item, nil)
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id, ok := parseIDParam(r, "id")
	if !ok {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "Tag 不存在", nil)
		return
	}
	err := h.service.Delete(r.Context(), id)
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "Tag 不存在", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}
	response.JSON(w, http.StatusOK, map[string]bool{"ok": true}, nil)
}

func (h *Handler) Merge(w http.ResponseWriter, r *http.Request) {
	var req mergeRequest
	if err := decodeJSON(r, &req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "请求参数不合法", nil)
		return
	}
	item, err := h.service.Merge(r.Context(), MergeInput{SourceIDs: req.SourceIDs, TargetID: req.TargetID})
	if errors.Is(err, ErrInvalidInput) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "合并参数不合法", nil)
		return
	}
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "Tag 不存在", nil)
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

func pageMeta(page Page) map[string]interface{} {
	return map[string]interface{}{"page": page.Number, "pageSize": page.Size, "total": page.Total}
}

func decodeJSON(r *http.Request, dst interface{}) error {
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	return decoder.Decode(dst)
}
