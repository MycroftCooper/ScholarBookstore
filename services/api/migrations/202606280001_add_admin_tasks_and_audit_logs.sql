-- +goose Up
create table moderation_tasks (
    id bigserial primary key,
    task_type varchar(40) not null,
    object_type varchar(40) not null,
    object_id bigint not null,
    domain_id bigint null references domains(id),
    module_id bigint null references modules(id),
    title varchar(200) not null,
    summary text not null default '',
    status varchar(30) not null default 'pending',
    priority integer not null default 0,
    submitter_id bigint null references users(id),
    assignee_id bigint null references users(id),
    due_at timestamptz null,
    resolved_at timestamptz null,
    resolution varchar(40) not null default '',
    resolution_note text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint moderation_tasks_type_check check (task_type in ('article_review', 'content_report', 'comment_report', 'user_report', 'appeal', 'role_request', 'module_create_request')),
    constraint moderation_tasks_status_check check (status in ('pending', 'processing', 'approved', 'rejected', 'resolved', 'ignored', 'cancelled'))
);

create unique index moderation_tasks_open_object_unique
    on moderation_tasks (task_type, object_type, object_id)
    where status in ('pending', 'processing');
create index moderation_tasks_status_created_idx on moderation_tasks(status, created_at desc);
create index moderation_tasks_assignee_status_idx on moderation_tasks(assignee_id, status, created_at desc);
create index moderation_tasks_domain_status_idx on moderation_tasks(domain_id, status, created_at desc);
create index moderation_tasks_module_status_idx on moderation_tasks(module_id, status, created_at desc);

create table audit_logs (
    id bigserial primary key,
    actor_id bigint null references users(id),
    action varchar(80) not null,
    target_type varchar(40) not null,
    target_id bigint not null,
    domain_id bigint null references domains(id),
    module_id bigint null references modules(id),
    detail jsonb not null default '{}'::jsonb,
    ip text not null default '',
    user_agent text not null default '',
    created_at timestamptz not null default now()
);

create index audit_logs_actor_created_idx on audit_logs(actor_id, created_at desc);
create index audit_logs_action_created_idx on audit_logs(action, created_at desc);
create index audit_logs_target_idx on audit_logs(target_type, target_id, created_at desc);

-- +goose Down
drop index if exists audit_logs_target_idx;
drop index if exists audit_logs_action_created_idx;
drop index if exists audit_logs_actor_created_idx;
drop table if exists audit_logs;
drop index if exists moderation_tasks_module_status_idx;
drop index if exists moderation_tasks_domain_status_idx;
drop index if exists moderation_tasks_assignee_status_idx;
drop index if exists moderation_tasks_status_created_idx;
drop index if exists moderation_tasks_open_object_unique;
drop table if exists moderation_tasks;
