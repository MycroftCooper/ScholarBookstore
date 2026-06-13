package modules

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) List(ctx context.Context, includeInactive bool) ([]Module, error) {
	query := `
		select id, slug, name, description, sort_order, is_active, created_at, updated_at
		from modules
		where deleted_at is null
	`
	if !includeInactive {
		query += " and is_active = true"
	}
	query += " order by sort_order asc, id asc"

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list modules: %w", err)
	}
	defer rows.Close()

	var modules []Module
	for rows.Next() {
		var module Module
		if err := rows.Scan(
			&module.ID,
			&module.Slug,
			&module.Name,
			&module.Description,
			&module.SortOrder,
			&module.IsActive,
			&module.CreatedAt,
			&module.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan module: %w", err)
		}
		modules = append(modules, module)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate modules: %w", err)
	}

	return modules, nil
}

func (r *Repository) FindBySlug(ctx context.Context, slug string) (Module, error) {
	const query = `
		select id, slug, name, description, sort_order, is_active, created_at, updated_at
		from modules
		where slug = $1 and is_active = true and deleted_at is null
	`
	return r.findOne(ctx, query, slug)
}

func (r *Repository) Create(ctx context.Context, input CreateModuleInput) (Module, error) {
	const query = `
		insert into modules (slug, name, description, sort_order, is_active)
		values ($1, $2, $3, $4, $5)
		returning id, slug, name, description, sort_order, is_active, created_at, updated_at
	`

	module, err := r.scanCreate(ctx, query, input)
	if isUniqueViolation(err) {
		return Module{}, ErrConflict
	}
	if err != nil {
		return Module{}, fmt.Errorf("create module: %w", err)
	}
	return module, nil
}

func (r *Repository) Update(ctx context.Context, id int64, input UpdateModuleInput) (Module, error) {
	const query = `
		update modules
		set
			name = coalesce($2, name),
			description = coalesce($3, description),
			sort_order = coalesce($4, sort_order),
			is_active = coalesce($5, is_active),
			updated_at = now()
		where id = $1 and deleted_at is null
		returning id, slug, name, description, sort_order, is_active, created_at, updated_at
	`

	var module Module
	err := r.db.QueryRow(ctx, query, id, input.Name, input.Description, input.SortOrder, input.IsActive).Scan(
		&module.ID,
		&module.Slug,
		&module.Name,
		&module.Description,
		&module.SortOrder,
		&module.IsActive,
		&module.CreatedAt,
		&module.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Module{}, ErrNotFound
	}
	if err != nil {
		return Module{}, fmt.Errorf("update module: %w", err)
	}
	return module, nil
}

func (r *Repository) scanCreate(ctx context.Context, query string, input CreateModuleInput) (Module, error) {
	var module Module
	err := r.db.QueryRow(ctx, query, input.Slug, input.Name, input.Description, input.SortOrder, input.IsActive).Scan(
		&module.ID,
		&module.Slug,
		&module.Name,
		&module.Description,
		&module.SortOrder,
		&module.IsActive,
		&module.CreatedAt,
		&module.UpdatedAt,
	)
	return module, err
}

func (r *Repository) findOne(ctx context.Context, query string, args ...interface{}) (Module, error) {
	var module Module
	err := r.db.QueryRow(ctx, query, args...).Scan(
		&module.ID,
		&module.Slug,
		&module.Name,
		&module.Description,
		&module.SortOrder,
		&module.IsActive,
		&module.CreatedAt,
		&module.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return Module{}, ErrNotFound
	}
	if err != nil {
		return Module{}, fmt.Errorf("find module: %w", err)
	}
	return module, nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
