-- +goose Up
-- +goose StatementBegin
alter table articles
  add column is_featured boolean not null default false;

create index articles_featured_published_idx
  on articles (is_featured, published_at desc, id desc)
  where deleted_at is null and status = 'published';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
drop index if exists articles_featured_published_idx;

alter table articles
  drop column if exists is_featured;
-- +goose StatementEnd
