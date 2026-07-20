package auth

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/mail"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"golang.org/x/crypto/bcrypt"

	"scholarbookstore/services/api/internal/config"
	"scholarbookstore/services/api/internal/users"
)

type UserRepository interface {
	Create(ctx context.Context, username string, email string, passwordHash string) (users.User, error)
	FindByEmail(ctx context.Context, email string) (users.User, error)
	FindByID(ctx context.Context, id int64) (users.User, error)
	UpdateProfile(ctx context.Context, id int64, input users.UpdateProfileInput) (users.User, error)
	UpdateAvatar(ctx context.Context, id int64, avatarURL string) (users.User, error)
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

func (s *Service) UpdateProfile(ctx context.Context, userID int64, input users.UpdateProfileInput) (users.PublicUser, error) {
	input.Bio = strings.TrimSpace(input.Bio)
	input.School = strings.TrimSpace(input.School)
	input.Company = strings.TrimSpace(input.Company)
	technicalTags, err := normalizeTechnicalTags(input.TechnicalTags)
	if err != nil {
		return users.PublicUser{}, err
	}
	input.TechnicalTags = technicalTags
	if userID <= 0 || len(input.Bio) > 200 || len(input.School) > 100 || len(input.Company) > 100 {
		return users.PublicUser{}, ErrInvalidInput
	}

	user, err := s.users.UpdateProfile(ctx, userID, input)
	if errors.Is(err, users.ErrNotFound) {
		return users.PublicUser{}, ErrUnauthorized
	}
	if err != nil {
		return users.PublicUser{}, err
	}
	return users.ToPublic(user), nil
}

const (
	maxTechnicalTags      = 10
	maxTechnicalTagLength = 30
)

func normalizeTechnicalTags(values []string) ([]string, error) {
	tags := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		tag := strings.TrimSpace(value)
		if tag == "" {
			continue
		}
		if utf8.RuneCountInString(tag) > maxTechnicalTagLength {
			return nil, ErrInvalidInput
		}
		normalized := strings.ToLower(tag)
		if _, exists := seen[normalized]; exists {
			continue
		}
		seen[normalized] = struct{}{}
		tags = append(tags, tag)
		if len(tags) > maxTechnicalTags {
			return nil, ErrInvalidInput
		}
	}
	return tags, nil
}

const maxAvatarBytes int64 = 2 * 1024 * 1024

var allowedAvatarTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

func (s *Service) UploadAvatar(ctx context.Context, userID int64, header *multipart.FileHeader) (users.PublicUser, error) {
	if userID <= 0 || header == nil || strings.TrimSpace(header.Filename) == "" {
		return users.PublicUser{}, ErrInvalidInput
	}
	if header.Size <= 0 || header.Size > maxAvatarBytes {
		return users.PublicUser{}, ErrPayloadTooLarge
	}

	originalName := filepath.Base(header.Filename)
	ext := strings.ToLower(filepath.Ext(originalName))
	if ext == ".jpeg" {
		ext = ".jpg"
	}

	file, err := header.Open()
	if err != nil {
		return users.PublicUser{}, fmt.Errorf("open avatar: %w", err)
	}
	defer file.Close()

	head := make([]byte, 512)
	n, err := io.ReadFull(file, head)
	if err != nil && err != io.ErrUnexpectedEOF {
		return users.PublicUser{}, fmt.Errorf("read avatar header: %w", err)
	}
	head = head[:n]

	mimeType := http.DetectContentType(head)
	expectedExt, ok := allowedAvatarTypes[mimeType]
	if !ok || ext != expectedExt {
		return users.PublicUser{}, ErrUnsupportedMedia
	}

	now := time.Now().UTC()
	storedName, err := randomAvatarFilename(now, ext)
	if err != nil {
		return users.PublicUser{}, err
	}
	relativeDir := filepath.Join("avatars", now.Format("2006"), now.Format("01"))
	targetDir := filepath.Join(s.cfg.UploadDir, relativeDir)
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		return users.PublicUser{}, fmt.Errorf("create avatar dir: %w", err)
	}

	targetPath := filepath.Join(targetDir, filepath.Base(storedName))
	out, err := os.OpenFile(targetPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0644)
	if err != nil {
		return users.PublicUser{}, fmt.Errorf("create avatar file: %w", err)
	}
	defer out.Close()

	written, err := io.Copy(out, io.MultiReader(bytes.NewReader(head), io.LimitReader(file, maxAvatarBytes+1)))
	if err != nil {
		_ = os.Remove(targetPath)
		return users.PublicUser{}, fmt.Errorf("write avatar file: %w", err)
	}
	if written > maxAvatarBytes {
		_ = os.Remove(targetPath)
		return users.PublicUser{}, ErrPayloadTooLarge
	}

	urlPath := strings.ReplaceAll(filepath.ToSlash(filepath.Join("avatars", now.Format("2006"), now.Format("01"), filepath.Base(storedName))), "\\", "/")
	publicURL := s.cfg.PublicUploadBaseURL + "/" + urlPath
	user, err := s.users.UpdateAvatar(ctx, userID, publicURL)
	if errors.Is(err, users.ErrNotFound) {
		_ = os.Remove(targetPath)
		return users.PublicUser{}, ErrUnauthorized
	}
	if err != nil {
		_ = os.Remove(targetPath)
		return users.PublicUser{}, err
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

func randomAvatarFilename(now time.Time, ext string) (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate avatar filename: %w", err)
	}
	return fmt.Sprintf("%s-%s%s", now.Format("20060102150405"), hex.EncodeToString(buf), ext), nil
}
