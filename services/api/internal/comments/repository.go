package comments

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

func (r *Repository) Begin(ctx context.Context) (pgx.Tx, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin comments tx: %w", err)
	}
	return tx, nil
}

func (r *Repository) ListByArticle(ctx context.Context, articleID int64, page int, pageSize int) ([]Comment, int64, error) {
	const articleQuery = `
		select exists (
			select 1 from articles
			where id = $1 and status = 'published' and deleted_at is null
		)
	`
	var exists bool
	if err := r.db.QueryRow(ctx, articleQuery, articleID).Scan(&exists); err != nil {
		return nil, 0, fmt.Errorf("check article: %w", err)
	}
	if !exists {
		return nil, 0, ErrNotFound
	}

	const countQuery = `
		select count(*)
		from comments
		where article_id = $1 and visibility = 'visible' and deleted_at is null
	`
	var total int64
	if err := r.db.QueryRow(ctx, countQuery, articleID).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count comments: %w", err)
	}

	const query = `
		select
			c.id, c.article_id, c.author_id, u.username, c.parent_id,
			c.reply_to_user_id, ru.username, c.content, c.visibility,
			c.created_at, c.updated_at
		from comments c
		join users u on u.id = c.author_id
		left join users ru on ru.id = c.reply_to_user_id
		where c.article_id = $1 and c.visibility = 'visible' and c.deleted_at is null
		order by coalesce(c.parent_id, c.id) asc, c.parent_id nulls first, c.created_at asc
		limit $2 offset $3
	`
	items, err := r.scanMany(ctx, query, articleID, pageSize, (page-1)*pageSize)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) ListMine(ctx context.Context, authorID int64, page int, pageSize int) ([]Comment, int64, error) {
	const countQuery = `
		select count(*)
		from comments
		where author_id = $1 and deleted_at is null
	`
	var total int64
	if err := r.db.QueryRow(ctx, countQuery, authorID).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count my comments: %w", err)
	}

	const query = `
		select
			c.id, c.article_id, c.author_id, u.username, c.parent_id,
			c.reply_to_user_id, ru.username, c.content, c.visibility,
			c.created_at, c.updated_at
		from comments c
		join users u on u.id = c.author_id
		left join users ru on ru.id = c.reply_to_user_id
		where c.author_id = $1 and c.deleted_at is null
		order by c.created_at desc, c.id desc
		limit $2 offset $3
	`
	items, err := r.scanMany(ctx, query, authorID, pageSize, (page-1)*pageSize)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) CreateTopLevel(ctx context.Context, authorID int64, articleID int64, content string) (Comment, error) {
	const query = `
		insert into comments (article_id, author_id, content)
		select $1, $2, $3
		where exists (
			select 1 from articles
			where id = $1 and status = 'published' and deleted_at is null
		)
		returning id
	`
	var id int64
	if err := r.db.QueryRow(ctx, query, articleID, authorID, content).Scan(&id); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Comment{}, ErrNotFound
		}
		return Comment{}, fmt.Errorf("create comment: %w", err)
	}
	return r.FindVisibleByID(ctx, id)
}

func (r *Repository) FindPublishedArticleForComment(ctx context.Context, tx pgx.Tx, articleID int64) (CommentableArticle, error) {
	const query = `
		select id, author_id
		from articles
		where id = $1 and status = 'published' and deleted_at is null
	`
	var article CommentableArticle
	err := tx.QueryRow(ctx, query, articleID).Scan(&article.ID, &article.AuthorID)
	if errors.Is(err, pgx.ErrNoRows) {
		return CommentableArticle{}, ErrNotFound
	}
	if err != nil {
		return CommentableArticle{}, fmt.Errorf("find commentable article: %w", err)
	}
	return article, nil
}

func (r *Repository) CreateTopLevelTx(ctx context.Context, tx pgx.Tx, authorID int64, articleID int64, content string) (Comment, error) {
	const query = `
		insert into comments (article_id, author_id, content)
		values ($1, $2, $3)
		returning id
	`
	var id int64
	if err := tx.QueryRow(ctx, query, articleID, authorID, content).Scan(&id); err != nil {
		return Comment{}, fmt.Errorf("create comment: %w", err)
	}
	return r.FindVisibleByIDTx(ctx, tx, id)
}

func (r *Repository) FindParentForReply(ctx context.Context, tx pgx.Tx, id int64) (ParentComment, error) {
	const query = `
		select c.id, c.article_id, c.author_id
		from comments c
		join articles a on a.id = c.article_id
		where c.id = $1
			and c.visibility = 'visible'
			and c.deleted_at is null
			and a.status = 'published'
			and a.deleted_at is null
	`
	var parent ParentComment
	err := tx.QueryRow(ctx, query, id).Scan(&parent.ID, &parent.ArticleID, &parent.AuthorID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ParentComment{}, ErrNotFound
	}
	if err != nil {
		return ParentComment{}, fmt.Errorf("find parent comment: %w", err)
	}
	return parent, nil
}

func (r *Repository) CreateReply(ctx context.Context, tx pgx.Tx, authorID int64, parent ParentComment, content string) (Comment, error) {
	const query = `
		insert into comments (article_id, author_id, parent_id, reply_to_user_id, content)
		values ($1, $2, $3, $4, $5)
		returning id
	`
	var id int64
	if err := tx.QueryRow(ctx, query, parent.ArticleID, authorID, parent.ID, parent.AuthorID, content).Scan(&id); err != nil {
		return Comment{}, fmt.Errorf("create reply: %w", err)
	}
	return r.FindVisibleByIDTx(ctx, tx, id)
}

func (r *Repository) Delete(ctx context.Context, id int64, userID int64, canDeleteAny bool) error {
	query := `
		update comments
		set deleted_at = now(), updated_at = now()
		where id = $1 and deleted_at is null
	`
	args := []interface{}{id}
	if !canDeleteAny {
		query += " and author_id = $2"
		args = append(args, userID)
	}

	tag, err := r.db.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("delete comment: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repository) FindVisibleByID(ctx context.Context, id int64) (Comment, error) {
	return r.findVisible(ctx, r.db, id)
}

func (r *Repository) FindVisibleByIDTx(ctx context.Context, tx pgx.Tx, id int64) (Comment, error) {
	return r.findVisible(ctx, tx, id)
}

type queryer interface {
	QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row
	Query(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error)
}

func (r *Repository) findVisible(ctx context.Context, q queryer, id int64) (Comment, error) {
	const query = `
		select
			c.id, c.article_id, c.author_id, u.username, c.parent_id,
			c.reply_to_user_id, ru.username, c.content, c.visibility,
			c.created_at, c.updated_at
		from comments c
		join users u on u.id = c.author_id
		left join users ru on ru.id = c.reply_to_user_id
		where c.id = $1 and c.visibility = 'visible' and c.deleted_at is null
	`
	item, err := scanComment(q.QueryRow(ctx, query, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return Comment{}, ErrNotFound
	}
	if err != nil {
		return Comment{}, err
	}
	return item, nil
}

func (r *Repository) scanMany(ctx context.Context, query string, args ...interface{}) ([]Comment, error) {
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query comments: %w", err)
	}
	defer rows.Close()

	var items []Comment
	for rows.Next() {
		item, err := scanComment(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate comments: %w", err)
	}
	return items, nil
}

type commentScanner interface {
	Scan(dest ...interface{}) error
}

func scanComment(scanner commentScanner) (Comment, error) {
	var item Comment
	if err := scanner.Scan(
		&item.ID,
		&item.ArticleID,
		&item.AuthorID,
		&item.AuthorUsername,
		&item.ParentID,
		&item.ReplyToUserID,
		&item.ReplyToUsername,
		&item.Content,
		&item.Visibility,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		return Comment{}, fmt.Errorf("scan comment: %w", err)
	}
	return item, nil
}
