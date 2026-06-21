-- +goose Up
-- +goose StatementBegin
create table domains (
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

create unique index domains_slug_unique on domains (slug) where deleted_at is null;
create index domains_active_sort_idx on domains (is_active, sort_order);

insert into domains (slug, name, description, sort_order, is_active)
values ('general', '通用领域', '现有版块的默认归属领域', 0, true);

alter table modules add column domain_id bigint null references domains(id);

update modules
set domain_id = (select id from domains where slug = 'general' and deleted_at is null limit 1)
where domain_id is null;

alter table modules alter column domain_id set not null;
create index modules_domain_sort_idx on modules (domain_id, is_active, sort_order) where deleted_at is null;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
drop index if exists modules_domain_sort_idx;
alter table modules drop column if exists domain_id;
drop table if exists domains;
-- +goose StatementEnd
