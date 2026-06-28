package admin

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) HasAdminAccess(ctx context.Context, actorID int64, actorRole string) (bool, error) {
	if actorRole == "admin" || actorRole == "reviewer" {
		return true, nil
	}
	if actorID <= 0 {
		return false, nil
	}
	const query = `
		select exists (
			select 1 from domain_owners where user_id = $1
			union all
			select 1 from module_moderators where user_id = $1
		)
	`
	var allowed bool
	if err := r.db.QueryRow(ctx, query, actorID).Scan(&allowed); err != nil {
		return false, fmt.Errorf("check admin access: %w", err)
	}
	return allowed, nil
}

func (r *Repository) ListTasks(ctx context.Context, filter TaskFilter, page int, pageSize int) ([]Task, int64, error) {
	args := []interface{}{}
	where := "true"
	if filter.TaskType != "" {
		args = append(args, filter.TaskType)
		where += fmt.Sprintf(" and mt.task_type = $%d", len(args))
	}
	if filter.Status != "" {
		args = append(args, filter.Status)
		where += fmt.Sprintf(" and mt.status = $%d", len(args))
	}
	if filter.Priority != nil {
		args = append(args, *filter.Priority)
		where += fmt.Sprintf(" and mt.priority = $%d", len(args))
	}
	if filter.DomainID != nil {
		args = append(args, *filter.DomainID)
		where += fmt.Sprintf(" and mt.domain_id = $%d", len(args))
	}
	if filter.ModuleID != nil {
		args = append(args, *filter.ModuleID)
		where += fmt.Sprintf(" and mt.module_id = $%d", len(args))
	}
	if filter.AssigneeID != nil {
		args = append(args, *filter.AssigneeID)
		where += fmt.Sprintf(" and mt.assignee_id = $%d", len(args))
	}
	scope := r.scopeClause(&args, filter.ActorID, filter.ActorRole)
	if scope != "" {
		where += " and " + scope
	}

	countQuery := fmt.Sprintf(`select count(*) from moderation_tasks mt where %s`, where)
	var total int64
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count moderation tasks: %w", err)
	}

	args = append(args, pageSize, (page-1)*pageSize)
	query := fmt.Sprintf(`
		select
			mt.id, mt.task_type, mt.object_type, mt.object_id,
			mt.domain_id, d.name, mt.module_id, m.name,
			mt.title, mt.summary, mt.status, mt.priority,
			mt.submitter_id, submitter.username,
			mt.assignee_id, assignee.username,
			mt.due_at, mt.resolved_at, mt.resolution, mt.resolution_note,
			case when mt.object_type = 'article' then a.title else ar.reason end,
			case when mt.object_type = 'article' then a.status else ar.status end,
			null::text,
			mt.created_at, mt.updated_at
		from moderation_tasks mt
		left join domains d on d.id = mt.domain_id
		left join modules m on m.id = mt.module_id
		left join users submitter on submitter.id = mt.submitter_id
		left join users assignee on assignee.id = mt.assignee_id
		left join articles a on mt.object_type = 'article' and a.id = mt.object_id
		left join article_reports ar on mt.object_type = 'article_report' and ar.id = mt.object_id
		where %s
		order by
			case when mt.status in ('pending', 'processing') then 0 else 1 end,
			mt.priority desc,
			mt.created_at asc,
			mt.id asc
		limit $%d offset $%d
	`, where, len(args)-1, len(args))
	items, err := r.scanTasks(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	return items, total, nil
}

func (r *Repository) FindTask(ctx context.Context, id int64, actorID int64, actorRole string) (Task, error) {
	args := []interface{}{id}
	where := "mt.id = $1"
	scope := r.scopeClause(&args, actorID, actorRole)
	if scope != "" {
		where += " and " + scope
	}
	query := fmt.Sprintf(`
		select
			mt.id, mt.task_type, mt.object_type, mt.object_id,
			mt.domain_id, d.name, mt.module_id, m.name,
			mt.title, mt.summary, mt.status, mt.priority,
			mt.submitter_id, submitter.username,
			mt.assignee_id, assignee.username,
			mt.due_at, mt.resolved_at, mt.resolution, mt.resolution_note,
			case when mt.object_type = 'article' then a.title else ar.reason end,
			case when mt.object_type = 'article' then a.status else ar.status end,
			case when mt.object_type = 'article' then a.content_md else a2.content_md end,
			mt.created_at, mt.updated_at
		from moderation_tasks mt
		left join domains d on d.id = mt.domain_id
		left join modules m on m.id = mt.module_id
		left join users submitter on submitter.id = mt.submitter_id
		left join users assignee on assignee.id = mt.assignee_id
		left join articles a on mt.object_type = 'article' and a.id = mt.object_id
		left join article_reports ar on mt.object_type = 'article_report' and ar.id = mt.object_id
		left join articles a2 on mt.object_type = 'article_report' and a2.id = ar.article_id
		where %s
	`, where)
	item, err := scanTask(r.db.QueryRow(ctx, query, args...))
	if errors.Is(err, pgx.ErrNoRows) {
		return Task{}, ErrNotFound
	}
	if err != nil {
		return Task{}, err
	}
	return item, nil
}

func (r *Repository) Stats(ctx context.Context, actorID int64, actorRole string) (TaskStats, error) {
	args := []interface{}{}
	scope := r.scopeClause(&args, actorID, actorRole)
	where := "true"
	if scope != "" {
		where += " and " + scope
	}
	query := fmt.Sprintf(`
		select
			count(*) filter (where mt.status in ('pending', 'processing') and (mt.assignee_id = $%d or mt.assignee_id is null)),
			count(*) filter (where mt.status in ('pending', 'processing') and mt.task_type = 'article_review'),
			count(*) filter (where mt.status in ('pending', 'processing') and mt.task_type in ('content_report', 'comment_report')),
			count(*) filter (where mt.status in ('pending', 'processing') and mt.due_at is not null and mt.due_at < now()),
			count(*) filter (where mt.resolved_at >= date_trunc('day', now()))
		from moderation_tasks mt
		where %s
	`, len(args)+1, where)
	args = append(args, actorID)
	var stats TaskStats
	if err := r.db.QueryRow(ctx, query, args...).Scan(
		&stats.MyPending,
		&stats.PendingReviews,
		&stats.PendingReports,
		&stats.OverdueTasks,
		&stats.ResolvedToday,
	); err != nil {
		return TaskStats{}, fmt.Errorf("query task stats: %w", err)
	}
	return stats, nil
}

func (r *Repository) ResolveTask(ctx context.Context, id int64, actorID int64, status string, resolution string, note string) (Task, error) {
	const query = `
		update moderation_tasks
		set
			status = $3,
			assignee_id = coalesce(assignee_id, $2),
			resolved_at = now(),
			resolution = $4,
			resolution_note = $5,
			updated_at = now()
		where id = $1 and status in ('pending', 'processing')
		returning id
	`
	var updatedID int64
	err := r.db.QueryRow(ctx, query, id, actorID, status, resolution, note).Scan(&updatedID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Task{}, ErrConflict
	}
	if err != nil {
		return Task{}, fmt.Errorf("resolve moderation task: %w", err)
	}
	return r.FindTask(ctx, updatedID, actorID, "admin")
}

func (r *Repository) Audit(ctx context.Context, input AuditLogInput) error {
	if input.Action == "" || input.TargetType == "" || input.TargetID <= 0 {
		return ErrInvalidInput
	}
	detail, err := json.Marshal(input.Detail)
	if err != nil {
		return fmt.Errorf("marshal audit detail: %w", err)
	}
	_, err = r.db.Exec(ctx, `
		insert into audit_logs (actor_id, action, target_type, target_id, domain_id, module_id, detail, ip, user_agent)
		values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
	`, input.ActorID, input.Action, input.TargetType, input.TargetID, input.DomainID, input.ModuleID, string(detail), input.IP, input.UserAgent)
	if err != nil {
		return fmt.Errorf("insert audit log: %w", err)
	}
	return nil
}

func (r *Repository) ListAuditLogs(ctx context.Context, filter AuditLogFilter, page int, pageSize int) ([]AuditLog, int64, error) {
	args := []interface{}{}
	where := "true"
	if filter.Action != "" {
		args = append(args, filter.Action)
		where += fmt.Sprintf(" and al.action = $%d", len(args))
	}
	if filter.ActorID != nil {
		args = append(args, *filter.ActorID)
		where += fmt.Sprintf(" and al.actor_id = $%d", len(args))
	}
	if filter.TargetType != "" {
		args = append(args, filter.TargetType)
		where += fmt.Sprintf(" and al.target_type = $%d", len(args))
	}
	if filter.TargetID != nil {
		args = append(args, *filter.TargetID)
		where += fmt.Sprintf(" and al.target_id = $%d", len(args))
	}
	if filter.DomainID != nil {
		args = append(args, *filter.DomainID)
		where += fmt.Sprintf(" and al.domain_id = $%d", len(args))
	}
	if filter.ModuleID != nil {
		args = append(args, *filter.ModuleID)
		where += fmt.Sprintf(" and al.module_id = $%d", len(args))
	}

	countQuery := fmt.Sprintf(`select count(*) from audit_logs al where %s`, where)
	var total int64
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count audit logs: %w", err)
	}

	args = append(args, pageSize, (page-1)*pageSize)
	query := fmt.Sprintf(`
		select
			al.id, al.actor_id, actor.username,
			al.action, al.target_type, al.target_id,
			al.domain_id, d.name, al.module_id, m.name,
			al.detail, al.ip, al.user_agent, al.created_at
		from audit_logs al
		left join users actor on actor.id = al.actor_id
		left join domains d on d.id = al.domain_id
		left join modules m on m.id = al.module_id
		where %s
		order by al.created_at desc, al.id desc
		limit $%d offset $%d
	`, where, len(args)-1, len(args))
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query audit logs: %w", err)
	}
	defer rows.Close()
	logs := []AuditLog{}
	for rows.Next() {
		var item AuditLog
		var actorID pgtype.Int8
		var actorName pgtype.Text
		var domainID pgtype.Int8
		var domainName pgtype.Text
		var moduleID pgtype.Int8
		var moduleName pgtype.Text
		var detailBytes []byte
		if err := rows.Scan(
			&item.ID,
			&actorID,
			&actorName,
			&item.Action,
			&item.TargetType,
			&item.TargetID,
			&domainID,
			&domainName,
			&moduleID,
			&moduleName,
			&detailBytes,
			&item.IP,
			&item.UserAgent,
			&item.CreatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan audit log: %w", err)
		}
		item.ActorID = int8Ptr(actorID)
		item.ActorName = textPtr(actorName)
		item.DomainID = int8Ptr(domainID)
		item.DomainName = textPtr(domainName)
		item.ModuleID = int8Ptr(moduleID)
		item.ModuleName = textPtr(moduleName)
		item.Detail = map[string]string{}
		_ = json.Unmarshal(detailBytes, &item.Detail)
		logs = append(logs, item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate audit logs: %w", err)
	}
	return logs, total, nil
}

func (r *Repository) scopeClause(args *[]interface{}, actorID int64, actorRole string) string {
	if actorRole == "admin" {
		return ""
	}
	if actorID <= 0 {
		return "false"
	}
	*args = append(*args, actorID)
	index := len(*args)
	return fmt.Sprintf(`(
		mt.assignee_id = $%d
		or exists (
			select 1 from domain_owners do
			where do.domain_id = mt.domain_id and do.user_id = $%d
		)
		or exists (
			select 1 from module_moderators mm
			where mm.module_id = mt.module_id and mm.user_id = $%d
		)
	)`, index, index, index)
}

func (r *Repository) scanTasks(ctx context.Context, query string, args ...interface{}) ([]Task, error) {
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query moderation tasks: %w", err)
	}
	defer rows.Close()
	items := []Task{}
	for rows.Next() {
		item, err := scanTask(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate moderation tasks: %w", err)
	}
	return items, nil
}

type taskScanner interface {
	Scan(dest ...interface{}) error
}

func scanTask(scanner taskScanner) (Task, error) {
	var item Task
	var domainID pgtype.Int8
	var domainName pgtype.Text
	var moduleID pgtype.Int8
	var moduleName pgtype.Text
	var submitterID pgtype.Int8
	var submitterName pgtype.Text
	var assigneeID pgtype.Int8
	var assigneeName pgtype.Text
	var dueAt pgtype.Timestamptz
	var resolvedAt pgtype.Timestamptz
	var objectTitle pgtype.Text
	var objectStatus pgtype.Text
	var objectContent pgtype.Text
	err := scanner.Scan(
		&item.ID,
		&item.TaskType,
		&item.ObjectType,
		&item.ObjectID,
		&domainID,
		&domainName,
		&moduleID,
		&moduleName,
		&item.Title,
		&item.Summary,
		&item.Status,
		&item.Priority,
		&submitterID,
		&submitterName,
		&assigneeID,
		&assigneeName,
		&dueAt,
		&resolvedAt,
		&item.Resolution,
		&item.ResolutionNote,
		&objectTitle,
		&objectStatus,
		&objectContent,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		return Task{}, fmt.Errorf("scan moderation task: %w", err)
	}
	item.DomainID = int8Ptr(domainID)
	item.DomainName = textPtr(domainName)
	item.ModuleID = int8Ptr(moduleID)
	item.ModuleName = textPtr(moduleName)
	item.SubmitterID = int8Ptr(submitterID)
	item.SubmitterName = textPtr(submitterName)
	item.AssigneeID = int8Ptr(assigneeID)
	item.AssigneeName = textPtr(assigneeName)
	if dueAt.Valid {
		item.DueAt = &dueAt.Time
	}
	if resolvedAt.Valid {
		item.ResolvedAt = &resolvedAt.Time
	}
	item.ObjectTitle = textPtr(objectTitle)
	item.ObjectStatus = textPtr(objectStatus)
	item.ObjectContentMD = textPtr(objectContent)
	return item, nil
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
	v := strings.TrimSpace(value.String)
	return &v
}
