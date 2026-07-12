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
	if err := r.createReportTask(ctx, id); err != nil {
		return Report{}, err
	}
	return r.FindByID(ctx, id)
}

func (r *Repository) CreateUser(ctx context.Context, username string, reporterID int64, reason string) (UserReport, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return UserReport{}, fmt.Errorf("begin user report: %w", err)
	}
	defer tx.Rollback(ctx)

	var reportedUserID int64
	err = tx.QueryRow(ctx, `
		select id
		from users
		where lower(username) = lower($1) and status = 'active' and deleted_at is null
	`, username).Scan(&reportedUserID)
	if errors.Is(err, pgx.ErrNoRows) {
		return UserReport{}, ErrNotFound
	}
	if err != nil {
		return UserReport{}, fmt.Errorf("find reported user: %w", err)
	}
	if reportedUserID == reporterID {
		return UserReport{}, ErrInvalidInput
	}

	var id int64
	err = tx.QueryRow(ctx, `
		insert into user_reports (reported_user_id, reporter_id, reason)
		values ($1, $2, $3)
		returning id
	`, reportedUserID, reporterID, reason).Scan(&id)
	if err != nil {
		if isUniqueViolation(err) {
			return UserReport{}, ErrConflict
		}
		return UserReport{}, fmt.Errorf("create user report: %w", err)
	}
	if err := r.createUserReportTask(ctx, tx, id); err != nil {
		return UserReport{}, err
	}
	item, err := r.findUserReportByID(ctx, tx, id)
	if err != nil {
		return UserReport{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return UserReport{}, fmt.Errorf("commit user report: %w", err)
	}
	return item, nil
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

func (r *Repository) Resolve(ctx context.Context, id int64, reviewerID int64, status string, note string, archiveArticle bool) (Report, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return Report{}, fmt.Errorf("begin resolve report: %w", err)
	}
	defer tx.Rollback(ctx)

	var updatedID int64
	var articleID int64
	err = tx.QueryRow(ctx, `
		update article_reports
		set status = $2, handled_by = $3, handled_at = now(), handle_note = $4, updated_at = now()
		where id = $1 and status = 'pending' and deleted_at is null
		returning id, article_id
	`, id, status, reviewerID, note).Scan(&updatedID, &articleID)
	if errors.Is(err, pgx.ErrNoRows) {
		exists, err := r.reportExists(ctx, tx, id)
		if err != nil {
			return Report{}, err
		}
		if exists {
			return Report{}, ErrConflict
		}
		return Report{}, ErrNotFound
	}
	if err != nil {
		return Report{}, fmt.Errorf("resolve report: %w", err)
	}

	if archiveArticle {
		cmd, err := tx.Exec(ctx, `
			update articles
			set status = 'archived', updated_at = now()
			where id = $1 and status = 'published' and deleted_at is null
		`, articleID)
		if err != nil {
			return Report{}, fmt.Errorf("archive reported article: %w", err)
		}
		if cmd.RowsAffected() == 0 {
			return Report{}, ErrConflict
		}
	}

	item, err := r.findByID(ctx, tx, updatedID)
	if err != nil {
		return Report{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Report{}, fmt.Errorf("commit resolve report: %w", err)
	}
	return item, nil
}

func (r *Repository) FindByID(ctx context.Context, id int64) (Report, error) {
	return r.findByID(ctx, r.db, id)
}

func (r *Repository) reportExists(ctx context.Context, db queryer, id int64) (bool, error) {
	var exists bool
	err := db.QueryRow(ctx, `
		select exists (
			select 1 from article_reports
			where id = $1 and deleted_at is null
		)
	`, id).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("check report existence: %w", err)
	}
	return exists, nil
}

func (r *Repository) createReportTask(ctx context.Context, reportID int64) error {
	const query = `
		insert into moderation_tasks (
			task_type, object_type, object_id, domain_id, module_id,
			title, summary, status, priority, submitter_id, assignee_id
		)
		select
			'content_report',
			'article_report',
			ar.id,
			m.domain_id,
			m.id,
			'文章举报：' || a.title,
			left(ar.reason, 500),
			'pending',
			1,
			ar.reporter_id,
			coalesce(mm.user_id, domain_owner.user_id, admin_user.id)
		from article_reports ar
		join articles a on a.id = ar.article_id
		join modules m on m.id = a.module_id
		left join lateral (
			select user_id
			from module_moderators
			where module_id = m.id
			order by created_at asc, user_id asc
			limit 1
		) mm on true
		left join lateral (
			select user_id
			from domain_owners
			where domain_id = m.domain_id
			order by created_at asc, user_id asc
			limit 1
		) domain_owner on mm.user_id is null
		left join lateral (
			select id
			from users
			where role = 'admin' and status = 'active' and deleted_at is null
			order by id asc
			limit 1
		) admin_user on mm.user_id is null and domain_owner.user_id is null
		where ar.id = $1
			and ar.status = 'pending'
			and ar.deleted_at is null
		on conflict (task_type, object_type, object_id)
		where status in ('pending', 'processing')
		do update set
			title = excluded.title,
			summary = excluded.summary,
			domain_id = excluded.domain_id,
			module_id = excluded.module_id,
			submitter_id = excluded.submitter_id,
			assignee_id = excluded.assignee_id,
			updated_at = now()
	`
	if _, err := r.db.Exec(ctx, query, reportID); err != nil {
		return fmt.Errorf("create report task: %w", err)
	}
	return nil
}

func (r *Repository) createUserReportTask(ctx context.Context, db execQueryer, reportID int64) error {
	const query = `
		insert into moderation_tasks (
			task_type, object_type, object_id, domain_id, module_id,
			title, summary, status, priority, submitter_id, assignee_id
		)
		select
			'user_report',
			'user_report',
			ur.id,
			null,
			null,
			'用户举报：' || reported.username,
			left(ur.reason, 500),
			'pending',
			1,
			ur.reporter_id,
			admin_user.id
		from user_reports ur
		join users reported on reported.id = ur.reported_user_id
		left join lateral (
			select id
			from users
			where role = 'admin' and status = 'active' and deleted_at is null
			order by id asc
			limit 1
		) admin_user on true
		where ur.id = $1
			and ur.status = 'pending'
			and ur.deleted_at is null
		on conflict (task_type, object_type, object_id)
		where status in ('pending', 'processing')
		do update set
			title = excluded.title,
			summary = excluded.summary,
			submitter_id = excluded.submitter_id,
			assignee_id = excluded.assignee_id,
			updated_at = now()
	`
	if _, err := db.Exec(ctx, query, reportID); err != nil {
		return fmt.Errorf("create user report task: %w", err)
	}
	return nil
}

func (r *Repository) findUserReportByID(ctx context.Context, db queryer, id int64) (UserReport, error) {
	const query = `
		select
			ur.id, ur.reported_user_id, reported.username, ur.reporter_id, reporter.username,
			ur.reason, ur.status, ur.handled_by, handler.username,
			ur.handled_at, ur.handle_note, ur.created_at, ur.updated_at
		from user_reports ur
		join users reported on reported.id = ur.reported_user_id
		join users reporter on reporter.id = ur.reporter_id
		left join users handler on handler.id = ur.handled_by
		where ur.id = $1 and ur.deleted_at is null
	`
	item, err := scanUserReport(db.QueryRow(ctx, query, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return UserReport{}, ErrNotFound
	}
	if err != nil {
		return UserReport{}, err
	}
	return item, nil
}

func (r *Repository) findByID(ctx context.Context, db queryer, id int64) (Report, error) {
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
	item, err := scanReport(db.QueryRow(ctx, query, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return Report{}, ErrNotFound
	}
	if err != nil {
		return Report{}, err
	}
	return item, nil
}

type queryer interface {
	QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row
}

type execQueryer interface {
	queryer
	Exec(ctx context.Context, sql string, arguments ...interface{}) (pgconn.CommandTag, error)
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

func scanUserReport(scanner reportScanner) (UserReport, error) {
	var item UserReport
	if err := scanner.Scan(
		&item.ID, &item.ReportedUserID, &item.ReportedUsername, &item.ReporterID, &item.ReporterName,
		&item.Reason, &item.Status, &item.HandledBy, &item.HandledByName,
		&item.HandledAt, &item.HandleNote, &item.CreatedAt, &item.UpdatedAt,
	); err != nil {
		return UserReport{}, fmt.Errorf("scan user report: %w", err)
	}
	return item, nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
