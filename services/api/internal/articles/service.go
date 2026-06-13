package articles

import (
	"context"
	"strings"
)

var validStatuses = map[string]struct{}{
	"draft":          {},
	"pending_review": {},
	"published":      {},
	"rejected":       {},
	"archived":       {},
}

type ArticleRepository interface {
	ListPublished(ctx context.Context, moduleSlug string, page int, pageSize int) ([]Article, int64, error)
	FindPublishedByID(ctx context.Context, id int64) (Article, error)
	ListMine(ctx context.Context, authorID int64, status string, page int, pageSize int) ([]Article, int64, error)
	Create(ctx context.Context, input CreateArticleInput) (Article, error)
	FindByIDForAuthor(ctx context.Context, id int64, authorID int64) (Article, error)
	UpdateOwn(ctx context.Context, id int64, authorID int64, input UpdateArticleInput) (Article, error)
	ListPendingReview(ctx context.Context, page int, pageSize int) ([]Article, int64, error)
	Approve(ctx context.Context, id int64, input ReviewArticleInput) (Article, error)
	Reject(ctx context.Context, id int64, input ReviewArticleInput) (Article, error)
}

type Service struct {
	repo ArticleRepository
}

func NewService(repo ArticleRepository) *Service {
	return &Service{repo: repo}
}

func (s *Service) ListPublished(ctx context.Context, moduleSlug string, page int, pageSize int) (Page, error) {
	page, pageSize = normalizePage(page, pageSize)
	items, total, err := s.repo.ListPublished(ctx, strings.TrimSpace(moduleSlug), page, pageSize)
	if err != nil {
		return Page{}, err
	}
	return Page{Number: page, Size: pageSize, Total: total, Articles: ToPublicList(items, false)}, nil
}

func (s *Service) FindPublishedByID(ctx context.Context, id int64) (PublicArticle, error) {
	if id <= 0 {
		return PublicArticle{}, ErrNotFound
	}
	item, err := s.repo.FindPublishedByID(ctx, id)
	if err != nil {
		return PublicArticle{}, err
	}
	return ToPublic(item, true), nil
}

func (s *Service) ListMine(ctx context.Context, authorID int64, status string, page int, pageSize int) (Page, error) {
	page, pageSize = normalizePage(page, pageSize)
	status = strings.TrimSpace(status)
	if status != "" {
		if _, ok := validStatuses[status]; !ok {
			return Page{}, ErrInvalidInput
		}
	}

	items, total, err := s.repo.ListMine(ctx, authorID, status, page, pageSize)
	if err != nil {
		return Page{}, err
	}
	return Page{Number: page, Size: pageSize, Total: total, Articles: ToPublicList(items, true)}, nil
}

func (s *Service) Create(ctx context.Context, input CreateArticleInput) (PublicArticle, error) {
	input.Title = strings.TrimSpace(input.Title)
	input.Summary = strings.TrimSpace(input.Summary)
	input.ContentMD = strings.TrimSpace(input.ContentMD)
	if input.ModuleID <= 0 || input.AuthorID <= 0 || !validArticleText(input.Title, input.Summary, input.ContentMD) {
		return PublicArticle{}, ErrInvalidInput
	}

	item, err := s.repo.Create(ctx, input)
	if err != nil {
		return PublicArticle{}, err
	}
	return ToPublic(item, true), nil
}

func (s *Service) UpdateOwn(ctx context.Context, id int64, authorID int64, input UpdateArticleInput) (PublicArticle, error) {
	if id <= 0 || authorID <= 0 {
		return PublicArticle{}, ErrNotFound
	}
	if input.Title != nil {
		trimmed := strings.TrimSpace(*input.Title)
		if trimmed == "" || len(trimmed) > 160 {
			return PublicArticle{}, ErrInvalidInput
		}
		input.Title = &trimmed
	}
	if input.Summary != nil {
		trimmed := strings.TrimSpace(*input.Summary)
		if len(trimmed) > 300 {
			return PublicArticle{}, ErrInvalidInput
		}
		input.Summary = &trimmed
	}
	if input.ContentMD != nil {
		trimmed := strings.TrimSpace(*input.ContentMD)
		if trimmed == "" {
			return PublicArticle{}, ErrInvalidInput
		}
		input.ContentMD = &trimmed
	}

	item, err := s.repo.UpdateOwn(ctx, id, authorID, input)
	if err != nil {
		return PublicArticle{}, err
	}
	return ToPublic(item, true), nil
}

func (s *Service) ListPendingReview(ctx context.Context, page int, pageSize int) (Page, error) {
	page, pageSize = normalizePage(page, pageSize)
	items, total, err := s.repo.ListPendingReview(ctx, page, pageSize)
	if err != nil {
		return Page{}, err
	}
	return Page{Number: page, Size: pageSize, Total: total, Articles: ToPublicList(items, true)}, nil
}

func (s *Service) Approve(ctx context.Context, id int64, reviewerID int64, reviewNote string) (PublicArticle, error) {
	if id <= 0 || reviewerID <= 0 {
		return PublicArticle{}, ErrNotFound
	}

	item, err := s.repo.Approve(ctx, id, ReviewArticleInput{
		ReviewerID: reviewerID,
		ReviewNote: strings.TrimSpace(reviewNote),
	})
	if err != nil {
		return PublicArticle{}, err
	}
	return ToPublic(item, true), nil
}

func (s *Service) Reject(ctx context.Context, id int64, reviewerID int64, reviewNote string) (PublicArticle, error) {
	reviewNote = strings.TrimSpace(reviewNote)
	if id <= 0 || reviewerID <= 0 {
		return PublicArticle{}, ErrNotFound
	}
	if reviewNote == "" {
		return PublicArticle{}, ErrInvalidInput
	}

	item, err := s.repo.Reject(ctx, id, ReviewArticleInput{
		ReviewerID: reviewerID,
		ReviewNote: reviewNote,
	})
	if err != nil {
		return PublicArticle{}, err
	}
	return ToPublic(item, true), nil
}

func validArticleText(title string, summary string, content string) bool {
	return title != "" && len(title) <= 160 && len(summary) <= 300 && content != ""
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
