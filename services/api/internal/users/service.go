package users

import (
	"context"
	"strings"
)

type RepositoryInterface interface {
	FindPublicAuthorProfile(ctx context.Context, username string, page int, pageSize int) (PublicAuthorProfile, int64, error)
}

type Service struct {
	repo RepositoryInterface
}

func NewService(repo RepositoryInterface) *Service {
	return &Service{repo: repo}
}

func (s *Service) FindPublicAuthorProfile(ctx context.Context, username string, page int, pageSize int) (AuthorProfilePage, error) {
	username = strings.TrimSpace(username)
	if username == "" {
		return AuthorProfilePage{}, ErrNotFound
	}
	page, pageSize = normalizePage(page, pageSize)

	author, total, err := s.repo.FindPublicAuthorProfile(ctx, username, page, pageSize)
	if err != nil {
		return AuthorProfilePage{}, err
	}
	return AuthorProfilePage{
		Number: page,
		Size:   pageSize,
		Total:  total,
		Author: author,
	}, nil
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
