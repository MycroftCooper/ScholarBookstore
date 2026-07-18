package articles

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

var tagSlugUnsafe = regexp.MustCompile(`[^\p{L}\p{N}-]+`)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) ListPublished(ctx context.Context, filter PublishedArticleFilter, page int, pageSize int) ([]Article, int64, error) {
	args := []interface{}{}
	queryArgIndex := 0
	whereClause := "a.status = 'published' and a.deleted_at is null and m.deleted_at is null and m.is_active = true and d.deleted_at is null and d.is_active = true"
	if filter.ModuleSlug != "" {
		args = append(args, filter.ModuleSlug)
		whereClause += fmt.Sprintf(" and m.slug = $%d", len(args))
	}
	if filter.Query != "" {
		args = append(args, filter.Query)
		queryArgIndex = len(args)
		whereClause += fmt.Sprintf(" and a.search_vector @@ websearch_to_tsquery('simple', $%d)", len(args))
	}
	if filter.TagSlug != "" {
		args = append(args, filter.TagSlug)
		whereClause += fmt.Sprintf(` and exists (
			select 1
			from article_tags at
			join tags t on t.id = at.tag_id
			where at.article_id = a.id and t.slug = $%d
		)`, len(args))
	}
	if filter.Featured {
		whereClause += " and a.is_featured = true"
	}

	orderBy := "a.published_at desc nulls last, a.id desc"
	if filter.Query != "" {
		orderBy = fmt.Sprintf("ts_rank_cd(a.search_vector, websearch_to_tsquery('simple', $%d)) desc, a.published_at desc nulls last, a.id desc", queryArgIndex)
	} else {
		switch filter.Sort {
		case "hot":
			orderBy = "coalesce(a.view_count, 0) / power(greatest(extract(epoch from (now() - coalesce(a.published_at, a.created_at))) / 3600, 0) + 1, 0.8) desc, a.published_at desc nulls last"
		case "random":
			orderBy = "random()"
		}
	}

	countQuery := fmt.Sprintf(`
		select count(*)
		from articles a
		join modules m on m.id = a.module_id
		join domains d on d.id = m.domain_id
		where %s
	`, whereClause)

	var total int64
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count published articles: %w", err)
	}

	args = append(args, pageSize, (page-1)*pageSize)
	query := fmt.Sprintf(`
		select
			a.id, a.module_id, m.slug, m.name, a.author_id, u.username,
			a.title, a.slug, a.summary, a.content_md, a.source_type, a.status, a.review_note,
			a.published_at, a.revision_of_article_id, a.word_count, a.reading_minutes, a.view_count, a.revision_count, a.is_featured,
			a.created_at, a.updated_at
		from articles a
		join modules m on m.id = a.module_id
		join domains d on d.id = m.domain_id
		join users u on u.id = a.author_id
		where %s
		order by %s
		limit $%d offset $%d
	`, whereClause, orderBy, len(args)-1, len(args))

	items, err := r.scanMany(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	return r.withStats(ctx, r.withTags(ctx, items)), total, nil
}

func (r *Repository) ListAdmin(ctx context.Context, filter AdminArticleFilter, page int, pageSize int) ([]Article, int64, error) {
	args := []interface{}{}
	whereClause := "a.deleted_at is null"
	if filter.Status != "" {
		args = append(args, filter.Status)
		whereClause += fmt.Sprintf(" and a.status = $%d", len(args))
	}
	scopeClause := r.adminScopeClause(&args, filter.ActorID, filter.ActorRole)
	if scopeClause != "" {
		whereClause += " and " + scopeClause
	}

	countQuery := fmt.Sprintf(`
		select count(*)
		from articles a
		join modules m on m.id = a.module_id
		where %s
	`, whereClause)

	var total int64
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count admin articles: %w", err)
	}

	args = append(args, pageSize, (page-1)*pageSize)
	query := fmt.Sprintf(`
		select
			a.id, a.module_id, m.slug, m.name, a.author_id, u.username,
			a.title, a.slug, a.summary, a.content_md, a.source_type, a.status, a.review_note,
			a.published_at, a.revision_of_article_id, a.word_count, a.reading_minutes, a.view_count, a.revision_count, a.is_featured,
			a.created_at, a.updated_at
		from articles a
		join modules m on m.id = a.module_id
		join users u on u.id = a.author_id
		where %s
		order by a.created_at desc, a.id desc
		limit $%d offset $%d
	`, whereClause, len(args)-1, len(args))

	items, err := r.scanMany(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	return r.withStats(ctx, r.withTags(ctx, items)), total, nil
}

func (r *Repository) FindPublishedByID(ctx context.Context, id int64) (Article, error) {
	const query = `
		select
			a.id, a.module_id, m.slug, m.name, a.author_id, u.username,
			a.title, a.slug, a.summary, a.content_md, a.source_type, a.status, a.review_note,
			a.published_at, a.revision_of_article_id, a.word_count, a.reading_minutes, a.view_count, a.revision_count, a.is_featured,
			a.created_at, a.updated_at
		from articles a
		join modules m on m.id = a.module_id
		join domains d on d.id = m.domain_id
		join users u on u.id = a.author_id
		where a.id = $1 and a.status = 'published' and a.deleted_at is null
			and m.deleted_at is null and m.is_active = true
			and d.deleted_at is null and d.is_active = true
	`
	item, err := r.scanOne(ctx, query, id)
	if err != nil {
		return Article{}, err
	}
	return r.withStat(ctx, r.withTag(ctx, item)), nil
}

func (r *Repository) FindPublishedByIDForViewer(ctx context.Context, id int64, viewerID int64) (Article, error) {
	const query = `
		select
			a.id, a.module_id, m.slug, m.name, a.author_id, u.username,
			a.title, a.slug, a.summary, a.content_md, a.source_type, a.status, a.review_note,
			a.published_at, a.revision_of_article_id, a.word_count, a.reading_minutes, a.view_count, a.revision_count, a.is_featured,
			a.created_at, a.updated_at
		from articles a
		join modules m on m.id = a.module_id
		join domains d on d.id = m.domain_id
		join users u on u.id = a.author_id
		where a.id = $1 and a.status = 'published' and a.deleted_at is null
			and m.deleted_at is null and m.is_active = true
			and d.deleted_at is null and d.is_active = true
	`
	item, err := r.scanOne(ctx, query, id)
	if err != nil {
		return Article{}, err
	}
	item = r.withStat(ctx, r.withTag(ctx, item))
	return r.withViewerVote(ctx, item, viewerID), nil
}

func (r *Repository) FindPreviewModule(ctx context.Context, id int64) (PreviewModule, error) {
	const query = `
		select m.id, m.slug, m.name
		from modules m
		join domains d on d.id = m.domain_id
		where m.id = $1
			and m.deleted_at is null
			and m.is_active = true
			and d.deleted_at is null
			and d.is_active = true
	`
	var module PreviewModule
	err := r.db.QueryRow(ctx, query, id).Scan(&module.ID, &module.Slug, &module.Name)
	if errors.Is(err, pgx.ErrNoRows) {
		return PreviewModule{}, ErrNotFound
	}
	if err != nil {
		return PreviewModule{}, fmt.Errorf("find preview module: %w", err)
	}
	return module, nil
}

func (r *Repository) IncrementViewCount(ctx context.Context, id int64) error {
	const query = `
		update articles a
		set view_count = a.view_count + 1
		from modules m
		join domains d on d.id = m.domain_id
		where a.id = $1
			and a.module_id = m.id
			and a.status = 'published'
			and a.deleted_at is null
			and m.deleted_at is null
			and m.is_active = true
			and d.deleted_at is null
			and d.is_active = true
		returning a.id
	`

	var updatedID int64
	err := r.db.QueryRow(ctx, query, id).Scan(&updatedID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("increment article view count: %w", err)
	}
	return nil
}

func (r *Repository) SetVote(ctx context.Context, articleID int64, userID int64, value int) (Article, error) {
	const query = `
		insert into article_votes (article_id, user_id, value)
		select $1, $2, $3
		where exists (
			select 1
			from articles a
			join modules m on m.id = a.module_id
			join domains d on d.id = m.domain_id
			where a.id = $1
				and a.author_id <> $2
				and a.status = 'published'
				and a.deleted_at is null
				and m.deleted_at is null
				and m.is_active = true
				and d.deleted_at is null
				and d.is_active = true
		)
		on conflict (article_id, user_id)
		do update set value = excluded.value, updated_at = now()
		returning article_id
	`
	var votedArticleID int64
	err := r.db.QueryRow(ctx, query, articleID, userID, value).Scan(&votedArticleID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Article{}, ErrNotFound
	}
	if err != nil {
		return Article{}, fmt.Errorf("set article vote: %w", err)
	}
	return r.FindPublishedByIDForViewer(ctx, votedArticleID, userID)
}

func (r *Repository) ClearVote(ctx context.Context, articleID int64, userID int64) (Article, error) {
	const query = `
		delete from article_votes
		where article_id = $1 and user_id = $2
	`
	if _, err := r.db.Exec(ctx, query, articleID, userID); err != nil {
		return Article{}, fmt.Errorf("clear article vote: %w", err)
	}
	return r.FindPublishedByIDForViewer(ctx, articleID, userID)
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
			a.title, a.slug, a.summary, a.content_md, a.source_type, a.status, a.review_note,
			a.published_at, a.revision_of_article_id, a.word_count, a.reading_minutes, a.view_count, a.revision_count, a.is_featured,
			a.created_at, a.updated_at
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
	return r.withStats(ctx, r.withTags(ctx, items)), total, nil
}

func (r *Repository) Create(ctx context.Context, input CreateArticleInput) (Article, error) {
	const query = `
		insert into articles (module_id, author_id, title, summary, content_md, source_type, status, word_count, reading_minutes)
		select $1, $2, $3, $4, $5, $6, $7, $8, $9
		where exists (
			select 1 from modules
			where id = $1 and is_active = true and deleted_at is null
		)
		returning id
	`

	var id int64
	if err := r.db.QueryRow(
		ctx,
		query,
		input.ModuleID,
		input.AuthorID,
		input.Title,
		input.Summary,
		input.ContentMD,
		input.SourceType,
		input.Status,
		input.WordCount,
		input.ReadingMinutes,
	).Scan(&id); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Article{}, ErrNotFound
		}
		return Article{}, fmt.Errorf("create article: %w", err)
	}

	if err := r.SetArticleTags(ctx, id, input.Tags); err != nil {
		return Article{}, err
	}
	if input.Status == "pending_review" {
		if err := r.createReviewTask(ctx, id); err != nil {
			return Article{}, err
		}
	}
	return r.FindByIDForAuthor(ctx, id, input.AuthorID)
}

func (r *Repository) CreateRevision(ctx context.Context, originalID int64, authorID int64, input UpdateArticleInput) (Article, error) {
	if input.Title == nil || input.Summary == nil || input.ContentMD == nil || input.SourceType == nil || input.WordCount == nil || input.ReadingMinutes == nil {
		return Article{}, ErrInvalidInput
	}

	const query = `
		insert into articles (
			module_id, author_id, title, summary, content_md, source_type, status,
			word_count, reading_minutes, revision_of_article_id
		)
		select
			original.module_id, original.author_id, $3, $4, $5, $6, 'pending_review',
			$7, $8, original.id
		from articles original
		where original.id = $1
			and original.author_id = $2
			and original.status = 'published'
			and original.deleted_at is null
			and not exists (
				select 1
				from articles revision
				where revision.revision_of_article_id = original.id
					and revision.deleted_at is null
					and revision.status in ('draft', 'pending_review', 'rejected')
			)
		returning id
	`

	var id int64
	err := r.db.QueryRow(
		ctx,
		query,
		originalID,
		authorID,
		*input.Title,
		*input.Summary,
		*input.ContentMD,
		*input.SourceType,
		*input.WordCount,
		*input.ReadingMinutes,
	).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Article{}, ErrConflict
	}
	if err != nil {
		return Article{}, fmt.Errorf("create article revision: %w", err)
	}

	if input.Tags != nil {
		if err := r.SetArticleTags(ctx, id, *input.Tags); err != nil {
			return Article{}, err
		}
	}
	if err := r.createReviewTask(ctx, id); err != nil {
		return Article{}, err
	}
	return r.FindByIDForAuthor(ctx, id, authorID)
}

func (r *Repository) FindByIDForAuthor(ctx context.Context, id int64, authorID int64) (Article, error) {
	const query = `
		select
			a.id, a.module_id, m.slug, m.name, a.author_id, u.username,
			a.title, a.slug, a.summary, a.content_md, a.source_type, a.status, a.review_note,
			a.published_at, a.revision_of_article_id, a.word_count, a.reading_minutes, a.view_count, a.revision_count, a.is_featured,
			a.created_at, a.updated_at
		from articles a
		join modules m on m.id = a.module_id
		join users u on u.id = a.author_id
		where a.id = $1 and a.author_id = $2 and a.deleted_at is null
	`
	item, err := r.scanOne(ctx, query, id, authorID)
	if err != nil {
		return Article{}, err
	}
	return r.withStat(ctx, r.withTag(ctx, item)), nil
}

func (r *Repository) UpdateOwn(ctx context.Context, id int64, authorID int64, input UpdateArticleInput) (Article, error) {
	const query = `
		update articles
		set
			title = coalesce($3, title),
			summary = coalesce($4, summary),
			content_md = coalesce($5, content_md),
			source_type = coalesce($6, source_type),
			word_count = coalesce($7, word_count),
			reading_minutes = coalesce($8, reading_minutes),
			status = case
				when status = 'rejected' then 'pending_review'
				when $9::varchar is not null then $9
				else status
			end,
			reviewed_by = case when status = 'rejected' or $9::varchar = 'pending_review' then null else reviewed_by end,
			reviewed_at = case when status = 'rejected' or $9::varchar = 'pending_review' then null else reviewed_at end,
			review_note = case when status = 'rejected' or $9::varchar = 'pending_review' then '' else review_note end,
			updated_at = now()
		where id = $1
			and author_id = $2
			and deleted_at is null
			and status in ('draft', 'pending_review', 'rejected')
		returning id
	`

	var updatedID int64
	err := r.db.QueryRow(
		ctx,
		query,
		id,
		authorID,
		input.Title,
		input.Summary,
		input.ContentMD,
		input.SourceType,
		input.WordCount,
		input.ReadingMinutes,
		input.Status,
	).Scan(&updatedID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Article{}, ErrConflict
	}
	if err != nil {
		return Article{}, fmt.Errorf("update article: %w", err)
	}

	if input.Tags != nil {
		if err := r.SetArticleTags(ctx, updatedID, *input.Tags); err != nil {
			return Article{}, err
		}
	}

	item, err := r.FindByIDForAuthor(ctx, updatedID, authorID)
	if err != nil {
		return Article{}, err
	}
	if item.Status == "pending_review" {
		if err := r.createReviewTask(ctx, updatedID); err != nil {
			return Article{}, err
		}
	}
	return item, nil
}

func (r *Repository) ListPendingReview(ctx context.Context, filter AdminArticleFilter, page int, pageSize int) ([]Article, int64, error) {
	args := []interface{}{}
	whereClause := "a.status = 'pending_review' and a.deleted_at is null"
	scopeClause := r.adminScopeClause(&args, filter.ActorID, filter.ActorRole)
	if scopeClause != "" {
		whereClause += " and " + scopeClause
	}

	countQuery := fmt.Sprintf(`
		select count(*)
		from articles a
		join modules m on m.id = a.module_id
		where %s
	`, whereClause)

	var total int64
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count pending review articles: %w", err)
	}

	args = append(args, pageSize, (page-1)*pageSize)
	query := fmt.Sprintf(`
		select
			a.id, a.module_id, m.slug, m.name, a.author_id, u.username,
			a.title, a.slug, a.summary, a.content_md, a.source_type, a.status, a.review_note,
			a.published_at, a.revision_of_article_id, a.word_count, a.reading_minutes, a.view_count, a.revision_count, a.is_featured,
			a.created_at, a.updated_at
		from articles a
		join modules m on m.id = a.module_id
		join users u on u.id = a.author_id
		where %s
		order by a.created_at asc, a.id asc
		limit $%d offset $%d
	`, whereClause, len(args)-1, len(args))

	items, err := r.scanMany(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	return r.withStats(ctx, r.withTags(ctx, items)), total, nil
}

func (r *Repository) CanModerateArticle(ctx context.Context, actorID int64, actorRole string, articleID int64) (bool, error) {
	if actorRole == "admin" {
		return true, nil
	}
	if actorID <= 0 || articleID <= 0 {
		return false, nil
	}

	const query = `
		select exists (
			select 1
			from articles a
			join modules m on m.id = a.module_id
			left join domain_owners do on do.domain_id = m.domain_id and do.user_id = $2
			left join module_moderators mm on mm.module_id = m.id and mm.user_id = $2
			where a.id = $1
				and a.deleted_at is null
				and m.deleted_at is null
				and (do.user_id is not null or mm.user_id is not null)
		)
	`
	var allowed bool
	if err := r.db.QueryRow(ctx, query, articleID, actorID).Scan(&allowed); err != nil {
		return false, fmt.Errorf("check article moderation permission: %w", err)
	}
	return allowed, nil
}

func (r *Repository) Approve(ctx context.Context, id int64, input ReviewArticleInput) (Article, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return Article{}, fmt.Errorf("begin approve article: %w", err)
	}
	defer tx.Rollback(ctx)

	var revisionOfID pgtype.Int8
	err = tx.QueryRow(ctx, `
		select revision_of_article_id
		from articles
		where id = $1 and status = 'pending_review' and deleted_at is null
		for update
	`, id).Scan(&revisionOfID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Article{}, ErrConflict
	}
	if err != nil {
		return Article{}, fmt.Errorf("load article for approve: %w", err)
	}

	var approvedID int64
	if !revisionOfID.Valid {
		err = tx.QueryRow(ctx, `
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
		`, id, input.ReviewerID, input.ReviewNote).Scan(&approvedID)
	} else {
		err = tx.QueryRow(ctx, `
			update articles original
			set
				title = revision.title,
				summary = revision.summary,
				content_md = revision.content_md,
				source_type = revision.source_type,
				word_count = revision.word_count,
				reading_minutes = revision.reading_minutes,
				revision_count = original.revision_count + 1,
				reviewed_by = $2,
				reviewed_at = now(),
				review_note = $3,
				updated_at = now()
			from articles revision
			where revision.id = $1
				and revision.revision_of_article_id = original.id
				and revision.status = 'pending_review'
				and revision.deleted_at is null
				and original.status = 'published'
				and original.deleted_at is null
			returning original.id
		`, id, input.ReviewerID, input.ReviewNote).Scan(&approvedID)
		if err == nil {
			revisionTags, tagErr := r.tagNamesTx(ctx, tx, id)
			if tagErr != nil {
				err = tagErr
			}
			if err == nil {
				err = r.replaceArticleTagsTx(ctx, tx, approvedID, revisionTags)
			}
			if err == nil {
				err = r.replaceArticleTagsTx(ctx, tx, id, nil)
			}
		}
		if err == nil {
			_, err = tx.Exec(ctx, `
				update articles
				set
					status = 'published',
					reviewed_by = $2,
					reviewed_at = now(),
					review_note = $3,
					deleted_at = now(),
					updated_at = now()
				where id = $1
			`, id, input.ReviewerID, input.ReviewNote)
		}
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return Article{}, ErrConflict
	}
	if err != nil {
		return Article{}, fmt.Errorf("approve article: %w", err)
	}

	if !revisionOfID.Valid {
		if _, err := tx.Exec(ctx, `
			insert into notifications (recipient_id, actor_id, type, article_id)
			select uf.follower_id, a.author_id, 'followee_article', a.id
			from articles a
			join user_follows uf on uf.followed_id = a.author_id
			join users follower on follower.id = uf.follower_id
			where a.id = $1
				and uf.follower_id <> a.author_id
				and follower.status = 'active'
				and follower.deleted_at is null
		`, approvedID); err != nil {
			return Article{}, fmt.Errorf("create followee article notifications: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return Article{}, fmt.Errorf("commit approve article: %w", err)
	}

	return r.findByID(ctx, approvedID)
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

func (r *Repository) UpdateAdmin(ctx context.Context, id int64, input AdminUpdateArticleInput) (Article, error) {
	if input.IsFeatured == nil {
		return Article{}, ErrInvalidInput
	}

	const query = `
		update articles
		set is_featured = coalesce($2, is_featured), updated_at = now()
		where id = $1 and deleted_at is null
		returning id
	`

	var updatedID int64
	err := r.db.QueryRow(ctx, query, id, input.IsFeatured).Scan(&updatedID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Article{}, ErrNotFound
	}
	if err != nil {
		return Article{}, fmt.Errorf("update article admin metadata: %w", err)
	}

	return r.findByID(ctx, updatedID)
}

func (r *Repository) adminScopeClause(args *[]interface{}, actorID int64, actorRole string) string {
	if actorRole == "admin" {
		return ""
	}
	if actorID <= 0 {
		return "false"
	}
	*args = append(*args, actorID)
	index := len(*args)
	return fmt.Sprintf(`(exists (
		select 1
		from domain_owners do
		where do.domain_id = m.domain_id and do.user_id = $%d
	) or exists (
		select 1
		from module_moderators mm
		where mm.module_id = m.id and mm.user_id = $%d
	))`, index, index)
}

func (r *Repository) createReviewTask(ctx context.Context, articleID int64) error {
	const query = `
		insert into moderation_tasks (
			task_type, object_type, object_id, domain_id, module_id,
			title, summary, status, priority, submitter_id, assignee_id
		)
		select
			'article_review',
			'article',
			a.id,
			m.domain_id,
			m.id,
			'文章审核：' || a.title,
			left(coalesce(a.summary, ''), 500),
			'pending',
			0,
			a.author_id,
			coalesce(mm.user_id, domain_owner.user_id, admin_user.id)
		from articles a
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
		where a.id = $1
			and a.status = 'pending_review'
			and a.deleted_at is null
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
	if _, err := r.db.Exec(ctx, query, articleID); err != nil {
		return fmt.Errorf("create article review task: %w", err)
	}
	return nil
}

func (r *Repository) findByID(ctx context.Context, id int64) (Article, error) {
	const query = `
		select
			a.id, a.module_id, m.slug, m.name, a.author_id, u.username,
			a.title, a.slug, a.summary, a.content_md, a.source_type, a.status, a.review_note,
			a.published_at, a.revision_of_article_id, a.word_count, a.reading_minutes, a.view_count, a.revision_count, a.is_featured,
			a.created_at, a.updated_at
		from articles a
		join modules m on m.id = a.module_id
		join users u on u.id = a.author_id
		where a.id = $1 and a.deleted_at is null
	`
	item, err := r.scanOne(ctx, query, id)
	if err != nil {
		return Article{}, err
	}
	return r.withStat(ctx, item), nil
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
			a.title, a.slug, a.summary, a.content_md, a.source_type, a.status, a.review_note,
			a.published_at, a.revision_of_article_id, a.word_count, a.reading_minutes, a.view_count, a.revision_count, a.is_featured,
			a.created_at, a.updated_at
		from articles a
		join modules m on m.id = a.module_id
		join users u on u.id = a.author_id
		where a.id = $1 and a.deleted_at is null
	`
	item, err := r.scanOne(ctx, findQuery, updatedID)
	if err != nil {
		return Article{}, err
	}
	return r.withStat(ctx, item), nil
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
			a.title, a.slug, a.summary, a.content_md, a.source_type, a.status, a.review_note,
			a.published_at, a.revision_of_article_id, a.word_count, a.reading_minutes, a.view_count, a.revision_count, a.is_featured,
			a.created_at, a.updated_at
		from articles a
		join modules m on m.id = a.module_id
		join users u on u.id = a.author_id
		where a.id = $1 and a.deleted_at is null
	`
	item, err := r.scanOne(ctx, findQuery, reviewedID)
	if err != nil {
		return Article{}, err
	}
	return r.withStat(ctx, item), nil
}

func (r *Repository) SetArticleTags(ctx context.Context, articleID int64, names []string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin set article tags: %w", err)
	}
	defer tx.Rollback(ctx)

	if err := r.replaceArticleTagsTx(ctx, tx, articleID, names); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit set article tags: %w", err)
	}
	return nil
}

func (r *Repository) tagNamesTx(ctx context.Context, tx pgx.Tx, articleID int64) ([]string, error) {
	rows, err := tx.Query(ctx, `
		select t.name
		from article_tags at
		join tags t on t.id = at.tag_id
		where at.article_id = $1
		order by at.created_at asc, t.name asc
	`, articleID)
	if err != nil {
		return nil, fmt.Errorf("query revision tags: %w", err)
	}
	defer rows.Close()

	var names []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("scan revision tag: %w", err)
		}
		names = append(names, name)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate revision tags: %w", err)
	}
	return names, nil
}

func (r *Repository) replaceArticleTagsTx(ctx context.Context, tx pgx.Tx, articleID int64, names []string) error {
	rows, err := tx.Query(ctx, `select tag_id from article_tags where article_id = $1`, articleID)
	if err != nil {
		return fmt.Errorf("query existing article tags: %w", err)
	}
	var oldTagIDs []int64
	for rows.Next() {
		var tagID int64
		if err := rows.Scan(&tagID); err != nil {
			rows.Close()
			return fmt.Errorf("scan existing article tag: %w", err)
		}
		oldTagIDs = append(oldTagIDs, tagID)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return fmt.Errorf("iterate existing article tags: %w", err)
	}
	rows.Close()

	if _, err := tx.Exec(ctx, `delete from article_tags where article_id = $1`, articleID); err != nil {
		return fmt.Errorf("delete article tags: %w", err)
	}
	for _, tagID := range oldTagIDs {
		if _, err := tx.Exec(ctx, `update tags set usage_count = greatest(usage_count - 1, 0), updated_at = now() where id = $1`, tagID); err != nil {
			return fmt.Errorf("decrement tag usage: %w", err)
		}
	}

	seen := map[string]struct{}{}
	for _, name := range names {
		name = strings.TrimSpace(name)
		slug := tagSlug(name)
		if slug == "" {
			continue
		}
		if _, ok := seen[slug]; ok {
			continue
		}
		seen[slug] = struct{}{}

		var tagID int64
		err := tx.QueryRow(ctx, `
			insert into tags (name, slug)
			values ($1, $2)
			on conflict (slug) do update set name = excluded.name, updated_at = now()
			returning id
		`, name, slug).Scan(&tagID)
		if err != nil {
			return fmt.Errorf("upsert tag: %w", err)
		}
		if _, err := tx.Exec(ctx, `insert into article_tags (article_id, tag_id) values ($1, $2) on conflict do nothing`, articleID, tagID); err != nil {
			return fmt.Errorf("insert article tag: %w", err)
		}
		if _, err := tx.Exec(ctx, `update tags set usage_count = usage_count + 1, updated_at = now() where id = $1`, tagID); err != nil {
			return fmt.Errorf("increment tag usage: %w", err)
		}
	}

	return nil
}

func (r *Repository) withTag(ctx context.Context, item Article) Article {
	item.Tags = r.loadTags(ctx, []int64{item.ID})[item.ID]
	return item
}

func (r *Repository) withTags(ctx context.Context, items []Article) []Article {
	ids := make([]int64, 0, len(items))
	for _, item := range items {
		ids = append(ids, item.ID)
	}
	tags := r.loadTags(ctx, ids)
	for i := range items {
		items[i].Tags = tags[items[i].ID]
	}
	return items
}

func (r *Repository) withStat(ctx context.Context, item Article) Article {
	stats := r.loadStats(ctx, []int64{item.ID})
	if stat, ok := stats[item.ID]; ok {
		item.BookmarkCount = stat.bookmarkCount
		item.CommentCount = stat.commentCount
		item.UpVotes = stat.upVotes
		item.DownVotes = stat.downVotes
	}
	return item
}

func (r *Repository) withStats(ctx context.Context, items []Article) []Article {
	ids := make([]int64, 0, len(items))
	for _, item := range items {
		ids = append(ids, item.ID)
	}
	stats := r.loadStats(ctx, ids)
	for i := range items {
		if stat, ok := stats[items[i].ID]; ok {
			items[i].BookmarkCount = stat.bookmarkCount
			items[i].CommentCount = stat.commentCount
			items[i].UpVotes = stat.upVotes
			items[i].DownVotes = stat.downVotes
		}
	}
	return items
}

type articleStats struct {
	bookmarkCount int64
	commentCount  int64
	upVotes       int64
	downVotes     int64
}

func (r *Repository) loadStats(ctx context.Context, articleIDs []int64) map[int64]articleStats {
	out := map[int64]articleStats{}
	if len(articleIDs) == 0 {
		return out
	}
	rows, err := r.db.Query(ctx, `
		select
			a.id,
			(select count(*) from article_bookmarks b where b.article_id = a.id and b.deleted_at is null) as bookmark_count,
			(
				select count(*)
				from comments c
				where c.article_id = a.id
					and c.parent_id is null
					and (
						c.deleted_at is null
						or exists (
							select 1
							from comments child
							where child.parent_id = c.id
								and child.visibility = 'visible'
								and child.deleted_at is null
						)
					)
			) as comment_count,
			(select count(*) from article_votes av where av.article_id = a.id and av.value = 1) as up_votes,
			(select count(*) from article_votes av where av.article_id = a.id and av.value = -1) as down_votes
		from articles a
		where a.id = any($1)
	`, articleIDs)
	if err != nil {
		return out
	}
	defer rows.Close()

	for rows.Next() {
		var articleID int64
		var stat articleStats
		if err := rows.Scan(&articleID, &stat.bookmarkCount, &stat.commentCount, &stat.upVotes, &stat.downVotes); err != nil {
			continue
		}
		out[articleID] = stat
	}
	return out
}

func (r *Repository) withViewerVote(ctx context.Context, item Article, viewerID int64) Article {
	if viewerID <= 0 {
		return item
	}
	const query = `
		select coalesce((select value from article_votes where article_id = $1 and user_id = $2), 0)
	`
	if err := r.db.QueryRow(ctx, query, item.ID, viewerID).Scan(&item.MyVote); err != nil {
		item.MyVote = 0
	}
	return item
}

func (r *Repository) loadTags(ctx context.Context, articleIDs []int64) map[int64][]Tag {
	out := map[int64][]Tag{}
	if len(articleIDs) == 0 {
		return out
	}
	rows, err := r.db.Query(ctx, `
		select at.article_id, t.id, t.name, t.slug, t.usage_count
		from article_tags at
		join tags t on t.id = at.tag_id
		where at.article_id = any($1)
		order by at.created_at asc, t.name asc
	`, articleIDs)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var articleID int64
		var tag Tag
		if err := rows.Scan(&articleID, &tag.ID, &tag.Name, &tag.Slug, &tag.UsageCount); err != nil {
			continue
		}
		out[articleID] = append(out[articleID], tag)
	}
	return out
}

func tagSlug(name string) string {
	slug := strings.ToLower(strings.TrimSpace(name))
	slug = strings.ReplaceAll(slug, "_", "-")
	slug = tagSlugUnsafe.ReplaceAllString(slug, "-")
	slug = strings.Trim(slug, "-")
	runes := []rune(slug)
	if len(runes) > 40 {
		slug = strings.Trim(string(runes[:40]), "-")
	}
	return slug
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
		&item.SourceType,
		&item.Status,
		&item.ReviewNote,
		&item.PublishedAt,
		&item.RevisionOfID,
		&item.WordCount,
		&item.ReadingMinutes,
		&item.ViewCount,
		&item.RevisionCount,
		&item.IsFeatured,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		return Article{}, fmt.Errorf("scan article: %w", err)
	}
	return item, nil
}
