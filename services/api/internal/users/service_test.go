package users

import (
	"context"
	"errors"
	"testing"
	"time"
)

type fakeAdminUserRepo struct {
	filter  AdminUserFilter
	updated UpdateAdminUserInput
}

func (r *fakeAdminUserRepo) FindPublicAuthorProfile(_ context.Context, _ string, _ int, _ int) (PublicAuthorProfile, int64, error) {
	return PublicAuthorProfile{}, 0, ErrNotFound
}

func (r *fakeAdminUserRepo) ListAdmin(_ context.Context, filter AdminUserFilter, _ int, _ int) ([]User, int64, error) {
	r.filter = filter
	return []User{{ID: 1, Username: "alice", Email: "alice@example.com", Role: "user", Status: "active", CreatedAt: time.Unix(1, 0)}}, 1, nil
}

func (r *fakeAdminUserRepo) UpdateAdmin(_ context.Context, id int64, input UpdateAdminUserInput) (User, error) {
	if id != 1 {
		return User{}, ErrNotFound
	}
	r.updated = input
	role := "user"
	if input.Role != nil {
		role = *input.Role
	}
	status := "active"
	if input.Status != nil {
		status = *input.Status
	}
	return User{ID: id, Username: "alice", Email: "alice@example.com", Role: role, Status: status, CreatedAt: time.Unix(1, 0)}, nil
}

func TestListAdminRejectsInvalidRole(t *testing.T) {
	service := NewService(&fakeAdminUserRepo{})

	_, err := service.ListAdmin(context.Background(), AdminUserFilter{Role: "owner"}, 1, 20)
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
}

func TestListAdminNormalizesFilter(t *testing.T) {
	repo := &fakeAdminUserRepo{}
	service := NewService(repo)

	page, err := service.ListAdmin(context.Background(), AdminUserFilter{Query: " alice ", Role: "user", Status: "active"}, 0, 999)
	if err != nil {
		t.Fatalf("list admin users: %v", err)
	}
	if page.Number != 1 || page.Size != 100 || page.Total != 1 {
		t.Fatalf("unexpected page: %#v", page)
	}
	if repo.filter.Query != "alice" {
		t.Fatalf("query was not trimmed: %#v", repo.filter)
	}
}

func TestUpdateAdminRejectsSelfDisable(t *testing.T) {
	service := NewService(&fakeAdminUserRepo{})
	status := "disabled"

	_, err := service.UpdateAdmin(context.Background(), 1, UpdateAdminUserInput{Status: &status, ActorID: 1})
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected ErrForbidden, got %v", err)
	}
}

func TestUpdateAdminTrimsAndUpdatesRole(t *testing.T) {
	repo := &fakeAdminUserRepo{}
	service := NewService(repo)
	role := " reviewer "

	user, err := service.UpdateAdmin(context.Background(), 1, UpdateAdminUserInput{Role: &role, ActorID: 99})
	if err != nil {
		t.Fatalf("update admin user: %v", err)
	}
	if user.Role != "reviewer" || repo.updated.Role == nil || *repo.updated.Role != "reviewer" {
		t.Fatalf("role was not normalized: user=%#v input=%#v", user, repo.updated.Role)
	}
}
