-- +goose Up
-- +goose StatementBegin
delete from comment_votes where value = -1;
alter table comment_votes drop constraint comment_votes_value_check;
alter table comment_votes
  add constraint comment_votes_value_check check (value = 1);
drop index if exists comment_votes_comment_value_idx;

delete from article_votes where value = -1;
alter table article_votes drop constraint article_votes_value_check;
alter table article_votes
  add constraint article_votes_value_check check (value = 1);
drop index if exists article_votes_article_value_idx;

delete from moderation_tasks where task_type = 'role_request';
alter table moderation_tasks drop constraint moderation_tasks_type_check;
alter table moderation_tasks
  add constraint moderation_tasks_type_check check (
    task_type in ('article_review', 'content_report', 'comment_report', 'user_report', 'appeal', 'module_create_request')
  );
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
alter table moderation_tasks drop constraint moderation_tasks_type_check;
alter table moderation_tasks
  add constraint moderation_tasks_type_check check (
    task_type in ('article_review', 'content_report', 'comment_report', 'user_report', 'appeal', 'role_request', 'module_create_request')
  );

alter table article_votes drop constraint article_votes_value_check;
alter table article_votes
  add constraint article_votes_value_check check (value in (-1, 1));
create index if not exists article_votes_article_value_idx on article_votes (article_id, value);

alter table comment_votes drop constraint comment_votes_value_check;
alter table comment_votes
  add constraint comment_votes_value_check check (value in (-1, 1));
create index if not exists comment_votes_comment_value_idx on comment_votes (comment_id, value);
-- +goose StatementEnd
