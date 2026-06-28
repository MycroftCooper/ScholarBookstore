# 开发任务拆分文档

## 0. 当前 MVP 状态

截至当前提交前，阶段 0 到阶段 9 的 MVP 主体功能已完成：

- 项目初始化、数据库 migration、Go API 框架。
- 认证系统。
- 领域、版块、文章、投稿、审核。
- 前端首页、登录、注册、版块、文章详情、投稿、个人中心、我的投稿、投稿编辑、我的评论、我的通知、管理后台。
- 评论、回复、删除评论。
- 顶级文章评论通知、评论回复通知。
- 图片上传到本地 `uploads`，Markdown 引用图片 URL。
- 管理后台领域/版块管理、文章隐藏/恢复、评论隐藏/恢复/删除。
- 公开文章搜索与发现页，包括关键词搜索、Tag 筛选、热点聚合和随机文章。
- 评论赞踩、最新/最热排序、加载更多、我的评论互动数据和隐藏/删除占位展示。
- 收藏文章、默认收藏夹、自定义收藏夹、收藏夹重命名/删除、移动收藏、我的收藏页和 `article_bookmark` 通知。
- 关注/取关用户、关注/粉丝列表、作者页与文章详情页关注按钮和 `followee_article` 通知。
- 文章举报、后台举报列表与处理。

当前 MVP 未纳入：

- PWA 安装与离线能力。
- 用户角色管理 UI。
- 生产部署自动化。

本地验收命令：

```bash
cd services/api
go test ./...

cd apps/web
npm.cmd run typecheck
```

## 15. 2026-06-23 后端健康审计与冒烟测试

- [x] 新增 `ForAI/Docs/12-backend-health-audit.md`，记录后端模块边界、测试缺口、P0/P1/P2 风险和后续重构建议。
- [x] 新增 `ForAI/Docs/13-system-capability-map.md`，作为当前系统能力、权限、数据表、页面入口、测试状态的总览。
- [x] 新增 `scripts/verify.ps1`，统一执行后端测试、前端 typecheck 和编码扫描。
- [x] 新增 `scripts/check-encoding.mjs`，按字节验证 UTF-8 并扫描高置信 mojibake 特征，排除缓存、依赖和二进制文件。
- [x] `scripts/verify.ps1` 仅负责调度命令，编码准入改由 Node 脚本执行，避免 PowerShell 读写中文内容造成 GBK 污染。
- [x] 新增 HTTP 冒烟测试脚手架 `services/api/internal/testutil` 和 routes smoke tests；设置 `TEST_DATABASE_URL` 后覆盖真实 PostgreSQL + router + cookie 鉴权链路。
- [x] 小规模后端重构：新增 `internal/http/request`，并接入 users/tags/reports handler 的 JSON、分页、路径 ID 解析。
- [x] 修复举报重复处理错误映射：`ErrConflict` 返回 `409 CONFLICT`。

本阶段不启动前端美化，只保持毛坯页面可调用、可展示错误/空态、可手动验证。

## 16. 2026-06-23 后端测试基线补强

- [x] 新增 `scripts/prepare-test-db.ps1`，用于创建本地 `kb_test` 并执行 goose migration。
- [x] routes 冒烟测试补充收藏夹链路：默认收藏夹、自定义收藏夹、重命名、移动收藏、删除收藏夹后转移到默认收藏夹。
- [x] comments service 测试补充：投票参数、取消投票、隐藏/恢复、reviewer/admin 删除权限传参。
- [x] follows service 测试补充：用户名 trim、非法输入、关注/粉丝列表鉴权。
- [x] notifications service 测试补充：recipient scope、分页规范化、单条/全部已读。
- [x] 小规模后端重构继续推进：articles/comments/bookmarks/notifications handler 接入 `internal/http/request`。

真实数据库冒烟启动方式：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\prepare-test-db.ps1
$env:TEST_DATABASE_URL = "postgres://postgres:postgres123@localhost:5432/kb_test?sslmode=disable"
powershell -ExecutionPolicy Bypass -File scripts\verify.ps1
```

## 1. 阶段 0：项目初始化

目标：

- 建立 monorepo 基础目录。
- 初始化前端 Next.js 项目和后端 Go 项目。
- 添加基础 README 和 `.env.example`。

输出：

- `apps/web`
- `services/api`
- 根目录 README。
- 前后端环境变量示例文件。

验收标准：

- 前端可启动默认页面。
- 后端可启动健康检查接口。
- 不包含业务代码大爆发式生成。

禁止事项：

- 不引入未确认技术栈。
- 不创建 Supabase、Firebase、MongoDB、Redis、GraphQL 相关代码。
- 不创建论坛或帖子系统。

## 2. 阶段 1：数据库 migration

目标：

- 使用 goose 创建基础表结构。
- 表结构与 `04-database-design.md` 保持一致。

输出：

- `users`
- `modules`
- `domains`
- `articles`
- `comments`
- `notifications`
- `article_images`

验收标准：

- `goose up` 可成功执行。
- `goose down` 可回滚。
- 表、索引、外键、check constraint 齐全。
- 不存在 `threads`、`thread_replies` 表。

禁止事项：

- 禁止直接手工改库不写 migration。
- 禁止跳过索引和外键。

## 3. 阶段 2：Go API 框架

目标：

- 搭建 Go + Chi + pgx 服务骨架。
- 实现配置、路由、中间件、统一响应、健康检查。

输出：

- `cmd/server/main.go`
- `internal/config`
- `internal/db`
- `internal/http`

验收标准：

- `/healthz` 返回成功。
- 数据库连接池可初始化。
- API 错误响应格式统一。

禁止事项：

- 不写完整业务模块。
- 不引入 Gin、Echo、Fiber。

## 4. 阶段 3：认证系统

目标：

- 实现注册、登录、退出、当前用户接口。
- 使用 bcrypt 和 JWT + httpOnly Cookie。

输出：

- auth、users 相关 handler、service、repository。
- 认证中间件。

验收标准：

- 用户可注册登录。
- 登录 Cookie 为 httpOnly。
- JWT 不进入 localStorage。
- 禁用用户不能登录。

禁止事项：

- 禁止保存明文密码。
- 禁止前端持久化 JWT。

## 5. 阶段 4：版块和文章 API

目标：

- 实现领域列表、领域详情、版块列表、版块详情。
- 实现投稿、文章列表、文章详情、我的投稿。

输出：

- domains、modules 业务包。
- articles 业务包。
- 文章主链路补充：草稿保存、提交审核、我的文章草稿筛选、状态筛选、已发布文章修订重审、Tag、文章 TOC、文章元数据（字数、预计阅读时长、浏览量、修订次数）。
- 必要的管理领域和版块接口。

验收标准：

- 游客只能看已发布文章。
- 作者可看自己的投稿状态。
- 普通用户不能管理版块。

禁止事项：

- 不实现复杂搜索。
- 不绕过文章状态过滤。

## 6. 阶段 5：前端页面骨架

目标：

- 建立 Next.js 路由和基础布局。
- 接入 API 客户端和基础登录态。

输出：

- 首页、登录页、注册页、版块页、文章详情页、投稿页、个人中心、我的投稿页、我的评论页、我的通知页、管理后台骨架。

验收标准：

- 页面路由与 `07-pages-routes.md` 一致。
- 移动端布局不明显溢出。
- 空状态和错误状态存在。

禁止事项：

- 不做复杂视觉重构。
- 不把后端权限逻辑写死在前端。
- 不创建帖子详情页。

## 7. 阶段 6：投稿审核流程

目标：

- 实现待审核列表、通过、拒绝。
- 前端管理后台支持审核操作。

输出：

- 审核 API。
- 审核后台页面。

验收标准：

- `pending_review` 可变为 `published` 或 `rejected`。
- 拒绝必须填写原因。
- 非 reviewer/admin 不能审核。

禁止事项：

- 不允许普通用户通过接口改文章状态。

## 8. 阶段 7：评论与回复系统

目标：

- 实现文章评论列表、创建顶级评论、回复评论、软删除。

输出：

- comments 业务包。
- 文章详情页评论区。
- 我的评论页。

验收标准：

- 游客不可看评论和回复。
- 登录用户可评论和回复。
- 回复评论时正确记录 `parent_id` 和 `reply_to_user_id`。
- 普通用户只能删除自己的评论或回复。
- 管理角色可删除任意评论或回复。

禁止事项：

- 不创建论坛帖子系统。
- 不允许前端直接创建通知。

## 9. 阶段 8：通知系统

目标：

- 实现文章评论通知和评论回复通知。
- 实现个人中心通知列表和已读操作。

输出：

- notifications 业务包。
- 未读通知数量接口。
- 我的通知页。

验收标准：

- 回复他人评论时创建 `comment_reply` 通知。
- 回复自己不创建通知。
- 用户只能查看自己的通知。
- 用户只能标记自己的通知已读。
- 通知创建与评论回复创建在同一事务中完成。

禁止事项：

- 不做邮件、短信、浏览器推送。
- 不让前端传入任意 `recipientId` 创建通知。

## 10. 阶段 9：图片上传

目标：

- 实现文章图片上传到本地 `uploads`。
- Markdown 可引用上传图片。

输出：

- uploads 业务包。
- 静态文件访问配置。
- 投稿页上传组件。

验收标准：

- 只允许图片类型。
- 超出大小返回错误。
- 文件名由后端生成。
- 数据库记录图片信息。

禁止事项：

- 不接入 S3/R2，除非先更新文档并确认。
- 不允许用户控制存储路径。

## 11. 阶段 10：用户资料与关注系统

目标：

- 实现用户资料扩展（头像、Bio、学校/公司）和关注/取关功能。
- 实现作者公开主页。
- 实现新文章通知关注者。

输出：

- `users` 表新增 `avatar_url`、`bio`、`school`、`company` 字段（DB migration）。已在认证 & 用户资料模块落地。
- `user_follows` 表（DB migration）。
- 通知类型扩展 `article_bookmark`、`followee_article`（DB migration）。
- 后端：用户资料编辑 API、作者公开信息 API、关注/取关 API、关注列表/粉丝列表 API。
- 后端：文章审核通过时批量创建 `followee_article` 通知。
- 前端：`/me/profile` 编辑资料页（含预览主页按钮）。已在认证 & 用户资料模块落地。
- 前端：`/authors/[username]` 作者公开主页已落地资料和已发布文章列表；关注按钮与关注统计在关注模块接真实数据。
- 前端：`/me/following` 我关注的用户页。
- 前端：`/me/followers` 关注我的用户页。
- 前端：文章详情页作者信息区增加关注按钮。

验收标准：

- 用户可上传头像、编辑 Bio、学校、公司。
- 未上传头像时展示自动生成的默认头像。
- 编辑资料页可点击"预览主页"以访客视角查看自己的作者主页。
- 游客可浏览作者公开主页，查看其信息和已发布文章。
- 登录用户可在作者主页和文章详情页关注/取关其他用户。
- 不能关注自己、不能重复关注。
- 作者主页展示关注者数和正在关注数。
- 被关注者文章审核通过时，所有活跃关注者收到通知。
- 用户可查看自己的关注列表和粉丝列表。
- 禁用用户不能被关注，禁用关注者不收到新文章通知。

禁止事项：

- 不做私信、实时聊天。
- 不做社交动态 feed 流。

## 12. 阶段 11：PWA（后续迭代）

目标：

- 给 Web 增加基础 PWA 能力。当前 MVP 暂不实现。

输出：

- manifest。
- 图标。
- 基础 service worker 或 Next.js PWA 方案。TODO：具体方案后续确认。

验收标准：

- 浏览器可识别为可安装 Web 应用。
- 离线状态有基础提示。

禁止事项：

- 不做原生 App。
- 不引入复杂推送服务。

## 13. 阶段 12：部署

目标：

- 完成本地到生产的部署路径。

输出：

- 前端 Vercel 部署说明。
- 后端服务器部署说明。
- PostgreSQL 部署和备份说明。
- uploads 备份说明。

验收标准：

- 前端可访问生产后端。
- 后端可连接生产 PostgreSQL。
- migration 可执行。
- 有备份和回滚说明。

禁止事项：

- 不引入 Kubernetes。
- 不引入微服务拆分。

---

## 14. 2026-06-23 MVP 后端完善状态

- [x] 后台用户管理：列表、搜索、角色筛选、状态筛选、修改角色、启用/禁用、禁止 admin 禁用自己。
- [x] 后台 Tag 管理：列表、搜索、重命名、删除、合并、使用次数维护。
- [x] 公开 Tag 查询：用于投稿页 Tag 推荐和发现页后续接入。
- [x] 后台数据看板：基础统计和 30 天趋势。
- [x] 举报处理增强：支持“处理并下架”，举报状态更新与文章下架在同一事务中完成。
- [x] 公开文章搜索升级：从 `ILIKE` 升级为 PostgreSQL full text search，并增加 GIN 索引 migration。
- [x] 前端后台毛坯页：`/admin/users`、`/admin/tags`、`/admin/dashboard`；举报处理已并入 `/admin/tasks`。
- [~] 测试覆盖：新增 users、tags、reports service 测试；bookmarks、comments、follows、notifications 仍需继续补充更细测试。

当前验收命令：

```bash
cd services/api
go test ./...

cd apps/web
npm.cmd run typecheck
```
