# 部署与运维文档

## 1. 本地开发环境

需要安装：

- Node.js LTS。TODO：具体版本后续项目初始化时锁定。
- Go。TODO：具体版本后续项目初始化时锁定。
- PostgreSQL（本地开发使用 Docker 容器）。
- goose。

本地服务建议：

- 前端：`http://localhost:3000`
- 后端：`http://localhost:8080`
- PostgreSQL：`localhost:5432`

## 2. 环境变量

后端 `.env` 示例：

```env
APP_ENV=development
API_ADDR=:8080
DATABASE_URL=postgres://postgres:postgres123@localhost:5432/kb_dev?sslmode=disable
JWT_SECRET=change-me-in-local
JWT_EXPIRES_IN=24h
COOKIE_NAME=scholar_session
COOKIE_DOMAIN=
COOKIE_SECURE=false
UPLOAD_DIR=./uploads
PUBLIC_UPLOAD_BASE_URL=http://localhost:8080/uploads
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

前端 `.env.local` 示例：

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1
```

约束：

- 生产密钥不得写入 Git。
- `.env.example` 只放示例值。
- 生产环境 `COOKIE_SECURE=true`。

## 3. PostgreSQL 本地启动

本地开发使用 Docker 运行 PostgreSQL，避免 Windows 用户目录包含中文时 PostgreSQL Windows 安装器异常。

本地数据库建议：

- 容器名：`kb-postgres`
- 镜像：`postgres:17`
- 数据库名：`kb_dev`
- 开发用户：`postgres`
- 开发密码：`postgres123`
- 端口映射：`localhost:5432 -> container:5432`
- 测试数据库：`kb_test`

创建容器：

```bash
docker run --name kb-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres123 -e POSTGRES_DB=kb_dev -p 5432:5432 -d postgres:17
```

常用命令：

```bash
docker ps
docker start kb-postgres
docker stop kb-postgres
docker exec -it kb-postgres psql -U postgres -d kb_dev
```

要求：

- 开发、测试、生产必须使用不同数据库。
- 禁止在生产库执行开发测试脚本。

## 4. goose migration 执行

migration 目录：

```text
services/api/migrations
```

执行方式：

```bash
goose -dir services/api/migrations postgres "$DATABASE_URL" up
```

回滚方式：

```bash
goose -dir services/api/migrations postgres "$DATABASE_URL" down
```

约束：

- 每次数据库结构变更必须创建新的 migration。
- migration 文件命名要表达目的。
- 生产执行 migration 前必须备份数据库。
- 已上线 migration 不得随意修改，只能追加新 migration。

## 5. 前端部署

目标平台：

- Vercel。

部署要求：

- 设置 `NEXT_PUBLIC_API_BASE_URL` 指向生产后端。
- 确认 CORS 和 Cookie 跨域配置。
- 构建前至少运行 `npm.cmd run typecheck`。

注意：

- 前端不存 JWT。
- 前端不包含任何后端密钥。

## 6. 后端部署

目标：

- 后端部署到服务器。
- PostgreSQL 可部署在同一服务器或独立服务器。TODO：具体生产拓扑后续确认。

建议方式：

- Go 编译为单二进制。
- 使用 systemd 管理进程。
- 使用 Nginx 或 Caddy 反向代理。TODO：具体代理方案后续确认。

后端部署要求：

- 配置生产 `.env`。
- 确保 `UPLOAD_DIR` 存在且权限正确。
- 生产环境 `APP_ENV=production`。
- 生产环境 `COOKIE_SECURE=true`。
- 生产环境使用强 `JWT_SECRET`。

## 7. 数据库备份

最低要求：

- 生产数据库定期备份。
- migration 前手动备份。
- 保留最近若干份备份。TODO：具体保留周期后续确认。

建议命令：

```bash
pg_dump "$DATABASE_URL" > backup.sql
```

恢复前要求：

- 先在测试环境验证备份可恢复。
- 不直接覆盖生产库，除非明确确认。

## 8. 图片备份

第一版图片在本地 `uploads`。

要求：

- `uploads` 必须纳入服务器备份。
- 数据库备份和图片备份需要尽量同一时间点。
- 不要把用户上传文件提交到 Git。
- 仓库通过 `services/api/uploads/.gitignore` 保留上传目录占位，并忽略真实上传文件。

后续迁移：

- 可迁移到 Cloudflare R2 或 S3。
- 迁移前必须更新技术选型、部署文档、上传接口实现和备份策略。

## 9. 日志

后端日志要求：

- 记录请求方法、路径、状态码、耗时。
- 记录服务端错误。
- 不记录密码、JWT、Cookie、密钥。
- 生产日志应便于 grep 和排查。

前端日志要求：

- 不打印敏感信息。
- 生产环境避免保留调试输出。

TODO：

- 是否接入外部错误追踪服务后续确认。

## 10. 安全更新

维护要求：

- 定期更新 Go、Node.js 依赖补丁版本。
- 更新前在本地运行测试和构建。
- 关注 PostgreSQL 安全更新。
- 生产服务器及时更新系统安全补丁。

禁止：

- 为修复单个问题盲目升级大版本框架。
- 未经确认引入新的托管服务或基础设施。
