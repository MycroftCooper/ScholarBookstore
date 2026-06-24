package domains

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

func (r *Repository) List(ctx context.Context, includeInactive bool) ([]Domain, error) {
	query := `
		select id, slug, name, description, sort_order, is_active, created_at, updated_at
		from domains
		where deleted_at is null
	`
	if !includeInactive {
		query += " and is_active = true"
	}
	query += " order by sort_order asc, id asc"

	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list domains: %w", err)
	}
	defer rows.Close()

	var items []Domain
	for rows.Next() {
		item, err := scanDomain(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate domains: %w", err)
	}
	return items, nil
}

func (r *Repository) FindByID(ctx context.Context, id int64, includeInactive bool) (Domain, error) {
	query := `
		select id, slug, name, description, sort_order, is_active, created_at, updated_at
		from domains
		where id = $1 and deleted_at is null
	`
	if !includeInactive {
		query += " and is_active = true"
	}
	domain, err := r.findOne(ctx, query, id)
	if err != nil {
		return Domain{}, err
	}

	modules, err := r.ListModulesByDomain(ctx, domain.ID, includeInactive)
	if err != nil {
		return Domain{}, err
	}
	domain.Modules = modules
	return domain, nil
}

func (r *Repository) ListModulesByDomain(ctx context.Context, domainID int64, includeInactive bool) ([]DomainModule, error) {
	query := `
		select
			m.id, m.domain_id, d.slug, d.name, m.slug, m.name, m.description,
			m.sort_order, m.is_active, m.created_at, m.updated_at
		from modules m
		join domains d on d.id = m.domain_id
		where m.domain_id = $1 and m.deleted_at is null and d.deleted_at is null
	`
	if !includeInactive {
		query += " and m.is_active = true and d.is_active = true"
	}
	query += " order by m.sort_order asc, m.id asc"

	rows, err := r.db.Query(ctx, query, domainID)
	if err != nil {
		return nil, fmt.Errorf("list domain modules: %w", err)
	}
	defer rows.Close()

	items := []DomainModule{}
	for rows.Next() {
		var item DomainModule
		if err := rows.Scan(
			&item.ID,
			&item.DomainID,
			&item.DomainSlug,
			&item.DomainName,
			&item.Slug,
			&item.Name,
			&item.Description,
			&item.SortOrder,
			&item.IsActive,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan domain module: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate domain modules: %w", err)
	}
	return items, nil
}

func (r *Repository) Create(ctx context.Context, input CreateDomainInput) (Domain, error) {
	const query = `
		insert into domains (slug, name, description, sort_order, is_active)
		values ($1, $2, $3, $4, $5)
		returning id
	`
	var id int64
	err := r.db.QueryRow(ctx, query, input.Slug, input.Name, input.Description, input.SortOrder, input.IsActive).Scan(&id)
	if isUniqueViolation(err) {
		return Domain{}, ErrConflict
	}
	if err != nil {
		return Domain{}, fmt.Errorf("create domain: %w", err)
	}
	return r.FindByID(ctx, id, true)
}

func (r *Repository) Update(ctx context.Context, id int64, input UpdateDomainInput) (Domain, error) {
	const query = `
		update domains
		set
			name = coalesce($2, name),
			description = coalesce($3, description),
			sort_order = coalesce($4, sort_order),
			is_active = coalesce($5, is_active),
			updated_at = now()
		where id = $1 and deleted_at is null
		returning id
	`
	var updatedID int64
	err := r.db.QueryRow(ctx, query, id, input.Name, input.Description, input.SortOrder, input.IsActive).Scan(&updatedID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Domain{}, ErrNotFound
	}
	if err != nil {
		return Domain{}, fmt.Errorf("update domain: %w", err)
	}
	return r.FindByID(ctx, updatedID, true)
}

func (r *Repository) AddOwner(ctx context.Context, domainID int64, userID int64) (DomainOwner, error) {
	const query = `
		insert into domain_owners (domain_id, user_id)
		select $1, $2
		where exists (select 1 from domains where id = $1 and deleted_at is null)
			and exists (select 1 from users where id = $2 and status = 'active' and deleted_at is null)
		on conflict (domain_id, user_id) do update set user_id = excluded.user_id
		returning domain_id, user_id, created_at
	`
	var item DomainOwner
	err := r.db.QueryRow(ctx, query, domainID, userID).Scan(&item.DomainID, &item.UserID, &item.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return DomainOwner{}, ErrNotFound
	}
	if err != nil {
		return DomainOwner{}, fmt.Errorf("add domain owner: %w", err)
	}
	return item, nil
}

func (r *Repository) RemoveOwner(ctx context.Context, domainID int64, userID int64) error {
	const query = `
		delete from domain_owners
		where domain_id = $1 and user_id = $2
		returning domain_id
	`
	var removedID int64
	err := r.db.QueryRow(ctx, query, domainID, userID).Scan(&removedID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("remove domain owner: %w", err)
	}
	return nil
}

func (r *Repository) findOne(ctx context.Context, query string, args ...interface{}) (Domain, error) {
	item, err := scanDomain(r.db.QueryRow(ctx, query, args...))
	if errors.Is(err, pgx.ErrNoRows) {
		return Domain{}, ErrNotFound
	}
	if err != nil {
		return Domain{}, err
	}
	return item, nil
}

type domainScanner interface {
	Scan(dest ...interface{}) error
}

func scanDomain(scanner domainScanner) (Domain, error) {
	var item Domain
	err := scanner.Scan(
		&item.ID,
		&item.Slug,
		&item.Name,
		&item.Description,
		&item.SortOrder,
		&item.IsActive,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		return Domain{}, fmt.Errorf("scan domain: %w", err)
	}
	return item, nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
