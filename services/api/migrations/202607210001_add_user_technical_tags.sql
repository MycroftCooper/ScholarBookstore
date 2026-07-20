-- +goose Up
-- +goose StatementBegin
create function valid_user_technical_tags(tags text[])
returns boolean
language sql
immutable
strict
parallel safe
as $$
  select
    cardinality(tags) <= 10
    and not exists (
      select 1
      from unnest(tags) as item(tag)
      where tag is null
        or tag <> btrim(tag)
        or char_length(tag) = 0
        or char_length(tag) > 30
    )
    and (
      select count(*) = count(distinct lower(tag))
      from unnest(tags) as item(tag)
    );
$$;

alter table users
  add column technical_tags text[] not null default '{}',
  add constraint users_technical_tags_check
    check (valid_user_technical_tags(technical_tags));
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
alter table users
  drop constraint if exists users_technical_tags_check,
  drop column if exists technical_tags;

drop function if exists valid_user_technical_tags(text[]);
-- +goose StatementEnd
