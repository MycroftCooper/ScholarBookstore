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
		select
			m.id, m.domain_id, d.slug, d.name, m.slug, m.name, m.description,
			m.sort_order, m.is_active, m.created_at, m.updated_at
		from modules m
		join domains d on d.id = m.domain_id
		where m.deleted_at is null and d.deleted_at is null
	`
	if !includeInactive {
		query += " and m.is_active = true and d.is_active = true"
	}
	query += " order by d.sort_order asc, m.sort_order asc, m.id asc"

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
			&module.DomainID,
			&module.DomainSlug,
			&module.DomainName,
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
		select
			m.id, m.domain_id, d.slug, d.name, m.slug, m.name, m.description,
			m.sort_order, m.is_active, m.created_at, m.updated_at
		from modules m
		join domains d on d.id = m.domain_id
		where m.slug = $1 and m.is_active = true and m.deleted_at is null
			and d.is_active = true and d.deleted_at is null
	`
	return r.findOne(ctx, query, slug)
}

func (r *Repository) Create(ctx context.Context, input CreateModuleInput) (Module, error) {
	const query = `
		insert into modules (domain_id, slug, name, description, sort_order, is_active)
		select $1, $2, $3, $4, $5, $6
		where exists (
			select 1 from domains
			where id = $1 and deleted_at is null
		)
		returning id
	`

	module, err := r.scanCreate(ctx, query, input)
	if errors.Is(err, pgx.ErrNoRows) {
		return Module{}, ErrNotFound
	}
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
			domain_id = coalesce($2, domain_id),
			name = coalesce($3, name),
			description = coalesce($4, description),
			sort_order = coalesce($5, sort_order),
			is_active = coalesce($6, is_active),
			updated_at = now()
		where id = $1 and deleted_at is null
			and ($2::bigint is null or exists (
				select 1 from domains
				where id = $2 and deleted_at is null
			))
		returning id
	`

	var updatedID int64
	err := r.db.QueryRow(ctx, query, id, input.DomainID, input.Name, input.Description, input.SortOrder, input.IsActive).Scan(&updatedID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Module{}, ErrNotFound
	}
	if err != nil {
		return Module{}, fmt.Errorf("update module: %w", err)
	}
	return r.FindByID(ctx, updatedID)
}

func (r *Repository) Delete(ctx context.Context, id int64) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin delete module: %w", err)
	}
	defer tx.Rollback(ctx)

	const deleteQuery = `
		update modules
		set is_active = false, deleted_at = now(), updated_at = now()
		where id = $1 and deleted_at is null
		returning id
	`
	var deletedID int64
	err = tx.QueryRow(ctx, deleteQuery, id).Scan(&deletedID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("delete module: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		update articles
		set status = 'archived', updated_at = now()
		where module_id = $1
			and deleted_at is null
			and status <> 'archived'
	`, deletedID); err != nil {
		return fmt.Errorf("archive module articles: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit delete module: %w", err)
	}
	return nil
}

func (r *Repository) CanManageDomain(ctx context.Context, actorID int64, actorRole string, domainID int64) (bool, error) {
	if actorRole == "admin" {
		return true, nil
	}
	if actorID <= 0 || domainID <= 0 {
		return false, nil
	}
	const query = `select exists (select 1 from domain_owners where domain_id = $1 and user_id = $2)`
	var allowed bool
	if err := r.db.QueryRow(ctx, query, domainID, actorID).Scan(&allowed); err != nil {
		return false, fmt.Errorf("check domain management permission: %w", err)
	}
	return allowed, nil
}

func (r *Repository) CanManageModule(ctx context.Context, actorID int64, actorRole string, moduleID int64) (bool, error) {
	if actorRole == "admin" {
		return true, nil
	}
	if actorID <= 0 || moduleID <= 0 {
		return false, nil
	}
	const query = `
		select exists (
			select 1
			from modules m
			join domain_owners do on do.domain_id = m.domain_id and do.user_id = $2
			where m.id = $1 and m.deleted_at is null
		)
	`
	var allowed bool
	if err := r.db.QueryRow(ctx, query, moduleID, actorID).Scan(&allowed); err != nil {
		return false, fmt.Errorf("check module management permission: %w", err)
	}
	return allowed, nil
}

func (r *Repository) AddModerator(ctx context.Context, moduleID int64, userID int64) (ModuleModerator, error) {
	const query = `
		insert into module_moderators (module_id, user_id)
		select $1, $2
		where exists (select 1 from modules where id = $1 and deleted_at is null)
			and exists (select 1 from users where id = $2 and status = 'active' and deleted_at is null)
		on conflict (module_id, user_id) do update set user_id = excluded.user_id
		returning module_id, user_id, created_at
	`
	var item ModuleModerator
	err := r.db.QueryRow(ctx, query, moduleID, userID).Scan(&item.ModuleID, &item.UserID, &item.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return ModuleModerator{}, ErrNotFound
	}
	if err != nil {
		return ModuleModerator{}, fmt.Errorf("add module moderator: %w", err)
	}
	return item, nil
}

func (r *Repository) RemoveModerator(ctx context.Context, moduleID int64, userID int64) error {
	const query = `
		delete from module_moderators
		where module_id = $1 and user_id = $2
		returning module_id
	`
	var removedID int64
	err := r.db.QueryRow(ctx, query, moduleID, userID).Scan(&removedID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("remove module moderator: %w", err)
	}
	return nil
}

func (r *Repository) scanCreate(ctx context.Context, query string, input CreateModuleInput) (Module, error) {
	var id int64
	err := r.db.QueryRow(ctx, query, input.DomainID, input.Slug, input.Name, input.Description, input.SortOrder, input.IsActive).Scan(&id)
	if err != nil {
		return Module{}, err
	}
	return r.FindByID(ctx, id)
}

func (r *Repository) FindByID(ctx context.Context, id int64) (Module, error) {
	const query = `
		select
			m.id, m.domain_id, d.slug, d.name, m.slug, m.name, m.description,
			m.sort_order, m.is_active, m.created_at, m.updated_at
		from modules m
		join domains d on d.id = m.domain_id
		where m.id = $1 and m.deleted_at is null and d.deleted_at is null
	`
	return r.findOne(ctx, query, id)
}

func (r *Repository) findOne(ctx context.Context, query string, args ...interface{}) (Module, error) {
	var module Module
	err := r.db.QueryRow(ctx, query, args...).Scan(
		&module.ID,
		&module.DomainID,
		&module.DomainSlug,
		&module.DomainName,
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
