-- +goose Up
-- +goose StatementBegin
alter table articles
  add column search_vector tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(content_md, ''))
  ) stored;

create index articles_search_vector_idx on articles using gin (search_vector);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
drop index if exists articles_search_vector_idx;
alter table articles drop column if exists search_vector;
-- +goose StatementEnd
