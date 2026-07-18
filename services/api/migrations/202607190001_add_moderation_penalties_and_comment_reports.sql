-- +goose Up
create table moderation_penalties (
    id bigserial primary key,
    user_id bigint not null references users(id),
    penalty_type varchar(40) not null,
    target_type varchar(40) not null default 'user',
    target_id bigint null,
    reason text not null default '',
    starts_at timestamptz not null default now(),
    expires_at timestamptz null,
    created_by bigint null references users(id),
    source_type varchar(40) not null default '',
    source_id bigint null,
    status varchar(20) not null default 'active',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint moderation_penalties_type_check check (penalty_type in ('account_disabled', 'follow_restricted', 'article_create_banned', 'comment_create_banned')),
    constraint moderation_penalties_target_type_check check (target_type in ('user', 'article', 'comment')),
    constraint moderation_penalties_status_check check (status in ('active', 'expired', 'revoked'))
);

create index moderation_penalties_active_user_type_idx
    on moderation_penalties (user_id, penalty_type, expires_at)
    where status = 'active';
create index moderation_penalties_source_idx
    on moderation_penalties (source_type, source_id);

create table comment_reports (
    id bigserial primary key,
    comment_id bigint not null references comments(id),
    reporter_id bigint not null references users(id),
    reason text not null,
    status varchar(20) not null default 'pending',
    handled_by bigint null references users(id),
    handled_at timestamptz null,
    handle_note text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz null,
    constraint comment_reports_status_check check (status in ('pending', 'resolved', 'rejected'))
);

create unique index comment_reports_pending_unique
    on comment_reports (comment_id, reporter_id)
    where status = 'pending' and deleted_at is null;
create index comment_reports_status_created_idx
    on comment_reports (status, created_at desc)
    where deleted_at is null;

-- +goose Down
drop index if exists comment_reports_status_created_idx;
drop index if exists comment_reports_pending_unique;
drop table if exists comment_reports;
drop index if exists moderation_penalties_source_idx;
drop index if exists moderation_penalties_active_user_type_idx;
drop table if exists moderation_penalties;
