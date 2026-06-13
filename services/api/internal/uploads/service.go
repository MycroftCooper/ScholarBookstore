package uploads

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"scholarbookstore/services/api/internal/config"
)

const MaxArticleImageBytes int64 = 5 * 1024 * 1024

var allowedImageTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"image/gif":  ".gif",
}

type Service struct {
	cfg  config.Config
	repo *Repository
}

func NewService(cfg config.Config, repo *Repository) *Service {
	return &Service{cfg: cfg, repo: repo}
}

func (s *Service) UploadArticleImage(ctx context.Context, userID int64, articleID *int64, header *multipart.FileHeader) (UploadResult, error) {
	if userID <= 0 || header == nil || strings.TrimSpace(header.Filename) == "" {
		return UploadResult{}, ErrInvalidInput
	}
	if header.Size <= 0 || header.Size > MaxArticleImageBytes {
		return UploadResult{}, ErrPayloadTooLarge
	}

	originalName := filepath.Base(header.Filename)
	ext := strings.ToLower(filepath.Ext(originalName))
	if ext == ".jpeg" {
		ext = ".jpg"
	}

	file, err := header.Open()
	if err != nil {
		return UploadResult{}, fmt.Errorf("open upload: %w", err)
	}
	defer file.Close()

	head := make([]byte, 512)
	n, err := io.ReadFull(file, head)
	if err != nil && err != io.ErrUnexpectedEOF {
		return UploadResult{}, fmt.Errorf("read upload header: %w", err)
	}
	head = head[:n]

	mimeType := http.DetectContentType(head)
	expectedExt, ok := allowedImageTypes[mimeType]
	if !ok {
		return UploadResult{}, ErrUnsupportedMediaType
	}
	if ext != expectedExt {
		return UploadResult{}, ErrUnsupportedMediaType
	}

	now := time.Now().UTC()
	storedName, err := randomStoredFilename(now, ext)
	if err != nil {
		return UploadResult{}, err
	}
	relativeDir := filepath.Join("articles", now.Format("2006"), now.Format("01"))
	targetDir := filepath.Join(s.cfg.UploadDir, relativeDir)
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		return UploadResult{}, fmt.Errorf("create upload dir: %w", err)
	}

	targetPath := filepath.Join(targetDir, filepath.Base(storedName))
	out, err := os.OpenFile(targetPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0644)
	if err != nil {
		return UploadResult{}, fmt.Errorf("create upload file: %w", err)
	}
	defer out.Close()

	written, err := io.Copy(out, io.MultiReader(bytes.NewReader(head), io.LimitReader(file, MaxArticleImageBytes+1)))
	if err != nil {
		_ = os.Remove(targetPath)
		return UploadResult{}, fmt.Errorf("write upload file: %w", err)
	}
	if written > MaxArticleImageBytes {
		_ = os.Remove(targetPath)
		return UploadResult{}, ErrPayloadTooLarge
	}

	urlPath := strings.ReplaceAll(filepath.ToSlash(filepath.Join("articles", now.Format("2006"), now.Format("01"), filepath.Base(storedName))), "\\", "/")
	publicURL := s.cfg.PublicUploadBaseURL + "/" + urlPath
	image, err := s.repo.CreateArticleImage(ctx, CreateArticleImageInput{
		ArticleID:        articleID,
		UploadedBy:       userID,
		OriginalFilename: originalName,
		StoredFilename:   urlPath,
		MimeType:         mimeType,
		SizeBytes:        written,
		URL:              publicURL,
	})
	if err != nil {
		_ = os.Remove(targetPath)
		return UploadResult{}, err
	}

	return UploadResult{
		ID:        image.ID,
		URL:       image.URL,
		MimeType:  image.MimeType,
		SizeBytes: image.SizeBytes,
	}, nil
}

func randomStoredFilename(now time.Time, ext string) (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate upload filename: %w", err)
	}
	return fmt.Sprintf("%s-%s%s", now.Format("20060102150405"), hex.EncodeToString(buf), ext), nil
}
