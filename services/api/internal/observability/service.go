package observability

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
)

var ErrInvalidInput = errors.New("invalid error log input")

type ErrorLogRepository interface {
	CreateErrorLog(ctx context.Context, input ErrorLogInput) error
	ListErrorLogs(ctx context.Context, filter ErrorLogFilter, page int, pageSize int) ([]ErrorLog, int64, error)
	DeleteErrorLog(ctx context.Context, id int64) (int64, error)
	DeleteAllErrorLogs(ctx context.Context) (int64, error)
}

type Service struct {
	repo ErrorLogRepository
}

func NewService(repo ErrorLogRepository) *Service {
	return &Service{repo: repo}
}

func (s *Service) CreateErrorLog(ctx context.Context, input ErrorLogInput) error {
	input.Source = normalizeOneOf(input.Source, "server", "client", "server")
	input.Level = normalizeOneOf(input.Level, "error", "warning", "info")
	input.Message = limit(strings.TrimSpace(input.Message), 2000)
	input.Stack = limit(strings.TrimSpace(input.Stack), 20000)
	input.RequestID = limit(strings.TrimSpace(input.RequestID), 120)
	input.Method = limit(strings.TrimSpace(input.Method), 12)
	input.Path = limit(strings.TrimSpace(input.Path), 1000)
	input.IP = limit(strings.TrimSpace(input.IP), 200)
	input.UserAgent = limit(strings.TrimSpace(input.UserAgent), 1000)
	input.Metadata = sanitizeMetadata(input.Metadata)
	if input.Message == "" {
		return ErrInvalidInput
	}
	input.Fingerprint = fingerprint(input)
	return s.repo.CreateErrorLog(ctx, input)
}

func (s *Service) ListErrorLogs(ctx context.Context, filter ErrorLogFilter, page int, pageSize int) (ErrorLogPage, error) {
	filter.Source = normalizeOptional(filter.Source, "client", "server")
	items, total, err := s.repo.ListErrorLogs(ctx, filter, page, pageSize)
	if err != nil {
		return ErrorLogPage{}, err
	}
	return ErrorLogPage{
		Number: page,
		Size:   pageSize,
		Total:  total,
		Logs:   items,
	}, nil
}

func (s *Service) DeleteErrorLog(ctx context.Context, id int64) (int64, error) {
	if id <= 0 {
		return 0, ErrInvalidInput
	}
	return s.repo.DeleteErrorLog(ctx, id)
}

func (s *Service) DeleteAllErrorLogs(ctx context.Context) (int64, error) {
	return s.repo.DeleteAllErrorLogs(ctx)
}

func normalizeOneOf(value string, fallback string, allowed ...string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	for _, item := range allowed {
		if value == item {
			return value
		}
	}
	return fallback
}

func normalizeOptional(value string, allowed ...string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	for _, item := range allowed {
		if value == item {
			return value
		}
	}
	return ""
}

func sanitizeMetadata(input map[string]string) map[string]string {
	out := map[string]string{}
	for key, value := range input {
		key = limit(strings.TrimSpace(key), 80)
		if key == "" || isSensitiveKey(key) {
			continue
		}
		out[key] = limit(strings.TrimSpace(value), 1000)
		if len(out) >= 20 {
			break
		}
	}
	return out
}

func isSensitiveKey(key string) bool {
	key = strings.ToLower(key)
	return strings.Contains(key, "password") ||
		strings.Contains(key, "token") ||
		strings.Contains(key, "secret") ||
		strings.Contains(key, "cookie") ||
		strings.Contains(key, "authorization")
}

func limit(value string, max int) string {
	if len(value) <= max {
		return value
	}
	return value[:max]
}

func fingerprint(input ErrorLogInput) string {
	key := strings.Join([]string{
		input.Source,
		input.Stack,
	}, "\n")
	if strings.TrimSpace(input.Stack) == "" {
		key = strings.Join([]string{
			input.Source,
			input.Message,
			input.Method,
			input.Path,
		}, "\n")
	}
	sum := sha256.Sum256([]byte(key))
	return hex.EncodeToString(sum[:])
}
