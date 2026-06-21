-- +goose Up
-- +goose StatementBegin
create table bookmark_collections (
  id bigserial primary key,
  user_id bigint not null references users(id),
  name varchar(80) not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create unique index bookmark_collections_default_unique on bookmark_collections (user_id) where is_default = true and deleted_at is null;
create unique index bookmark_collections_user_name_unique on bookmark_collections (user_id, (lower(name))) where deleted_at is null;
create index bookmark_collections_user_created_idx on bookmark_collections (user_id, created_at desc) where deleted_at is null;

create table article_bookmarks (
  id bigserial primary key,
  collection_id bigint not null references bookmark_collections(id),
  article_id bigint not null references articles(id),
  user_id bigint not null references users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create unique index article_bookmarks_user_article_unique on article_bookmarks (user_id, article_id) where deleted_at is null;
create index article_bookmarks_collection_created_idx on article_bookmarks (collection_id, created_at desc) where deleted_at is null;
create index article_bookmarks_article_created_idx on article_bookmarks (article_id, created_at desc) where deleted_at is null;
create index article_bookmarks_user_created_idx on article_bookmarks (user_id, created_at desc) where deleted_at is null;

alter table notifications drop constraint notifications_type_check;
alter table notifications
  add constraint notifications_type_check check (type in ('comment_reply', 'article_comment', 'article_bookmark'));
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
delete from notifications where type = 'article_bookmark';
alter table notifications drop constraint notifications_type_check;
alter table notifications
  add constraint notifications_type_check check (type in ('comment_reply', 'article_comment'));
drop table if exists article_bookmarks;
drop table if exists bookmark_collections;
-- +goose StatementEnd
