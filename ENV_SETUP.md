# ENV_SETUP

本文件用于在新设备上快速恢复 ScholarBookstore 的本地开发环境。

## 1. 前置工具

需要先安装并确认可用：

| 工具 | 用途 | 验证命令 |
| --- | --- | --- |
| Node.js | 前端运行环境 | `node --version` |
| npm | Node 包管理器 | `npm.cmd --version` |
| pnpm | 前端包管理器 | `corepack pnpm --version` |
| Go | 后端运行环境 | `go version` |
| goose | 数据库 migration | `goose -version` |
| Docker Desktop | 本地 PostgreSQL | `docker --version` |

PowerShell 可能因为执行策略拦截 `npm.ps1`，如遇到该问题，优先使用 `npm.cmd`。

pnpm 当前建议通过 Corepack 使用：

```powershell
corepack pnpm --version
```

## 2. PostgreSQL 本地数据库

本项目本地开发使用 Docker 运行 PostgreSQL。

创建容器：

```bash
docker run --name kb-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres123 -e POSTGRES_DB=kb_dev -p 5432:5432 -d postgres:17
```

如果容器已经创建但未启动：

```bash
docker start kb-postgres
```

查看容器状态：

```bash
docker ps
```

进入数据库：

```bash
docker exec -it kb-postgres psql -U postgres -d kb_dev
```

数据库连接串：

```env
DATABASE_URL=postgres://postgres:postgres123@localhost:5432/kb_dev?sslmode=disable
```

## 3. 环境变量文件

后端：

```text
services/api/.env.example
```

复制为：

```text
services/api/.env
```

前端：

```text
apps/web/.env.local.example
```

复制为：

```text
apps/web/.env.local
```

实际 `.env` 和 `.env.local` 不提交到 Git。

## 4. 数据库 migration

migration 目录：

```text
services/api/migrations
```

查看 migration 状态：

```bash
goose -dir services/api/migrations postgres "postgres://postgres:postgres123@localhost:5432/kb_dev?sslmode=disable" status
```

执行 migration：

```bash
goose -dir services/api/migrations postgres "postgres://postgres:postgres123@localhost:5432/kb_dev?sslmode=disable" up
```

回滚最后一次 migration：

```bash
goose -dir services/api/migrations postgres "postgres://postgres:postgres123@localhost:5432/kb_dev?sslmode=disable" down
```

注意：回滚会修改数据库结构，执行前需要确认当前库可以被改动。

## 5. 项目启动

当前仓库已经补齐目录、env 示例、初始 migration 和后端 Go API 骨架。

计划中的启动位置：

```text
apps/web
services/api
```

后端启动：

```powershell
cd services/api
go run ./cmd/server
```

如遇到 Windows 用户目录 Go 缓存权限问题，可临时把缓存放到项目目录：

```powershell
cd services/api
$env:GOCACHE=(Resolve-Path .).Path + '\.gocache'
$env:GOMODCACHE=(Resolve-Path .).Path + '\.gomodcache'
go run ./cmd/server
```

前端启动：

```powershell
cd apps/web
npm.cmd install
npm.cmd run dev
```

计划中的本地服务地址：

| 服务 | 地址 |
| --- | --- |
| 前端 | `http://localhost:3000` |
| 后端 | `http://localhost:8080` |
| PostgreSQL | `localhost:5432` |

## 6. 快速检查清单

新设备准备完成后，依次确认：

- `node --version` 正常。
- `npm.cmd --version` 正常。
- `corepack pnpm --version` 正常。
- `go version` 正常。
- `goose -version` 正常。
- Docker Desktop 已启动。
- `docker ps` 能看到或能够启动 `kb-postgres`。
- `localhost:5432` 可连接。
- `services/api/.env` 使用正确的 `DATABASE_URL`。
- `goose status` 能看到 migration 状态。

更多环境记录见：

- `ForAI/Docs/11-local-environment.md`
- `ForAI/Docs/09-deployment-operations.md`
