-- +goose Up
-- +goose StatementBegin
alter table articles
  add column word_count integer not null default 0,
  add column reading_minutes integer not null default 1,
  add column view_count bigint not null default 0,
  add column revision_count integer not null default 0;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
alter table articles
  drop column if exists revision_count,
  drop column if exists view_count,
  drop column if exists reading_minutes,
  drop column if exists word_count;
-- +goose StatementEnd
