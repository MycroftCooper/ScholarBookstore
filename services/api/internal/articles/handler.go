package articles

import (
	"errors"
	"net/http"

	"scholarbookstore/services/api/internal/auth"
	httprequest "scholarbookstore/services/api/internal/http/request"
	"scholarbookstore/services/api/internal/http/response"
)

type Handler struct {
	service *Service
}

type createArticleRequest struct {
	ModuleID   int64    `json:"moduleId"`
	Title      string   `json:"title"`
	Summary    string   `json:"summary"`
	ContentMD  string   `json:"contentMd"`
	SourceType string   `json:"sourceType"`
	Status     string   `json:"status"`
	Tags       []string `json:"tags"`
}

type updateArticleRequest struct {
	Title      *string   `json:"title"`
	Summary    *string   `json:"summary"`
	ContentMD  *string   `json:"contentMd"`
	SourceType *string   `json:"sourceType"`
	Status     *string   `json:"status"`
	Tags       *[]string `json:"tags"`
}

type reviewArticleRequest struct {
	ReviewNote string `json:"reviewNote"`
}

type adminUpdateArticleRequest struct {
	IsFeatured *bool `json:"isFeatured"`
}

type voteArticleRequest struct {
	Value int `json:"value"`
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) ListPublished(w http.ResponseWriter, r *http.Request) {
	page, pageSize, ok := httprequest.Pagination(r)
	if !ok {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request", nil)
		return
	}

	result, err := h.service.ListPublished(r.Context(), PublishedArticleFilter{
		ModuleSlug: r.URL.Query().Get("moduleSlug"),
		Query:      r.URL.Query().Get("q"),
		TagSlug:    r.URL.Query().Get("tag"),
		Sort:       r.URL.Query().Get("sort"),
		Featured:   r.URL.Query().Get("featured") == "true",
	}, page, pageSize)
	if errors.Is(err, ErrInvalidInput) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "service unavailable", nil)
		return
	}

	response.JSON(w, http.StatusOK, result.Articles, pageMeta(result))
}

func (h *Handler) DetailPublished(w http.ResponseWriter, r *http.Request) {
	id, ok := httprequest.IDParam(r, "id")
	if !ok {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "article not found", nil)
		return
	}

	var article PublicArticle
	var err error
	if user, ok := auth.UserFromContext(r.Context()); ok {
		article, err = h.service.FindPublishedByIDForViewer(r.Context(), id, user.ID)
	} else {
		article, err = h.service.FindPublishedByID(r.Context(), id)
	}
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "article not found", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "service unavailable", nil)
		return
	}

	response.JSON(w, http.StatusOK, article, nil)
}

func (h *Handler) Vote(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "请先登录", nil)
		return
	}
	articleID, idOK := httprequest.IDParam(r, "id")
	if !idOK {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "文章不存在", nil)
		return
	}

	var req voteArticleRequest
	if err := httprequest.DecodeJSON(r, &req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "请求参数不合法", nil)
		return
	}

	article, err := h.service.Vote(r.Context(), articleID, user.ID, req.Value)
	if errors.Is(err, ErrInvalidInput) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "点赞参数不合法", nil)
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

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "please login first", nil)
		return
	}

	var req createArticleRequest
	if err := httprequest.DecodeJSON(r, &req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request", nil)
		return
	}

	article, err := h.service.Create(r.Context(), CreateArticleInput{
		ModuleID:   req.ModuleID,
		AuthorID:   user.ID,
		Title:      req.Title,
		Summary:    req.Summary,
		ContentMD:  req.ContentMD,
		SourceType: req.SourceType,
		Status:     req.Status,
		Tags:       req.Tags,
	})
	if errors.Is(err, ErrInvalidInput) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request", nil)
		return
	}
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusForbidden, "FORBIDDEN", "permission denied", nil)
		return
	}
	if errors.Is(err, ErrForbidden) {
		response.Error(w, http.StatusForbidden, "FORBIDDEN", "current user is restricted from submitting articles", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "service unavailable", nil)
		return
	}

	response.JSON(w, http.StatusCreated, map[string]interface{}{
		"id":     article.ID,
		"status": article.Status,
	}, nil)
}

func (h *Handler) Preview(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "please login first", nil)
		return
	}

	var req createArticleRequest
	if err := httprequest.DecodeJSON(r, &req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request", nil)
		return
	}

	article, err := h.service.Preview(r.Context(), PreviewArticleInput{
		ModuleID:       req.ModuleID,
		AuthorID:       user.ID,
		AuthorUsername: user.Username,
		Title:          req.Title,
		Summary:        req.Summary,
		ContentMD:      req.ContentMD,
		SourceType:     req.SourceType,
		Tags:           req.Tags,
	})
	if errors.Is(err, ErrInvalidInput) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request", nil)
		return
	}
	if errors.Is(err, ErrForbidden) {
		response.Error(w, http.StatusForbidden, "FORBIDDEN", "current user is restricted from submitting articles", nil)
		return
	}
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusForbidden, "FORBIDDEN", "permission denied", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "service unavailable", nil)
		return
	}

	response.JSON(w, http.StatusOK, article, nil)
}
func (h *Handler) ListMine(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "please login first", nil)
		return
	}

	page, pageSize, valid := httprequest.Pagination(r)
	if !valid {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request", nil)
		return
	}

	result, err := h.service.ListMine(r.Context(), user.ID, r.URL.Query().Get("status"), page, pageSize)
	if errors.Is(err, ErrInvalidInput) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "service unavailable", nil)
		return
	}

	response.JSON(w, http.StatusOK, result.Articles, pageMeta(result))
}

func (h *Handler) DetailMine(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "please login first", nil)
		return
	}

	id, idOK := httprequest.IDParam(r, "id")
	if !idOK {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "article not found", nil)
		return
	}

	article, err := h.service.FindMineByID(r.Context(), id, user.ID)
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "article not found", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "service unavailable", nil)
		return
	}

	response.JSON(w, http.StatusOK, article, nil)
}

func (h *Handler) UpdateOwn(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "please login first", nil)
		return
	}

	id, idOK := httprequest.IDParam(r, "id")
	if !idOK {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "article not found", nil)
		return
	}

	var req updateArticleRequest
	if err := httprequest.DecodeJSON(r, &req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request", nil)
		return
	}

	article, err := h.service.UpdateOwn(r.Context(), id, user.ID, UpdateArticleInput{
		Title:      req.Title,
		Summary:    req.Summary,
		ContentMD:  req.ContentMD,
		SourceType: req.SourceType,
		Status:     req.Status,
		Tags:       req.Tags,
	})
	if errors.Is(err, ErrInvalidInput) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request", nil)
		return
	}
	if errors.Is(err, ErrConflict) {
		response.Error(w, http.StatusConflict, "CONFLICT", "article state conflict", nil)
		return
	}
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "article not found", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "service unavailable", nil)
		return
	}

	response.JSON(w, http.StatusOK, article, nil)
}

func (h *Handler) ListPendingReview(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "please login first", nil)
		return
	}

	page, pageSize, ok := httprequest.Pagination(r)
	if !ok {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request", nil)
		return
	}

	result, err := h.service.ListPendingReview(r.Context(), user.ID, user.Role, page, pageSize)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "service unavailable", nil)
		return
	}

	response.JSON(w, http.StatusOK, result.Articles, pageMeta(result))
}

func (h *Handler) ListAdmin(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "please login first", nil)
		return
	}

	page, pageSize, ok := httprequest.Pagination(r)
	if !ok {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request", nil)
		return
	}

	result, err := h.service.ListAdmin(r.Context(), r.URL.Query().Get("status"), user.ID, user.Role, page, pageSize)
	if errors.Is(err, ErrInvalidInput) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "service unavailable", nil)
		return
	}

	response.JSON(w, http.StatusOK, result.Articles, pageMeta(result))
}

func (h *Handler) Archive(w http.ResponseWriter, r *http.Request) {
	h.changeVisibility(w, r, true)
}

func (h *Handler) RestoreArchived(w http.ResponseWriter, r *http.Request) {
	h.changeVisibility(w, r, false)
}

func (h *Handler) UpdateAdmin(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "please login first", nil)
		return
	}

	id, idOK := httprequest.IDParam(r, "id")
	if !idOK {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "article not found", nil)
		return
	}

	var req adminUpdateArticleRequest
	if err := httprequest.DecodeJSON(r, &req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request", nil)
		return
	}

	article, err := h.service.UpdateAdmin(r.Context(), id, user.ID, user.Role, AdminUpdateArticleInput{
		IsFeatured: req.IsFeatured,
	})
	if errors.Is(err, ErrForbidden) {
		response.Error(w, http.StatusForbidden, "FORBIDDEN", "permission denied", nil)
		return
	}
	if errors.Is(err, ErrInvalidInput) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request", nil)
		return
	}
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "article not found", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "service unavailable", nil)
		return
	}

	response.JSON(w, http.StatusOK, article, nil)
}

func (h *Handler) changeVisibility(w http.ResponseWriter, r *http.Request, archive bool) {
	id, idOK := httprequest.IDParam(r, "id")
	if !idOK {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "article not found", nil)
		return
	}

	var (
		article PublicArticle
		err     error
	)
	if archive {
		article, err = h.service.Archive(r.Context(), id)
	} else {
		article, err = h.service.RestoreArchived(r.Context(), id)
	}

	if errors.Is(err, ErrConflict) {
		response.Error(w, http.StatusConflict, "CONFLICT", "article state conflict", nil)
		return
	}
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "article not found", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "service unavailable", nil)
		return
	}

	response.JSON(w, http.StatusOK, article, nil)
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
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "please login first", nil)
		return
	}

	id, idOK := httprequest.IDParam(r, "id")
	if !idOK {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "article not found", nil)
		return
	}

	var req reviewArticleRequest
	if err := httprequest.DecodeJSON(r, &req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request", nil)
		return
	}

	var (
		article PublicArticle
		err     error
	)
	if approve {
		article, err = h.service.Approve(r.Context(), id, user.ID, user.Role, req.ReviewNote)
	} else {
		article, err = h.service.Reject(r.Context(), id, user.ID, user.Role, req.ReviewNote)
	}

	if errors.Is(err, ErrForbidden) {
		response.Error(w, http.StatusForbidden, "FORBIDDEN", "permission denied", nil)
		return
	}
	if errors.Is(err, ErrInvalidInput) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request", nil)
		return
	}
	if errors.Is(err, ErrConflict) {
		response.Error(w, http.StatusConflict, "CONFLICT", "article state conflict", nil)
		return
	}
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "article not found", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "service unavailable", nil)
		return
	}

	response.JSON(w, http.StatusOK, article, nil)
}

func pageMeta(page Page) map[string]interface{} {
	return map[string]interface{}{
		"page":     page.Number,
		"pageSize": page.Size,
		"total":    page.Total,
	}
}
