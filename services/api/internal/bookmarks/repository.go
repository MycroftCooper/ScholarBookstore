package bookmarks

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

type BookmarkableArticle struct {
	ID       int64
	AuthorID int64
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Begin(ctx context.Context) (pgx.Tx, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin bookmarks tx: %w", err)
	}
	return tx, nil
}

func (r *Repository) FindPublishedArticle(ctx context.Context, tx pgx.Tx, articleID int64) (BookmarkableArticle, error) {
	const query = `
		select id, author_id
		from articles
		where id = $1 and status = 'published' and deleted_at is null
	`
	var article BookmarkableArticle
	err := tx.QueryRow(ctx, query, articleID).Scan(&article.ID, &article.AuthorID)
	if errors.Is(err, pgx.ErrNoRows) {
		return BookmarkableArticle{}, ErrNotFound
	}
	if err != nil {
		return BookmarkableArticle{}, fmt.Errorf("find bookmarkable article: %w", err)
	}
	return article, nil
}

func (r *Repository) EnsureDefaultCollection(ctx context.Context, tx pgx.Tx, userID int64) (Collection, error) {
	item, err := r.findDefaultCollection(ctx, tx, userID)
	if err == nil {
		return item, nil
	}
	if !errors.Is(err, ErrNotFound) {
		return Collection{}, err
	}

	const insertQuery = `
		insert into bookmark_collections (user_id, name, is_default)
		values ($1, 'Default', true)
		returning id, user_id, name, is_default, 0::bigint, created_at, updated_at
	`
	item, err = scanCollection(tx.QueryRow(ctx, insertQuery, userID))
	if err == nil {
		return item, nil
	}
	if isUniqueViolation(err) {
		return r.findDefaultCollection(ctx, tx, userID)
	}
	return Collection{}, fmt.Errorf("create default bookmark collection: %w", err)
}

func (r *Repository) FindCollectionForUser(ctx context.Context, tx pgx.Tx, userID int64, collectionID int64) (Collection, error) {
	const query = `
		select
			id, user_id, name, is_default,
			(select count(*) from article_bookmarks b where b.collection_id = bookmark_collections.id and b.deleted_at is null) as item_count,
			created_at, updated_at
		from bookmark_collections
		where id = $1 and user_id = $2 and deleted_at is null
	`
	item, err := scanCollection(tx.QueryRow(ctx, query, collectionID, userID))
	if errors.Is(err, pgx.ErrNoRows) {
		return Collection{}, ErrNotFound
	}
	if err != nil {
		return Collection{}, err
	}
	return item, nil
}

func (r *Repository) CreateCollection(ctx context.Context, userID int64, name string) (Collection, error) {
	const query = `
		insert into bookmark_collections (user_id, name, is_default)
		values ($1, $2, false)
		returning id, user_id, name, is_default, 0::bigint, created_at, updated_at
	`
	item, err := scanCollection(r.db.QueryRow(ctx, query, userID, name))
	if err != nil {
		if isUniqueViolation(err) {
			return Collection{}, ErrConflict
		}
		return Collection{}, fmt.Errorf("create bookmark collection: %w", err)
	}
	return item, nil
}

func (r *Repository) UpdateCollection(ctx context.Context, userID int64, collectionID int64, name string) (Collection, error) {
	const query = `
		update bookmark_collections
		set name = $3, updated_at = now()
		where id = $1
			and user_id = $2
			and is_default = false
			and deleted_at is null
		returning id, user_id, name, is_default,
			(select count(*) from article_bookmarks b where b.collection_id = bookmark_collections.id and b.deleted_at is null) as item_count,
			created_at, updated_at
	`
	item, err := scanCollection(r.db.QueryRow(ctx, query, collectionID, userID, name))
	if errors.Is(err, pgx.ErrNoRows) {
		return Collection{}, ErrNotFound
	}
	if err != nil {
		if isUniqueViolation(err) {
			return Collection{}, ErrConflict
		}
		return Collection{}, fmt.Errorf("update bookmark collection: %w", err)
	}
	return item, nil
}

func (r *Repository) DeleteCollection(ctx context.Context, tx pgx.Tx, userID int64, collectionID int64, fallbackCollectionID int64) error {
	const moveQuery = `
		update article_bookmarks
		set collection_id = $3
		where user_id = $1
			and collection_id = $2
			and deleted_at is null
	`
	if _, err := tx.Exec(ctx, moveQuery, userID, collectionID, fallbackCollectionID); err != nil {
		return fmt.Errorf("move bookmarks before deleting collection: %w", err)
	}

	const deleteQuery = `
		update bookmark_collections
		set deleted_at = now(), updated_at = now()
		where id = $1
			and user_id = $2
			and is_default = false
			and deleted_at is null
	`
	tag, err := tx.Exec(ctx, deleteQuery, collectionID, userID)
	if err != nil {
		return fmt.Errorf("delete bookmark collection: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *Repository) ListCollections(ctx context.Context, userID int64) ([]Collection, error) {
	const query = `
		select
			c.id, c.user_id, c.name, c.is_default,
			(select count(*) from article_bookmarks b where b.collection_id = c.id and b.deleted_at is null) as item_count,
			c.created_at, c.updated_at
		from bookmark_collections c
		where c.user_id = $1 and c.deleted_at is null
		order by c.is_default desc, c.created_at desc, c.id desc
	`
	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("query bookmark collections: %w", err)
	}
	defer rows.Close()

	var items []Collection
	for rows.Next() {
		item, err := scanCollection(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate bookmark collections: %w", err)
	}
	return items, nil
}

func (r *Repository) AddBookmark(ctx context.Context, tx pgx.Tx, userID int64, articleID int64, collectionID int64) (bool, error) {
	const query = `
		insert into article_bookmarks (collection_id, article_id, user_id)
		values ($1, $2, $3)
		on conflict (user_id, article_id) where deleted_at is null do nothing
		returning id
	`
	var id int64
	err := tx.QueryRow(ctx, query, collectionID, articleID, userID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("add article bookmark: %w", err)
	}
	return true, nil
}

func (r *Repository) MoveBookmark(ctx context.Context, userID int64, bookmarkID int64, collectionID int64) (BookmarkedArticle, error) {
	const query = `
		update article_bookmarks b
		set collection_id = $3
		where b.id = $1
			and b.user_id = $2
			and b.deleted_at is null
			and exists (
				select 1 from bookmark_collections c
				where c.id = $3 and c.user_id = $2 and c.deleted_at is null
			)
		returning b.id
	`
	var id int64
	err := r.db.QueryRow(ctx, query, bookmarkID, userID, collectionID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return BookmarkedArticle{}, ErrNotFound
	}
	if err != nil {
		return BookmarkedArticle{}, fmt.Errorf("move bookmark: %w", err)
	}
	return r.findBookmark(ctx, userID, id)
}

func (r *Repository) RemoveBookmark(ctx context.Context, userID int64, articleID int64) (State, error) {
	const query = `
		update article_bookmarks
		set deleted_at = now()
		where user_id = $1 and article_id = $2 and deleted_at is null
	`
	if _, err := r.db.Exec(ctx, query, userID, articleID); err != nil {
		return State{}, fmt.Errorf("remove article bookmark: %w", err)
	}
	return r.State(ctx, userID, articleID)
}

func (r *Repository) State(ctx context.Context, userID int64, articleID int64) (State, error) {
	const articleQuery = `
		select exists (
			select 1 from articles
			where id = $1 and status = 'published' and deleted_at is null
		)
	`
	var exists bool
	if err := r.db.QueryRow(ctx, articleQuery, articleID).Scan(&exists); err != nil {
		return State{}, fmt.Errorf("check bookmark article: %w", err)
	}
	if !exists {
		return State{}, ErrNotFound
	}

	const query = `
		select
			exists (
				select 1 from article_bookmarks
				where user_id = $1 and article_id = $2 and deleted_at is null
			) as bookmarked,
			(
				select collection_id from article_bookmarks
				where user_id = $1 and article_id = $2 and deleted_at is null
				limit 1
			) as collection_id,
			(
				select count(*) from article_bookmarks
				where article_id = $2 and deleted_at is null
			) as bookmark_count
	`
	var state State
	state.ArticleID = articleID
	if err := r.db.QueryRow(ctx, query, userID, articleID).Scan(&state.Bookmarked, &state.CollectionID, &state.BookmarkCount); err != nil {
		return State{}, fmt.Errorf("get bookmark state: %w", err)
	}
	return state, nil
}

func (r *Repository) StateTx(ctx context.Context, tx pgx.Tx, userID int64, articleID int64) (State, error) {
	const query = `
		select
			exists (
				select 1 from article_bookmarks
				where user_id = $1 and article_id = $2 and deleted_at is null
			) as bookmarked,
			(
				select collection_id from article_bookmarks
				where user_id = $1 and article_id = $2 and deleted_at is null
				limit 1
			) as collection_id,
			(
				select count(*) from article_bookmarks
				where article_id = $2 and deleted_at is null
			) as bookmark_count
	`
	var state State
	state.ArticleID = articleID
	if err := tx.QueryRow(ctx, query, userID, articleID).Scan(&state.Bookmarked, &state.CollectionID, &state.BookmarkCount); err != nil {
		return State{}, fmt.Errorf("get bookmark state: %w", err)
	}
	return state, nil
}

func (r *Repository) ListBookmarks(ctx context.Context, userID int64, collectionID *int64, page int, pageSize int) ([]BookmarkedArticle, int64, error) {
	args := []interface{}{userID}
	filter := "b.user_id = $1 and b.deleted_at is null and a.status = 'published' and a.deleted_at is null"
	if collectionID != nil {
		args = append(args, *collectionID)
		filter += fmt.Sprintf(" and b.collection_id = $%d", len(args))
	}

	countQuery := fmt.Sprintf(`
		select count(*)
		from article_bookmarks b
		join articles a on a.id = b.article_id
		where %s
	`, filter)
	var total int64
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count bookmarks: %w", err)
	}

	args = append(args, pageSize, (page-1)*pageSize)
	query := fmt.Sprintf(`
		select
			b.id, b.collection_id, c.name, a.id, a.module_id, m.slug, m.name,
			a.author_id, u.username, a.title, a.summary, a.published_at,
			a.word_count, a.reading_minutes, a.view_count, a.revision_count, b.created_at
		from article_bookmarks b
		join bookmark_collections c on c.id = b.collection_id
		join articles a on a.id = b.article_id
		join modules m on m.id = a.module_id
		join users u on u.id = a.author_id
		where %s
		order by b.created_at desc, b.id desc
		limit $%d offset $%d
	`, filter, len(args)-1, len(args))

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query bookmarks: %w", err)
	}
	defer rows.Close()

	var items []BookmarkedArticle
	for rows.Next() {
		var item BookmarkedArticle
		if err := rows.Scan(
			&item.BookmarkID,
			&item.CollectionID,
			&item.CollectionName,
			&item.ArticleID,
			&item.ModuleID,
			&item.ModuleSlug,
			&item.ModuleName,
			&item.AuthorID,
			&item.AuthorUsername,
			&item.Title,
			&item.Summary,
			&item.PublishedAt,
			&item.WordCount,
			&item.ReadingMinutes,
			&item.ViewCount,
			&item.RevisionCount,
			&item.BookmarkedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan bookmark: %w", err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate bookmarks: %w", err)
	}
	return items, total, nil
}

func (r *Repository) findBookmark(ctx context.Context, userID int64, bookmarkID int64) (BookmarkedArticle, error) {
	const query = `
		select
			b.id, b.collection_id, c.name, a.id, a.module_id, m.slug, m.name,
			a.author_id, u.username, a.title, a.summary, a.published_at,
			a.word_count, a.reading_minutes, a.view_count, a.revision_count, b.created_at
		from article_bookmarks b
		join bookmark_collections c on c.id = b.collection_id
		join articles a on a.id = b.article_id
		join modules m on m.id = a.module_id
		join users u on u.id = a.author_id
		where b.id = $1
			and b.user_id = $2
			and b.deleted_at is null
			and a.status = 'published'
			and a.deleted_at is null
	`
	var item BookmarkedArticle
	err := r.db.QueryRow(ctx, query, bookmarkID, userID).Scan(
		&item.BookmarkID,
		&item.CollectionID,
		&item.CollectionName,
		&item.ArticleID,
		&item.ModuleID,
		&item.ModuleSlug,
		&item.ModuleName,
		&item.AuthorID,
		&item.AuthorUsername,
		&item.Title,
		&item.Summary,
		&item.PublishedAt,
		&item.WordCount,
		&item.ReadingMinutes,
		&item.ViewCount,
		&item.RevisionCount,
		&item.BookmarkedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return BookmarkedArticle{}, ErrNotFound
	}
	if err != nil {
		return BookmarkedArticle{}, fmt.Errorf("find bookmark: %w", err)
	}
	return item, nil
}

func (r *Repository) findDefaultCollection(ctx context.Context, tx pgx.Tx, userID int64) (Collection, error) {
	const query = `
		select
			id, user_id, name, is_default,
			(select count(*) from article_bookmarks b where b.collection_id = bookmark_collections.id and b.deleted_at is null) as item_count,
			created_at, updated_at
		from bookmark_collections
		where user_id = $1 and is_default = true and deleted_at is null
	`
	item, err := scanCollection(tx.QueryRow(ctx, query, userID))
	if errors.Is(err, pgx.ErrNoRows) {
		return Collection{}, ErrNotFound
	}
	if err != nil {
		return Collection{}, err
	}
	return item, nil
}

type collectionScanner interface {
	Scan(dest ...interface{}) error
}

func scanCollection(scanner collectionScanner) (Collection, error) {
	var item Collection
	if err := scanner.Scan(
		&item.ID,
		&item.UserID,
		&item.Name,
		&item.IsDefault,
		&item.ItemCount,
		&item.CreatedAt,
		&item.UpdatedAt,
	); err != nil {
		return Collection{}, fmt.Errorf("scan bookmark collection: %w", err)
	}
	return item, nil
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
