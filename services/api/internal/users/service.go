package users

import (
	"context"
	"strings"
)

type RepositoryInterface interface {
	FindPublicAuthorProfile(ctx context.Context, username string, page int, pageSize int) (PublicAuthorProfile, int64, error)
	ListAdmin(ctx context.Context, filter AdminUserFilter, page int, pageSize int) ([]User, int64, error)
	UpdateAdmin(ctx context.Context, id int64, input UpdateAdminUserInput) (User, error)
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

func (s *Service) ListAdmin(ctx context.Context, filter AdminUserFilter, page int, pageSize int) (AdminUserPage, error) {
	page, pageSize = normalizePage(page, pageSize)
	filter.Query = strings.TrimSpace(filter.Query)
	filter.Role = strings.TrimSpace(filter.Role)
	filter.Status = strings.TrimSpace(filter.Status)
	if filter.Role != "" && !validRole(filter.Role) {
		return AdminUserPage{}, ErrInvalidInput
	}
	if filter.Status != "" && !validStatus(filter.Status) {
		return AdminUserPage{}, ErrInvalidInput
	}

	items, total, err := s.repo.ListAdmin(ctx, filter, page, pageSize)
	if err != nil {
		return AdminUserPage{}, err
	}
	users := make([]PublicUser, 0, len(items))
	for _, item := range items {
		users = append(users, ToPublic(item))
	}
	return AdminUserPage{Number: page, Size: pageSize, Total: total, Users: users}, nil
}

func (s *Service) UpdateAdmin(ctx context.Context, id int64, input UpdateAdminUserInput) (PublicUser, error) {
	if id <= 0 || input.ActorID <= 0 {
		return PublicUser{}, ErrNotFound
	}
	if input.Role != nil {
		role := strings.TrimSpace(*input.Role)
		if !validRole(role) {
			return PublicUser{}, ErrInvalidInput
		}
		input.Role = &role
	}
	if input.Status != nil {
		status := strings.TrimSpace(*input.Status)
		if !validStatus(status) {
			return PublicUser{}, ErrInvalidInput
		}
		if id == input.ActorID && status == "disabled" {
			return PublicUser{}, ErrForbidden
		}
		input.Status = &status
	}
	item, err := s.repo.UpdateAdmin(ctx, id, input)
	if err != nil {
		return PublicUser{}, err
	}
	return ToPublic(item), nil
}

func validRole(role string) bool {
	return role == "user" || role == "reviewer" || role == "admin"
}

func validStatus(status string) bool {
	return status == "active" || status == "disabled"
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
