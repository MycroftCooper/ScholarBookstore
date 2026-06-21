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
