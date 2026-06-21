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

### 2.5 更新个人资料

- Method：`PATCH`
- Path：`/api/v1/me/profile`
- 登录：是
- 角色：user、reviewer、admin

请求：

```json
{
  "bio": "后端工程师，关注数据库与 Go",
  "school": "示例大学",
  "company": "示例公司"
}
```

约束：

- `bio` 最长 200 字。
- `school`、`company` 最长 100 字。
- 只能更新自己的资料。

响应：返回当前用户基础信息与资料字段。

错误：

- `VALIDATION_ERROR`
- `UNAUTHORIZED`

### 2.6 上传头像

- Method：`POST`
- Path：`/api/v1/me/avatar`
- 登录：是
- 角色：user、reviewer、admin
- Content-Type：`multipart/form-data`

请求字段：

- `file`：头像图片。

约束：

- 仅允许 jpeg/png/webp。
- 最大 2MB。
- 后端生成文件名并存储到本地 uploads。
- 上传成功后更新当前用户 `avatarUrl`。

响应：返回当前用户基础信息与资料字段。

错误：

- `VALIDATION_ERROR`
- `UNAUTHORIZED`
- `PAYLOAD_TOO_LARGE`
- `UNSUPPORTED_MEDIA_TYPE`

## 3. 领域接口

### 3.1 领域列表

- Method：`GET`
- Path：`/api/v1/domains`
- 登录：否
- 角色：guest、user、reviewer、admin

查询参数：

- `includeInactive`：仅 admin 可用，默认 `false`。

响应：领域列表。

错误：

- `FORBIDDEN`

### 3.2 领域详情

- Method：`GET`
- Path：`/api/v1/domains/{id}`
- 登录：否
- 角色：guest、user、reviewer、admin

响应：领域详情，包含该领域下启用版块列表。

错误：

- `NOT_FOUND`

### 3.3 创建领域

- Method：`POST`
- Path：`/api/v1/admin/domains`
- 登录：是
- 角色：admin

请求：

```json
{
  "slug": "backend",
  "name": "后端开发",
  "description": "后端开发知识领域",
  "sortOrder": 0,
  "isActive": true
}
```

错误：

- `VALIDATION_ERROR`
- `CONFLICT`
- `FORBIDDEN`

### 3.4 更新领域

- Method：`PATCH`
- Path：`/api/v1/admin/domains/{id}`
- 登录：是
- 角色：admin

请求：允许更新 `name`、`description`、`sortOrder`、`isActive`。

错误：

- `VALIDATION_ERROR`
- `NOT_FOUND`
- `FORBIDDEN`

## 4. 版块接口

### 4.1 版块列表

- Method：`GET`
- Path：`/api/v1/modules`
- 登录：否
- 角色：guest、user、reviewer、admin

查询参数：

- `includeInactive`：仅 admin 可用，默认 `false`。

响应：版块列表。

错误：

- `FORBIDDEN`

### 4.2 版块详情

- Method：`GET`
- Path：`/api/v1/modules/{slug}`
- 登录：否
- 角色：guest、user、reviewer、admin

响应：版块详情。

错误：

- `NOT_FOUND`

### 4.3 创建版块

- Method：`POST`
- Path：`/api/v1/admin/modules`
- 登录：是
- 角色：admin

请求：

```json
{
  "domainId": 1,
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

### 4.4 更新版块

- Method：`PATCH`
- Path：`/api/v1/admin/modules/{id}`
- 登录：是
- 角色：admin

请求：允许更新 `domainId`、`name`、`description`、`sortOrder`、`isActive`。

错误：

- `VALIDATION_ERROR`
- `NOT_FOUND`
- `FORBIDDEN`

## 5. 文章接口

### 5.1 文章列表

- Method：`GET`
- Path：`/api/v1/articles`
- 登录：否
- 角色：guest、user、reviewer、admin

查询参数：

- `moduleSlug`
- `q`：可选，按标题、摘要、正文模糊搜索已发布文章。
- `tag`：可选，按 Tag slug 筛选已发布文章。
- `sort`：可选，`latest`、`hot`、`random`，默认 `latest`。
- `page`
- `pageSize`

响应：仅返回 `published` 且未删除文章。`hot` 按浏览量和发布时间衰减排序，`random` 返回随机文章。

错误：

- `VALIDATION_ERROR`

### 5.2 文章详情

- Method：`GET`
- Path：`/api/v1/articles/{id}`
- 登录：否
- 角色：guest、user、reviewer、admin

响应：已发布文章详情。读取成功后后端会递增 `viewCount`。

响应文章对象包含 `tags`：

```json
{
  "tags": [
    {
      "id": 1,
      "name": "PostgreSQL",
      "slug": "postgresql",
      "usageCount": 12
    }
  ]
}
```

错误：

- `NOT_FOUND`：文章不存在、未发布或已删除。

### 5.3 创建投稿

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
  "contentMd": "## 正文",
  "status": "pending_review",
  "tags": ["PostgreSQL", "数据库"]
}
```

约束：

- `status` 可选，允许 `draft` 或 `pending_review`。
- 未传 `status` 时默认 `pending_review`。
- `draft` 允许正文为空；`pending_review` 必须有正文。
- 后端根据 `contentMd` 写入 `wordCount` 和 `readingMinutes`。
- `tags` 可选，最多 9 个，每个最长 30 字；后端自由创建并按 slug 去重。

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

### 5.4 我的投稿

- Method：`GET`
- Path：`/api/v1/me/articles`
- 登录：是
- 角色：user、reviewer、admin

查询参数：

- `status`：可选，允许 `draft`、`pending_review`、`published`、`rejected`、`archived`。
- `page`
- `pageSize`

响应：当前用户投稿列表。

错误：

- `UNAUTHORIZED`
- `VALIDATION_ERROR`

### 5.5 我的单篇投稿

- Method：`GET`
- Path：`/api/v1/me/articles/{id}`
- 登录：是
- 角色：user、reviewer、admin

响应：当前用户自己的单篇投稿，包含 Markdown 正文和审核说明。

错误：

- `UNAUTHORIZED`
- `NOT_FOUND`

### 5.6 更新自己的投稿或发起修订

- Method：`PATCH`
- Path：`/api/v1/articles/{id}`
- 登录：是
- 角色：user、reviewer、admin

请求：允许更新 `title`、`summary`、`contentMd`、`status`、`tags`。

```json
{
  "title": "PostgreSQL 索引入门",
  "summary": "介绍常见索引类型",
  "contentMd": "## 正文",
  "status": "pending_review",
  "tags": ["PostgreSQL", "数据库"]
}
```

约束：

- 仅作者可更新。
- 允许更新 `draft`、`pending_review`、`rejected`。
- 当目标文章为 `published` 且 `status = "pending_review"` 时，创建一条修订稿；原文保持公开。
- `status` 可选，允许 `draft` 或 `pending_review`。
- `draft` 可保存为空正文；`pending_review` 必须有正文。
- `rejected` 文章更新后重新进入 `pending_review`，并清空旧审核说明。
- 更新正文时后端重新计算 `wordCount` 和 `readingMinutes`。
- 更新 `tags` 时替换整组文章标签；最多 9 个，每个最长 30 字。
- 同一篇已发布原文同时只允许存在一条未完成修订稿。

错误：

- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`：当前状态不允许编辑，或该原文已存在未完成修订稿。

## 6. 审核接口

### 6.0 后台文章列表

- Method：`GET`
- Path：`/api/v1/admin/articles`
- 登录：是
- 角色：reviewer、admin

查询参数：

- `status`：可选，筛选文章状态。
- `page`
- `pageSize`

响应：后台文章列表，用于内容管理。

错误：

- `VALIDATION_ERROR`
- `FORBIDDEN`

### 6.1 待审核文章列表

- Method：`GET`
- Path：`/api/v1/admin/articles/reviews`
- 登录：是
- 角色：reviewer、admin

响应：`pending_review` 文章列表。

错误：

- `FORBIDDEN`

### 6.2 审核通过

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

约束：

- 普通投稿审核通过后变为 `published` 并设置 `publishedAt`。
- 修订稿审核通过后，用修订稿内容替换原文，原文 `revisionCount + 1`，修订稿软删除。

错误：

- `NOT_FOUND`
- `CONFLICT`
- `FORBIDDEN`

### 6.3 审核拒绝

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

### 6.4 隐藏已发布文章

- Method：`POST`
- Path：`/api/v1/admin/articles/{id}/archive`
- 登录：是
- 角色：reviewer、admin

约束：

- 仅允许 `published -> archived`。
- `archived` 文章不在公开文章列表和详情中展示。

错误：

- `NOT_FOUND`
- `CONFLICT`
- `FORBIDDEN`

### 6.5 恢复隐藏文章

- Method：`POST`
- Path：`/api/v1/admin/articles/{id}/restore`
- 登录：是
- 角色：reviewer、admin

约束：

- 仅允许 `archived -> published`。

错误：

- `NOT_FOUND`
- `CONFLICT`
- `FORBIDDEN`

错误：

- `VALIDATION_ERROR`
- `NOT_FOUND`
- `CONFLICT`
- `FORBIDDEN`

## 7. 评论接口

### 7.1 评论列表

- Method：`GET`
- Path：`/api/v1/articles/{id}/comments`
- 登录：是
- 角色：user、reviewer、admin

查询参数：

- `sort`：可选，`latest` 或 `hot`，默认 `latest`。
- `page`
- `pageSize`

响应：文章下可见评论。当前返回扁平列表并带 `parentId`，前端按顶级评论和回复展示。评论对象包含 `upVotes`、`downVotes`、`score`、`myVote`。

错误：

- `UNAUTHORIZED`
- `VALIDATION_ERROR`
- `NOT_FOUND`

### 7.2 创建顶级评论

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

### 7.3 回复评论

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

### 7.4 删除评论或回复

- Method：`DELETE`
- Path：`/api/v1/comments/{id}`
- 登录：是
- 角色：user、reviewer、admin

约束：

- 普通用户只能删除自己的评论或回复。
- reviewer、admin 可删除任意评论或回复。

### 7.5 评论赞踩

- Method：`PUT`
- Path：`/api/v1/comments/{id}/vote`
- 登录：是
- 角色：user、reviewer、admin

请求：

```json
{
  "value": 1
}
```

约束：

- `value = 1` 表示赞。
- `value = -1` 表示踩。
- `value = 0` 表示取消当前赞/踩。
- 只能对可见、未删除且所属文章已发布的评论赞踩。
- 同一用户对同一评论最多保留一条赞踩记录，切换时覆盖旧值。

响应：更新后的评论对象，包含赞踩统计与当前用户 `myVote`。

错误：

- `VALIDATION_ERROR`
- `UNAUTHORIZED`
- `NOT_FOUND`

错误：

- `FORBIDDEN`
- `NOT_FOUND`

### 7.5 我的评论

- Method：`GET`
- Path：`/api/v1/me/comments`
- 登录：是
- 角色：user、reviewer、admin

查询参数：

- `page`
- `pageSize`

响应：当前用户发表过的评论和回复。

### 7.6 后台评论列表

- Method：`GET`
- Path：`/api/v1/admin/comments`
- 登录：是
- 角色：reviewer、admin

响应：后台评论列表，包含可见和已隐藏评论，不包含已删除评论。

错误：

- `FORBIDDEN`

### 7.7 隐藏评论

- Method：`POST`
- Path：`/api/v1/admin/comments/{id}/hide`
- 登录：是
- 角色：reviewer、admin

效果：将评论 `visibility` 设置为 `hidden`。

错误：

- `NOT_FOUND`
- `FORBIDDEN`

### 7.8 恢复评论

- Method：`POST`
- Path：`/api/v1/admin/comments/{id}/show`
- 登录：是
- 角色：reviewer、admin

效果：将评论 `visibility` 设置为 `visible`。

错误：

- `NOT_FOUND`
- `FORBIDDEN`

错误：

- `UNAUTHORIZED`

## 8. 收藏接口

### 8.1 收藏状态

- Method：`GET`
- Path：`/api/v1/articles/{id}/bookmark`
- 登录：是
- 角色：user、reviewer、admin

响应：当前用户是否已收藏该文章，以及文章收藏总数。

错误：

- `UNAUTHORIZED`
- `NOT_FOUND`

### 8.2 收藏文章

- Method：`POST`
- Path：`/api/v1/articles/{id}/bookmark`
- 登录：是
- 角色：user、reviewer、admin

请求：

```json
{
  "collectionId": 1
}
```

约束：

- `collectionId` 可选；为空时后端使用或自动创建默认收藏夹。
- 只能收藏已发布且未删除文章。
- 只能收藏到自己的收藏夹。
- 收藏他人文章时创建 `article_bookmark` 通知。

响应：收藏状态。

### 8.3 取消收藏

- Method：`DELETE`
- Path：`/api/v1/articles/{id}/bookmark`
- 登录：是
- 角色：user、reviewer、admin

响应：收藏状态。

### 8.4 收藏夹列表

- Method：`GET`
- Path：`/api/v1/me/bookmark-collections`
- 登录：是
- 角色：user、reviewer、admin

响应：当前用户收藏夹列表。首次调用时后端会自动创建默认收藏夹。

### 8.5 创建收藏夹

- Method：`POST`
- Path：`/api/v1/me/bookmark-collections`
- 登录：是
- 角色：user、reviewer、admin

请求：

```json
{
  "name": "数据库"
}
```

错误：

- `VALIDATION_ERROR`
- `CONFLICT`

### 8.6 我的收藏

- Method：`GET`
- Path：`/api/v1/me/bookmarks`
- 登录：是
- 角色：user、reviewer、admin

查询参数：

- `collectionId`：可选，按收藏夹筛选。
- `page`
- `pageSize`

响应：当前用户收藏的已发布文章列表。

## 9. 用户与关注接口

### 9.1 作者公开信息

- Method：`GET`
- Path：`/api/v1/users/{username}`
- 登录：否
- 角色：guest、user、reviewer、admin

响应：作者公开信息（头像、用户名、bio、学校、公司、已发布文章数、关注者数、正在关注数），以及已发布文章列表（分页）。

查询参数：

- `page`
- `pageSize`

错误：

- `NOT_FOUND`：用户不存在。

### 9.2 关注状态

- Method：`GET`
- Path：`/api/v1/users/{username}/follow`
- 登录：是
- 角色：user、reviewer、admin

响应：当前用户是否关注目标用户，以及目标用户关注数。

### 9.3 关注用户

- Method：`POST`
- Path：`/api/v1/users/{username}/follow`
- 登录：是
- 角色：user、reviewer、admin

约束：

- 不能关注自己。
- 不能关注不存在或禁用用户。
- 重复关注幂等。

### 9.4 取关用户

- Method：`DELETE`
- Path：`/api/v1/users/{username}/follow`
- 登录：是
- 角色：user、reviewer、admin

### 9.5 我关注的用户

- Method：`GET`
- Path：`/api/v1/me/following`
- 登录：是
- 角色：user、reviewer、admin

### 9.6 关注我的用户

- Method：`GET`
- Path：`/api/v1/me/followers`
- 登录：是
- 角色：user、reviewer、admin

## 10. 举报接口

### 10.1 举报文章

- Method：`POST`
- Path：`/api/v1/articles/{id}/reports`
- 登录：是
- 角色：user、reviewer、admin

请求：

```json
{
  "reason": "疑似违规"
}
```

约束：只能举报已发布文章；同一用户对同一文章只能有一个待处理举报。

### 10.2 后台举报列表

- Method：`GET`
- Path：`/api/v1/admin/reports`
- 登录：是
- 角色：reviewer、admin

查询参数：

- `status`：可选，`pending`、`resolved`、`rejected`。

### 10.3 处理举报

- Method：`POST`
- Path：`/api/v1/admin/reports/{id}/resolve`
- 登录：是
- 角色：reviewer、admin

请求：

```json
{
  "status": "resolved",
  "note": "已处理"
}
```

## 11. 通知接口

### 11.1 我的通知

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
- `article_bookmark`：文章被收藏。
- `followee_article`：关注的用户发布了新文章。

错误：

- `UNAUTHORIZED`

### 11.2 未读通知数量

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

### 11.3 标记通知已读

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

### 11.4 全部标记已读

- Method：`POST`
- Path：`/api/v1/me/notifications/read-all`
- 登录：是
- 角色：user、reviewer、admin

响应：更新数量。

## 12. 上传接口

### 12.1 上传文章图片

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
- 默认最大大小 5MB。
- 文件扩展名和 MIME 必须双重校验。
