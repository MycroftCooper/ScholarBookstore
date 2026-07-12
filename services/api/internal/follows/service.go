package follows

import (
	"context"
	"strings"
)

type FollowRepository interface {
	Follow(ctx context.Context, followerID int64, username string) (State, error)
	Unfollow(ctx context.Context, followerID int64, username string) (State, error)
	State(ctx context.Context, viewerID int64, username string) (State, error)
	ListFollowing(ctx context.Context, userID int64) ([]UserSummary, error)
	ListFollowers(ctx context.Context, userID int64) ([]UserSummary, error)
	ListRecommendedUsers(ctx context.Context, viewerID int64, limit int) ([]UserSummary, error)
	FollowModule(ctx context.Context, followerID int64, slug string) (TargetState, error)
	UnfollowModule(ctx context.Context, followerID int64, slug string) (TargetState, error)
	ModuleState(ctx context.Context, viewerID int64, slug string) (TargetState, error)
	FollowDomain(ctx context.Context, followerID int64, id int64) (TargetState, error)
	UnfollowDomain(ctx context.Context, followerID int64, id int64) (TargetState, error)
	DomainState(ctx context.Context, viewerID int64, id int64) (TargetState, error)
	ListFollowingModules(ctx context.Context, userID int64) ([]ModuleSummary, error)
	ListFollowingDomains(ctx context.Context, userID int64) ([]DomainSummary, error)
}

type Service struct {
	repo FollowRepository
}

func NewService(repo FollowRepository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Follow(ctx context.Context, followerID int64, username string) (PublicState, error) {
	username = strings.TrimSpace(username)
	if followerID <= 0 || username == "" {
		return PublicState{}, ErrInvalidInput
	}
	item, err := s.repo.Follow(ctx, followerID, username)
	if err != nil {
		return PublicState{}, err
	}
	return ToPublicState(item), nil
}

func (s *Service) Unfollow(ctx context.Context, followerID int64, username string) (PublicState, error) {
	username = strings.TrimSpace(username)
	if followerID <= 0 || username == "" {
		return PublicState{}, ErrInvalidInput
	}
	item, err := s.repo.Unfollow(ctx, followerID, username)
	if err != nil {
		return PublicState{}, err
	}
	return ToPublicState(item), nil
}

func (s *Service) State(ctx context.Context, viewerID int64, username string) (PublicState, error) {
	username = strings.TrimSpace(username)
	if viewerID <= 0 || username == "" {
		return PublicState{}, ErrInvalidInput
	}
	item, err := s.repo.State(ctx, viewerID, username)
	if err != nil {
		return PublicState{}, err
	}
	return ToPublicState(item), nil
}

func (s *Service) ListFollowing(ctx context.Context, userID int64) ([]PublicUserSummary, error) {
	if userID <= 0 {
		return nil, ErrForbidden
	}
	items, err := s.repo.ListFollowing(ctx, userID)
	if err != nil {
		return nil, err
	}
	return ToPublicUserSummaries(items), nil
}

func (s *Service) ListFollowingPage(ctx context.Context, userID int64) (FollowingPage, error) {
	if userID <= 0 {
		return FollowingPage{}, ErrForbidden
	}
	users, err := s.repo.ListFollowing(ctx, userID)
	if err != nil {
		return FollowingPage{}, err
	}
	modules, err := s.repo.ListFollowingModules(ctx, userID)
	if err != nil {
		return FollowingPage{}, err
	}
	domains, err := s.repo.ListFollowingDomains(ctx, userID)
	if err != nil {
		return FollowingPage{}, err
	}
	return FollowingPage{
		Users:   ToPublicUserSummaries(users),
		Modules: ToPublicModuleSummaries(modules),
		Domains: ToPublicDomainSummaries(domains),
	}, nil
}

func (s *Service) ListFollowers(ctx context.Context, userID int64) ([]PublicUserSummary, error) {
	if userID <= 0 {
		return nil, ErrForbidden
	}
	items, err := s.repo.ListFollowers(ctx, userID)
	if err != nil {
		return nil, err
	}
	return ToPublicUserSummaries(items), nil
}

func (s *Service) ListRecommendedUsers(ctx context.Context, viewerID int64, limit int) ([]PublicUserSummary, error) {
	if viewerID <= 0 {
		return nil, ErrForbidden
	}
	if limit < 1 {
		limit = 6
	}
	if limit > 20 {
		limit = 20
	}
	items, err := s.repo.ListRecommendedUsers(ctx, viewerID, limit)
	if err != nil {
		return nil, err
	}
	return ToPublicUserSummaries(items), nil
}

func (s *Service) FollowModule(ctx context.Context, followerID int64, slug string) (PublicTargetState, error) {
	slug = strings.TrimSpace(slug)
	if followerID <= 0 || slug == "" {
		return PublicTargetState{}, ErrInvalidInput
	}
	item, err := s.repo.FollowModule(ctx, followerID, slug)
	if err != nil {
		return PublicTargetState{}, err
	}
	return ToPublicTargetState(item), nil
}

func (s *Service) UnfollowModule(ctx context.Context, followerID int64, slug string) (PublicTargetState, error) {
	slug = strings.TrimSpace(slug)
	if followerID <= 0 || slug == "" {
		return PublicTargetState{}, ErrInvalidInput
	}
	item, err := s.repo.UnfollowModule(ctx, followerID, slug)
	if err != nil {
		return PublicTargetState{}, err
	}
	return ToPublicTargetState(item), nil
}

func (s *Service) ModuleState(ctx context.Context, viewerID int64, slug string) (PublicTargetState, error) {
	slug = strings.TrimSpace(slug)
	if viewerID <= 0 || slug == "" {
		return PublicTargetState{}, ErrInvalidInput
	}
	item, err := s.repo.ModuleState(ctx, viewerID, slug)
	if err != nil {
		return PublicTargetState{}, err
	}
	return ToPublicTargetState(item), nil
}

func (s *Service) FollowDomain(ctx context.Context, followerID int64, id int64) (PublicTargetState, error) {
	if followerID <= 0 || id <= 0 {
		return PublicTargetState{}, ErrInvalidInput
	}
	item, err := s.repo.FollowDomain(ctx, followerID, id)
	if err != nil {
		return PublicTargetState{}, err
	}
	return ToPublicTargetState(item), nil
}

func (s *Service) UnfollowDomain(ctx context.Context, followerID int64, id int64) (PublicTargetState, error) {
	if followerID <= 0 || id <= 0 {
		return PublicTargetState{}, ErrInvalidInput
	}
	item, err := s.repo.UnfollowDomain(ctx, followerID, id)
	if err != nil {
		return PublicTargetState{}, err
	}
	return ToPublicTargetState(item), nil
}

func (s *Service) DomainState(ctx context.Context, viewerID int64, id int64) (PublicTargetState, error) {
	if viewerID <= 0 || id <= 0 {
		return PublicTargetState{}, ErrInvalidInput
	}
	item, err := s.repo.DomainState(ctx, viewerID, id)
	if err != nil {
		return PublicTargetState{}, err
	}
	return ToPublicTargetState(item), nil
}
