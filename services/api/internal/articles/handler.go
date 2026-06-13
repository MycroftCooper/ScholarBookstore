package articles

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

type createArticleRequest struct {
	ModuleID  int64  `json:"moduleId"`
	Title     string `json:"title"`
	Summary   string `json:"summary"`
	ContentMD string `json:"contentMd"`
}

type updateArticleRequest struct {
	Title     *string `json:"title"`
	Summary   *string `json:"summary"`
	ContentMD *string `json:"contentMd"`
}

type reviewArticleRequest struct {
	ReviewNote string `json:"reviewNote"`
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) ListPublished(w http.ResponseWriter, r *http.Request) {
	page, pageSize, ok := parsePagination(r)
	if !ok {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "分页参数不合法", nil)
		return
	}

	result, err := h.service.ListPublished(r.Context(), r.URL.Query().Get("moduleSlug"), page, pageSize)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}

	response.JSON(w, http.StatusOK, result.Articles, pageMeta(result))
}

func (h *Handler) DetailPublished(w http.ResponseWriter, r *http.Request) {
	id, ok := parseIDParam(r, "id")
	if !ok {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "文章不存在", nil)
		return
	}

	article, err := h.service.FindPublishedByID(r.Context(), id)
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "文章不存在", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}

	response.JSON(w, http.StatusOK, article, nil)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "请先登录", nil)
		return
	}

	var req createArticleRequest
	if err := decodeJSON(r, &req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "请求参数不合法", nil)
		return
	}

	article, err := h.service.Create(r.Context(), CreateArticleInput{
		ModuleID:  req.ModuleID,
		AuthorID:  user.ID,
		Title:     req.Title,
		Summary:   req.Summary,
		ContentMD: req.ContentMD,
	})
	if errors.Is(err, ErrInvalidInput) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "请求参数不合法", nil)
		return
	}
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusForbidden, "FORBIDDEN", "版块不可投稿", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}

	response.JSON(w, http.StatusCreated, map[string]interface{}{
		"id":     article.ID,
		"status": article.Status,
	}, nil)
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

	result, err := h.service.ListMine(r.Context(), user.ID, r.URL.Query().Get("status"), page, pageSize)
	if errors.Is(err, ErrInvalidInput) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "状态参数不合法", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}

	response.JSON(w, http.StatusOK, result.Articles, pageMeta(result))
}

func (h *Handler) UpdateOwn(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "请先登录", nil)
		return
	}

	id, idOK := parseIDParam(r, "id")
	if !idOK {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "文章不存在", nil)
		return
	}

	var req updateArticleRequest
	if err := decodeJSON(r, &req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "请求参数不合法", nil)
		return
	}

	article, err := h.service.UpdateOwn(r.Context(), id, user.ID, UpdateArticleInput{
		Title:     req.Title,
		Summary:   req.Summary,
		ContentMD: req.ContentMD,
	})
	if errors.Is(err, ErrInvalidInput) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "请求参数不合法", nil)
		return
	}
	if errors.Is(err, ErrConflict) {
		response.Error(w, http.StatusConflict, "CONFLICT", "当前文章状态不允许编辑", nil)
		return
	}
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "文章不存在", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}

	response.JSON(w, http.StatusOK, article, nil)
}

func (h *Handler) ListPendingReview(w http.ResponseWriter, r *http.Request) {
	page, pageSize, ok := parsePagination(r)
	if !ok {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "分页参数不合法", nil)
		return
	}

	result, err := h.service.ListPendingReview(r.Context(), page, pageSize)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}

	response.JSON(w, http.StatusOK, result.Articles, pageMeta(result))
}

func (h *Handler) Approve(w http.ResponseWriter, r *http.Request) {
	h.review(w, r, true)
}

func (h *Handler) Reject(w http.ResponseWriter, r *http.Request) {
	h.review(w, r, false)
}

func (h *Handler) review(w http.ResponseWriter, r *http.Request, approve bool) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "请先登录", nil)
		return
	}

	id, idOK := parseIDParam(r, "id")
	if !idOK {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "文章不存在", nil)
		return
	}

	var req reviewArticleRequest
	if err := decodeJSON(r, &req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "请求参数不合法", nil)
		return
	}

	var (
		article PublicArticle
		err     error
	)
	if approve {
		article, err = h.service.Approve(r.Context(), id, user.ID, req.ReviewNote)
	} else {
		article, err = h.service.Reject(r.Context(), id, user.ID, req.ReviewNote)
	}

	if errors.Is(err, ErrInvalidInput) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "拒绝原因不能为空", nil)
		return
	}
	if errors.Is(err, ErrConflict) {
		response.Error(w, http.StatusConflict, "CONFLICT", "当前文章状态不允许审核", nil)
		return
	}
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "文章不存在", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}

	response.JSON(w, http.StatusOK, article, nil)
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
