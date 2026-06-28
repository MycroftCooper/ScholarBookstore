package admin

import (
	"context"
	"strings"
)

type TaskRepository interface {
	HasAdminAccess(ctx context.Context, actorID int64, actorRole string) (bool, error)
	ListTasks(ctx context.Context, filter TaskFilter, page int, pageSize int) ([]Task, int64, error)
	FindTask(ctx context.Context, id int64, actorID int64, actorRole string) (Task, error)
	Stats(ctx context.Context, actorID int64, actorRole string) (TaskStats, error)
	ResolveTask(ctx context.Context, id int64, actorID int64, status string, resolution string, note string) (Task, error)
	Audit(ctx context.Context, input AuditLogInput) error
	ListAuditLogs(ctx context.Context, filter AuditLogFilter, page int, pageSize int) ([]AuditLog, int64, error)
}

type Service struct {
	repo TaskRepository
}

func NewService(repo TaskRepository) *Service {
	return &Service{repo: repo}
}

func (s *Service) ListTasks(ctx context.Context, filter TaskFilter, page int, pageSize int) (Page, error) {
	page, pageSize = normalizePage(page, pageSize)
	filter.TaskType = strings.TrimSpace(filter.TaskType)
	filter.Status = strings.TrimSpace(filter.Status)
	if !validTaskType(filter.TaskType) || !validTaskStatus(filter.Status) {
		return Page{}, ErrInvalidInput
	}
	allowed, err := s.repo.HasAdminAccess(ctx, filter.ActorID, filter.ActorRole)
	if err != nil {
		return Page{}, err
	}
	if !allowed {
		return Page{}, ErrForbidden
	}
	items, total, err := s.repo.ListTasks(ctx, filter, page, pageSize)
	if err != nil {
		return Page{}, err
	}
	return Page{Number: page, Size: pageSize, Total: total, Tasks: ToPublicTasks(items)}, nil
}

func (s *Service) FindTask(ctx context.Context, id int64, actorID int64, actorRole string) (PublicTask, error) {
	if id <= 0 || actorID <= 0 {
		return PublicTask{}, ErrNotFound
	}
	allowed, err := s.repo.HasAdminAccess(ctx, actorID, actorRole)
	if err != nil {
		return PublicTask{}, err
	}
	if !allowed {
		return PublicTask{}, ErrForbidden
	}
	item, err := s.repo.FindTask(ctx, id, actorID, actorRole)
	if err != nil {
		return PublicTask{}, err
	}
	return ToPublicTask(item, true), nil
}

func (s *Service) TaskForAction(ctx context.Context, id int64, actorID int64, actorRole string) (Task, error) {
	if id <= 0 || actorID <= 0 {
		return Task{}, ErrNotFound
	}
	allowed, err := s.repo.HasAdminAccess(ctx, actorID, actorRole)
	if err != nil {
		return Task{}, err
	}
	if !allowed {
		return Task{}, ErrForbidden
	}
	item, err := s.repo.FindTask(ctx, id, actorID, actorRole)
	if err != nil {
		return Task{}, err
	}
	if item.Status != "pending" && item.Status != "processing" {
		return Task{}, ErrConflict
	}
	return item, nil
}

func (s *Service) Stats(ctx context.Context, actorID int64, actorRole string) (TaskStats, error) {
	if actorID <= 0 {
		return TaskStats{}, ErrForbidden
	}
	allowed, err := s.repo.HasAdminAccess(ctx, actorID, actorRole)
	if err != nil {
		return TaskStats{}, err
	}
	if !allowed {
		return TaskStats{}, ErrForbidden
	}
	return s.repo.Stats(ctx, actorID, actorRole)
}

func (s *Service) ResolveTask(ctx context.Context, id int64, actorID int64, status string, resolution string, note string) (PublicTask, error) {
	status = strings.TrimSpace(status)
	resolution = strings.TrimSpace(resolution)
	note = strings.TrimSpace(note)
	if id <= 0 || actorID <= 0 || !closedTaskStatus(status) || resolution == "" {
		return PublicTask{}, ErrInvalidInput
	}
	item, err := s.repo.ResolveTask(ctx, id, actorID, status, resolution, note)
	if err != nil {
		return PublicTask{}, err
	}
	return ToPublicTask(item, true), nil
}

func (s *Service) Audit(ctx context.Context, input AuditLogInput) error {
	input.Action = strings.TrimSpace(input.Action)
	input.TargetType = strings.TrimSpace(input.TargetType)
	input.IP = strings.TrimSpace(input.IP)
	input.UserAgent = strings.TrimSpace(input.UserAgent)
	if input.Detail == nil {
		input.Detail = map[string]string{}
	}
	return s.repo.Audit(ctx, input)
}

func (s *Service) ListAuditLogs(ctx context.Context, filter AuditLogFilter, actorRole string, page int, pageSize int) (AuditLogPage, error) {
	if actorRole != "admin" {
		return AuditLogPage{}, ErrForbidden
	}
	page, pageSize = normalizePage(page, pageSize)
	filter.Action = strings.TrimSpace(filter.Action)
	filter.TargetType = strings.TrimSpace(filter.TargetType)
	items, total, err := s.repo.ListAuditLogs(ctx, filter, page, pageSize)
	if err != nil {
		return AuditLogPage{}, err
	}
	return AuditLogPage{Number: page, Size: pageSize, Total: total, Logs: items}, nil
}

func validTaskType(value string) bool {
	switch value {
	case "", "article_review", "content_report", "comment_report", "user_report", "appeal", "role_request", "module_create_request":
		return true
	default:
		return false
	}
}

func validTaskStatus(value string) bool {
	switch value {
	case "", "pending", "processing", "approved", "rejected", "resolved", "ignored", "cancelled":
		return true
	default:
		return false
	}
}

func closedTaskStatus(value string) bool {
	return value == "approved" || value == "rejected" || value == "resolved" || value == "ignored" || value == "cancelled"
}

func normalizePage(page int, pageSize int) (int, int) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	return page, pageSize
}
