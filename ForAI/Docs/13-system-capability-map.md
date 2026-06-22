# 当前系统能力地图

更新日期：2026-06-23

状态说明：

- `[x] 已实现并有测试`
- `[~] 已实现但测试不足`
- `[ ] 未实现`
- `[defer] 后续迭代`

| 模块 | 后端能力 | 主要 API | 数据表 | 权限 | 前端毛坯入口 | 测试状态 | 文档状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 认证 | 注册、登录、退出、当前用户、禁用用户不可登录 | `/api/v1/auth/*` | `users` | guest/user/reviewer/admin | `/login`、`/register` | `[x] 已实现并有测试` | `[x] 已同步` |
| 用户资料 | 个人资料、头像、作者公开主页 | `/api/v1/me/profile`、`/api/v1/me/avatar`、`/api/v1/users/{username}` | `users`、`article_images` | user+ | `/me/profile`、`/authors/[username]` | `[~] 已实现但测试不足` | `[x] 已同步` |
| 后台用户管理 | 列表、搜索、角色/状态筛选、改角色、禁用 | `/api/v1/admin/users`、`/api/v1/admin/users/{id}` | `users` | admin | `/admin/users` | `[x] 已实现并有测试` | `[x] 已同步` |
| 领域 | 公开列表/详情、后台创建/更新 | `/api/v1/domains`、`/api/v1/admin/domains` | `domains` | public/admin | `/domain`、后台入口 | `[~] 已实现但测试不足` | `[x] 已同步` |
| 版块 | 公开列表/详情、后台创建/更新 | `/api/v1/modules`、`/api/v1/admin/modules` | `modules` | public/admin | `/modules/[slug]`、后台入口 | `[x] 已实现并有测试` | `[x] 已同步` |
| 文章投稿 | 创建、草稿、提交审核、作者列表、作者详情 | `/api/v1/articles`、`/api/v1/me/articles` | `articles`、`article_tags`、`tags` | user+ | `/me/submit`、`/me/articles` | `[x] 已实现并有测试` | `[x] 已同步` |
| 文章审核 | 待审核列表、通过、拒绝、归档、恢复 | `/api/v1/admin/articles/*` | `articles` | reviewer/admin | `/admin` | `[x] 已实现并有测试` | `[x] 已同步` |
| 公开文章 | 列表、详情、FTS 搜索、Tag 筛选、hot/random/latest | `/api/v1/articles`、`/api/v1/articles/{id}` | `articles`、`tags`、`article_tags` | public | `/discover`、`/articles/[id]` | `[x] 已实现并有测试` | `[x] 已同步` |
| Tag | 公开查询、后台列表、重命名、删除、合并 | `/api/v1/tags`、`/api/v1/admin/tags/*` | `tags`、`article_tags` | public/admin | `/admin/tags`、投稿页 Tag 推荐 | `[x] 已实现并有测试` | `[x] 已同步` |
| 评论 | 文章评论、回复、软删除、后台隐藏/恢复 | `/api/v1/articles/{id}/comments`、`/api/v1/comments/*`、`/api/v1/admin/comments/*` | `comments` | user+/reviewer/admin | `CommentSection`、`/me/comments` | `[x] 已实现并有测试` | `[x] 已同步` |
| 评论投票 | 赞/踩/取消、禁止自评投票 | `/api/v1/comments/{id}/vote` | `comment_votes` | user+ | `CommentSection` | `[x] 已实现并有测试` | `[x] 已同步` |
| 收藏 | 默认收藏夹、自定义收藏夹、收藏/取消、移动、删除转移 | `/api/v1/me/bookmark-collections`、`/api/v1/articles/{id}/bookmark`、`/api/v1/me/bookmarks` | `bookmark_collections`、`article_bookmarks` | user+ | `/me/bookmarks` | `[x] 已实现并有测试` | `[x] 已同步` |
| 关注 | 关注/取关、关注列表、粉丝列表、作者页关注状态 | `/api/v1/users/{username}/follow`、`/api/v1/me/following`、`/api/v1/me/followers` | `user_follows` | user+ | `/me/following`、`/me/followers`、作者页 | `[x] 已实现并有测试` | `[x] 已同步` |
| 通知 | 我的通知、未读数、单条已读、全部已读 | `/api/v1/me/notifications/*` | `notifications` | user+ | `/me/notifications` | `[x] 已实现并有测试` | `[x] 已同步` |
| 举报 | 创建举报、后台列表、驳回、处理并下架 | `/api/v1/articles/{id}/reports`、`/api/v1/admin/reports/*` | `article_reports`、`articles` | user+/reviewer/admin | `/admin/reports` | `[x] 已实现并有测试` | `[x] 已同步` |
| Dashboard | 基础统计、30 天趋势 | `/api/v1/admin/dashboard` | 多表聚合 | reviewer/admin | `/admin/dashboard` | `[~] 已实现但测试不足` | `[x] 已同步` |
| 上传 | 头像上传、文章图片上传、本地 uploads 存储 | `/api/v1/me/avatar`、`/api/v1/uploads/article-images` | `article_images` | user+ | 投稿页/资料页 | `[~] 已实现但测试不足` | `[x] 已同步` |
| PWA | 安装、离线、manifest、service worker | 暂无 | 暂无 | public | 暂无 | `[defer] 后续迭代` | `[x] 已标注 defer` |
| 邮件/S3/R2/复杂推荐/审计日志 | 生产增强能力 | 暂无 | 暂无 | 待定 | 暂无 | `[defer] 后续迭代` | `[x] 已标注 defer` |

## 当前验证入口

```powershell
powershell -ExecutionPolicy Bypass -File scripts\verify.ps1
```

可先运行 `scripts\prepare-test-db.ps1` 创建并迁移本地 `kb_test`。设置 `TEST_DATABASE_URL` 后会额外启用真实 PostgreSQL HTTP 冒烟测试；未设置时相关用例自动跳过。
