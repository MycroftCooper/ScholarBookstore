package moderation

import (
	"context"
	"strings"
	"time"
)

type RepositoryInterface interface {
	HasActivePenalty(ctx context.Context, userID int64, penaltyType string) (bool, error)
	CreatePenalty(ctx context.Context, input PenaltyInput) error
	DisableUser(ctx context.Context, userID int64) error
	ArchiveArticle(ctx context.Context, articleID int64) error
	HideComment(ctx context.Context, commentID int64) error
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) HasActivePenalty(ctx context.Context, userID int64, penaltyType string) (bool, error) {
	if userID <= 0 || !validPenaltyType(penaltyType) {
		return false, ErrInvalidInput
	}
	return s.repo.HasActivePenalty(ctx, userID, penaltyType)
}

func (s *Service) CreatePenalty(ctx context.Context, input PenaltyInput) error {
	input.Type = strings.TrimSpace(input.Type)
	input.TargetType = strings.TrimSpace(input.TargetType)
	input.Reason = strings.TrimSpace(input.Reason)
	input.SourceType = strings.TrimSpace(input.SourceType)
	if input.TargetType == "" {
		input.TargetType = "user"
	}
	if input.UserID <= 0 || input.CreatedBy <= 0 || !validPenaltyType(input.Type) || !validTargetType(input.TargetType) {
		return ErrInvalidInput
	}
	return s.repo.CreatePenalty(ctx, input)
}

func (s *Service) DisableUser(ctx context.Context, userID int64) error {
	if userID <= 0 {
		return ErrInvalidInput
	}
	return s.repo.DisableUser(ctx, userID)
}

func (s *Service) ArchiveArticle(ctx context.Context, articleID int64) error {
	if articleID <= 0 {
		return ErrInvalidInput
	}
	return s.repo.ArchiveArticle(ctx, articleID)
}

func (s *Service) HideComment(ctx context.Context, commentID int64) error {
	if commentID <= 0 {
		return ErrInvalidInput
	}
	return s.repo.HideComment(ctx, commentID)
}

func ExpiresInDays(days int) *time.Time {
	if days <= 0 {
		return nil
	}
	expires := time.Now().Add(time.Duration(days) * 24 * time.Hour)
	return &expires
}

func validPenaltyType(value string) bool {
	switch value {
	case PenaltyAccountDisabled, PenaltyFollowRestricted, PenaltyArticleCreateBanned, PenaltyCommentCreateBanned:
		return true
	default:
		return false
	}
}

func validTargetType(value string) bool {
	return value == "user" || value == "article" || value == "comment"
}
