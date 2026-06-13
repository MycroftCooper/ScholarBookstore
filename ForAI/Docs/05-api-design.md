# API 接口设计文档

## 1. 总体约定

- API 前缀：`/api/v1`。
- 响应格式遵守 `03-project-standards.md`。
- 认证方式：JWT + httpOnly Cookie。
- 角色：guest、user、reviewer、admin。
- 分页参数统一为 `page`、`pageSize`。
- `pageSize` 默认 20，最大 100。
- 第一版不提供论坛、帖子、主题帖相关接口。

通用错误：

- `VALIDATION_ERROR`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `PAYLOAD_TOO_LARGE`
- `UNSUPPORTED_MEDIA_TYPE`
- `INTERNAL_ERROR`

## 2. 认证接口

### 2.1 注册

- Method：`POST`
- Path：`/api/v1/auth/register`
- 登录：否
- 角色：guest

请求：

```json
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "password"
}
```

响应：返回用户基础信息。

错误：

- `VALIDATION_ERROR`
- `CONFLICT`

### 2.2 登录

- Method：`POST`
- Path：`/api/v1/auth/login`
- 登录：否
- 角色：guest

请求：

```json
{
  "email": "alice@example.com",
  "password": "password"
}
```

响应：返回用户基础信息，并通过 `Set-Cookie` 写入 httpOnly Cookie。

错误：

- `VALIDATION_ERROR`
- `UNAUTHORIZED`
- `FORBIDDEN`：用户被禁用。

### 2.3 退出登录

- Method：`POST`
- Path：`/api/v1/auth/logout`
- 登录：是
- 角色：user、reviewer、admin

响应：

```json
{
  "data": {
    "ok": true
  },
  "meta": {}
}
```

### 2.4 当前用户

- Method：`GET`
- Path：`/api/v1/auth/me`
- 登录：是
- 角色：user、reviewer、admin

响应：当前用户基础信息。

错误：

- `UNAUTHORIZED`

## 3. 版块接口

### 3.1 版块列表

- Method：`GET`
- Path：`/api/v1/modules`
- 登录：否
- 角色：guest、user、reviewer、admin

查询参数：

- `includeInactive`：仅 admin 可用，默认 `false`。

响应：版块列表。

错误：

- `FORBIDDEN`

### 3.2 版块详情

- Method：`GET`
- Path：`/api/v1/modules/{slug}`
- 登录：否
- 角色：guest、user、reviewer、admin

响应：版块详情。

错误：

- `NOT_FOUND`

### 3.3 创建版块

- Method：`POST`
- Path：`/api/v1/admin/modules`
- 登录：是
- 角色：admin

请求：

```json
{
  "slug": "database",
  "name": "数据库",
  "description": "数据库知识版块",
  "sortOrder": 0,
  "isActive": true
}
```

错误：

- `VALIDATION_ERROR`
- `CONFLICT`
- `FORBIDDEN`

### 3.4 更新版块

- Method：`PATCH`
- Path：`/api/v1/admin/modules/{id}`
- 登录：是
- 角色：admin

请求：允许更新 `name`、`description`、`sortOrder`、`isActive`。

错误：

- `VALIDATION_ERROR`
- `NOT_FOUND`
- `FORBIDDEN`

## 4. 文章接口

### 4.1 文章列表

- Method：`GET`
- Path：`/api/v1/articles`
- 登录：否
- 角色：guest、user、reviewer、admin

查询参数：

- `moduleSlug`
- `page`
- `pageSize`

响应：仅返回 `published` 且未删除文章。

错误：

- `VALIDATION_ERROR`

### 4.2 文章详情

- Method：`GET`
- Path：`/api/v1/articles/{id}`
- 登录：否
- 角色：guest、user、reviewer、admin

响应：已发布文章详情。

错误：

- `NOT_FOUND`：文章不存在、未发布或已删除。

### 4.3 创建投稿

- Method：`POST`
- Path：`/api/v1/articles`
- 登录：是
- 角色：user、reviewer、admin

请求：

```json
{
  "moduleId": 1,
  "title": "PostgreSQL 索引入门",
  "summary": "介绍常见索引类型",
  "contentMd": "## 正文"
}
```

响应：

```json
{
  "data": {
    "id": 1,
    "status": "pending_review"
  },
  "meta": {}
}
```

错误：

- `VALIDATION_ERROR`
- `UNAUTHORIZED`
- `FORBIDDEN`

### 4.4 我的投稿

- Method：`GET`
- Path：`/api/v1/me/articles`
- 登录：是
- 角色：user、reviewer、admin

查询参数：

- `status`
- `page`
- `pageSize`

响应：当前用户投稿列表。

错误：

- `UNAUTHORIZED`
- `VALIDATION_ERROR`

### 4.5 更新自己的未发布文章

- Method：`PATCH`
- Path：`/api/v1/articles/{id}`
- 登录：是
- 角色：user、reviewer、admin

请求：允许更新 `title`、`summary`、`contentMd`。

约束：

- 仅作者可更新。
- 已发布文章是否允许编辑为 TODO，默认不允许直接编辑。

错误：

- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`

## 5. 审核接口

### 5.1 待审核文章列表

- Method：`GET`
- Path：`/api/v1/admin/articles/reviews`
- 登录：是
- 角色：reviewer、admin

响应：`pending_review` 文章列表。

错误：

- `FORBIDDEN`

### 5.2 审核通过

- Method：`POST`
- Path：`/api/v1/admin/articles/{id}/approve`
- 登录：是
- 角色：reviewer、admin

请求：

```json
{
  "reviewNote": "通过"
}
```

错误：

- `NOT_FOUND`
- `CONFLICT`
- `FORBIDDEN`

### 5.3 审核拒绝

- Method：`POST`
- Path：`/api/v1/admin/articles/{id}/reject`
- 登录：是
- 角色：reviewer、admin

请求：

```json
{
  "reviewNote": "内容不完整，请补充示例"
}
```

错误：

- `VALIDATION_ERROR`
- `NOT_FOUND`
- `CONFLICT`
- `FORBIDDEN`

## 6. 评论接口

### 6.1 评论列表

- Method：`GET`
- Path：`/api/v1/articles/{id}/comments`
- 登录：否
- 角色：guest、user、reviewer、admin

查询参数：

- `page`
- `pageSize`

响应：文章下可见评论。返回结构应包含顶级评论及其回复，或返回扁平列表并带 `parentId`。TODO：前端展示结构实现前确认。

错误：

- `NOT_FOUND`

### 6.2 创建顶级评论

- Method：`POST`
- Path：`/api/v1/articles/{id}/comments`
- 登录：是
- 角色：user、reviewer、admin

请求：

```json
{
  "content": "写得很好"
}
```

错误：

- `VALIDATION_ERROR`
- `UNAUTHORIZED`
- `NOT_FOUND`

约束：

- 文章必须为 `published`。
- 评论他人文章时，后端创建 `article_comment` 通知给文章作者。
- 评论自己的文章时，不创建通知。

### 6.3 回复评论

- Method：`POST`
- Path：`/api/v1/comments/{id}/replies`
- 登录：是
- 角色：user、reviewer、admin

请求：

```json
{
  "content": "同意你的观点"
}
```

响应：新创建的回复评论。

约束：

- 被回复评论必须存在、未删除、可见。
- 被回复评论所属文章必须为 `published`。
- 回复自己不创建通知。
- 回复他人必须创建 `comment_reply` 通知。

错误：

- `VALIDATION_ERROR`
- `UNAUTHORIZED`
- `NOT_FOUND`
- `CONFLICT`

### 6.4 删除评论或回复

- Method：`DELETE`
- Path：`/api/v1/comments/{id}`
- 登录：是
- 角色：user、reviewer、admin

约束：

- 普通用户只能删除自己的评论或回复。
- reviewer、admin 可删除任意评论或回复。

错误：

- `FORBIDDEN`
- `NOT_FOUND`

### 6.5 我的评论

- Method：`GET`
- Path：`/api/v1/me/comments`
- 登录：是
- 角色：user、reviewer、admin

查询参数：

- `page`
- `pageSize`

响应：当前用户发表过的评论和回复。

错误：

- `UNAUTHORIZED`

## 7. 通知接口

### 7.1 我的通知

- Method：`GET`
- Path：`/api/v1/me/notifications`
- 登录：是
- 角色：user、reviewer、admin

查询参数：

- `unreadOnly`：可选，默认 `false`。
- `page`
- `pageSize`

响应：当前用户收到的通知。

通知类型：

- `article_comment`：文章收到顶级评论。
- `comment_reply`：评论被回复。

错误：

- `UNAUTHORIZED`

### 7.2 未读通知数量

- Method：`GET`
- Path：`/api/v1/me/notifications/unread-count`
- 登录：是
- 角色：user、reviewer、admin

响应：

```json
{
  "data": {
    "count": 3
  },
  "meta": {}
}
```

### 7.3 标记通知已读

- Method：`POST`
- Path：`/api/v1/me/notifications/{id}/read`
- 登录：是
- 角色：user、reviewer、admin

约束：

- 只能标记自己的通知。

错误：

- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`

### 7.4 全部标记已读

- Method：`POST`
- Path：`/api/v1/me/notifications/read-all`
- 登录：是
- 角色：user、reviewer、admin

响应：更新数量。

## 8. 上传接口

### 8.1 上传文章图片

- Method：`POST`
- Path：`/api/v1/uploads/article-images`
- 登录：是
- 角色：user、reviewer、admin
- Content-Type：`multipart/form-data`

请求字段：

- `file`：图片文件。
- `articleId`：可选，投稿前可为空。

响应：

```json
{
  "data": {
    "id": 1,
    "url": "/uploads/articles/2026/06/file.webp",
    "mimeType": "image/webp",
    "sizeBytes": 12345
  },
  "meta": {}
}
```

错误：

- `VALIDATION_ERROR`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `PAYLOAD_TOO_LARGE`
- `UNSUPPORTED_MEDIA_TYPE`

约束：

- 只允许图片 MIME。
- 默认最大大小 TODO：建议 5MB，需确认。
- 文件扩展名和 MIME 必须双重校验。
