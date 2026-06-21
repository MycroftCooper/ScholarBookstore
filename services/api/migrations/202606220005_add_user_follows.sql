-- +goose Up
-- +goose StatementBegin
create table user_follows (
  id bigserial primary key,
  follower_id bigint not null references users(id),
  followed_id bigint not null references users(id),
  created_at timestamptz not null default now(),
  constraint user_follows_not_self_check check (follower_id <> followed_id)
);

create unique index user_follows_unique on user_follows (follower_id, followed_id);
create index user_follows_follower_idx on user_follows (follower_id, created_at desc);
create index user_follows_followed_idx on user_follows (followed_id, created_at desc);

alter table notifications drop constraint notifications_type_check;
alter table notifications
  add constraint notifications_type_check check (type in ('comment_reply', 'article_comment', 'article_bookmark', 'followee_article'));
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
delete from notifications where type = 'followee_article';
alter table notifications drop constraint notifications_type_check;
alter table notifications
  add constraint notifications_type_check check (type in ('comment_reply', 'article_comment', 'article_bookmark'));
drop table if exists user_follows;
-- +goose StatementEnd
