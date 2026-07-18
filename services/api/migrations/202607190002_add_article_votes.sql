-- +goose Up
-- +goose StatementBegin
create table article_votes (
  id bigserial primary key,
  article_id bigint not null references articles(id),
  user_id bigint not null references users(id),
  value smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint article_votes_value_check check (value in (-1, 1))
);

create unique index article_votes_article_user_unique on article_votes (article_id, user_id);
create index article_votes_user_created_idx on article_votes (user_id, created_at desc);
create index article_votes_article_value_idx on article_votes (article_id, value);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
drop table if exists article_votes;
-- +goose StatementEnd
