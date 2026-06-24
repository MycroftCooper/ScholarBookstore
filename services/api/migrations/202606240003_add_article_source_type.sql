-- +goose Up
alter table articles
  add column source_type varchar(20) not null default 'original';

alter table articles
  add constraint articles_source_type_check check (source_type in ('original', 'reprint'));

-- +goose Down
alter table articles
  drop constraint if exists articles_source_type_check;

alter table articles
  drop column if exists source_type;
