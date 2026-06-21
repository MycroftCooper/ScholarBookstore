package notifications

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

func (r *Repository) CreateCommentReply(ctx context.Context, tx pgx.Tx, input CreateCommentReplyInput) error {
	const query = `
		insert into notifications (recipient_id, actor_id, type, article_id, comment_id)
		values ($1, $2, 'comment_reply', $3, $4)
	`
	if _, err := tx.Exec(ctx, query, input.RecipientID, input.ActorID, input.ArticleID, input.CommentID); err != nil {
		return fmt.Errorf("create comment reply notification: %w", err)
	}
	return nil
}

func (r *Repository) CreateArticleComment(ctx context.Context, tx pgx.Tx, input CreateArticleCommentInput) error {
	const query = `
		insert into notifications (recipient_id, actor_id, type, article_id, comment_id)
		values ($1, $2, 'article_comment', $3, $4)
	`
	if _, err := tx.Exec(ctx, query, input.RecipientID, input.ActorID, input.ArticleID, input.CommentID); err != nil {
		return fmt.Errorf("create article comment notification: %w", err)
	}
	return nil
}

func (r *Repository) CreateArticleBookmark(ctx context.Context, tx pgx.Tx, input CreateArticleBookmarkInput) error {
	const query = `
		insert into notifications (recipient_id, actor_id, type, article_id)
		values ($1, $2, 'article_bookmark', $3)
	`
	if _, err := tx.Exec(ctx, query, input.RecipientID, input.ActorID, input.ArticleID); err != nil {
		return fmt.Errorf("create article bookmark notification: %w", err)
	}
	return nil
}

func (r *Repository) ListMineWithPool(ctx context.Context, recipientID int64, unreadOnly bool, page int, pageSize int) ([]Notification, int64, error) {
	return r.ListMine(ctx, r.db, recipientID, unreadOnly, page, pageSize)
}

func (r *Repository) UnreadCountWithPool(ctx context.Context, recipientID int64) (int64, error) {
	return r.UnreadCount(ctx, r.db, recipientID)
}

func (r *Repository) MarkReadWithPool(ctx context.Context, recipientID int64, id int64) error {
	return r.MarkRead(ctx, r.db, recipientID, id)
}

func (r *Repository) MarkAllReadWithPool(ctx context.Context, recipientID int64) (int64, error) {
	return r.MarkAllRead(ctx, r.db, recipientID)
}

func (r *Repository) ListMine(ctx context.Context, db queryer, recipientID int64, unreadOnly bool, page int, pageSize int) ([]Notification, int64, error) {
	args := []interface{}{recipientID}
	filter := "n.recipient_id = $1 and n.deleted_at is null"
	if unreadOnly {
		filter += " and n.read_at is null"
	}

	countQuery := fmt.Sprintf(`
		select count(*)
		from notifications n
		where %s
	`, filter)

	var total int64
	if err := db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count notifications: %w", err)
	}

	args = append(args, pageSize, (page-1)*pageSize)
	query := fmt.Sprintf(`
		select
			n.id, n.recipient_id, n.actor_id, u.username, n.type,
			n.article_id, a.title, n.comment_id, n.read_at, n.created_at
		from notifications n
		join users u on u.id = n.actor_id
		left join articles a on a.id = n.article_id
		where %s
		order by n.created_at desc, n.id desc
		limit $%d offset $%d
	`, filter, len(args)-1, len(args))

	rows, err := db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query notifications: %w", err)
	}
	defer rows.Close()

	var items []Notification
	for rows.Next() {
		item, err := scanNotification(rows)
		if err != nil {
			return nil, 0, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate notifications: %w", err)
	}
	return items, total, nil
}

func (r *Repository) UnreadCount(ctx context.Context, db queryer, recipientID int64) (int64, error) {
	const query = `
		select count(*)
		from notifications
		where recipient_id = $1 and read_at is null and deleted_at is null
	`
	var count int64
	if err := db.QueryRow(ctx, query, recipientID).Scan(&count); err != nil {
		return 0, fmt.Errorf("count unread notifications: %w", err)
	}
	return count, nil
}

func (r *Repository) MarkRead(ctx context.Context, db execer, recipientID int64, id int64) error {
	const query = `
		update notifications
		set read_at = coalesce(read_at, now())
		where id = $1 and recipient_id = $2 and deleted_at is null
	`
	tag, err := db.Exec(ctx, query, id, recipientID)
	if err != nil {
		return fmt.Errorf("mark notification read: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repository) MarkAllRead(ctx context.Context, db execer, recipientID int64) (int64, error) {
	const query = `
		update notifications
		set read_at = now()
		where recipient_id = $1 and read_at is null and deleted_at is null
	`
	tag, err := db.Exec(ctx, query, recipientID)
	if err != nil {
		return 0, fmt.Errorf("mark all notifications read: %w", err)
	}
	return tag.RowsAffected(), nil
}

var ErrNotFound = errors.New("notification not found")

type queryer interface {
	QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row
	Query(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error)
}

type execer interface {
	Exec(ctx context.Context, sql string, args ...interface{}) (pgconn.CommandTag, error)
}

type notificationScanner interface {
	Scan(dest ...interface{}) error
}

func scanNotification(scanner notificationScanner) (Notification, error) {
	var item Notification
	if err := scanner.Scan(
		&item.ID,
		&item.RecipientID,
		&item.ActorID,
		&item.ActorUsername,
		&item.Type,
		&item.ArticleID,
		&item.ArticleTitle,
		&item.CommentID,
		&item.ReadAt,
		&item.CreatedAt,
	); err != nil {
		return Notification{}, fmt.Errorf("scan notification: %w", err)
	}
	return item, nil
}
