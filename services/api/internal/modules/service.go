package modules

import (
	"context"
	"regexp"
	"strings"
)

var slugPattern = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

type ModuleRepository interface {
	List(ctx context.Context, includeInactive bool) ([]Module, error)
	FindBySlug(ctx context.Context, slug string) (Module, error)
	Create(ctx context.Context, input CreateModuleInput) (Module, error)
	Update(ctx context.Context, id int64, input UpdateModuleInput) (Module, error)
	Delete(ctx context.Context, id int64) error
	FindByID(ctx context.Context, id int64) (Module, error)
	CanManageDomain(ctx context.Context, actorID int64, actorRole string, domainID int64) (bool, error)
	CanManageModule(ctx context.Context, actorID int64, actorRole string, moduleID int64) (bool, error)
	AddModerator(ctx context.Context, moduleID int64, userID int64) (ModuleModerator, error)
	RemoveModerator(ctx context.Context, moduleID int64, userID int64) error
}

type Service struct {
	repo ModuleRepository
}

func NewService(repo ModuleRepository) *Service {
	return &Service{repo: repo}
}

func (s *Service) List(ctx context.Context, includeInactive bool) ([]PublicModule, error) {
	items, err := s.repo.List(ctx, includeInactive)
	if err != nil {
		return nil, err
	}
	return ToPublicList(items), nil
}

func (s *Service) FindBySlug(ctx context.Context, slug string) (PublicModule, error) {
	slug = strings.TrimSpace(slug)
	if !validSlug(slug) {
		return PublicModule{}, ErrNotFound
	}

	module, err := s.repo.FindBySlug(ctx, slug)
	if err != nil {
		return PublicModule{}, err
	}
	return ToPublic(module), nil
}

func (s *Service) Create(ctx context.Context, input CreateModuleInput) (PublicModule, error) {
	input.Slug = strings.TrimSpace(strings.ToLower(input.Slug))
	input.Name = strings.TrimSpace(input.Name)
	input.Description = strings.TrimSpace(input.Description)

	if input.DomainID <= 0 || !validSlug(input.Slug) || input.Name == "" || len(input.Name) > 80 || len(input.Description) > 1000 {
		return PublicModule{}, ErrInvalidInput
	}

	module, err := s.repo.Create(ctx, input)
	if err != nil {
		return PublicModule{}, err
	}
	return ToPublic(module), nil
}

func (s *Service) CreateManaged(ctx context.Context, input CreateModuleInput, actorID int64, actorRole string) (PublicModule, error) {
	input.Slug = strings.TrimSpace(strings.ToLower(input.Slug))
	input.Name = strings.TrimSpace(input.Name)
	input.Description = strings.TrimSpace(input.Description)

	if input.DomainID <= 0 || !validSlug(input.Slug) || input.Name == "" || len(input.Name) > 80 || len(input.Description) > 1000 {
		return PublicModule{}, ErrInvalidInput
	}
	allowed, err := s.repo.CanManageDomain(ctx, actorID, actorRole, input.DomainID)
	if err != nil {
		return PublicModule{}, err
	}
	if !allowed {
		return PublicModule{}, ErrForbidden
	}

	module, err := s.repo.Create(ctx, input)
	if err != nil {
		return PublicModule{}, err
	}
	return ToPublic(module), nil
}

func (s *Service) Update(ctx context.Context, id int64, input UpdateModuleInput) (PublicModule, error) {
	if id <= 0 {
		return PublicModule{}, ErrNotFound
	}
	if input.Name != nil {
		trimmed := strings.TrimSpace(*input.Name)
		if trimmed == "" || len(trimmed) > 80 {
			return PublicModule{}, ErrInvalidInput
		}
		input.Name = &trimmed
	}
	if input.DomainID != nil && *input.DomainID <= 0 {
		return PublicModule{}, ErrInvalidInput
	}
	if input.Description != nil {
		trimmed := strings.TrimSpace(*input.Description)
		if len(trimmed) > 1000 {
			return PublicModule{}, ErrInvalidInput
		}
		input.Description = &trimmed
	}

	module, err := s.repo.Update(ctx, id, input)
	if err != nil {
		return PublicModule{}, err
	}
	return ToPublic(module), nil
}

func (s *Service) UpdateManaged(ctx context.Context, id int64, input UpdateModuleInput, actorID int64, actorRole string) (PublicModule, error) {
	if id <= 0 {
		return PublicModule{}, ErrNotFound
	}
	if actorRole != "admin" && input.DomainID != nil {
		return PublicModule{}, ErrForbidden
	}
	if input.Name != nil {
		trimmed := strings.TrimSpace(*input.Name)
		if trimmed == "" || len(trimmed) > 80 {
			return PublicModule{}, ErrInvalidInput
		}
		input.Name = &trimmed
	}
	if input.DomainID != nil && *input.DomainID <= 0 {
		return PublicModule{}, ErrInvalidInput
	}
	if input.Description != nil {
		trimmed := strings.TrimSpace(*input.Description)
		if len(trimmed) > 1000 {
			return PublicModule{}, ErrInvalidInput
		}
		input.Description = &trimmed
	}
	allowed, err := s.repo.CanManageModule(ctx, actorID, actorRole, id)
	if err != nil {
		return PublicModule{}, err
	}
	if !allowed {
		return PublicModule{}, ErrForbidden
	}

	module, err := s.repo.Update(ctx, id, input)
	if err != nil {
		return PublicModule{}, err
	}
	return ToPublic(module), nil
}

func (s *Service) Delete(ctx context.Context, id int64, actorID int64, actorRole string) error {
	if id <= 0 {
		return ErrNotFound
	}
	allowed, err := s.repo.CanManageModule(ctx, actorID, actorRole, id)
	if err != nil {
		return err
	}
	if !allowed {
		return ErrForbidden
	}
	return s.repo.Delete(ctx, id)
}

func (s *Service) AddModerator(ctx context.Context, moduleID int64, userID int64, actorID int64, actorRole string) (ModuleModerator, error) {
	if moduleID <= 0 || userID <= 0 {
		return ModuleModerator{}, ErrInvalidInput
	}
	allowed, err := s.repo.CanManageModule(ctx, actorID, actorRole, moduleID)
	if err != nil {
		return ModuleModerator{}, err
	}
	if !allowed {
		return ModuleModerator{}, ErrForbidden
	}
	return s.repo.AddModerator(ctx, moduleID, userID)
}

func (s *Service) RemoveModerator(ctx context.Context, moduleID int64, userID int64, actorID int64, actorRole string) error {
	if moduleID <= 0 || userID <= 0 {
		return ErrInvalidInput
	}
	allowed, err := s.repo.CanManageModule(ctx, actorID, actorRole, moduleID)
	if err != nil {
		return err
	}
	if !allowed {
		return ErrForbidden
	}
	return s.repo.RemoveModerator(ctx, moduleID, userID)
}

func validSlug(slug string) bool {
	return len(slug) >= 2 && len(slug) <= 80 && slugPattern.MatchString(slug)
}
