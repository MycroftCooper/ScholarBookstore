package users

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrNotFound     = errors.New("user not found")
	ErrConflict     = errors.New("user already exists")
	ErrInvalidInput = errors.New("invalid user input")
	ErrForbidden    = errors.New("user action forbidden")
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Create(ctx context.Context, username string, email string, passwordHash string) (User, error) {
	const query = `
		insert into users (username, email, password_hash, role, status)
		values ($1, $2, $3, 'user', 'active')
		returning
			id, username, email, password_hash, role, status,
			avatar_url, bio, school, company, created_at, updated_at
	`

	var user User
	err := r.db.QueryRow(ctx, query, username, strings.ToLower(email), passwordHash).Scan(
		&user.ID,
		&user.Username,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
		&user.Status,
		&user.AvatarURL,
		&user.Bio,
		&user.School,
		&user.Company,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if err != nil {
		if isUniqueViolation(err) {
			return User{}, ErrConflict
		}
		return User{}, fmt.Errorf("create user: %w", err)
	}

	return user, nil
}

func (r *Repository) FindByEmail(ctx context.Context, email string) (User, error) {
	const query = `
		select
			id, username, email, password_hash, role, status,
			avatar_url, bio, school, company, created_at, updated_at
		from users
		where lower(email) = lower($1) and deleted_at is null
	`
	return r.findOne(ctx, query, email)
}

func (r *Repository) FindByID(ctx context.Context, id int64) (User, error) {
	const query = `
		select
			id, username, email, password_hash, role, status,
			avatar_url, bio, school, company, created_at, updated_at
		from users
		where id = $1 and deleted_at is null
	`
	return r.findOne(ctx, query, id)
}

func (r *Repository) UpdateProfile(ctx context.Context, id int64, input UpdateProfileInput) (User, error) {
	const query = `
		update users
		set bio = $2, school = $3, company = $4, updated_at = now()
		where id = $1 and deleted_at is null
		returning
			id, username, email, password_hash, role, status,
			avatar_url, bio, school, company, created_at, updated_at
	`
	return r.findOne(ctx, query, id, input.Bio, input.School, input.Company)
}

func (r *Repository) UpdateAvatar(ctx context.Context, id int64, avatarURL string) (User, error) {
	const query = `
		update users
		set avatar_url = $2, updated_at = now()
		where id = $1 and deleted_at is null
		returning
			id, username, email, password_hash, role, status,
			avatar_url, bio, school, company, created_at, updated_at
	`
	return r.findOne(ctx, query, id, avatarURL)
}

func (r *Repository) FindPublicAuthorProfile(ctx context.Context, username string, page int, pageSize int) (PublicAuthorProfile, int64, error) {
	const authorQuery = `
		select id, username, avatar_url, bio, school, company
		from users
		where lower(username) = lower($1) and status = 'active' and deleted_at is null
	`
	var author PublicAuthorProfile
	if err := r.db.QueryRow(ctx, authorQuery, username).Scan(
		&author.ID,
		&author.Username,
		&author.AvatarURL,
		&author.Bio,
		&author.School,
		&author.Company,
	); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return PublicAuthorProfile{}, 0, ErrNotFound
		}
		return PublicAuthorProfile{}, 0, fmt.Errorf("find public author: %w", err)
	}

	const countQuery = `
		select count(*)
		from articles
		where author_id = $1 and status = 'published' and deleted_at is null
	`
	var total int64
	if err := r.db.QueryRow(ctx, countQuery, author.ID).Scan(&total); err != nil {
		return PublicAuthorProfile{}, 0, fmt.Errorf("count author articles: %w", err)
	}
	author.PublishedArticleCount = total

	const followCountsQuery = `
		select
			(select count(*) from user_follows where followed_id = $1),
			(select count(*) from user_follows where follower_id = $1)
	`
	if err := r.db.QueryRow(ctx, followCountsQuery, author.ID).Scan(&author.FollowersCount, &author.FollowingCount); err != nil {
		return PublicAuthorProfile{}, 0, fmt.Errorf("count author follows: %w", err)
	}

	const articleQuery = `
		select
			a.id, a.module_id, m.slug, m.name, a.author_id, u.username,
			a.title, a.summary, a.status, a.published_at, a.created_at, a.updated_at
		from articles a
		join modules m on m.id = a.module_id
		join users u on u.id = a.author_id
		where a.author_id = $1 and a.status = 'published' and a.deleted_at is null
		order by a.published_at desc nulls last, a.id desc
		limit $2 offset $3
	`
	rows, err := r.db.Query(ctx, articleQuery, author.ID, pageSize, (page-1)*pageSize)
	if err != nil {
		return PublicAuthorProfile{}, 0, fmt.Errorf("query author articles: %w", err)
	}
	defer rows.Close()

	author.Articles = []AuthorArticle{}
	for rows.Next() {
		var article AuthorArticle
		if err := rows.Scan(
			&article.ID,
			&article.ModuleID,
			&article.ModuleSlug,
			&article.ModuleName,
			&article.AuthorID,
			&article.AuthorUsername,
			&article.Title,
			&article.Summary,
			&article.Status,
			&article.PublishedAt,
			&article.CreatedAt,
			&article.UpdatedAt,
		); err != nil {
			return PublicAuthorProfile{}, 0, fmt.Errorf("scan author article: %w", err)
		}
		author.Articles = append(author.Articles, article)
	}
	if err := rows.Err(); err != nil {
		return PublicAuthorProfile{}, 0, fmt.Errorf("iterate author articles: %w", err)
	}

	return author, total, nil
}

func (r *Repository) ListAdmin(ctx context.Context, filter AdminUserFilter, page int, pageSize int) ([]User, int64, error) {
	args := []interface{}{}
	where := "deleted_at is null"
	if filter.Query != "" {
		args = append(args, "%"+filter.Query+"%")
		where += fmt.Sprintf(" and (username ilike $%d or email ilike $%d)", len(args), len(args))
	}
	if filter.Role != "" {
		args = append(args, filter.Role)
		where += fmt.Sprintf(" and role = $%d", len(args))
	}
	if filter.Status != "" {
		args = append(args, filter.Status)
		where += fmt.Sprintf(" and status = $%d", len(args))
	}

	countQuery := fmt.Sprintf("select count(*) from users where %s", where)
	var total int64
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count admin users: %w", err)
	}

	args = append(args, pageSize, (page-1)*pageSize)
	query := fmt.Sprintf(`
		select
			id, username, email, password_hash, role, status,
			avatar_url, bio, school, company, created_at, updated_at
		from users
		where %s
		order by created_at desc, id desc
		limit $%d offset $%d
	`, where, len(args)-1, len(args))

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query admin users: %w", err)
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var user User
		if err := rows.Scan(
			&user.ID,
			&user.Username,
			&user.Email,
			&user.PasswordHash,
			&user.Role,
			&user.Status,
			&user.AvatarURL,
			&user.Bio,
			&user.School,
			&user.Company,
			&user.CreatedAt,
			&user.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan admin user: %w", err)
		}
		users = append(users, user)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate admin users: %w", err)
	}
	return users, total, nil
}

func (r *Repository) UpdateAdmin(ctx context.Context, id int64, input UpdateAdminUserInput) (User, error) {
	const query = `
		update users
		set
			role = coalesce($2, role),
			status = coalesce($3, status),
			updated_at = now()
		where id = $1 and deleted_at is null
		returning
			id, username, email, password_hash, role, status,
			avatar_url, bio, school, company, created_at, updated_at
	`
	user, err := r.findOne(ctx, query, id, input.Role, input.Status)
	if err != nil {
		return User{}, err
	}
	return user, nil
}

func (r *Repository) findOne(ctx context.Context, query string, args ...interface{}) (User, error) {
	var user User
	err := r.db.QueryRow(ctx, query, args...).Scan(
		&user.ID,
		&user.Username,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
		&user.Status,
		&user.AvatarURL,
		&user.Bio,
		&user.School,
		&user.Company,
		&user.CreatedAt,
		&user.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrNotFound
	}
	if err != nil {
		return User{}, fmt.Errorf("find user: %w", err)
	}
	return user, nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
