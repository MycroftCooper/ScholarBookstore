package auth

import (
	"context"
	"errors"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"

	"scholarbookstore/services/api/internal/config"
	"scholarbookstore/services/api/internal/users"
)

type fakeUserRepo struct {
	created users.User
	byEmail users.User
	byID    users.User
}

func (r *fakeUserRepo) Create(_ context.Context, username string, email string, passwordHash string) (users.User, error) {
	r.created = users.User{
		ID:           1,
		Username:     username,
		Email:        email,
		PasswordHash: passwordHash,
		Role:         "user",
		Status:       "active",
		CreatedAt:    time.Unix(1, 0),
	}
	return r.created, nil
}

func (r *fakeUserRepo) FindByEmail(_ context.Context, _ string) (users.User, error) {
	if r.byEmail.ID == 0 {
		return users.User{}, users.ErrNotFound
	}
	return r.byEmail, nil
}

func (r *fakeUserRepo) FindByID(_ context.Context, _ int64) (users.User, error) {
	if r.byID.ID == 0 {
		return users.User{}, users.ErrNotFound
	}
	return r.byID, nil
}

func TestRegisterHashesPassword(t *testing.T) {
	repo := &fakeUserRepo{}
	service := NewService(testConfig(), repo)

	_, err := service.Register(context.Background(), "alice", "alice@example.com", "password123")
	if err != nil {
		t.Fatalf("register: %v", err)
	}

	if repo.created.PasswordHash == "password123" {
		t.Fatal("password was stored in plaintext")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(repo.created.PasswordHash), []byte("password123")); err != nil {
		t.Fatalf("stored password hash does not match password: %v", err)
	}
}

func TestLoginRejectsDisabledUser(t *testing.T) {
	hash, err := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}

	repo := &fakeUserRepo{
		byEmail: users.User{
			ID:           1,
			Email:        "alice@example.com",
			PasswordHash: string(hash),
			Role:         "user",
			Status:       "disabled",
		},
	}
	service := NewService(testConfig(), repo)

	_, err = service.Login(context.Background(), "alice@example.com", "password123")
	if !errors.Is(err, ErrUserDisabled) {
		t.Fatalf("expected ErrUserDisabled, got %v", err)
	}
}

func TestSignAndParseToken(t *testing.T) {
	now := time.Now()
	token, expiresAt, err := SignToken("secret", 42, "reviewer", time.Hour, now)
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	if !expiresAt.Equal(now.Add(time.Hour)) {
		t.Fatalf("unexpected expiry: %v", expiresAt)
	}

	claims, err := ParseToken("secret", token)
	if err != nil {
		t.Fatalf("parse token: %v", err)
	}
	if claims.Subject != "42" || claims.Role != "reviewer" {
		t.Fatalf("unexpected claims: subject=%q role=%q", claims.Subject, claims.Role)
	}
}

func testConfig() config.Config {
	return config.Config{
		JWTSecret:    "test-secret",
		JWTExpiresIn: time.Hour,
		CookieName:   "scholar_session",
	}
}
