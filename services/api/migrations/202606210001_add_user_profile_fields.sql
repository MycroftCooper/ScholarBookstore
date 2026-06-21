-- +goose Up
-- +goose StatementBegin
alter table users
  add column avatar_url text not null default '',
  add column bio varchar(200) not null default '',
  add column school varchar(100) not null default '',
  add column company varchar(100) not null default '';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
alter table users
  drop column if exists company,
  drop column if exists school,
  drop column if exists bio,
  drop column if exists avatar_url;
-- +goose StatementEnd
