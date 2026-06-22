# 后端健康审计

更新日期：2026-06-23

## 结论

当前后端 MVP 主链路已经具备可运行基础：Chi 路由集中、业务按模块拆分、PostgreSQL migration 完整、核心 service 测试已覆盖认证、文章、模块、用户、Tag、举报、评论、关注、通知等重点模块。本轮新增了 HTTP 层冒烟测试脚手架和统一验证脚本，可以用真实 PostgreSQL 测试库持续验证 cookie 鉴权、权限中间件、文章发布、搜索、举报事务、收藏夹转移等跨模块行为。

当前不建议立即转向前端美化。更优先的工作是继续补齐后端自动化测试、清理 handler 层重复代码、完善事务与错误映射规范。

## P0 问题

暂无已确认 P0。当前 `go test ./...`、前端 typecheck 和编码扫描均可通过。

## P1 问题

- HTTP handler 层重复实现分页、路径 ID、JSON body 解析，已经新增 `internal/http/request` 并接入 users/tags/reports/articles/comments/bookmarks/notifications；domains/modules/uploads 等较小模块后续可继续收敛。
- 数据库冒烟测试需要外部提供 `TEST_DATABASE_URL`。本轮新增 `scripts/prepare-test-db.ps1` 用于创建本地 `kb_test` 并执行 migration，降低新环境接入成本。
- reports handler 之前未映射重复处理冲突，本轮已补 `ErrConflict -> 409 CONFLICT`，并在冒烟测试里覆盖重复处理失败。
- 跨模块链路测试仍有继续加密空间。新增 routes smoke tests 覆盖主链路，comments/follows/notifications 已补 service 测试，bookmarks 的默认收藏夹、重命名、删除转移由真实 DB 冒烟覆盖。

## P2 问题

- `routes.New` 负责组装所有 repository/service/handler，短期可接受；后续模块继续增长时建议拆出 wiring helper，避免路由定义和依赖构造互相干扰。
- 错误响应文案分散在各 handler 中，后续可抽取错误映射函数，统一 code/message/status。
- 事务辅助仍在 repository/service 内部分散处理。后续可抽出小型事务 runner，但应先补足事务失败回滚测试。
- 文档较多，状态容易漂移；本轮新增能力地图作为当前事实入口，后续功能变更应同步更新。

## 测试现状

- 已有 service 测试：auth、articles、modules、users、tags、reports。
- 新增 HTTP 冒烟测试：`services/api/internal/http/routes/routes_smoke_test.go`。
- 新增测试工具：`services/api/internal/testutil`。
- 新增 service 测试：comments、follows、notifications。
- 冒烟测试覆盖：
  - `/healthz`
  - 注册、登录、禁用用户不可登录、当前 cookie 鉴权
  - admin-only 401/403
  - admin 用户列表/禁用用户/禁止禁用自己
  - 投稿、审核发布、公开搜索、Tag 查询、Dashboard
  - 评论、投票、收藏、关注、通知入口
  - 默认收藏夹、自定义收藏夹重命名、删除收藏夹后转移收藏
  - 举报创建、后台处理并下架、重复处理 409

## 验证命令

```powershell
powershell -ExecutionPolicy Bypass -File scripts\verify.ps1
```

如需启用真实数据库冒烟测试：

```powershell
scripts\prepare-test-db.ps1
$env:TEST_DATABASE_URL = "postgres://postgres:postgres123@localhost:5432/kb_test?sslmode=disable"
powershell -ExecutionPolicy Bypass -File scripts\verify.ps1
```

缺少 `TEST_DATABASE_URL` 时，数据库冒烟用例会自动 skip，不影响普通单元测试。
