package dashboard

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Snapshot(ctx context.Context) (Dashboard, error) {
	var item Dashboard
	const summaryQuery = `
		select
			(select count(*) from articles where deleted_at is null),
			(select count(*) from articles where status = 'published' and deleted_at is null),
			(select count(*) from users where status = 'active' and deleted_at is null),
			(select count(*) from articles where status = 'published' and deleted_at is null and published_at >= date_trunc('day', now())),
			(select count(*) from articles where status = 'pending_review' and deleted_at is null),
			(select count(*) from article_reports where status = 'pending' and deleted_at is null)
	`
	if err := r.db.QueryRow(ctx, summaryQuery).Scan(
		&item.TotalArticles,
		&item.PublishedArticles,
		&item.ActiveUsers,
		&item.TodayPublishedArticles,
		&item.PendingReviewArticles,
		&item.PendingReports,
	); err != nil {
		return Dashboard{}, fmt.Errorf("query dashboard summary: %w", err)
	}

	published, err := r.metric(ctx, `
		with days as (
			select generate_series(current_date - interval '29 days', current_date, interval '1 day')::date as day
		)
		select to_char(days.day, 'YYYY-MM-DD'), count(a.id)
		from days
		left join articles a on a.status = 'published'
			and a.deleted_at is null
			and a.published_at >= days.day
			and a.published_at < days.day + interval '1 day'
		group by days.day
		order by days.day asc
	`)
	if err != nil {
		return Dashboard{}, err
	}
	active, err := r.metric(ctx, `
		with days as (
			select generate_series(current_date - interval '29 days', current_date, interval '1 day')::date as day
		), events as (
			select author_id as user_id, created_at from articles where deleted_at is null
			union all select author_id, created_at from comments where deleted_at is null
			union all select user_id, created_at from article_bookmarks where deleted_at is null
			union all select follower_id, created_at from user_follows
			union all select reporter_id, created_at from article_reports where deleted_at is null
		)
		select to_char(days.day, 'YYYY-MM-DD'), count(distinct events.user_id)
		from days
		left join events on events.created_at >= days.day and events.created_at < days.day + interval '1 day'
		group by days.day
		order by days.day asc
	`)
	if err != nil {
		return Dashboard{}, err
	}
	item.PublishedArticlesByDay = published
	item.ActiveUsersByDay = active
	return item, nil
}

func (r *Repository) metric(ctx context.Context, query string) ([]MetricPoint, error) {
	rows, err := r.db.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query dashboard metric: %w", err)
	}
	defer rows.Close()
	points := []MetricPoint{}
	for rows.Next() {
		var point MetricPoint
		if err := rows.Scan(&point.Date, &point.Count); err != nil {
			return nil, fmt.Errorf("scan dashboard metric: %w", err)
		}
		points = append(points, point)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate dashboard metric: %w", err)
	}
	return points, nil
}
