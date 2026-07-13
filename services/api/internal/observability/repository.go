package observability

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) CreateErrorLog(ctx context.Context, input ErrorLogInput) error {
	metadata, err := json.Marshal(input.Metadata)
	if err != nil {
		return fmt.Errorf("marshal error log metadata: %w", err)
	}
	_, err = r.db.Exec(ctx, `
		insert into error_logs (source, level, fingerprint, message, stack, user_id, request_id, method, path, ip, user_agent, metadata)
		values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
		on conflict (source, fingerprint) do update
		set
			level = excluded.level,
			message = excluded.message,
			stack = excluded.stack,
			user_id = excluded.user_id,
			request_id = excluded.request_id,
			method = excluded.method,
			path = excluded.path,
			ip = excluded.ip,
			user_agent = excluded.user_agent,
			metadata = excluded.metadata,
			occurrence_count = error_logs.occurrence_count + 1,
			last_seen_at = now(),
			updated_at = now()
	`, input.Source, input.Level, input.Fingerprint, input.Message, input.Stack, input.UserID, input.RequestID, input.Method, input.Path, input.IP, input.UserAgent, string(metadata))
	if err != nil {
		return fmt.Errorf("insert error log: %w", err)
	}
	return nil
}

func (r *Repository) ListErrorLogs(ctx context.Context, filter ErrorLogFilter, page int, pageSize int) ([]ErrorLog, int64, error) {
	args := []interface{}{}
	where := "true"
	if filter.Source != "" {
		args = append(args, filter.Source)
		where += fmt.Sprintf(" and el.source = $%d", len(args))
	}
	if filter.UserID != nil {
		args = append(args, *filter.UserID)
		where += fmt.Sprintf(" and el.user_id = $%d", len(args))
	}

	countQuery := fmt.Sprintf(`select count(*) from error_logs el where %s`, where)
	var total int64
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count error logs: %w", err)
	}

	args = append(args, pageSize, (page-1)*pageSize)
	query := fmt.Sprintf(`
		select
			el.id, el.source, el.level, el.message, el.stack,
			el.fingerprint,
			el.user_id, u.username,
			el.request_id, el.method, el.path, el.ip, el.user_agent,
			el.metadata, el.occurrence_count, el.first_seen_at, el.last_seen_at, el.created_at
		from error_logs el
		left join users u on u.id = el.user_id
		where %s
		order by el.last_seen_at desc, el.id desc
		limit $%d offset $%d
	`, where, len(args)-1, len(args))

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query error logs: %w", err)
	}
	defer rows.Close()

	items := []ErrorLog{}
	for rows.Next() {
		var item ErrorLog
		var userID pgtype.Int8
		var username pgtype.Text
		var metadataBytes []byte
		if err := rows.Scan(
			&item.ID,
			&item.Source,
			&item.Level,
			&item.Message,
			&item.Stack,
			&item.Fingerprint,
			&userID,
			&username,
			&item.RequestID,
			&item.Method,
			&item.Path,
			&item.IP,
			&item.UserAgent,
			&metadataBytes,
			&item.OccurrenceCount,
			&item.FirstSeenAt,
			&item.LastSeenAt,
			&item.CreatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan error log: %w", err)
		}
		item.UserID = int8Ptr(userID)
		item.Username = textPtr(username)
		item.Metadata = map[string]string{}
		_ = json.Unmarshal(metadataBytes, &item.Metadata)
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate error logs: %w", err)
	}
	return items, total, nil
}

func (r *Repository) DeleteErrorLog(ctx context.Context, id int64) (int64, error) {
	tag, err := r.db.Exec(ctx, `delete from error_logs where id = $1`, id)
	if err != nil {
		return 0, fmt.Errorf("delete error log: %w", err)
	}
	return tag.RowsAffected(), nil
}

func (r *Repository) DeleteAllErrorLogs(ctx context.Context) (int64, error) {
	tag, err := r.db.Exec(ctx, `delete from error_logs`)
	if err != nil {
		return 0, fmt.Errorf("delete all error logs: %w", err)
	}
	return tag.RowsAffected(), nil
}

func int8Ptr(value pgtype.Int8) *int64 {
	if !value.Valid {
		return nil
	}
	v := value.Int64
	return &v
}

func textPtr(value pgtype.Text) *string {
	if !value.Valid {
		return nil
	}
	v := value.String
	return &v
}
