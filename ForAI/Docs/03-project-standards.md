# 项目规范文档

## 1. Monorepo 目录结构

建议目录结构：

```text
ScholarBookstore/
  ForAI/
    Docs/
  apps/
    web/
      app/
      components/
      lib/
      hooks/
      styles/
      public/
  services/
    api/
      cmd/
      internal/
      migrations/
      uploads/
  README.md
```

约束：

- 前端代码只放在 `apps/web`。
- 后端代码只放在 `services/api`。
- 文档只放在 `ForAI/Docs`。
- 数据库 migration 只放在 `services/api/migrations`。
- 上传文件开发期放在 `services/api/uploads`，该目录不得提交用户上传内容。

## 2. 前端目录规范

```text
apps/web/
  app/
    page.tsx
    login/
    register/
    modules/
    articles/
    submit/
    me/
    admin/
  components/
    ui/
    layout/
    markdown/
    forms/
    content/
    notifications/
  hooks/
  lib/
    api/
    auth/
    validators/
    utils.ts
  styles/
  public/
```

约束：

- `components/ui` 仅放 shadcn/ui 组件。
- 业务组件放在 `components/content`、`components/forms`、`components/notifications` 或对应业务目录。
- API 请求封装放在 `lib/api`。
- 登录态判断逻辑放在 `lib/auth`。
- 表单校验逻辑放在 `lib/validators`。
- 页面组件不得直接拼接后端 URL，必须使用统一 API 客户端。

## 3. 后端目录规范

```text
services/api/
  cmd/
    server/
      main.go
  internal/
    config/
    db/
    http/
      middleware/
      response/
      routes/
    auth/
    users/
    modules/
    articles/
    comments/
    notifications/
    uploads/
  migrations/
  uploads/
```

约束：

- `cmd/server/main.go` 只负责启动、依赖装配、优雅退出。
- `internal/config` 只负责配置读取和校验。
- `internal/db` 只负责数据库连接池和事务工具。
- `internal/http` 放通用 HTTP 层能力。
- 每个业务包内部按 handler、service、repository、model 拆分。
- 第一版不创建 `threads` 或 `thread_replies` 业务包。

## 4. Go 分层规范

每个业务模块推荐结构：

```text
internal/articles/
  handler.go
  service.go
  repository.go
  model.go
  errors.go
```

职责：

- handler：解析请求、调用 service、返回响应，不写业务规则。
- service：执行业务规则、权限判断、状态流转。
- repository：执行 SQL，不写 HTTP 逻辑。
- model：定义领域模型和 DTO。
- errors：定义模块内错误。

约束：

- handler 不直接访问数据库。
- repository 不读取 Cookie、不解析 JWT。
- service 不依赖具体 HTTP 框架类型。
- 事务边界由 service 发起。
- 创建评论回复和通知必须在同一事务中完成。

## 5. 命名规范

数据库：

- 表名使用复数 snake_case，如 `articles`。
- 字段名使用 snake_case，如 `created_at`。
- 主键统一为 `id`，类型为 `bigserial` 或 `bigint`。
- 外键命名为 `{resource}_id`。
- 时间字段统一为 `created_at`、`updated_at`、`deleted_at`。

Go：

- 包名短小小写，如 `articles`。
- 导出类型使用 PascalCase。
- 未导出变量和函数使用 camelCase。
- HTTP handler 命名为 `handleCreateArticle` 或方法接收器 `CreateArticle`。

前端：

- React 组件使用 PascalCase。
- hooks 使用 `useXxx`。
- API 方法使用动词开头，如 `createArticle`、`listModules`、`markNotificationRead`。
- 路由目录使用小写 kebab-case。

## 6. 环境变量规范

后端环境变量：

| 名称 | 必填 | 说明 |
| --- | --- | --- |
| `APP_ENV` | 是 | `development`、`test`、`production` |
| `API_ADDR` | 是 | 后端监听地址，如 `:8080` |
| `DATABASE_URL` | 是 | PostgreSQL 连接字符串 |
| `JWT_SECRET` | 是 | JWT 签名密钥，生产环境必须足够长 |
| `JWT_EXPIRES_IN` | 是 | JWT 有效期，如 `24h` |
| `COOKIE_NAME` | 是 | 登录 Cookie 名称 |
| `COOKIE_DOMAIN` | 否 | 生产环境按域名配置 |
| `COOKIE_SECURE` | 是 | 生产环境必须为 `true` |
| `UPLOAD_DIR` | 是 | 本地上传目录 |
| `PUBLIC_UPLOAD_BASE_URL` | 是 | 图片公开访问前缀 |
| `CORS_ALLOWED_ORIGINS` | 是 | 前端来源白名单 |

前端环境变量：

| 名称 | 必填 | 说明 |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | 是 | 浏览器访问后端 API 的基础 URL |

约束：

- 密钥不得提交到 Git。
- `.env.example` 只允许写示例值。
- 前端 `NEXT_PUBLIC_*` 不得包含密钥。

## 7. 错误处理规范

常见 HTTP 状态码：

| 状态码 | 场景 |
| --- | --- |
| 400 | 请求参数错误 |
| 401 | 未登录或登录态失效 |
| 403 | 权限不足 |
| 404 | 资源不存在或不可见 |
| 409 | 唯一约束冲突或状态冲突 |
| 413 | 上传文件过大 |
| 415 | 上传文件类型不支持 |
| 500 | 未预期服务端错误 |

禁止：

- 将数据库原始错误直接返回给前端。
- 在响应中泄露 SQL、堆栈、密钥、服务器路径。

## 8. 接口响应格式

成功响应：

```json
{
  "data": {},
  "meta": {}
}
```

列表响应：

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 0
  }
}
```

错误响应：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数不合法",
    "details": {}
  }
}
```

约束：

- 所有 API 必须使用统一响应格式。
- 错误 `code` 使用大写 snake_case。
- 业务错误必须有稳定 `code`，供前端判断。
- `message` 面向用户或前端展示，不包含敏感信息。

