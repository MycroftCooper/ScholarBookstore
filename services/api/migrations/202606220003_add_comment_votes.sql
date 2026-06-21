-- +goose Up
-- +goose StatementBegin
create table comment_votes (
  id bigserial primary key,
  comment_id bigint not null references comments(id),
  user_id bigint not null references users(id),
  value smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comment_votes_value_check check (value in (-1, 1))
);

create unique index comment_votes_comment_user_unique on comment_votes (comment_id, user_id);
create index comment_votes_user_created_idx on comment_votes (user_id, created_at desc);
create index comment_votes_comment_value_idx on comment_votes (comment_id, value);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
drop table if exists comment_votes;
-- +goose StatementEnd
