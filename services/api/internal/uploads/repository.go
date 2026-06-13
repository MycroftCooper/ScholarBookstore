package uploads

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateArticleImage(ctx context.Context, input CreateArticleImageInput) (ArticleImage, error) {
	if input.ArticleID != nil {
		ok, err := r.canAttachToArticle(ctx, *input.ArticleID, input.UploadedBy)
		if err != nil {
			return ArticleImage{}, err
		}
		if !ok {
			return ArticleImage{}, ErrNotFound
		}
	}

	const query = `
		insert into article_images (
			article_id, uploaded_by, original_filename, stored_filename,
			mime_type, size_bytes, url
		)
		values ($1, $2, $3, $4, $5, $6, $7)
		returning
			id, article_id, uploaded_by, original_filename, stored_filename,
			mime_type, size_bytes, url, created_at
	`
	var item ArticleImage
	err := r.db.QueryRow(ctx, query,
		input.ArticleID,
		input.UploadedBy,
		input.OriginalFilename,
		input.StoredFilename,
		input.MimeType,
		input.SizeBytes,
		input.URL,
	).Scan(
		&item.ID,
		&item.ArticleID,
		&item.UploadedBy,
		&item.OriginalFilename,
		&item.StoredFilename,
		&item.MimeType,
		&item.SizeBytes,
		&item.URL,
		&item.CreatedAt,
	)
	if err != nil {
		return ArticleImage{}, fmt.Errorf("create article image: %w", err)
	}
	return item, nil
}

func (r *Repository) canAttachToArticle(ctx context.Context, articleID int64, userID int64) (bool, error) {
	const query = `
		select exists (
			select 1
			from articles
			where id = $1 and author_id = $2 and deleted_at is null
		)
	`
	var ok bool
	if err := r.db.QueryRow(ctx, query, articleID, userID).Scan(&ok); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, fmt.Errorf("check article image attachment: %w", err)
	}
	return ok, nil
}
