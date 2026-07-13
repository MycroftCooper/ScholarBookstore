-- +goose Up
create table error_logs (
    id bigserial primary key,
    source varchar(40) not null,
    level varchar(20) not null default 'error',
    fingerprint varchar(64) not null,
    message text not null,
    stack text not null default '',
    user_id bigint null references users(id) on delete set null,
    request_id text not null default '',
    method varchar(12) not null default '',
    path text not null default '',
    ip text not null default '',
    user_agent text not null default '',
    metadata jsonb not null default '{}'::jsonb,
    occurrence_count bigint not null default 1,
    first_seen_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint error_logs_source_check check (source in ('client', 'server')),
    constraint error_logs_level_check check (level in ('error', 'warning', 'info'))
);

create unique index error_logs_source_fingerprint_unique on error_logs(source, fingerprint);
create index error_logs_last_seen_idx on error_logs(last_seen_at desc);
create index error_logs_user_last_seen_idx on error_logs(user_id, last_seen_at desc);
create index error_logs_source_last_seen_idx on error_logs(source, last_seen_at desc);

-- +goose Down
drop index if exists error_logs_source_last_seen_idx;
drop index if exists error_logs_user_last_seen_idx;
drop index if exists error_logs_last_seen_idx;
drop index if exists error_logs_source_fingerprint_unique;
drop table if exists error_logs;
