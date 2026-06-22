package reports

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

type createReportRequest struct {
	Reason string `json:"reason"`
}

type resolveReportRequest struct {
	Status         string `json:"status"`
	Note           string `json:"note"`
	ArchiveArticle bool   `json:"archiveArticle"`
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "请先登录", nil)
		return
	}
	articleID, idOK := parseIDParam(r, "id")
	if !idOK {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "文章不存在", nil)
		return
	}
	var req createReportRequest
	if err := decodeJSON(r, &req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "请求参数不合法", nil)
		return
	}
	report, err := h.service.Create(r.Context(), articleID, user.ID, req.Reason)
	if errors.Is(err, ErrInvalidInput) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "举报原因不合法", nil)
		return
	}
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "文章不存在", nil)
		return
	}
	if errors.Is(err, ErrConflict) {
		response.Error(w, http.StatusConflict, "CONFLICT", "你已举报过该文章", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}
	response.JSON(w, http.StatusCreated, report, nil)
}

func (h *Handler) ListAdmin(w http.ResponseWriter, r *http.Request) {
	page, pageSize, ok := parsePagination(r)
	if !ok {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "分页参数不合法", nil)
		return
	}
	result, err := h.service.ListAdmin(r.Context(), r.URL.Query().Get("status"), page, pageSize)
	if errors.Is(err, ErrInvalidInput) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "查询参数不合法", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}
	response.JSON(w, http.StatusOK, result.Reports, pageMeta(result))
}

func (h *Handler) Resolve(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "请先登录", nil)
		return
	}
	reportID, idOK := parseIDParam(r, "id")
	if !idOK {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "举报不存在", nil)
		return
	}
	var req resolveReportRequest
	if err := decodeJSON(r, &req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "请求参数不合法", nil)
		return
	}
	report, err := h.service.Resolve(r.Context(), reportID, user.ID, req.Status, req.Note, req.ArchiveArticle)
	if errors.Is(err, ErrInvalidInput) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "处理参数不合法", nil)
		return
	}
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "举报不存在", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}
	response.JSON(w, http.StatusOK, report, nil)
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

func decodeJSON(r *http.Request, dst interface{}) error {
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	return decoder.Decode(dst)
}
