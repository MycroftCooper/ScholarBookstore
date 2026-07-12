package follows

import (
	"context"
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

func (h *Handler) State(w http.ResponseWriter, r *http.Request) {
	h.withUserTarget(w, r, h.service.State)
}

func (h *Handler) Follow(w http.ResponseWriter, r *http.Request) {
	h.withUserTarget(w, r, h.service.Follow)
}

func (h *Handler) Unfollow(w http.ResponseWriter, r *http.Request) {
	h.withUserTarget(w, r, h.service.Unfollow)
}

func (h *Handler) ListFollowing(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "请先登录", nil)
		return
	}
	result, err := h.service.ListFollowingPage(r.Context(), user.ID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}
	response.JSON(w, http.StatusOK, result, nil)
}

func (h *Handler) ListFollowers(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "请先登录", nil)
		return
	}
	items, err := h.service.ListFollowers(r.Context(), user.ID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}
	response.JSON(w, http.StatusOK, items, nil)
}

func (h *Handler) ListRecommendedUsers(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "请先登录", nil)
		return
	}
	limit := 6
	if raw := r.URL.Query().Get("limit"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil {
			response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "推荐数量不合法", nil)
			return
		}
		limit = parsed
	}
	items, err := h.service.ListRecommendedUsers(r.Context(), user.ID, limit)
	if errors.Is(err, ErrForbidden) {
		response.Error(w, http.StatusForbidden, "FORBIDDEN", "无权查看推荐", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}
	response.JSON(w, http.StatusOK, items, nil)
}

func (h *Handler) ModuleState(w http.ResponseWriter, r *http.Request) {
	h.withModuleTarget(w, r, h.service.ModuleState)
}

func (h *Handler) FollowModule(w http.ResponseWriter, r *http.Request) {
	h.withModuleTarget(w, r, h.service.FollowModule)
}

func (h *Handler) UnfollowModule(w http.ResponseWriter, r *http.Request) {
	h.withModuleTarget(w, r, h.service.UnfollowModule)
}

func (h *Handler) DomainState(w http.ResponseWriter, r *http.Request) {
	h.withDomainTarget(w, r, h.service.DomainState)
}

func (h *Handler) FollowDomain(w http.ResponseWriter, r *http.Request) {
	h.withDomainTarget(w, r, h.service.FollowDomain)
}

func (h *Handler) UnfollowDomain(w http.ResponseWriter, r *http.Request) {
	h.withDomainTarget(w, r, h.service.UnfollowDomain)
}

func (h *Handler) withUserTarget(w http.ResponseWriter, r *http.Request, action func(context.Context, int64, string) (PublicState, error)) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "请先登录", nil)
		return
	}
	result, err := action(r.Context(), user.ID, chi.URLParam(r, "username"))
	if errors.Is(err, ErrInvalidInput) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "关注参数不合法", nil)
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
	response.JSON(w, http.StatusOK, result, nil)
}

func (h *Handler) withModuleTarget(w http.ResponseWriter, r *http.Request, action func(context.Context, int64, string) (PublicTargetState, error)) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "请先登录", nil)
		return
	}
	result, err := action(r.Context(), user.ID, chi.URLParam(r, "slug"))
	h.writeTargetState(w, result, err, "版块不存在")
}

func (h *Handler) withDomainTarget(w http.ResponseWriter, r *http.Request, action func(context.Context, int64, int64) (PublicTargetState, error)) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "请先登录", nil)
		return
	}
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || id <= 0 {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "领域不存在", nil)
		return
	}
	result, actionErr := action(r.Context(), user.ID, id)
	h.writeTargetState(w, result, actionErr, "领域不存在")
}

func (h *Handler) writeTargetState(w http.ResponseWriter, result PublicTargetState, err error, notFoundMessage string) {
	if errors.Is(err, ErrInvalidInput) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "关注参数不合法", nil)
		return
	}
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", notFoundMessage, nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}
	response.JSON(w, http.StatusOK, result, nil)
}
