-- +goose Up
-- +goose StatementBegin
alter table notifications drop constraint notifications_type_check;
alter table notifications
  add constraint notifications_type_check check (type in ('comment_reply', 'article_comment'));
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
delete from notifications where type = 'article_comment';
alter table notifications drop constraint notifications_type_check;
alter table notifications
  add constraint notifications_type_check check (type in ('comment_reply'));
-- +goose StatementEnd
