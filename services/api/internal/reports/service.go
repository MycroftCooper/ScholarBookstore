package reports

import (
	"context"
	"strings"
)

type ReportRepository interface {
	Create(ctx context.Context, articleID int64, reporterID int64, reason string) (Report, error)
	CreateUser(ctx context.Context, username string, reporterID int64, reason string) (UserReport, error)
	ListAdmin(ctx context.Context, status string, page int, pageSize int) ([]Report, int64, error)
	Resolve(ctx context.Context, id int64, reviewerID int64, status string, note string, archiveArticle bool) (Report, error)
}

type Service struct {
	repo ReportRepository
}

func NewService(repo ReportRepository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, articleID int64, reporterID int64, reason string) (PublicReport, error) {
	reason = strings.TrimSpace(reason)
	if articleID <= 0 || reporterID <= 0 || reason == "" || len([]rune(reason)) > 1000 {
		return PublicReport{}, ErrInvalidInput
	}
	item, err := s.repo.Create(ctx, articleID, reporterID, reason)
	if err != nil {
		return PublicReport{}, err
	}
	return ToPublic(item), nil
}

func (s *Service) CreateUser(ctx context.Context, username string, reporterID int64, reason string) (PublicUserReport, error) {
	username = strings.TrimSpace(username)
	reason = strings.TrimSpace(reason)
	if username == "" || reporterID <= 0 || reason == "" || len([]rune(reason)) > 1000 {
		return PublicUserReport{}, ErrInvalidInput
	}
	item, err := s.repo.CreateUser(ctx, username, reporterID, reason)
	if err != nil {
		return PublicUserReport{}, err
	}
	return ToPublicUserReport(item), nil
}

func (s *Service) ListAdmin(ctx context.Context, status string, page int, pageSize int) (Page, error) {
	status = strings.TrimSpace(status)
	if status != "" && status != "pending" && status != "resolved" && status != "rejected" {
		return Page{}, ErrInvalidInput
	}
	page, pageSize = normalizePage(page, pageSize)
	items, total, err := s.repo.ListAdmin(ctx, status, page, pageSize)
	if err != nil {
		return Page{}, err
	}
	return Page{Number: page, Size: pageSize, Total: total, Reports: ToPublicList(items)}, nil
}

func (s *Service) Resolve(ctx context.Context, id int64, reviewerID int64, status string, note string, archiveArticle bool) (PublicReport, error) {
	status = strings.TrimSpace(status)
	note = strings.TrimSpace(note)
	if id <= 0 || reviewerID <= 0 || (status != "resolved" && status != "rejected") {
		return PublicReport{}, ErrInvalidInput
	}
	if status == "rejected" && archiveArticle {
		return PublicReport{}, ErrInvalidInput
	}
	item, err := s.repo.Resolve(ctx, id, reviewerID, status, note, archiveArticle)
	if err != nil {
		return PublicReport{}, err
	}
	return ToPublic(item), nil
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
