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
		select
			u.id, u.username, u.avatar_url, u.bio,
			(select count(*) from articles a where a.author_id = u.id and a.status = 'published' and a.deleted_at is null) as published_article_count,
			(select count(*) from user_follows followers where followers.followed_id = u.id) as followers_count,
			uf.created_at
		from user_follows uf
		join users u on u.id = uf.followed_id
		where uf.follower_id = $1 and u.status = 'active' and u.deleted_at is null
		order by uf.created_at desc
	`
	return r.scanUserSummaries(ctx, query, userID)
}

func (r *Repository) ListFollowers(ctx context.Context, userID int64) ([]UserSummary, error) {
	const query = `
		select
			u.id, u.username, u.avatar_url, u.bio,
			(select count(*) from articles a where a.author_id = u.id and a.status = 'published' and a.deleted_at is null) as published_article_count,
			(select count(*) from user_follows followers where followers.followed_id = u.id) as followers_count,
			uf.created_at
		from user_follows uf
		join users u on u.id = uf.follower_id
		where uf.followed_id = $1 and u.status = 'active' and u.deleted_at is null
		order by uf.created_at desc
	`
	return r.scanUserSummaries(ctx, query, userID)
}

func (r *Repository) ListRecommendedUsers(ctx context.Context, viewerID int64, limit int) ([]UserSummary, error) {
	const query = `
		select
			u.id, u.username, u.avatar_url, u.bio,
			(select count(*) from articles a where a.author_id = u.id and a.status = 'published' and a.deleted_at is null) as published_article_count,
			(select count(*) from user_follows followers where followers.followed_id = u.id) as followers_count,
			u.created_at
		from users u
		where u.status = 'active'
			and u.deleted_at is null
			and u.id <> $1
			and not exists (
				select 1
				from user_follows uf
				where uf.follower_id = $1 and uf.followed_id = u.id
			)
			and exists (
				select 1
				from articles a
				where a.author_id = u.id and a.status = 'published' and a.deleted_at is null
			)
		order by published_article_count desc, followers_count desc, u.created_at desc, u.id desc
		limit $2
	`
	return r.scanUserSummaries(ctx, query, viewerID, limit)
}

func (r *Repository) FollowModule(ctx context.Context, followerID int64, slug string) (TargetState, error) {
	target, err := r.findActiveModuleBySlug(ctx, slug)
	if err != nil {
		return TargetState{}, err
	}
	if _, err := r.db.Exec(ctx, `
		insert into module_follows (follower_id, module_id)
		values ($1, $2)
		on conflict (follower_id, module_id) do nothing
	`, followerID, target.ID); err != nil {
		return TargetState{}, fmt.Errorf("follow module: %w", err)
	}
	return r.ModuleStateByID(ctx, followerID, target.ID)
}

func (r *Repository) UnfollowModule(ctx context.Context, followerID int64, slug string) (TargetState, error) {
	target, err := r.findActiveModuleBySlug(ctx, slug)
	if err != nil {
		return TargetState{}, err
	}
	if _, err := r.db.Exec(ctx, `delete from module_follows where follower_id = $1 and module_id = $2`, followerID, target.ID); err != nil {
		return TargetState{}, fmt.Errorf("unfollow module: %w", err)
	}
	return r.ModuleStateByID(ctx, followerID, target.ID)
}

func (r *Repository) ModuleState(ctx context.Context, viewerID int64, slug string) (TargetState, error) {
	target, err := r.findActiveModuleBySlug(ctx, slug)
	if err != nil {
		return TargetState{}, err
	}
	return r.ModuleStateByID(ctx, viewerID, target.ID)
}

func (r *Repository) ModuleStateByID(ctx context.Context, viewerID int64, moduleID int64) (TargetState, error) {
	const query = `
		select
			m.id, m.slug, m.name,
			exists (select 1 from module_follows where follower_id = $1 and module_id = m.id) as following,
			(select count(*) from module_follows where module_id = m.id) as followers_count
		from modules m
		join domains d on d.id = m.domain_id
		where m.id = $2 and m.is_active = true and m.deleted_at is null
			and d.is_active = true and d.deleted_at is null
	`
	var state TargetState
	err := r.db.QueryRow(ctx, query, viewerID, moduleID).Scan(
		&state.ID,
		&state.Slug,
		&state.Name,
		&state.Following,
		&state.FollowersCount,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return TargetState{}, ErrNotFound
	}
	if err != nil {
		return TargetState{}, fmt.Errorf("get module follow state: %w", err)
	}
	return state, nil
}

func (r *Repository) FollowDomain(ctx context.Context, followerID int64, id int64) (TargetState, error) {
	target, err := r.findActiveDomainByID(ctx, id)
	if err != nil {
		return TargetState{}, err
	}
	if _, err := r.db.Exec(ctx, `
		insert into domain_follows (follower_id, domain_id)
		values ($1, $2)
		on conflict (follower_id, domain_id) do nothing
	`, followerID, target.ID); err != nil {
		return TargetState{}, fmt.Errorf("follow domain: %w", err)
	}
	return r.DomainStateByID(ctx, followerID, target.ID)
}

func (r *Repository) UnfollowDomain(ctx context.Context, followerID int64, id int64) (TargetState, error) {
	target, err := r.findActiveDomainByID(ctx, id)
	if err != nil {
		return TargetState{}, err
	}
	if _, err := r.db.Exec(ctx, `delete from domain_follows where follower_id = $1 and domain_id = $2`, followerID, target.ID); err != nil {
		return TargetState{}, fmt.Errorf("unfollow domain: %w", err)
	}
	return r.DomainStateByID(ctx, followerID, target.ID)
}

func (r *Repository) DomainState(ctx context.Context, viewerID int64, id int64) (TargetState, error) {
	target, err := r.findActiveDomainByID(ctx, id)
	if err != nil {
		return TargetState{}, err
	}
	return r.DomainStateByID(ctx, viewerID, target.ID)
}

func (r *Repository) DomainStateByID(ctx context.Context, viewerID int64, domainID int64) (TargetState, error) {
	const query = `
		select
			d.id, d.slug, d.name,
			exists (select 1 from domain_follows where follower_id = $1 and domain_id = d.id) as following,
			(select count(*) from domain_follows where domain_id = d.id) as followers_count
		from domains d
		where d.id = $2 and d.is_active = true and d.deleted_at is null
	`
	var state TargetState
	err := r.db.QueryRow(ctx, query, viewerID, domainID).Scan(
		&state.ID,
		&state.Slug,
		&state.Name,
		&state.Following,
		&state.FollowersCount,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return TargetState{}, ErrNotFound
	}
	if err != nil {
		return TargetState{}, fmt.Errorf("get domain follow state: %w", err)
	}
	return state, nil
}

func (r *Repository) ListFollowingModules(ctx context.Context, userID int64) ([]ModuleSummary, error) {
	const query = `
		select m.id, d.id, d.slug, d.name, m.slug, m.name, m.description, mf.created_at
		from module_follows mf
		join modules m on m.id = mf.module_id
		join domains d on d.id = m.domain_id
		where mf.follower_id = $1
			and m.is_active = true and m.deleted_at is null
			and d.is_active = true and d.deleted_at is null
		order by mf.created_at desc
	`
	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("query following modules: %w", err)
	}
	defer rows.Close()
	var items []ModuleSummary
	for rows.Next() {
		var item ModuleSummary
		if err := rows.Scan(&item.ID, &item.DomainID, &item.DomainSlug, &item.DomainName, &item.Slug, &item.Name, &item.Description, &item.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan following module: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate following modules: %w", err)
	}
	return items, nil
}

func (r *Repository) ListFollowingDomains(ctx context.Context, userID int64) ([]DomainSummary, error) {
	const query = `
		select d.id, d.slug, d.name, d.description, df.created_at
		from domain_follows df
		join domains d on d.id = df.domain_id
		where df.follower_id = $1 and d.is_active = true and d.deleted_at is null
		order by df.created_at desc
	`
	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("query following domains: %w", err)
	}
	defer rows.Close()
	var items []DomainSummary
	for rows.Next() {
		var item DomainSummary
		if err := rows.Scan(&item.ID, &item.Slug, &item.Name, &item.Description, &item.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan following domain: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate following domains: %w", err)
	}
	return items, nil
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

func (r *Repository) findActiveModuleBySlug(ctx context.Context, slug string) (ModuleSummary, error) {
	const query = `
		select m.id, d.id, d.slug, d.name, m.slug, m.name, m.description, m.created_at
		from modules m
		join domains d on d.id = m.domain_id
		where lower(m.slug) = lower($1)
			and m.is_active = true and m.deleted_at is null
			and d.is_active = true and d.deleted_at is null
	`
	var item ModuleSummary
	err := r.db.QueryRow(ctx, query, slug).Scan(
		&item.ID,
		&item.DomainID,
		&item.DomainSlug,
		&item.DomainName,
		&item.Slug,
		&item.Name,
		&item.Description,
		&item.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return ModuleSummary{}, ErrNotFound
	}
	if err != nil {
		return ModuleSummary{}, fmt.Errorf("find follow module: %w", err)
	}
	return item, nil
}

func (r *Repository) findActiveDomainByID(ctx context.Context, id int64) (DomainSummary, error) {
	const query = `
		select id, slug, name, description, created_at
		from domains
		where id = $1 and is_active = true and deleted_at is null
	`
	var item DomainSummary
	err := r.db.QueryRow(ctx, query, id).Scan(
		&item.ID,
		&item.Slug,
		&item.Name,
		&item.Description,
		&item.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return DomainSummary{}, ErrNotFound
	}
	if err != nil {
		return DomainSummary{}, fmt.Errorf("find follow domain: %w", err)
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
		if err := rows.Scan(&item.ID, &item.Username, &item.AvatarURL, &item.Bio, &item.PublishedArticleCount, &item.FollowersCount, &item.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan follow user: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate follow users: %w", err)
	}
	return items, nil
}
