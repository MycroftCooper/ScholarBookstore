-- +goose Up
-- +goose StatementBegin
alter table articles
  add column revision_of_article_id bigint null references articles(id);

create unique index articles_active_revision_unique
  on articles (revision_of_article_id)
  where revision_of_article_id is not null
    and deleted_at is null
    and status in ('draft', 'pending_review', 'rejected');

create index articles_revision_of_idx
  on articles (revision_of_article_id)
  where revision_of_article_id is not null;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
drop index if exists articles_revision_of_idx;
drop index if exists articles_active_revision_unique;

alter table articles
  drop column if exists revision_of_article_id;
-- +goose StatementEnd
