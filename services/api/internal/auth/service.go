package auth

import (
	"context"
	"errors"
	"net/mail"
	"strconv"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"scholarbookstore/services/api/internal/config"
	"scholarbookstore/services/api/internal/users"
)

type UserRepository interface {
	Create(ctx context.Context, username string, email string, passwordHash string) (users.User, error)
	FindByEmail(ctx context.Context, email string) (users.User, error)
	FindByID(ctx context.Context, id int64) (users.User, error)
}

type Service struct {
	cfg   config.Config
	users UserRepository
	now   func() time.Time
}

type AuthResult struct {
	User      users.PublicUser
	Token     string
	ExpiresAt time.Time
}

func NewService(cfg config.Config, userRepo UserRepository) *Service {
	return &Service{
		cfg:   cfg,
		users: userRepo,
		now:   time.Now,
	}
}

func (s *Service) Register(ctx context.Context, username string, email string, password string) (users.PublicUser, error) {
	username = strings.TrimSpace(username)
	email = strings.TrimSpace(strings.ToLower(email))

	if err := validateRegistration(username, email, password); err != nil {
		return users.PublicUser{}, err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return users.PublicUser{}, err
	}

	user, err := s.users.Create(ctx, username, email, string(hash))
	if errors.Is(err, users.ErrConflict) {
		return users.PublicUser{}, ErrUserConflict
	}
	if err != nil {
		return users.PublicUser{}, err
	}

	return users.ToPublic(user), nil
}

func (s *Service) Login(ctx context.Context, email string, password string) (AuthResult, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	if !validEmail(email) || strings.TrimSpace(password) == "" {
		return AuthResult{}, ErrInvalidInput
	}

	user, err := s.users.FindByEmail(ctx, email)
	if errors.Is(err, users.ErrNotFound) {
		return AuthResult{}, ErrInvalidCredentials
	}
	if err != nil {
		return AuthResult{}, err
	}
	if user.Status == "disabled" {
		return AuthResult{}, ErrUserDisabled
	}
	if user.Status != "active" {
		return AuthResult{}, ErrInvalidCredentials
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return AuthResult{}, ErrInvalidCredentials
	}

	token, expiresAt, err := SignToken(s.cfg.JWTSecret, user.ID, user.Role, s.cfg.JWTExpiresIn, s.now())
	if err != nil {
		return AuthResult{}, err
	}

	return AuthResult{
		User:      users.ToPublic(user),
		Token:     token,
		ExpiresAt: expiresAt,
	}, nil
}

func (s *Service) AuthenticateToken(ctx context.Context, rawToken string) (users.PublicUser, error) {
	claims, err := ParseToken(s.cfg.JWTSecret, rawToken)
	if err != nil {
		return users.PublicUser{}, ErrUnauthorized
	}

	userID, err := strconv.ParseInt(claims.Subject, 10, 64)
	if err != nil {
		return users.PublicUser{}, ErrUnauthorized
	}

	user, err := s.users.FindByID(ctx, userID)
	if errors.Is(err, users.ErrNotFound) {
		return users.PublicUser{}, ErrUnauthorized
	}
	if err != nil {
		return users.PublicUser{}, err
	}
	if user.Status != "active" {
		return users.PublicUser{}, ErrUnauthorized
	}
	if user.Role != claims.Role {
		return users.PublicUser{}, ErrUnauthorized
	}

	return users.ToPublic(user), nil
}

func validateRegistration(username string, email string, password string) error {
	if len(username) < 3 || len(username) > 40 {
		return ErrInvalidInput
	}
	if !validEmail(email) {
		return ErrInvalidInput
	}
	if len(password) < 8 {
		return ErrInvalidInput
	}
	return nil
}

func validEmail(email string) bool {
	if email == "" {
		return false
	}
	_, err := mail.ParseAddress(email)
	return err == nil
}
