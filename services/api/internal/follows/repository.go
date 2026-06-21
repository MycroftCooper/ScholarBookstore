package follows

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

func (r *Repository) Follow(ctx context.Context, followerID int64, username string) (State, error) {
	target, err := r.findActiveUserByUsername(ctx, username)
	if err != nil {
		return State{}, err
	}
	if target.ID == followerID {
		return State{}, ErrInvalidInput
	}
	const query = `
		insert into user_follows (follower_id, followed_id)
		values ($1, $2)
		on conflict (follower_id, followed_id) do nothing
	`
	if _, err := r.db.Exec(ctx, query, followerID, target.ID); err != nil {
		return State{}, fmt.Errorf("follow user: %w", err)
	}
	return r.StateByID(ctx, followerID, target.ID)
}

func (r *Repository) Unfollow(ctx context.Context, followerID int64, username string) (State, error) {
	target, err := r.findActiveUserByUsername(ctx, username)
	if err != nil {
		return State{}, err
	}
	const query = `delete from user_follows where follower_id = $1 and followed_id = $2`
	if _, err := r.db.Exec(ctx, query, followerID, target.ID); err != nil {
		return State{}, fmt.Errorf("unfollow user: %w", err)
	}
	return r.StateByID(ctx, followerID, target.ID)
}

func (r *Repository) State(ctx context.Context, viewerID int64, username string) (State, error) {
	target, err := r.findActiveUserByUsername(ctx, username)
	if err != nil {
		return State{}, err
	}
	return r.StateByID(ctx, viewerID, target.ID)
}

func (r *Repository) StateByID(ctx context.Context, viewerID int64, targetID int64) (State, error) {
	const query = `
		select
			u.id, u.username,
			exists (select 1 from user_follows where follower_id = $1 and followed_id = u.id) as following,
			(select count(*) from user_follows where followed_id = u.id) as followers_count,
			(select count(*) from user_follows where follower_id = u.id) as following_count
		from users u
		where u.id = $2 and u.status = 'active' and u.deleted_at is null
	`
	var state State
	err := r.db.QueryRow(ctx, query, viewerID, targetID).Scan(
		&state.UserID,
		&state.Username,
		&state.Following,
		&state.FollowersCount,
		&state.FollowingCount,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return State{}, ErrNotFound
	}
	if err != nil {
		return State{}, fmt.Errorf("get follow state: %w", err)
	}
	return state, nil
}

func (r *Repository) ListFollowing(ctx context.Context, userID int64) ([]UserSummary, error) {
	const query = `
		select u.id, u.username, u.avatar_url, u.bio, uf.created_at
		from user_follows uf
		join users u on u.id = uf.followed_id
		where uf.follower_id = $1 and u.status = 'active' and u.deleted_at is null
		order by uf.created_at desc
	`
	return r.scanUserSummaries(ctx, query, userID)
}

func (r *Repository) ListFollowers(ctx context.Context, userID int64) ([]UserSummary, error) {
	const query = `
		select u.id, u.username, u.avatar_url, u.bio, uf.created_at
		from user_follows uf
		join users u on u.id = uf.follower_id
		where uf.followed_id = $1 and u.status = 'active' and u.deleted_at is null
		order by uf.created_at desc
	`
	return r.scanUserSummaries(ctx, query, userID)
}

func (r *Repository) findActiveUserByUsername(ctx context.Context, username string) (UserSummary, error) {
	const query = `
		select id, username, avatar_url, bio, created_at
		from users
		where lower(username) = lower($1) and status = 'active' and deleted_at is null
	`
	var item UserSummary
	err := r.db.QueryRow(ctx, query, username).Scan(
		&item.ID,
		&item.Username,
		&item.AvatarURL,
		&item.Bio,
		&item.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return UserSummary{}, ErrNotFound
	}
	if err != nil {
		return UserSummary{}, fmt.Errorf("find follow user: %w", err)
	}
	return item, nil
}

func (r *Repository) scanUserSummaries(ctx context.Context, query string, args ...interface{}) ([]UserSummary, error) {
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query follow users: %w", err)
	}
	defer rows.Close()
	var items []UserSummary
	for rows.Next() {
		var item UserSummary
		if err := rows.Scan(&item.ID, &item.Username, &item.AvatarURL, &item.Bio, &item.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan follow user: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate follow users: %w", err)
	}
	return items, nil
}
