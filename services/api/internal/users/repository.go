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
	ErrNotFound = errors.New("user not found")
	ErrConflict = errors.New("user already exists")
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
		returning id, username, email, password_hash, role, status, created_at, updated_at
	`

	var user User
	err := r.db.QueryRow(ctx, query, username, strings.ToLower(email), passwordHash).Scan(
		&user.ID,
		&user.Username,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
		&user.Status,
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
		select id, username, email, password_hash, role, status, created_at, updated_at
		from users
		where lower(email) = lower($1) and deleted_at is null
	`
	return r.findOne(ctx, query, email)
}

func (r *Repository) FindByID(ctx context.Context, id int64) (User, error) {
	const query = `
		select id, username, email, password_hash, role, status, created_at, updated_at
		from users
		where id = $1 and deleted_at is null
	`
	return r.findOne(ctx, query, id)
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
