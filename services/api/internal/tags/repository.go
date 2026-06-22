package tags

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

func (r *Repository) List(ctx context.Context, filter Filter, page int, pageSize int) ([]Tag, int64, error) {
	args := []interface{}{}
	where := "true"
	if filter.Query != "" {
		args = append(args, "%"+filter.Query+"%")
		where += fmt.Sprintf(" and (name ilike $%d or slug ilike $%d)", len(args), len(args))
	}

	countQuery := fmt.Sprintf("select count(*) from tags where %s", where)
	var total int64
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count tags: %w", err)
	}

	args = append(args, pageSize, (page-1)*pageSize)
	query := fmt.Sprintf(`
		select id, name, slug, usage_count, created_at, updated_at
		from tags
		where %s
		order by usage_count desc, name asc, id asc
		limit $%d offset $%d
	`, where, len(args)-1, len(args))

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query tags: %w", err)
	}
	defer rows.Close()

	var items []Tag
	for rows.Next() {
		item, err := scanTag(rows)
		if err != nil {
			return nil, 0, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate tags: %w", err)
	}
	return items, total, nil
}

func (r *Repository) Update(ctx context.Context, id int64, input UpdateInput) (Tag, error) {
	const query = `
		update tags
		set name = $2, slug = $3, updated_at = now()
		where id = $1
		returning id, name, slug, usage_count, created_at, updated_at
	`
	item, err := scanTag(r.db.QueryRow(ctx, query, id, input.Name, tagSlug(input.Name)))
	if errors.Is(err, pgx.ErrNoRows) {
		return Tag{}, ErrNotFound
	}
	if err != nil {
		if isUniqueViolation(err) {
			return Tag{}, ErrConflict
		}
		return Tag{}, err
	}
	return item, nil
}

func (r *Repository) Delete(ctx context.Context, id int64) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin delete tag: %w", err)
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `delete from article_tags where tag_id = $1`, id); err != nil {
		return fmt.Errorf("delete article tag links: %w", err)
	}
	cmd, err := tx.Exec(ctx, `delete from tags where id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete tag: %w", err)
	}
	if cmd.RowsAffected() == 0 {
		return ErrNotFound
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit delete tag: %w", err)
	}
	return nil
}

func (r *Repository) Merge(ctx context.Context, input MergeInput) (Tag, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return Tag{}, fmt.Errorf("begin merge tags: %w", err)
	}
	defer tx.Rollback(ctx)

	var targetID int64
	if err := tx.QueryRow(ctx, `select id from tags where id = $1 for update`, input.TargetID).Scan(&targetID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Tag{}, ErrNotFound
		}
		return Tag{}, fmt.Errorf("find target tag: %w", err)
	}

	rows, err := tx.Query(ctx, `select id from tags where id = any($1) for update`, input.SourceIDs)
	if err != nil {
		return Tag{}, fmt.Errorf("find source tags: %w", err)
	}
	found := map[int64]struct{}{}
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return Tag{}, fmt.Errorf("scan source tag: %w", err)
		}
		found[id] = struct{}{}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return Tag{}, fmt.Errorf("iterate source tags: %w", err)
	}
	rows.Close()
	if len(found) != len(input.SourceIDs) {
		return Tag{}, ErrNotFound
	}

	if _, err := tx.Exec(ctx, `
		insert into article_tags (article_id, tag_id)
		select article_id, $1
		from article_tags
		where tag_id = any($2)
		on conflict do nothing
	`, input.TargetID, input.SourceIDs); err != nil {
		return Tag{}, fmt.Errorf("move article tag links: %w", err)
	}
	if _, err := tx.Exec(ctx, `delete from article_tags where tag_id = any($1)`, input.SourceIDs); err != nil {
		return Tag{}, fmt.Errorf("delete source tag links: %w", err)
	}
	if _, err := tx.Exec(ctx, `delete from tags where id = any($1)`, input.SourceIDs); err != nil {
		return Tag{}, fmt.Errorf("delete source tags: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		update tags
		set usage_count = (
			select count(*) from article_tags where tag_id = tags.id
		), updated_at = now()
		where id = $1
	`, input.TargetID); err != nil {
		return Tag{}, fmt.Errorf("refresh target tag usage: %w", err)
	}

	item, err := scanTag(tx.QueryRow(ctx, `
		select id, name, slug, usage_count, created_at, updated_at
		from tags
		where id = $1
	`, input.TargetID))
	if err != nil {
		return Tag{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Tag{}, fmt.Errorf("commit merge tags: %w", err)
	}
	return item, nil
}

type tagScanner interface {
	Scan(dest ...interface{}) error
}

func scanTag(scanner tagScanner) (Tag, error) {
	var item Tag
	if err := scanner.Scan(
		&item.ID,
		&item.Name,
		&item.Slug,
		&item.UsageCount,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		return Tag{}, fmt.Errorf("scan tag: %w", err)
	}
	return item, nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
