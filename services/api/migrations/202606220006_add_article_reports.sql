-- +goose Up
-- +goose StatementBegin
create table article_reports (
  id bigserial primary key,
  article_id bigint not null references articles(id),
  reporter_id bigint not null references users(id),
  reason text not null,
  status varchar(20) not null default 'pending',
  handled_by bigint null references users(id),
  handled_at timestamptz null,
  handle_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint article_reports_status_check check (status in ('pending', 'resolved', 'rejected'))
);

create unique index article_reports_pending_unique on article_reports (article_id, reporter_id) where status = 'pending' and deleted_at is null;
create index article_reports_status_created_idx on article_reports (status, created_at desc) where deleted_at is null;
create index article_reports_article_created_idx on article_reports (article_id, created_at desc) where deleted_at is null;
create index article_reports_reporter_created_idx on article_reports (reporter_id, created_at desc) where deleted_at is null;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
drop table if exists article_reports;
-- +goose StatementEnd
