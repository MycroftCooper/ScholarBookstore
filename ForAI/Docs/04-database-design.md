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

### 3.2 modules

版块表。

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | `bigserial` | PK | 版块 ID |
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

说明：

- 普通用户只能向 `is_active = true` 且未删除版块投稿。

### 3.3 articles

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
| `created_at` | `timestamptz` | not null | 创建时间 |
| `updated_at` | `timestamptz` | not null | 更新时间 |
| `deleted_at` | `timestamptz` | null | 软删除时间 |

索引：

- `index articles_module_status_published_idx on articles (module_id, status, published_at desc) where deleted_at is null`
- `index articles_author_created_idx on articles (author_id, created_at desc) where deleted_at is null`
- `index articles_status_created_idx on articles (status, created_at desc) where deleted_at is null`
- `unique index articles_slug_unique on articles (slug) where slug is not null and deleted_at is null`

说明：

- 游客只能查看 `status = 'published'` 且未删除文章。
- 作者可查看自己的未发布文章。
- 审核员和管理员可查看待审核文章。

### 3.4 comments

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

### 3.5 notifications

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

- MVP 只做 `comment_reply` 类型。
- 用户只能查看自己的通知。
- 通知删除为软删除。
- 回复自己不创建通知。

### 3.6 article_images

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

## 4. 外键策略

- 用户删除不级联删除文章、评论、通知，保留历史内容并使用软删除或禁用。
- 版块删除不级联删除文章，默认软删除版块并隐藏入口。
- 文章删除不物理删除评论和通知。
- 父评论删除不物理删除子回复，展示时可显示“原评论已删除”或隐藏整组。TODO：具体展示策略后续确认。

## 5. 软删除策略

- 所有公开查询必须过滤 `deleted_at is null`。
- 管理后台可查看软删除内容，TODO：是否提供恢复功能后续确认。
- 删除操作默认写入 `deleted_at`，不执行物理删除。
- 用户上传文件的物理删除由运维清理任务或人工处理，第一版不自动清理。

