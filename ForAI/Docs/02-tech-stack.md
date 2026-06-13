# 技术选型文档

## 1. 总体原则

项目采用前后端分离架构，优先选择稳定、轻量、可长期维护的技术。第一版产品结构为 `网站 -> 版块 -> 文章`，不做论坛系统。

任何后续 AI 编码工具不得擅自更换技术栈，不得为了短期便利引入高维护成本组件。

## 2. 前端技术

### 2.1 Next.js

选择原因：

- 适合内容型 Web/PWA。
- 支持路由、页面组织、服务端渲染和静态能力，利于 SEO。
- 可部署到 Vercel，降低前端运维成本。
- 与 TypeScript、Tailwind CSS、shadcn/ui 配合成熟。

使用约束：

- 前端调用 Go 后端 REST API。
- 不在 Next.js 中实现核心业务后端逻辑。
- 不使用 Next.js 替代 Go API 服务。

### 2.2 TypeScript

选择原因：

- 提高前端类型安全。
- 让后续 AI 编码更容易遵守接口契约。
- 减少表单、API 响应和组件参数错误。

### 2.3 Tailwind CSS

选择原因：

- 开发效率高。
- 适合小团队统一样式。
- 与 shadcn/ui 兼容良好。

### 2.4 shadcn/ui

选择原因：

- 提供可复制、可定制、低黑盒程度的组件。
- 避免引入重型 UI 框架。
- 适合后台表格、表单、弹窗、按钮等基础界面。

## 3. 后端技术

### 3.1 Go

选择原因：

- 编译部署简单，单二进制便于服务器部署。
- 性能和并发能力足够。
- 标准库成熟，维护成本低。
- 类型明确，适合后续 AI 小步实现。

### 3.2 Chi

选择原因：

- 轻量、直接、符合 Go 标准库风格。
- 中间件生态足够覆盖日志、恢复、CORS、认证。
- 比大型框架更容易长期维护。

使用约束：

- 不引入 Gin、Echo、Fiber 等替代 Web 框架，除非用户明确批准。
- 路由按资源拆分，避免单文件堆积。

### 3.3 pgx

选择原因：

- PostgreSQL 原生支持好。
- 性能和类型支持优于通用 database/sql 场景。
- 与事务、连接池配合成熟。

使用约束：

- 允许使用 `pgxpool` 管理连接池。
- 不引入 ORM 作为默认方案。
- 不引入 Prisma、GORM、Ent，除非用户明确批准。

## 4. 数据库技术

### 4.1 PostgreSQL

选择原因：

- 关系模型适合用户、版块、文章、评论、评论回复、通知。
- 事务和约束能力强。
- 支持 JSONB、全文检索、枚举、索引等扩展能力。
- 单人项目中 PostgreSQL 足以支撑第一版。

### 4.2 goose

选择原因：

- 简单、稳定，适合 Go 项目。
- migration 文件清晰可审计。
- 支持本地和服务器环境一致执行。

使用约束：

- 所有数据库结构变更必须通过 goose migration。
- 禁止直接手改线上数据库结构后不提交 migration。

## 5. 认证技术

### 5.1 JWT

选择原因：

- 便于前后端分离。
- 后端可无状态校验登录态。
- 与 httpOnly Cookie 结合可降低前端 token 泄漏风险。

实现依赖：

- Go 后端使用 `github.com/golang-jwt/jwt/v5` 签发和验证 JWT。

使用约束：

- JWT 只放在 httpOnly Cookie。
- 禁止保存到 localStorage 或 sessionStorage。
- JWT 必须包含用户 ID、角色、过期时间。
- TODO：是否增加 refresh token 机制，后续确认。

### 5.2 httpOnly Cookie

选择原因：

- 浏览器自动携带，前端 JS 无法读取。
- 降低 XSS 直接窃取 token 的风险。

使用约束：

- 生产环境必须启用 `Secure`。
- 根据前后端域名关系正确配置 `SameSite`。
- Cookie 名称统一由后端配置，禁止散落硬编码。

### 5.3 bcrypt

选择原因：

- 稳定、成熟，适合密码哈希。
- 成本参数可调。

使用约束：

- 禁止保存明文密码。
- 禁止自行实现密码哈希算法。

## 6. Markdown 与图片

### 6.1 react-markdown + remark-gfm

选择原因：

- 支持 Markdown 渲染。
- remark-gfm 支持表格、任务列表、删除线等常见 GFM 语法。
- 前端生态成熟。

使用约束：

- Markdown 渲染必须考虑 XSS 风险。
- TODO：是否允许原始 HTML，默认不允许，需后续确认。

### 6.2 本地 uploads

选择原因：

- 第一版部署简单。
- 降低外部服务依赖。
- 便于本地开发和调试。

使用约束：

- 文件必须经过后端校验。
- 只允许图片类型。
- 文件路径不得由用户直接控制。
- 数据库保存相对 URL 或公开访问路径，不保存本地绝对路径。
- 后期可迁移到 Cloudflare R2 或 S3，但第一版不得强依赖对象存储。

## 7. 明确禁止擅自引入的技术

除非用户明确提出并更新文档，否则禁止引入：

- Supabase。
- Firebase。
- MongoDB。
- Redis。
- GraphQL。
- 微服务架构。
- Elasticsearch、Meilisearch 等独立搜索服务。
- RabbitMQ、Kafka 等消息队列。
- Kubernetes。
- GORM、Prisma、Ent 等 ORM。
- NextAuth/Auth.js。
- 任何替代当前后端认证方案的第三方认证服务。
- 任何会显著增加部署复杂度的基础设施。

## 8. 技术变更流程

如确需更换或新增关键技术，必须先完成：

1. 在本文档记录变更原因。
2. 在 `03-project-standards.md` 更新相关规范。
3. 在 `09-deployment-operations.md` 更新部署和运维影响。
4. 获得用户明确确认。
