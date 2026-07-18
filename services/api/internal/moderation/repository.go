package moderation

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) HasActivePenalty(ctx context.Context, userID int64, penaltyType string) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx, `
		select exists (
			select 1
			from moderation_penalties
			where user_id = $1
				and penalty_type = $2
				and status = 'active'
				and starts_at <= now()
				and (expires_at is null or expires_at > now())
		)
	`, userID, penaltyType).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("check active penalty: %w", err)
	}
	return exists, nil
}

func (r *Repository) CreatePenalty(ctx context.Context, input PenaltyInput) error {
	_, err := r.db.Exec(ctx, `
		insert into moderation_penalties (
			user_id, penalty_type, target_type, target_id, reason,
			expires_at, created_by, source_type, source_id
		)
		values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, input.UserID, input.Type, input.TargetType, input.TargetID, input.Reason, input.ExpiresAt, input.CreatedBy, input.SourceType, input.SourceID)
	if err != nil {
		return fmt.Errorf("create moderation penalty: %w", err)
	}
	return nil
}

func (r *Repository) DisableUser(ctx context.Context, userID int64) error {
	_, err := r.db.Exec(ctx, `
		update users
		set status = 'disabled', updated_at = now()
		where id = $1 and deleted_at is null
	`, userID)
	if err != nil {
		return fmt.Errorf("disable user: %w", err)
	}
	return nil
}

func (r *Repository) ArchiveArticle(ctx context.Context, articleID int64) error {
	_, err := r.db.Exec(ctx, `
		update articles
		set status = 'archived', updated_at = now()
		where id = $1 and status = 'published' and deleted_at is null
	`, articleID)
	if err != nil {
		return fmt.Errorf("archive article: %w", err)
	}
	return nil
}

func (r *Repository) HideComment(ctx context.Context, commentID int64) error {
	_, err := r.db.Exec(ctx, `
		update comments
		set visibility = 'hidden', updated_at = now()
		where id = $1 and deleted_at is null
	`, commentID)
	if err != nil {
		return fmt.Errorf("hide comment: %w", err)
	}
	return nil
}
