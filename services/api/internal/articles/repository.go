package articles

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

func (r *Repository) ListPublished(ctx context.Context, moduleSlug string, page int, pageSize int) ([]Article, int64, error) {
	args := []interface{}{}
	filter := "a.status = 'published' and a.deleted_at is null"
	if moduleSlug != "" {
		args = append(args, moduleSlug)
		filter += fmt.Sprintf(" and m.slug = $%d and m.deleted_at is null and m.is_active = true", len(args))
	}

	countQuery := fmt.Sprintf(`
		select count(*)
		from articles a
		join modules m on m.id = a.module_id
		where %s
	`, filter)

	var total int64
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count published articles: %w", err)
	}

	args = append(args, pageSize, (page-1)*pageSize)
	query := fmt.Sprintf(`
		select
			a.id, a.module_id, m.slug, m.name, a.author_id, u.username,
			a.title, a.slug, a.summary, a.content_md, a.status, a.review_note,
			a.published_at, a.created_at, a.updated_at
		from articles a
		join modules m on m.id = a.module_id
		join users u on u.id = a.author_id
		where %s
		order by a.published_at desc nulls last, a.id desc
		limit $%d offset $%d
	`, filter, len(args)-1, len(args))

	items, err := r.scanMany(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) ListAdmin(ctx context.Context, status string, page int, pageSize int) ([]Article, int64, error) {
	args := []interface{}{}
	filter := "a.deleted_at is null"
	if status != "" {
		args = append(args, status)
		filter += fmt.Sprintf(" and a.status = $%d", len(args))
	}

	countQuery := fmt.Sprintf(`
		select count(*)
		from articles a
		where %s
	`, filter)

	var total int64
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count admin articles: %w", err)
	}

	args = append(args, pageSize, (page-1)*pageSize)
	query := fmt.Sprintf(`
		select
			a.id, a.module_id, m.slug, m.name, a.author_id, u.username,
			a.title, a.slug, a.summary, a.content_md, a.status, a.review_note,
			a.published_at, a.created_at, a.updated_at
		from articles a
		join modules m on m.id = a.module_id
		join users u on u.id = a.author_id
		where %s
		order by a.created_at desc, a.id desc
		limit $%d offset $%d
	`, filter, len(args)-1, len(args))

	items, err := r.scanMany(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) FindPublishedByID(ctx context.Context, id int64) (Article, error) {
	const query = `
		select
			a.id, a.module_id, m.slug, m.name, a.author_id, u.username,
			a.title, a.slug, a.summary, a.content_md, a.status, a.review_note,
			a.published_at, a.created_at, a.updated_at
		from articles a
		join modules m on m.id = a.module_id
		join users u on u.id = a.author_id
		where a.id = $1 and a.status = 'published' and a.deleted_at is null
	`
	return r.scanOne(ctx, query, id)
}

func (r *Repository) ListMine(ctx context.Context, authorID int64, status string, page int, pageSize int) ([]Article, int64, error) {
	args := []interface{}{authorID}
	filter := "a.author_id = $1 and a.deleted_at is null"
	if status != "" {
		args = append(args, status)
		filter += fmt.Sprintf(" and a.status = $%d", len(args))
	}

	countQuery := fmt.Sprintf(`
		select count(*)
		from articles a
		where %s
	`, filter)

	var total int64
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count my articles: %w", err)
	}

	args = append(args, pageSize, (page-1)*pageSize)
	query := fmt.Sprintf(`
		select
			a.id, a.module_id, m.slug, m.name, a.author_id, u.username,
			a.title, a.slug, a.summary, a.content_md, a.status, a.review_note,
			a.published_at, a.created_at, a.updated_at
		from articles a
		join modules m on m.id = a.module_id
		join users u on u.id = a.author_id
		where %s
		order by a.created_at desc, a.id desc
		limit $%d offset $%d
	`, filter, len(args)-1, len(args))

	items, err := r.scanMany(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) Create(ctx context.Context, input CreateArticleInput) (Article, error) {
	const query = `
		insert into articles (module_id, author_id, title, summary, content_md, status)
		select $1, $2, $3, $4, $5, 'pending_review'
		where exists (
			select 1 from modules
			where id = $1 and is_active = true and deleted_at is null
		)
		returning id
	`

	var id int64
	if err := r.db.QueryRow(ctx, query, input.ModuleID, input.AuthorID, input.Title, input.Summary, input.ContentMD).Scan(&id); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Article{}, ErrNotFound
		}
		return Article{}, fmt.Errorf("create article: %w", err)
	}

	return r.FindByIDForAuthor(ctx, id, input.AuthorID)
}

func (r *Repository) FindByIDForAuthor(ctx context.Context, id int64, authorID int64) (Article, error) {
	const query = `
		select
			a.id, a.module_id, m.slug, m.name, a.author_id, u.username,
			a.title, a.slug, a.summary, a.content_md, a.status, a.review_note,
			a.published_at, a.created_at, a.updated_at
		from articles a
		join modules m on m.id = a.module_id
		join users u on u.id = a.author_id
		where a.id = $1 and a.author_id = $2 and a.deleted_at is null
	`
	return r.scanOne(ctx, query, id, authorID)
}

func (r *Repository) UpdateOwn(ctx context.Context, id int64, authorID int64, input UpdateArticleInput) (Article, error) {
	const query = `
		update articles
		set
			title = coalesce($3, title),
			summary = coalesce($4, summary),
			content_md = coalesce($5, content_md),
			status = case when status = 'rejected' then 'pending_review' else status end,
			reviewed_by = case when status = 'rejected' then null else reviewed_by end,
			reviewed_at = case when status = 'rejected' then null else reviewed_at end,
			review_note = case when status = 'rejected' then '' else review_note end,
			updated_at = now()
		where id = $1
			and author_id = $2
			and deleted_at is null
			and status in ('draft', 'pending_review', 'rejected')
		returning id
	`

	var updatedID int64
	err := r.db.QueryRow(ctx, query, id, authorID, input.Title, input.Summary, input.ContentMD).Scan(&updatedID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Article{}, ErrConflict
	}
	if err != nil {
		return Article{}, fmt.Errorf("update article: %w", err)
	}

	return r.FindByIDForAuthor(ctx, updatedID, authorID)
}

func (r *Repository) ListPendingReview(ctx context.Context, page int, pageSize int) ([]Article, int64, error) {
	const countQuery = `
		select count(*)
		from articles a
		where a.status = 'pending_review' and a.deleted_at is null
	`

	var total int64
	if err := r.db.QueryRow(ctx, countQuery).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count pending review articles: %w", err)
	}

	const query = `
		select
			a.id, a.module_id, m.slug, m.name, a.author_id, u.username,
			a.title, a.slug, a.summary, a.content_md, a.status, a.review_note,
			a.published_at, a.created_at, a.updated_at
		from articles a
		join modules m on m.id = a.module_id
		join users u on u.id = a.author_id
		where a.status = 'pending_review' and a.deleted_at is null
		order by a.created_at asc, a.id asc
		limit $1 offset $2
	`

	items, err := r.scanMany(ctx, query, pageSize, (page-1)*pageSize)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) Approve(ctx context.Context, id int64, input ReviewArticleInput) (Article, error) {
	const query = `
		update articles
		set
			status = 'published',
			reviewed_by = $2,
			reviewed_at = now(),
			review_note = $3,
			published_at = now(),
			updated_at = now()
		where id = $1 and status = 'pending_review' and deleted_at is null
		returning id
	`

	return r.review(ctx, query, id, input)
}

func (r *Repository) Reject(ctx context.Context, id int64, input ReviewArticleInput) (Article, error) {
	const query = `
		update articles
		set
			status = 'rejected',
			reviewed_by = $2,
			reviewed_at = now(),
			review_note = $3,
			updated_at = now()
		where id = $1 and status = 'pending_review' and deleted_at is null
		returning id
	`

	return r.review(ctx, query, id, input)
}

func (r *Repository) Archive(ctx context.Context, id int64) (Article, error) {
	const query = `
		update articles
		set status = 'archived', updated_at = now()
		where id = $1 and status = 'published' and deleted_at is null
		returning id
	`
	return r.updateStatus(ctx, query, id)
}

func (r *Repository) RestoreArchived(ctx context.Context, id int64) (Article, error) {
	const query = `
		update articles
		set status = 'published', updated_at = now()
		where id = $1 and status = 'archived' and deleted_at is null
		returning id
	`
	return r.updateStatus(ctx, query, id)
}

func (r *Repository) updateStatus(ctx context.Context, query string, id int64) (Article, error) {
	var updatedID int64
	err := r.db.QueryRow(ctx, query, id).Scan(&updatedID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Article{}, ErrConflict
	}
	if err != nil {
		return Article{}, fmt.Errorf("update article status: %w", err)
	}

	const findQuery = `
		select
			a.id, a.module_id, m.slug, m.name, a.author_id, u.username,
			a.title, a.slug, a.summary, a.content_md, a.status, a.review_note,
			a.published_at, a.created_at, a.updated_at
		from articles a
		join modules m on m.id = a.module_id
		join users u on u.id = a.author_id
		where a.id = $1 and a.deleted_at is null
	`
	return r.scanOne(ctx, findQuery, updatedID)
}

func (r *Repository) review(ctx context.Context, query string, id int64, input ReviewArticleInput) (Article, error) {
	var reviewedID int64
	err := r.db.QueryRow(ctx, query, id, input.ReviewerID, input.ReviewNote).Scan(&reviewedID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Article{}, ErrConflict
	}
	if err != nil {
		return Article{}, fmt.Errorf("review article: %w", err)
	}

	const findQuery = `
		select
			a.id, a.module_id, m.slug, m.name, a.author_id, u.username,
			a.title, a.slug, a.summary, a.content_md, a.status, a.review_note,
			a.published_at, a.created_at, a.updated_at
		from articles a
		join modules m on m.id = a.module_id
		join users u on u.id = a.author_id
		where a.id = $1 and a.deleted_at is null
	`
	return r.scanOne(ctx, findQuery, reviewedID)
}

func (r *Repository) scanMany(ctx context.Context, query string, args ...interface{}) ([]Article, error) {
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query articles: %w", err)
	}
	defer rows.Close()

	var items []Article
	for rows.Next() {
		item, err := scanArticle(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate articles: %w", err)
	}
	return items, nil
}

func (r *Repository) scanOne(ctx context.Context, query string, args ...interface{}) (Article, error) {
	row := r.db.QueryRow(ctx, query, args...)
	item, err := scanArticle(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return Article{}, ErrNotFound
	}
	if err != nil {
		return Article{}, err
	}
	return item, nil
}

type articleScanner interface {
	Scan(dest ...interface{}) error
}

func scanArticle(scanner articleScanner) (Article, error) {
	var item Article
	err := scanner.Scan(
		&item.ID,
		&item.ModuleID,
		&item.ModuleSlug,
		&item.ModuleName,
		&item.AuthorID,
		&item.AuthorUsername,
		&item.Title,
		&item.Slug,
		&item.Summary,
		&item.ContentMD,
		&item.Status,
		&item.ReviewNote,
		&item.PublishedAt,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		return Article{}, fmt.Errorf("scan article: %w", err)
	}
	return item, nil
}
