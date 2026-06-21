package reports

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

func (r *Repository) Create(ctx context.Context, articleID int64, reporterID int64, reason string) (Report, error) {
	const query = `
		insert into article_reports (article_id, reporter_id, reason)
		select $1, $2, $3
		where exists (
			select 1 from articles
			where id = $1 and status = 'published' and deleted_at is null
		)
		returning id
	`
	var id int64
	err := r.db.QueryRow(ctx, query, articleID, reporterID, reason).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Report{}, ErrNotFound
	}
	if err != nil {
		if isUniqueViolation(err) {
			return Report{}, ErrConflict
		}
		return Report{}, fmt.Errorf("create article report: %w", err)
	}
	return r.FindByID(ctx, id)
}

func (r *Repository) ListAdmin(ctx context.Context, status string, page int, pageSize int) ([]Report, int64, error) {
	args := []interface{}{}
	filter := "ar.deleted_at is null"
	if status != "" {
		args = append(args, status)
		filter += fmt.Sprintf(" and ar.status = $%d", len(args))
	}
	countQuery := fmt.Sprintf(`select count(*) from article_reports ar where %s`, filter)
	var total int64
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count reports: %w", err)
	}
	args = append(args, pageSize, (page-1)*pageSize)
	query := fmt.Sprintf(`
		select
			ar.id, ar.article_id, a.title, ar.reporter_id, reporter.username,
			ar.reason, ar.status, ar.handled_by, handler.username,
			ar.handled_at, ar.handle_note, ar.created_at, ar.updated_at
		from article_reports ar
		join articles a on a.id = ar.article_id
		join users reporter on reporter.id = ar.reporter_id
		left join users handler on handler.id = ar.handled_by
		where %s
		order by ar.created_at desc, ar.id desc
		limit $%d offset $%d
	`, filter, len(args)-1, len(args))
	items, err := r.scanMany(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) Resolve(ctx context.Context, id int64, reviewerID int64, status string, note string) (Report, error) {
	const query = `
		update article_reports
		set status = $2, handled_by = $3, handled_at = now(), handle_note = $4, updated_at = now()
		where id = $1 and status = 'pending' and deleted_at is null
		returning id
	`
	var updatedID int64
	err := r.db.QueryRow(ctx, query, id, status, reviewerID, note).Scan(&updatedID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Report{}, ErrNotFound
	}
	if err != nil {
		return Report{}, fmt.Errorf("resolve report: %w", err)
	}
	return r.FindByID(ctx, updatedID)
}

func (r *Repository) FindByID(ctx context.Context, id int64) (Report, error) {
	const query = `
		select
			ar.id, ar.article_id, a.title, ar.reporter_id, reporter.username,
			ar.reason, ar.status, ar.handled_by, handler.username,
			ar.handled_at, ar.handle_note, ar.created_at, ar.updated_at
		from article_reports ar
		join articles a on a.id = ar.article_id
		join users reporter on reporter.id = ar.reporter_id
		left join users handler on handler.id = ar.handled_by
		where ar.id = $1 and ar.deleted_at is null
	`
	item, err := scanReport(r.db.QueryRow(ctx, query, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return Report{}, ErrNotFound
	}
	if err != nil {
		return Report{}, err
	}
	return item, nil
}

func (r *Repository) scanMany(ctx context.Context, query string, args ...interface{}) ([]Report, error) {
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query reports: %w", err)
	}
	defer rows.Close()
	var items []Report
	for rows.Next() {
		item, err := scanReport(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate reports: %w", err)
	}
	return items, nil
}

type reportScanner interface {
	Scan(dest ...interface{}) error
}

func scanReport(scanner reportScanner) (Report, error) {
	var item Report
	if err := scanner.Scan(
		&item.ID, &item.ArticleID, &item.ArticleTitle, &item.ReporterID, &item.ReporterName,
		&item.Reason, &item.Status, &item.HandledBy, &item.HandledByName,
		&item.HandledAt, &item.HandleNote, &item.CreatedAt, &item.UpdatedAt,
	); err != nil {
		return Report{}, fmt.Errorf("scan report: %w", err)
	}
	return item, nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
