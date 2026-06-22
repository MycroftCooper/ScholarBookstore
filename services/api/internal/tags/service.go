package tags

import (
	"context"
	"regexp"
	"strings"
)

var slugUnsafe = regexp.MustCompile(`[^\p{L}\p{N}-]+`)

type RepositoryInterface interface {
	List(ctx context.Context, filter Filter, page int, pageSize int) ([]Tag, int64, error)
	Update(ctx context.Context, id int64, input UpdateInput) (Tag, error)
	Delete(ctx context.Context, id int64) error
	Merge(ctx context.Context, input MergeInput) (Tag, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) List(ctx context.Context, filter Filter, page int, pageSize int) (Page, error) {
	page, pageSize = normalizePage(page, pageSize)
	filter.Query = strings.TrimSpace(filter.Query)
	items, total, err := s.repo.List(ctx, filter, page, pageSize)
	if err != nil {
		return Page{}, err
	}
	return Page{Number: page, Size: pageSize, Total: total, Tags: ToPublicList(items)}, nil
}

func (s *Service) Update(ctx context.Context, id int64, input UpdateInput) (PublicTag, error) {
	input.Name = strings.TrimSpace(input.Name)
	if id <= 0 || !validName(input.Name) {
		return PublicTag{}, ErrInvalidInput
	}
	item, err := s.repo.Update(ctx, id, input)
	if err != nil {
		return PublicTag{}, err
	}
	return ToPublic(item), nil
}

func (s *Service) Delete(ctx context.Context, id int64) error {
	if id <= 0 {
		return ErrNotFound
	}
	return s.repo.Delete(ctx, id)
}

func (s *Service) Merge(ctx context.Context, input MergeInput) (PublicTag, error) {
	if input.TargetID <= 0 || len(input.SourceIDs) == 0 || len(input.SourceIDs) > 50 {
		return PublicTag{}, ErrInvalidInput
	}
	seen := map[int64]struct{}{input.TargetID: {}}
	sources := make([]int64, 0, len(input.SourceIDs))
	for _, id := range input.SourceIDs {
		if id <= 0 {
			return PublicTag{}, ErrInvalidInput
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		sources = append(sources, id)
	}
	if len(sources) == 0 {
		return PublicTag{}, ErrInvalidInput
	}
	input.SourceIDs = sources
	item, err := s.repo.Merge(ctx, input)
	if err != nil {
		return PublicTag{}, err
	}
	return ToPublic(item), nil
}

func validName(name string) bool {
	return name != "" && len([]rune(name)) <= 30 && tagSlug(name) != ""
}

func tagSlug(name string) string {
	slug := strings.ToLower(strings.TrimSpace(name))
	slug = strings.ReplaceAll(slug, "_", "-")
	slug = slugUnsafe.ReplaceAllString(slug, "-")
	slug = strings.Trim(slug, "-")
	runes := []rune(slug)
	if len(runes) > 40 {
		slug = strings.Trim(string(runes[:40]), "-")
	}
	return slug
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
