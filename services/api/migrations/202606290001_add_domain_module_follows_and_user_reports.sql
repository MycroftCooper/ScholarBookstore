-- +goose Up
-- +goose StatementBegin
create table module_follows (
  id bigserial primary key,
  follower_id bigint not null references users(id),
  module_id bigint not null references modules(id),
  created_at timestamptz not null default now()
);

create unique index module_follows_unique on module_follows (follower_id, module_id);
create index module_follows_follower_idx on module_follows (follower_id, created_at desc);
create index module_follows_module_idx on module_follows (module_id, created_at desc);

create table domain_follows (
  id bigserial primary key,
  follower_id bigint not null references users(id),
  domain_id bigint not null references domains(id),
  created_at timestamptz not null default now()
);

create unique index domain_follows_unique on domain_follows (follower_id, domain_id);
create index domain_follows_follower_idx on domain_follows (follower_id, created_at desc);
create index domain_follows_domain_idx on domain_follows (domain_id, created_at desc);

create table user_reports (
  id bigserial primary key,
  reported_user_id bigint not null references users(id),
  reporter_id bigint not null references users(id),
  reason text not null,
  status varchar(20) not null default 'pending',
  handled_by bigint null references users(id),
  handled_at timestamptz null,
  handle_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint user_reports_not_self_check check (reported_user_id <> reporter_id),
  constraint user_reports_status_check check (status in ('pending', 'resolved', 'rejected'))
);

create unique index user_reports_pending_unique
  on user_reports (reported_user_id, reporter_id)
  where status = 'pending' and deleted_at is null;
create index user_reports_status_created_idx on user_reports (status, created_at desc)
  where deleted_at is null;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
drop index if exists user_reports_status_created_idx;
drop index if exists user_reports_pending_unique;
drop table if exists user_reports;
drop index if exists domain_follows_domain_idx;
drop index if exists domain_follows_follower_idx;
drop index if exists domain_follows_unique;
drop table if exists domain_follows;
drop index if exists module_follows_module_idx;
drop index if exists module_follows_follower_idx;
drop index if exists module_follows_unique;
drop table if exists module_follows;
-- +goose StatementEnd
