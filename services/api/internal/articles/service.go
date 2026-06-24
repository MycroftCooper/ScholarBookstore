package articles

import (
	"context"
	"strings"
	"unicode"
)

var validStatuses = map[string]struct{}{
	"draft":          {},
	"pending_review": {},
	"published":      {},
	"rejected":       {},
	"archived":       {},
}

var validSourceTypes = map[string]struct{}{
	"original": {},
	"reprint":  {},
}

type ArticleRepository interface {
	ListPublished(ctx context.Context, filter PublishedArticleFilter, page int, pageSize int) ([]Article, int64, error)
	ListAdmin(ctx context.Context, filter AdminArticleFilter, page int, pageSize int) ([]Article, int64, error)
	FindPublishedByID(ctx context.Context, id int64) (Article, error)
	IncrementViewCount(ctx context.Context, id int64) error
	ListMine(ctx context.Context, authorID int64, status string, page int, pageSize int) ([]Article, int64, error)
	Create(ctx context.Context, input CreateArticleInput) (Article, error)
	CreateRevision(ctx context.Context, originalID int64, authorID int64, input UpdateArticleInput) (Article, error)
	FindByIDForAuthor(ctx context.Context, id int64, authorID int64) (Article, error)
	UpdateOwn(ctx context.Context, id int64, authorID int64, input UpdateArticleInput) (Article, error)
	ListPendingReview(ctx context.Context, filter AdminArticleFilter, page int, pageSize int) ([]Article, int64, error)
	CanModerateArticle(ctx context.Context, actorID int64, actorRole string, articleID int64) (bool, error)
	Approve(ctx context.Context, id int64, input ReviewArticleInput) (Article, error)
	Reject(ctx context.Context, id int64, input ReviewArticleInput) (Article, error)
	Archive(ctx context.Context, id int64) (Article, error)
	RestoreArchived(ctx context.Context, id int64) (Article, error)
	UpdateAdmin(ctx context.Context, id int64, input AdminUpdateArticleInput) (Article, error)
}

type Service struct {
	repo ArticleRepository
}

func NewService(repo ArticleRepository) *Service {
	return &Service{repo: repo}
}

func (s *Service) ListPublished(ctx context.Context, filter PublishedArticleFilter, page int, pageSize int) (Page, error) {
	page, pageSize = normalizePage(page, pageSize)
	filter.ModuleSlug = strings.TrimSpace(filter.ModuleSlug)
	filter.Query = strings.TrimSpace(filter.Query)
	filter.TagSlug = strings.TrimSpace(filter.TagSlug)
	filter.Sort = strings.TrimSpace(filter.Sort)
	if filter.Sort == "" {
		filter.Sort = "latest"
	}
	if filter.Sort != "latest" && filter.Sort != "hot" && filter.Sort != "random" {
		return Page{}, ErrInvalidInput
	}

	items, total, err := s.repo.ListPublished(ctx, filter, page, pageSize)
	if err != nil {
		return Page{}, err
	}
	return Page{Number: page, Size: pageSize, Total: total, Articles: ToPublicList(items, false)}, nil
}

func (s *Service) ListAdmin(ctx context.Context, status string, actorID int64, actorRole string, page int, pageSize int) (Page, error) {
	page, pageSize = normalizePage(page, pageSize)
	status = strings.TrimSpace(status)
	if status != "" {
		if _, ok := validStatuses[status]; !ok {
			return Page{}, ErrInvalidInput
		}
	}

	items, total, err := s.repo.ListAdmin(ctx, AdminArticleFilter{Status: status, ActorID: actorID, ActorRole: actorRole}, page, pageSize)
	if err != nil {
		return Page{}, err
	}
	return Page{Number: page, Size: pageSize, Total: total, Articles: ToPublicList(items, false)}, nil
}

func (s *Service) FindPublishedByID(ctx context.Context, id int64) (PublicArticle, error) {
	if id <= 0 {
		return PublicArticle{}, ErrNotFound
	}
	if err := s.repo.IncrementViewCount(ctx, id); err != nil {
		return PublicArticle{}, err
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

func (s *Service) FindMineByID(ctx context.Context, id int64, authorID int64) (PublicArticle, error) {
	if id <= 0 || authorID <= 0 {
		return PublicArticle{}, ErrNotFound
	}

	item, err := s.repo.FindByIDForAuthor(ctx, id, authorID)
	if err != nil {
		return PublicArticle{}, err
	}
	return ToPublic(item, true), nil
}

func (s *Service) Create(ctx context.Context, input CreateArticleInput) (PublicArticle, error) {
	input.Title = strings.TrimSpace(input.Title)
	input.Summary = strings.TrimSpace(input.Summary)
	input.ContentMD = strings.TrimSpace(input.ContentMD)
	input.SourceType = strings.TrimSpace(input.SourceType)
	if input.SourceType == "" {
		input.SourceType = "original"
	}
	input.Status = strings.TrimSpace(input.Status)
	if input.Status == "" {
		input.Status = "pending_review"
	}
	if input.ModuleID <= 0 || input.AuthorID <= 0 || !validSubmissionStatus(input.Status) || !validSourceType(input.SourceType) || !validArticleText(input.Title, input.Summary, input.ContentMD, input.Status) {
		return PublicArticle{}, ErrInvalidInput
	}
	tags, ok := normalizeTags(input.Tags)
	if !ok {
		return PublicArticle{}, ErrInvalidInput
	}
	input.Tags = tags
	input.WordCount, input.ReadingMinutes = articleMetrics(input.ContentMD)

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
		input.ContentMD = &trimmed
		wordCount, readingMinutes := articleMetrics(trimmed)
		input.WordCount = &wordCount
		input.ReadingMinutes = &readingMinutes
	}
	if input.SourceType != nil {
		trimmed := strings.TrimSpace(*input.SourceType)
		if !validSourceType(trimmed) {
			return PublicArticle{}, ErrInvalidInput
		}
		input.SourceType = &trimmed
	}
	if input.Status != nil {
		trimmed := strings.TrimSpace(*input.Status)
		if !validSubmissionStatus(trimmed) {
			return PublicArticle{}, ErrInvalidInput
		}
		input.Status = &trimmed
	}
	if input.Tags != nil {
		tags, ok := normalizeTags(*input.Tags)
		if !ok {
			return PublicArticle{}, ErrInvalidInput
		}
		input.Tags = &tags
	}
	targetStatus := "draft"
	if input.Status != nil {
		targetStatus = *input.Status
	}
	if targetStatus == "pending_review" && input.ContentMD != nil && *input.ContentMD == "" {
		return PublicArticle{}, ErrInvalidInput
	}
	if targetStatus == "pending_review" && input.ContentMD == nil {
		current, err := s.repo.FindByIDForAuthor(ctx, id, authorID)
		if err != nil {
			return PublicArticle{}, err
		}
		if strings.TrimSpace(current.ContentMD) == "" {
			return PublicArticle{}, ErrInvalidInput
		}
	}

	current, err := s.repo.FindByIDForAuthor(ctx, id, authorID)
	if err != nil {
		return PublicArticle{}, err
	}
	if current.Status == "published" {
		if targetStatus != "pending_review" || input.Title == nil || input.ContentMD == nil {
			return PublicArticle{}, ErrInvalidInput
		}
		if input.Summary == nil {
			summary := current.Summary
			input.Summary = &summary
		}
		if input.SourceType == nil {
			sourceType := current.SourceType
			input.SourceType = &sourceType
		}
		item, err := s.repo.CreateRevision(ctx, id, authorID, input)
		if err != nil {
			return PublicArticle{}, err
		}
		return ToPublic(item, true), nil
	}

	item, err := s.repo.UpdateOwn(ctx, id, authorID, input)
	if err != nil {
		return PublicArticle{}, err
	}
	return ToPublic(item, true), nil
}

func (s *Service) ListPendingReview(ctx context.Context, actorID int64, actorRole string, page int, pageSize int) (Page, error) {
	page, pageSize = normalizePage(page, pageSize)
	items, total, err := s.repo.ListPendingReview(ctx, AdminArticleFilter{ActorID: actorID, ActorRole: actorRole}, page, pageSize)
	if err != nil {
		return Page{}, err
	}
	return Page{Number: page, Size: pageSize, Total: total, Articles: ToPublicList(items, true)}, nil
}

func (s *Service) Approve(ctx context.Context, id int64, reviewerID int64, reviewerRole string, reviewNote string) (PublicArticle, error) {
	if id <= 0 || reviewerID <= 0 {
		return PublicArticle{}, ErrNotFound
	}
	allowed, err := s.repo.CanModerateArticle(ctx, reviewerID, reviewerRole, id)
	if err != nil {
		return PublicArticle{}, err
	}
	if !allowed {
		return PublicArticle{}, ErrForbidden
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

func (s *Service) Reject(ctx context.Context, id int64, reviewerID int64, reviewerRole string, reviewNote string) (PublicArticle, error) {
	reviewNote = strings.TrimSpace(reviewNote)
	if id <= 0 || reviewerID <= 0 {
		return PublicArticle{}, ErrNotFound
	}
	if reviewNote == "" {
		return PublicArticle{}, ErrInvalidInput
	}
	allowed, err := s.repo.CanModerateArticle(ctx, reviewerID, reviewerRole, id)
	if err != nil {
		return PublicArticle{}, err
	}
	if !allowed {
		return PublicArticle{}, ErrForbidden
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

func (s *Service) Archive(ctx context.Context, id int64) (PublicArticle, error) {
	if id <= 0 {
		return PublicArticle{}, ErrNotFound
	}
	item, err := s.repo.Archive(ctx, id)
	if err != nil {
		return PublicArticle{}, err
	}
	return ToPublic(item, false), nil
}

func (s *Service) RestoreArchived(ctx context.Context, id int64) (PublicArticle, error) {
	if id <= 0 {
		return PublicArticle{}, ErrNotFound
	}
	item, err := s.repo.RestoreArchived(ctx, id)
	if err != nil {
		return PublicArticle{}, err
	}
	return ToPublic(item, false), nil
}

func (s *Service) UpdateAdmin(ctx context.Context, id int64, actorID int64, actorRole string, input AdminUpdateArticleInput) (PublicArticle, error) {
	if id <= 0 {
		return PublicArticle{}, ErrNotFound
	}
	if input.IsFeatured == nil {
		return PublicArticle{}, ErrInvalidInput
	}
	allowed, err := s.repo.CanModerateArticle(ctx, actorID, actorRole, id)
	if err != nil {
		return PublicArticle{}, err
	}
	if !allowed {
		return PublicArticle{}, ErrForbidden
	}

	item, err := s.repo.UpdateAdmin(ctx, id, input)
	if err != nil {
		return PublicArticle{}, err
	}
	return ToPublic(item, false), nil
}

func validSubmissionStatus(status string) bool {
	return status == "draft" || status == "pending_review"
}

func validSourceType(sourceType string) bool {
	_, ok := validSourceTypes[sourceType]
	return ok
}

func validArticleText(title string, summary string, content string, status string) bool {
	if title == "" || len(title) > 160 || len(summary) > 300 {
		return false
	}
	return status == "draft" || content != ""
}

func articleMetrics(content string) (int, int) {
	wordCount := 0
	for _, item := range content {
		if !unicode.IsSpace(item) {
			wordCount++
		}
	}
	readingMinutes := (wordCount + 499) / 500
	if readingMinutes < 1 {
		readingMinutes = 1
	}
	return wordCount, readingMinutes
}

func normalizeTags(tags []string) ([]string, bool) {
	out := make([]string, 0, len(tags))
	seen := map[string]struct{}{}
	for _, tag := range tags {
		tag = strings.TrimSpace(tag)
		if tag == "" {
			continue
		}
		if len([]rune(tag)) > 30 {
			return nil, false
		}
		key := strings.ToLower(tag)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, tag)
	}
	if len(out) > 9 {
		return nil, false
	}
	return out, true
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
