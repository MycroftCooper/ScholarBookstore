-- +goose Up
-- +goose StatementBegin
create table users (
  id bigserial primary key,
  username varchar(40) not null,
  email varchar(255) not null,
  password_hash text not null,
  role varchar(20) not null default 'user',
  status varchar(20) not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint users_role_check check (role in ('user', 'reviewer', 'admin')),
  constraint users_status_check check (status in ('active', 'disabled'))
);

create unique index users_username_unique on users (lower(username)) where deleted_at is null;
create unique index users_email_unique on users (lower(email)) where deleted_at is null;
create index users_role_idx on users (role);
create index users_status_idx on users (status);

create table modules (
  id bigserial primary key,
  slug varchar(80) not null,
  name varchar(80) not null,
  description text not null default '',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create unique index modules_slug_unique on modules (slug) where deleted_at is null;
create index modules_active_sort_idx on modules (is_active, sort_order);

create table articles (
  id bigserial primary key,
  module_id bigint not null references modules(id),
  author_id bigint not null references users(id),
  title varchar(160) not null,
  slug varchar(180) null,
  summary varchar(300) not null default '',
  content_md text not null,
  status varchar(30) not null,
  reviewed_by bigint null references users(id),
  reviewed_at timestamptz null,
  review_note text not null default '',
  published_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint articles_status_check check (status in ('draft', 'pending_review', 'published', 'rejected', 'archived'))
);

create index articles_module_status_published_idx on articles (module_id, status, published_at desc) where deleted_at is null;
create index articles_author_created_idx on articles (author_id, created_at desc) where deleted_at is null;
create index articles_status_created_idx on articles (status, created_at desc) where deleted_at is null;
create unique index articles_slug_unique on articles (slug) where slug is not null and deleted_at is null;

create table comments (
  id bigserial primary key,
  article_id bigint not null references articles(id),
  author_id bigint not null references users(id),
  parent_id bigint null references comments(id),
  reply_to_user_id bigint null references users(id),
  content text not null,
  visibility varchar(20) not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint comments_visibility_check check (visibility in ('visible', 'hidden'))
);

create index comments_article_created_idx on comments (article_id, created_at asc) where deleted_at is null;
create index comments_parent_created_idx on comments (parent_id, created_at asc) where deleted_at is null;
create index comments_author_created_idx on comments (author_id, created_at desc) where deleted_at is null;
create index comments_reply_to_user_idx on comments (reply_to_user_id, created_at desc) where deleted_at is null;

create table notifications (
  id bigserial primary key,
  recipient_id bigint not null references users(id),
  actor_id bigint not null references users(id),
  type varchar(40) not null,
  article_id bigint null references articles(id),
  comment_id bigint null references comments(id),
  read_at timestamptz null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz null,
  constraint notifications_type_check check (type in ('comment_reply'))
);

create index notifications_recipient_created_idx on notifications (recipient_id, created_at desc) where deleted_at is null;
create index notifications_recipient_unread_idx on notifications (recipient_id, read_at) where deleted_at is null;
create index notifications_actor_created_idx on notifications (actor_id, created_at desc) where deleted_at is null;

create table article_images (
  id bigserial primary key,
  article_id bigint null references articles(id),
  uploaded_by bigint not null references users(id),
  original_filename varchar(255) not null,
  stored_filename varchar(255) not null,
  mime_type varchar(100) not null,
  size_bytes bigint not null,
  url text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create unique index article_images_stored_filename_unique on article_images (stored_filename) where deleted_at is null;
create index article_images_article_idx on article_images (article_id) where deleted_at is null;
create index article_images_uploaded_by_created_idx on article_images (uploaded_by, created_at desc) where deleted_at is null;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
drop table if exists article_images;
drop table if exists notifications;
drop table if exists comments;
drop table if exists articles;
drop table if exists modules;
drop table if exists users;
-- +goose StatementEnd
