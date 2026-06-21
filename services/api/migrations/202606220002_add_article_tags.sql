-- +goose Up
-- +goose StatementBegin
create table tags (
  id bigserial primary key,
  name varchar(30) not null,
  slug varchar(40) not null,
  usage_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index tags_slug_unique on tags (slug);
create index tags_usage_count_idx on tags (usage_count desc, name asc);

create table article_tags (
  article_id bigint not null references articles(id) on delete cascade,
  tag_id bigint not null references tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (article_id, tag_id)
);

create index article_tags_tag_idx on article_tags (tag_id, article_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
drop table if exists article_tags;
drop table if exists tags;
-- +goose StatementEnd
