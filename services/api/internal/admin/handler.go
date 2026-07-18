package admin

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"scholarbookstore/services/api/internal/articles"
	"scholarbookstore/services/api/internal/auth"
	httprequest "scholarbookstore/services/api/internal/http/request"
	"scholarbookstore/services/api/internal/http/response"
	"scholarbookstore/services/api/internal/moderation"
	"scholarbookstore/services/api/internal/reports"
)

type Handler struct {
	service        *Service
	articleService *articles.Service
	reportService  *reports.Service
	moderation     *moderation.Service
}

type taskActionRequest struct {
	Note    string                   `json:"note"`
	Actions []moderation.ActionInput `json:"actions"`
}

func NewHandler(service *Service, articleService *articles.Service, reportService *reports.Service, moderationService *moderation.Service) *Handler {
	return &Handler{service: service, articleService: articleService, reportService: reportService, moderation: moderationService}
}

func (h *Handler) ListTasks(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "请先登录", nil)
		return
	}
	page, pageSize, ok := httprequest.Pagination(r)
	if !ok {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "分页参数不合法", nil)
		return
	}
	filter, ok := parseTaskFilter(r, user.ID, user.Role)
	if !ok {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "查询参数不合法", nil)
		return
	}
	result, err := h.service.ListTasks(r.Context(), filter, page, pageSize)
	if errors.Is(err, ErrInvalidInput) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "查询参数不合法", nil)
		return
	}
	if errors.Is(err, ErrForbidden) {
		response.Error(w, http.StatusForbidden, "FORBIDDEN", "permission denied", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}
	response.JSON(w, http.StatusOK, result.Tasks, pageMeta(result))
}

func (h *Handler) TaskStats(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "请先登录", nil)
		return
	}
	stats, err := h.service.Stats(r.Context(), user.ID, user.Role)
	if errors.Is(err, ErrForbidden) {
		response.Error(w, http.StatusForbidden, "FORBIDDEN", "permission denied", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}
	response.JSON(w, http.StatusOK, stats, nil)
}

func (h *Handler) TaskDetail(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "请先登录", nil)
		return
	}
	id, idOK := httprequest.IDParam(r, "id")
	if !idOK {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "待办不存在", nil)
		return
	}
	task, err := h.service.FindTask(r.Context(), id, user.ID, user.Role)
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "待办不存在", nil)
		return
	}
	if errors.Is(err, ErrForbidden) {
		response.Error(w, http.StatusForbidden, "FORBIDDEN", "permission denied", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}
	response.JSON(w, http.StatusOK, task, nil)
}

func (h *Handler) ListAuditLogs(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "请先登录", nil)
		return
	}
	page, pageSize, ok := httprequest.Pagination(r)
	if !ok {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "分页参数不合法", nil)
		return
	}
	filter, ok := parseAuditLogFilter(r)
	if !ok {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "查询参数不合法", nil)
		return
	}
	result, err := h.service.ListAuditLogs(r.Context(), filter, user.Role, page, pageSize)
	if errors.Is(err, ErrForbidden) {
		response.Error(w, http.StatusForbidden, "FORBIDDEN", "permission denied", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}
	response.JSON(w, http.StatusOK, result.Logs, map[string]interface{}{
		"page":     result.Number,
		"pageSize": result.Size,
		"total":    result.Total,
	})
}

func (h *Handler) ApproveTask(w http.ResponseWriter, r *http.Request) {
	h.handleTaskAction(w, r, "approve")
}

func (h *Handler) RejectTask(w http.ResponseWriter, r *http.Request) {
	h.handleTaskAction(w, r, "reject")
}

func (h *Handler) TakeDownTask(w http.ResponseWriter, r *http.Request) {
	h.handleTaskAction(w, r, "take_down")
}

func (h *Handler) IgnoreTask(w http.ResponseWriter, r *http.Request) {
	h.handleTaskAction(w, r, "ignore")
}

func (h *Handler) handleTaskAction(w http.ResponseWriter, r *http.Request, action string) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "请先登录", nil)
		return
	}
	id, idOK := httprequest.IDParam(r, "id")
	if !idOK {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "待办不存在", nil)
		return
	}
	var req taskActionRequest
	if err := httprequest.DecodeJSON(r, &req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "请求参数不合法", nil)
		return
	}
	req.Note = strings.TrimSpace(req.Note)
	task, err := h.service.TaskForAction(r.Context(), id, user.ID, user.Role)
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "待办不存在", nil)
		return
	}
	if errors.Is(err, ErrForbidden) {
		response.Error(w, http.StatusForbidden, "FORBIDDEN", "permission denied", nil)
		return
	}
	if errors.Is(err, ErrConflict) {
		response.Error(w, http.StatusConflict, "CONFLICT", "待办已处理", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}

	status, resolution, auditAction, actionErr := h.executeTaskAction(r, task, user.ID, user.Role, action, req.Note, req.Actions)
	if actionErr != nil {
		h.writeActionError(w, actionErr)
		return
	}
	resolved, err := h.service.ResolveTask(r.Context(), task.ID, user.ID, status, resolution, req.Note)
	if errors.Is(err, ErrInvalidInput) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "请求参数不合法", nil)
		return
	}
	if errors.Is(err, ErrConflict) {
		response.Error(w, http.StatusConflict, "CONFLICT", "待办已处理", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}
	_ = h.service.Audit(r.Context(), AuditLogInput{
		ActorID:    user.ID,
		Action:     auditAction,
		TargetType: task.ObjectType,
		TargetID:   task.ObjectID,
		DomainID:   task.DomainID,
		ModuleID:   task.ModuleID,
		Detail: map[string]string{
			"taskId":  strconv.FormatInt(task.ID, 10),
			"note":    req.Note,
			"actions": formatModerationActions(req.Actions),
		},
		IP:        r.RemoteAddr,
		UserAgent: r.UserAgent(),
	})
	response.JSON(w, http.StatusOK, resolved, nil)
}

func (h *Handler) executeTaskAction(r *http.Request, task Task, actorID int64, actorRole string, action string, note string, actions []moderation.ActionInput) (string, string, string, error) {
	switch task.TaskType {
	case "article_review":
		switch action {
		case "approve":
			_, err := h.articleService.Approve(r.Context(), task.ObjectID, actorID, actorRole, note)
			return "approved", "approved", "article_review_approved", mapArticleErr(err)
		case "reject":
			if note == "" {
				return "", "", "", ErrInvalidInput
			}
			_, err := h.articleService.Reject(r.Context(), task.ObjectID, actorID, actorRole, note)
			return "rejected", "rejected", "article_review_rejected", mapArticleErr(err)
		case "take_down":
			if note == "" {
				return "", "", "", ErrInvalidInput
			}
			_, err := h.articleService.Archive(r.Context(), task.ObjectID)
			return "resolved", "taken_down", "article_taken_down", mapArticleErr(err)
		default:
			return "", "", "", ErrInvalidInput
		}
	case "content_report":
		switch action {
		case "ignore":
			if note == "" {
				return "", "", "", ErrInvalidInput
			}
			_, err := h.reportService.Resolve(r.Context(), task.ObjectID, actorID, "rejected", note, false)
			return "ignored", "ignored", "content_report_ignored", mapReportErr(err)
		case "take_down":
			if note == "" {
				return "", "", "", ErrInvalidInput
			}
			if len(actions) == 0 {
				actions = []moderation.ActionInput{{Type: "hide_content"}}
			}
			_, err := h.reportService.Resolve(r.Context(), task.ObjectID, actorID, "resolved", note, hasAction(actions, "hide_content"))
			if mapped := mapReportErr(err); mapped != nil {
				return "", "", "", mapped
			}
			if err := h.applyModerationActions(r, task, actorID, note, "article_report", actions); err != nil {
				return "", "", "", err
			}
			return "resolved", "penalized", "content_report_resolved", nil
		default:
			return "", "", "", ErrInvalidInput
		}
	case "comment_report":
		switch action {
		case "ignore":
			if note == "" {
				return "", "", "", ErrInvalidInput
			}
			_, err := h.reportService.ResolveComment(r.Context(), task.ObjectID, actorID, "rejected", note, false)
			return "ignored", "ignored", "comment_report_ignored", mapReportErr(err)
		case "take_down":
			if note == "" {
				return "", "", "", ErrInvalidInput
			}
			if len(actions) == 0 {
				actions = []moderation.ActionInput{{Type: "hide_content"}}
			}
			_, err := h.reportService.ResolveComment(r.Context(), task.ObjectID, actorID, "resolved", note, hasAction(actions, "hide_content"))
			if mapped := mapReportErr(err); mapped != nil {
				return "", "", "", mapped
			}
			if err := h.applyModerationActions(r, task, actorID, note, "comment_report", actions); err != nil {
				return "", "", "", err
			}
			return "resolved", "penalized", "comment_report_resolved", nil
		default:
			return "", "", "", ErrInvalidInput
		}
	case "user_report":
		switch action {
		case "ignore":
			if note == "" {
				return "", "", "", ErrInvalidInput
			}
			_, err := h.reportService.ResolveUser(r.Context(), task.ObjectID, actorID, "rejected", note, false)
			return "ignored", "ignored", "user_report_ignored", mapReportErr(err)
		case "take_down":
			if note == "" {
				return "", "", "", ErrInvalidInput
			}
			if len(actions) == 0 {
				actions = []moderation.ActionInput{{Type: "disable_account"}}
			}
			_, err := h.reportService.ResolveUser(r.Context(), task.ObjectID, actorID, "resolved", note, hasAction(actions, "disable_account"))
			if mapped := mapReportErr(err); mapped != nil {
				return "", "", "", mapped
			}
			if err := h.applyModerationActions(r, task, actorID, note, "user_report", actions); err != nil {
				return "", "", "", err
			}
			return "resolved", "penalized", "user_report_resolved", nil
		default:
			return "", "", "", ErrInvalidInput
		}
	default:
		return "", "", "", ErrInvalidInput
	}
}

func (h *Handler) writeActionError(w http.ResponseWriter, err error) {
	if errors.Is(err, ErrInvalidInput) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "处理备注或动作不合法", nil)
		return
	}
	if errors.Is(err, ErrForbidden) {
		response.Error(w, http.StatusForbidden, "FORBIDDEN", "permission denied", nil)
		return
	}
	if errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusNotFound, "NOT_FOUND", "对象不存在", nil)
		return
	}
	if errors.Is(err, ErrConflict) {
		response.Error(w, http.StatusConflict, "CONFLICT", "对象状态不允许执行该操作", nil)
		return
	}
	response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
}

func (h *Handler) applyModerationActions(r *http.Request, task Task, actorID int64, note string, sourceType string, actions []moderation.ActionInput) error {
	if h.moderation == nil {
		return nil
	}
	for _, action := range actions {
		action.Type = strings.TrimSpace(action.Type)
		switch action.Type {
		case "hide_content":
			continue
		case "disable_account":
			if task.TargetUserID == nil {
				return ErrInvalidInput
			}
			if err := h.moderation.DisableUser(r.Context(), *task.TargetUserID); err != nil {
				return mapModerationErr(err)
			}
			if err := h.createPenalty(r, task, actorID, note, sourceType, moderation.PenaltyAccountDisabled, 0); err != nil {
				return err
			}
		case "restrict_follow":
			if err := h.createPenalty(r, task, actorID, note, sourceType, moderation.PenaltyFollowRestricted, action.Duration); err != nil {
				return err
			}
		case "ban_article_create":
			if err := h.createPenalty(r, task, actorID, note, sourceType, moderation.PenaltyArticleCreateBanned, action.Duration); err != nil {
				return err
			}
		case "ban_comment_create":
			if err := h.createPenalty(r, task, actorID, note, sourceType, moderation.PenaltyCommentCreateBanned, action.Duration); err != nil {
				return err
			}
		default:
			return ErrInvalidInput
		}
	}
	return nil
}

func (h *Handler) createPenalty(r *http.Request, task Task, actorID int64, note string, sourceType string, penaltyType string, durationDays int) error {
	if task.TargetUserID == nil || durationDays < 0 || durationDays > 3650 {
		return ErrInvalidInput
	}
	targetType := "user"
	var targetID *int64
	switch task.ObjectType {
	case "article_report":
		targetType = "article"
	case "comment_report":
		targetType = "comment"
	}
	if targetType != "user" {
		id := task.ObjectID
		targetID = &id
	}
	err := h.moderation.CreatePenalty(r.Context(), moderation.PenaltyInput{
		UserID:     *task.TargetUserID,
		Type:       penaltyType,
		TargetType: targetType,
		TargetID:   targetID,
		Reason:     note,
		ExpiresAt:  moderation.ExpiresInDays(durationDays),
		CreatedBy:  actorID,
		SourceType: sourceType,
		SourceID:   task.ObjectID,
	})
	return mapModerationErr(err)
}

func hasAction(actions []moderation.ActionInput, actionType string) bool {
	for _, action := range actions {
		if strings.TrimSpace(action.Type) == actionType {
			return true
		}
	}
	return false
}

func formatModerationActions(actions []moderation.ActionInput) string {
	if len(actions) == 0 {
		return ""
	}
	parts := make([]string, 0, len(actions))
	for _, action := range actions {
		parts = append(parts, fmt.Sprintf("%s:%d", strings.TrimSpace(action.Type), action.Duration))
	}
	return strings.Join(parts, ",")
}

func mapArticleErr(err error) error {
	if errors.Is(err, articles.ErrInvalidInput) {
		return ErrInvalidInput
	}
	if errors.Is(err, articles.ErrForbidden) {
		return ErrForbidden
	}
	if errors.Is(err, articles.ErrNotFound) {
		return ErrNotFound
	}
	if errors.Is(err, articles.ErrConflict) {
		return ErrConflict
	}
	return err
}

func mapReportErr(err error) error {
	if errors.Is(err, reports.ErrInvalidInput) {
		return ErrInvalidInput
	}
	if errors.Is(err, reports.ErrNotFound) {
		return ErrNotFound
	}
	if errors.Is(err, reports.ErrConflict) {
		return ErrConflict
	}
	return err
}

func mapModerationErr(err error) error {
	if errors.Is(err, moderation.ErrInvalidInput) {
		return ErrInvalidInput
	}
	if errors.Is(err, moderation.ErrForbidden) {
		return ErrForbidden
	}
	return err
}

func parseTaskFilter(r *http.Request, actorID int64, actorRole string) (TaskFilter, bool) {
	query := r.URL.Query()
	filter := TaskFilter{
		TaskType:  query.Get("taskType"),
		Status:    query.Get("status"),
		ActorID:   actorID,
		ActorRole: actorRole,
	}
	if value := strings.TrimSpace(query.Get("priority")); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil {
			return TaskFilter{}, false
		}
		filter.Priority = &parsed
	}
	if value := strings.TrimSpace(query.Get("domainId")); value != "" {
		parsed, err := strconv.ParseInt(value, 10, 64)
		if err != nil || parsed <= 0 {
			return TaskFilter{}, false
		}
		filter.DomainID = &parsed
	}
	if value := strings.TrimSpace(query.Get("moduleId")); value != "" {
		parsed, err := strconv.ParseInt(value, 10, 64)
		if err != nil || parsed <= 0 {
			return TaskFilter{}, false
		}
		filter.ModuleID = &parsed
	}
	if value := strings.TrimSpace(query.Get("assigneeId")); value != "" {
		parsed, err := strconv.ParseInt(value, 10, 64)
		if err != nil || parsed <= 0 {
			return TaskFilter{}, false
		}
		filter.AssigneeID = &parsed
	}
	return filter, true
}

func parseAuditLogFilter(r *http.Request) (AuditLogFilter, bool) {
	query := r.URL.Query()
	filter := AuditLogFilter{
		Action:     query.Get("action"),
		TargetType: query.Get("targetType"),
	}
	if value := strings.TrimSpace(query.Get("actorId")); value != "" {
		parsed, err := strconv.ParseInt(value, 10, 64)
		if err != nil || parsed <= 0 {
			return AuditLogFilter{}, false
		}
		filter.ActorID = &parsed
	}
	if value := strings.TrimSpace(query.Get("targetId")); value != "" {
		parsed, err := strconv.ParseInt(value, 10, 64)
		if err != nil || parsed <= 0 {
			return AuditLogFilter{}, false
		}
		filter.TargetID = &parsed
	}
	if value := strings.TrimSpace(query.Get("domainId")); value != "" {
		parsed, err := strconv.ParseInt(value, 10, 64)
		if err != nil || parsed <= 0 {
			return AuditLogFilter{}, false
		}
		filter.DomainID = &parsed
	}
	if value := strings.TrimSpace(query.Get("moduleId")); value != "" {
		parsed, err := strconv.ParseInt(value, 10, 64)
		if err != nil || parsed <= 0 {
			return AuditLogFilter{}, false
		}
		filter.ModuleID = &parsed
	}
	return filter, true
}

func pageMeta(page Page) map[string]interface{} {
	return map[string]interface{}{
		"page":     page.Number,
		"pageSize": page.Size,
		"total":    page.Total,
	}
}

func unsupportedTaskAction(task Task, action string) error {
	return fmt.Errorf("unsupported task action %s for %s", action, task.TaskType)
}
