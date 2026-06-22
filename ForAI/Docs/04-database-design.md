# 数据库设计文档

## 1. 总体约定

- 数据库：PostgreSQL。
- migration 工具：goose。
- 主键：统一使用 `bigserial`。
- 时间字段：统一使用 `timestamptz`。
- 软删除字段：统一使用 `deleted_at timestamptz null`。
- 公开查询默认过滤 `deleted_at is null`。
- 所有数据库结构变更必须创建 goose migration。
- 第一版不创建 `threads`、`thread_replies` 表。

## 2. 枚举值

推荐使用 text + check constraint，便于第一版迭代调整。

### 2.1 用户角色

| 值 | 说明 |
| --- | --- |
| `user` | 普通用户 |
| `reviewer` | 审核员 |
| `admin` | 管理员 |

游客不入库，游客由未登录状态表示。

### 2.2 用户状态

| 值 | 说明 |
| --- | --- |
| `active` | 正常 |
| `disabled` | 禁用 |

### 2.3 文章状态

| 值 | 说明 |
| --- | --- |
| `draft` | 草稿，TODO：MVP 是否做草稿箱需确认 |
| `pending_review` | 待审核 |
| `published` | 已发布 |
| `rejected` | 已拒绝 |
| `archived` | 已归档或下架 |

### 2.4 内容可见状态

用于评论和评论回复：

| 值 | 说明 |
| --- | --- |
| `visible` | 正常可见 |
| `hidden` | 被审核员或管理员隐藏 |

### 2.5 通知类型

| 值 | 说明 |
| --- | --- |
| `comment_reply` | 评论被回复 |
| `article_comment` | 文章收到顶级评论 |
| `article_bookmark` | 文章被收藏 |
| `followee_article` | 关注的用户发布了新文章 |

## 3. 表结构

### 3.1 users

用户表。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `bigserial` | PK | 用户 ID |
| `username` | `varchar(40)` | not null | 用户名 |
| `email` | `varchar(255)` | not null | 邮箱 |
| `password_hash` | `text` | not null | bcrypt 哈希 |
| `role` | `varchar(20)` | not null | `user`、`reviewer`、`admin` |
| `status` | `varchar(20)` | not null | `active`、`disabled` |
| `avatar_url` | `text` | not null default '' | 头像公开 URL，未上传时为空 |
| `bio` | `varchar(200)` | not null default '' | 个人简介 |
| `school` | `varchar(100)` | not null default '' | 学校 |
| `company` | `varchar(100)` | not null default '' | 公司 |
| `created_at` | `timestamptz` | not null | 创建时间 |
| `updated_at` | `timestamptz` | not null | 更新时间 |
| `deleted_at` | `timestamptz` | null | 软删除时间 |

索引：

- `unique index users_username_unique on users (lower(username)) where deleted_at is null`
- `unique index users_email_unique on users (lower(email)) where deleted_at is null`
- `index users_role_idx on users (role)`
- `index users_status_idx on users (status)`

说明：

- 邮箱和用户名比较必须大小写不敏感。
- 禁用用户不能登录。

### 3.2 domains

领域表。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `bigserial` | PK | 领域 ID |
| `slug` | `varchar(80)` | not null | URL/管理标识 |
| `name` | `varchar(80)` | not null | 领域名称 |
| `description` | `text` | not null default '' | 领域说明 |
| `sort_order` | `integer` | not null default 0 | 排序 |
| `is_active` | `boolean` | not null default true | 是否启用 |
| `created_at` | `timestamptz` | not null | 创建时间 |
| `updated_at` | `timestamptz` | not null | 更新时间 |
| `deleted_at` | `timestamptz` | null | 软删除时间 |

索引：

- `unique index domains_slug_unique on domains (slug) where deleted_at is null`
- `index domains_active_sort_idx on domains (is_active, sort_order)`

### 3.3 modules

版块表。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `bigserial` | PK | 版块 ID |
| `domain_id` | `bigint` | FK domains(id), not null | 所属领域 |
| `slug` | `varchar(80)` | not null | URL 标识 |
| `name` | `varchar(80)` | not null | 版块名称 |
| `description` | `text` | not null default '' | 版块说明 |
| `sort_order` | `integer` | not null default 0 | 排序 |
| `is_active` | `boolean` | not null default true | 是否启用 |
| `created_at` | `timestamptz` | not null | 创建时间 |
| `updated_at` | `timestamptz` | not null | 更新时间 |
| `deleted_at` | `timestamptz` | null | 软删除时间 |

索引：

- `unique index modules_slug_unique on modules (slug) where deleted_at is null`
- `index modules_active_sort_idx on modules (is_active, sort_order)`
- `index modules_domain_sort_idx on modules (domain_id, is_active, sort_order) where deleted_at is null`

说明：

- 普通用户只能向 `is_active = true` 且未删除版块投稿。

### 3.4 articles

文章表。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `bigserial` | PK | 文章 ID |
| `module_id` | `bigint` | FK modules(id), not null | 所属版块 |
| `author_id` | `bigint` | FK users(id), not null | 作者 |
| `title` | `varchar(160)` | not null | 标题 |
| `slug` | `varchar(180)` | null | TODO：是否需要文章 slug |
| `summary` | `varchar(300)` | not null default '' | 摘要 |
| `content_md` | `text` | not null | Markdown 正文 |
| `status` | `varchar(30)` | not null | 文章状态 |
| `reviewed_by` | `bigint` | FK users(id), null | 审核人 |
| `reviewed_at` | `timestamptz` | null | 审核时间 |
| `review_note` | `text` | not null default '' | 审核说明或拒绝原因 |
| `published_at` | `timestamptz` | null | 发布时间 |
| `revision_of_article_id` | `bigint` | FK articles(id), null | 修订稿指向的原文 ID；普通文章为空 |
| `word_count` | `integer` | not null default 0 | 正文字数/字符数，用于文章元数据 |
| `reading_minutes` | `integer` | not null default 1 | 预计阅读时长，最小 1 分钟 |
| `view_count` | `bigint` | not null default 0 | 已发布文章浏览量 |
| `revision_count` | `integer` | not null default 0 | 修订版本数，修订模块接入后递增 |
| `created_at` | `timestamptz` | not null | 创建时间 |
| `updated_at` | `timestamptz` | not null | 更新时间 |
| `deleted_at` | `timestamptz` | null | 软删除时间 |

索引：

- `index articles_module_status_published_idx on articles (module_id, status, published_at desc) where deleted_at is null`
- `index articles_author_created_idx on articles (author_id, created_at desc) where deleted_at is null`
- `index articles_status_created_idx on articles (status, created_at desc) where deleted_at is null`
- `unique index articles_slug_unique on articles (slug) where slug is not null and deleted_at is null`
- `unique index articles_active_revision_unique on articles (revision_of_article_id) where revision_of_article_id is not null and deleted_at is null and status in ('draft', 'pending_review', 'rejected')`
- `index articles_revision_of_idx on articles (revision_of_article_id) where revision_of_article_id is not null`

说明：

- 游客只能查看 `status = 'published'` 且未删除文章。
- 作者可查看自己的未发布文章。
- 审核员和管理员可查看待审核文章。
- 作者修订已发布文章时创建一条 `pending_review` 修订稿，原文保持 `published`。
- 修订稿审核通过后替换原文内容并递增原文 `revision_count`，修订稿软删除。

### 3.5 tags 与 article_tags

标签表与文章标签关系表。

`tags`：

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `bigserial` | PK | 标签 ID |
| `name` | `varchar(30)` | not null | 展示名称 |
| `slug` | `varchar(40)` | not null | 去重标识，支持中英文与数字 |
| `usage_count` | `integer` | not null default 0 | 使用次数 |
| `created_at` | `timestamptz` | not null | 创建时间 |
| `updated_at` | `timestamptz` | not null | 更新时间 |

`article_tags`：

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `article_id` | `bigint` | FK articles(id), PK | 文章 ID |
| `tag_id` | `bigint` | FK tags(id), PK | 标签 ID |
| `created_at` | `timestamptz` | not null | 绑定时间 |

索引：

- `unique index tags_slug_unique on tags (slug)`
- `index tags_usage_count_idx on tags (usage_count desc, name asc)`
- `index article_tags_tag_idx on article_tags (tag_id, article_id)`

说明：

- 投稿和编辑文章最多绑定 9 个标签。
- 标签自由创建，按 slug 去重。
- 文章标签变更时同步维护 `tags.usage_count`。

### 3.6 comments

文章评论表，同时支持评论回复。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `bigserial` | PK | 评论 ID |
| `article_id` | `bigint` | FK articles(id), not null | 所属文章 |
| `author_id` | `bigint` | FK users(id), not null | 评论作者 |
| `parent_id` | `bigint` | FK comments(id), null | 被回复的评论 ID；为空表示顶级评论 |
| `reply_to_user_id` | `bigint` | FK users(id), null | 被回复用户 ID |
| `content` | `text` | not null | 评论内容 |
| `visibility` | `varchar(20)` | not null default `visible` | 可见状态 |
| `created_at` | `timestamptz` | not null | 创建时间 |
| `updated_at` | `timestamptz` | not null | 更新时间 |
| `deleted_at` | `timestamptz` | null | 软删除时间 |

索引：

- `index comments_article_created_idx on comments (article_id, created_at asc) where deleted_at is null`
- `index comments_parent_created_idx on comments (parent_id, created_at asc) where deleted_at is null`
- `index comments_author_created_idx on comments (author_id, created_at desc) where deleted_at is null`
- `index comments_reply_to_user_idx on comments (reply_to_user_id, created_at desc) where deleted_at is null`

说明：

- `parent_id is null` 表示文章下的顶级评论。
- `parent_id is not null` 表示对评论的回复。
- MVP 允许回复任意评论，但展示层可按两层结构呈现：顶级评论 + 回复列表。
- 创建回复时必须校验父评论属于同一篇文章。
- 创建回复时，如果 `reply_to_user_id != author_id`，必须创建通知。

### 3.6a comment_votes

评论赞踩表。每个用户对同一条评论最多保留一条赞或踩记录。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `bigserial` | PK | 赞踩 ID |
| `comment_id` | `bigint` | FK comments(id), not null | 被赞踩的评论 |
| `user_id` | `bigint` | FK users(id), not null | 操作用户 |
| `value` | `smallint` | not null | `1` 表示赞，`-1` 表示踩 |
| `created_at` | `timestamptz` | not null | 创建时间 |
| `updated_at` | `timestamptz` | not null | 更新时间 |

索引：

- `unique index comment_votes_comment_user_unique on comment_votes (comment_id, user_id)`
- `index comment_votes_user_created_idx on comment_votes (user_id, created_at desc)`
- `index comment_votes_comment_value_idx on comment_votes (comment_id, value)`

说明：

- 再次点击同一种赞/踩时前端传 `value = 0`，后端删除该用户的赞踩记录。
- 从赞切换到踩或从踩切换到赞时，后端更新同一条记录。
- 只能对可见、未删除且所属文章已发布的评论赞踩，不可对自己的评论投票。

### 3.6 notifications

站内通知表。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `bigserial` | PK | 通知 ID |
| `recipient_id` | `bigint` | FK users(id), not null | 接收人 |
| `actor_id` | `bigint` | FK users(id), not null | 触发人 |
| `type` | `varchar(40)` | not null | 通知类型 |
| `article_id` | `bigint` | FK articles(id), null | 关联文章 |
| `comment_id` | `bigint` | FK comments(id), null | 触发通知的评论或回复 |
| `read_at` | `timestamptz` | null | 已读时间 |
| `created_at` | `timestamptz` | not null | 创建时间 |
| `deleted_at` | `timestamptz` | null | 软删除时间 |

索引：

- `index notifications_recipient_created_idx on notifications (recipient_id, created_at desc) where deleted_at is null`
- `index notifications_recipient_unread_idx on notifications (recipient_id, read_at) where deleted_at is null`
- `index notifications_actor_created_idx on notifications (actor_id, created_at desc) where deleted_at is null`

说明：

- MVP 已做 `comment_reply`、`article_comment`、`article_bookmark`、`followee_article` 类型。
- 用户只能查看自己的通知。
- 通知删除为软删除。
- 回复自己不创建通知。

### 3.7 article_images

文章图片表。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `bigserial` | PK | 图片 ID |
| `article_id` | `bigint` | FK articles(id), null | 关联文章，投稿前可为空 |
| `uploaded_by` | `bigint` | FK users(id), not null | 上传者 |
| `original_filename` | `varchar(255)` | not null | 原始文件名 |
| `stored_filename` | `varchar(255)` | not null | 存储文件名 |
| `mime_type` | `varchar(100)` | not null | MIME 类型 |
| `size_bytes` | `bigint` | not null | 文件大小 |
| `url` | `text` | not null | 公开访问 URL |
| `created_at` | `timestamptz` | not null | 创建时间 |
| `deleted_at` | `timestamptz` | null | 软删除时间 |

索引：

- `unique index article_images_stored_filename_unique on article_images (stored_filename) where deleted_at is null`
- `index article_images_article_idx on article_images (article_id) where deleted_at is null`
- `index article_images_uploaded_by_created_idx on article_images (uploaded_by, created_at desc) where deleted_at is null`

说明：

- 上传后未绑定文章的图片需要后台清理策略。TODO：清理周期后续确认。
- 图片软删除不一定立即删除物理文件，物理清理策略后续确认。

### 3.8 bookmark_collections

用户收藏夹表。默认收藏夹由后端在用户首次查看或收藏时自动创建。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `bigserial` | PK | 收藏夹 ID |
| `user_id` | `bigint` | FK users(id), not null | 所属用户 |
| `name` | `varchar(80)` | not null | 收藏夹名称 |
| `is_default` | `boolean` | not null default false | 是否默认收藏夹 |
| `created_at` | `timestamptz` | not null | 创建时间 |
| `updated_at` | `timestamptz` | not null | 更新时间 |
| `deleted_at` | `timestamptz` | null | 软删除时间 |

索引：

- `unique index bookmark_collections_default_unique on bookmark_collections (user_id) where is_default = true and deleted_at is null`
- `unique index bookmark_collections_user_name_unique on bookmark_collections (user_id, lower(name)) where deleted_at is null`
- `index bookmark_collections_user_created_idx on bookmark_collections (user_id, created_at desc) where deleted_at is null`

### 3.9 article_bookmarks

文章收藏表。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `bigserial` | PK | 收藏 ID |
| `collection_id` | `bigint` | FK bookmark_collections(id), not null | 所属收藏夹 |
| `article_id` | `bigint` | FK articles(id), not null | 被收藏文章 |
| `user_id` | `bigint` | FK users(id), not null | 收藏用户 |
| `created_at` | `timestamptz` | not null | 收藏时间 |
| `deleted_at` | `timestamptz` | null | 取消收藏时间 |

索引：

- `unique index article_bookmarks_user_article_unique on article_bookmarks (user_id, article_id) where deleted_at is null`
- `index article_bookmarks_collection_created_idx on article_bookmarks (collection_id, created_at desc) where deleted_at is null`
- `index article_bookmarks_article_created_idx on article_bookmarks (article_id, created_at desc) where deleted_at is null`
- `index article_bookmarks_user_created_idx on article_bookmarks (user_id, created_at desc) where deleted_at is null`

说明：

- 用户只能收藏 `published` 且未删除文章。
- 同一用户对同一篇文章只能有一个未删除收藏。
- 收藏他人文章时创建 `article_bookmark` 通知。

### 3.10 user_follows

用户关注关系表。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `bigserial` | PK | 关注关系 ID |
| `follower_id` | `bigint` | FK users(id), not null | 关注者 |
| `followed_id` | `bigint` | FK users(id), not null | 被关注者 |
| `created_at` | `timestamptz` | not null | 关注时间 |

索引：

- `unique index user_follows_unique on user_follows (follower_id, followed_id)`
- `index user_follows_follower_idx on user_follows (follower_id, created_at desc)`
- `index user_follows_followed_idx on user_follows (followed_id, created_at desc)`

说明：

- 不能关注自己（应用层校验）。
- 不能重复关注同一用户（唯一索引保证）。
- 取关时物理删除记录（不适用软删除，关注关系是轻量操作）。
- 查询粉丝数/关注数使用 `count(*)` 配合索引。
- 被关注者文章审核通过为新发布文章时，后端在审核事务中创建 `followee_article` 通知。

### 3.11 article_reports

文章举报表。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `bigserial` | PK | 举报 ID |
| `article_id` | `bigint` | FK articles(id), not null | 被举报文章 |
| `reporter_id` | `bigint` | FK users(id), not null | 举报人 |
| `reason` | `text` | not null | 举报原因 |
| `status` | `varchar(20)` | not null default `pending` | `pending`、`resolved`、`rejected` |
| `handled_by` | `bigint` | FK users(id), null | 处理人 |
| `handled_at` | `timestamptz` | null | 处理时间 |
| `handle_note` | `text` | not null default '' | 处理说明 |
| `created_at` | `timestamptz` | not null | 创建时间 |
| `updated_at` | `timestamptz` | not null | 更新时间 |
| `deleted_at` | `timestamptz` | null | 软删除时间 |

索引：

- `unique index article_reports_pending_unique on article_reports (article_id, reporter_id) where status = 'pending' and deleted_at is null`
- `index article_reports_status_created_idx on article_reports (status, created_at desc) where deleted_at is null`

## 4. 外键策略

- 用户删除不级联删除文章、评论、通知，保留历史内容并使用软删除或禁用。
- 用户删除时级联删除关注关系（`user_follows`，无论作为关注者还是被关注者）。
- 版块删除不级联删除文章，默认软删除版块并隐藏入口。
- 文章删除不物理删除评论和通知。
- 父评论删除不物理删除子回复，展示时可显示“原评论已删除”或隐藏整组。TODO：具体展示策略后续确认。

## 5. 软删除策略

- 所有公开查询必须过滤 `deleted_at is null`。
- 管理后台可查看软删除内容，TODO：是否提供恢复功能后续确认。
- 删除操作默认写入 `deleted_at`，不执行物理删除。
- 用户上传文件的物理删除由运维清理任务或人工处理，第一版不自动清理。
