# 本地开发环境记录

## 1. 已确认工具

当前本机开发环境已确认：

| 工具 | 状态 | 备注 |
| --- | --- | --- |
| Node.js | 可用 | 当前检查版本：`v24.16.0` |
| npm | 可用 | 当前检查版本：`11.13.0`；PowerShell 中建议使用 `npm.cmd` |
| pnpm | 可用 | 通过 Corepack 启动，当前检查版本：`11.6.0` |
| Go | 可用 | 当前检查版本：`go1.26.4 windows/amd64` |
| goose | 可用 | 当前检查版本：`v3.27.1` |
| Docker Desktop | 可用 | 当前检查版本：`29.5.3` |
| WSL2 | 已启用 | 默认 WSL 版本为 2；当前未确认到已注册的 Ubuntu 发行版 |

## 2. npm 与 pnpm 注意事项

PowerShell 直接执行 `npm` 可能命中 `npm.ps1`，并被当前执行策略拦截。可使用：

```powershell
npm.cmd --version
```

pnpm 当前由 Corepack 管理，可使用：

```powershell
corepack pnpm --version
```

后续如果需要在任意 shell 中直接使用 `pnpm`，可再单独安装或启用全局 shim。

## 3. PostgreSQL Docker 容器

本地开发数据库使用 Docker 运行，原因是 Windows 当前用户目录包含中文，PostgreSQL Windows 安装器可能无法正常安装。

容器信息：

| 项 | 值 |
| --- | --- |
| 容器名 | `kb-postgres` |
| 镜像 | `postgres:17` |
| 数据库用户 | `postgres` |
| 数据库密码 | `postgres123` |
| 数据库名 | `kb_dev` |
| 端口映射 | `localhost:5432 -> container:5432` |

创建容器命令：

```bash
docker run --name kb-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres123 -e POSTGRES_DB=kb_dev -p 5432:5432 -d postgres:17
```

数据库连接串：

```env
DATABASE_URL=postgres://postgres:postgres123@localhost:5432/kb_dev?sslmode=disable
```

常用命令：

```bash
docker ps
docker start kb-postgres
docker stop kb-postgres
docker exec -it kb-postgres psql -U postgres -d kb_dev
```

## 4. 当前验证结果

已验证容器 `kb-postgres` 正在运行，主机端口 `localhost:5432` 连通，数据库 `kb_dev` 可通过用户 `postgres` 正常连接。

当前 PostgreSQL 服务端版本：

```text
PostgreSQL 17.10
```

## 5. 项目环境变量

后端本地示例配置见：

```text
services/api/.env.example
```

前端本地示例配置见：

```text
apps/web/.env.local.example
```

实际 `.env`、`.env.local` 文件不得提交到 Git。
