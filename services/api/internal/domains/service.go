package domains

import (
	"context"
	"regexp"
	"strings"
)

var slugPattern = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

type DomainRepository interface {
	List(ctx context.Context, includeInactive bool) ([]Domain, error)
	FindByID(ctx context.Context, id int64, includeInactive bool) (Domain, error)
	Create(ctx context.Context, input CreateDomainInput) (Domain, error)
	Update(ctx context.Context, id int64, input UpdateDomainInput) (Domain, error)
	AddOwner(ctx context.Context, domainID int64, userID int64) (DomainOwner, error)
	RemoveOwner(ctx context.Context, domainID int64, userID int64) error
}

type Service struct {
	repo DomainRepository
}

func NewService(repo DomainRepository) *Service {
	return &Service{repo: repo}
}

func (s *Service) List(ctx context.Context, includeInactive bool) ([]PublicDomain, error) {
	items, err := s.repo.List(ctx, includeInactive)
	if err != nil {
		return nil, err
	}
	return ToPublicList(items), nil
}

func (s *Service) FindByID(ctx context.Context, id int64, includeInactive bool) (PublicDomain, error) {
	if id <= 0 {
		return PublicDomain{}, ErrNotFound
	}
	item, err := s.repo.FindByID(ctx, id, includeInactive)
	if err != nil {
		return PublicDomain{}, err
	}
	return ToPublic(item, true), nil
}

func (s *Service) Create(ctx context.Context, input CreateDomainInput) (PublicDomain, error) {
	input.Slug = strings.TrimSpace(strings.ToLower(input.Slug))
	input.Name = strings.TrimSpace(input.Name)
	input.Description = strings.TrimSpace(input.Description)
	if !validSlug(input.Slug) || input.Name == "" || len(input.Name) > 80 || len(input.Description) > 1000 {
		return PublicDomain{}, ErrInvalidInput
	}
	item, err := s.repo.Create(ctx, input)
	if err != nil {
		return PublicDomain{}, err
	}
	return ToPublic(item, true), nil
}

func (s *Service) Update(ctx context.Context, id int64, input UpdateDomainInput) (PublicDomain, error) {
	if id <= 0 {
		return PublicDomain{}, ErrNotFound
	}
	if input.Name != nil {
		trimmed := strings.TrimSpace(*input.Name)
		if trimmed == "" || len(trimmed) > 80 {
			return PublicDomain{}, ErrInvalidInput
		}
		input.Name = &trimmed
	}
	if input.Description != nil {
		trimmed := strings.TrimSpace(*input.Description)
		if len(trimmed) > 1000 {
			return PublicDomain{}, ErrInvalidInput
		}
		input.Description = &trimmed
	}
	item, err := s.repo.Update(ctx, id, input)
	if err != nil {
		return PublicDomain{}, err
	}
	return ToPublic(item, true), nil
}

func (s *Service) AddOwner(ctx context.Context, domainID int64, userID int64) (DomainOwner, error) {
	if domainID <= 0 || userID <= 0 {
		return DomainOwner{}, ErrInvalidInput
	}
	return s.repo.AddOwner(ctx, domainID, userID)
}

func (s *Service) RemoveOwner(ctx context.Context, domainID int64, userID int64) error {
	if domainID <= 0 || userID <= 0 {
		return ErrInvalidInput
	}
	return s.repo.RemoveOwner(ctx, domainID, userID)
}

func validSlug(slug string) bool {
	return len(slug) >= 2 && len(slug) <= 80 && slugPattern.MatchString(slug)
}
