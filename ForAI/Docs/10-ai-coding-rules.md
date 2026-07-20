# AI 编码规则文档

## 1. 核心原则

后续 AI 编码工具必须把本文档作为硬约束。任何代码实现必须优先遵守 `ForAI/Docs` 下的项目文档。

任何功能开发开始前还必须阅读 `ForAI/PM/PRODUCT.md`、`SCOPE.md`、`RELEASE.md` 和 `STATUS.md`。`ForAI/PM` 决定做什么，`ForAI/Docs` 决定如何实现；两者冲突时先停止实现并按 PM 决策收口文档，不得根据旧需求恢复已冻结、延期或移除的功能。

目标是小步、可审查、可回滚地开发知识库社区网站，而不是一次性生成大量难以维护的代码。

第一版产品结构固定为：

```text
网站 -> 版块 -> 文章
```

第一版不做论坛、帖子、主题帖、帖子回复。讨论能力只通过文章评论和评论回复实现。

## 2. 禁止擅自更换技术栈

不得擅自替换或绕开以下技术选型：

- 前端：Next.js + TypeScript + Tailwind CSS + shadcn/ui。
- 后端：Go + Chi + pgx。
- 数据库：PostgreSQL。
- migration：goose。
- 认证：JWT + httpOnly Cookie + bcrypt。
- Markdown：react-markdown + remark-gfm。
- 图片：第一版本地 `uploads`。

明确禁止擅自引入：

- Supabase。
- Firebase。
- MongoDB。
- Redis。
- GraphQL。
- 微服务。
- GORM、Prisma、Ent。
- NextAuth/Auth.js。
- Elasticsearch、Meilisearch。
- RabbitMQ、Kafka。
- Kubernetes。

如确需新增技术，必须先提出原因、影响和替代方案，并获得用户明确确认，再更新相关文档。

## 3. 禁止恢复论坛系统

除非用户后续明确要求并先更新文档，否则不得创建：

- `threads` 表。
- `thread_replies` 表。
- 帖子 API。
- 帖子详情页。
- 版块帖子列表。
- 发帖、回帖、锁帖相关业务包。

如果需要讨论能力，必须优先使用文章评论、评论回复和通知。

## 4. 不要引入未经确认的新依赖

规则：

- 新增 npm、Go module 或系统依赖前，必须说明用途。
- 若标准库或现有依赖足够，不新增依赖。
- 不能为了少写几行代码引入长期维护成本高的库。
- 新依赖必须记录在对应技术或开发文档中。

## 5. 每次只完成一个小任务

编码节奏：

- 每次只实现一个明确阶段或一个小功能。
- 不要一次性生成前后端全套业务代码。
- 不要在修一个问题时顺手重构无关模块。
- 不要在没有测试或运行验证的情况下声称完成。

推荐任务粒度：

- 一个 API endpoint。
- 一个数据库 migration。
- 一个页面骨架。
- 一个表单。
- 一个权限校验点。

## 6. 数据库变更规则

涉及数据库结构变更时必须：

- 创建 goose migration。
- 更新 `04-database-design.md`。
- 确认 up/down 可执行。
- 同步更新 repository SQL。
- 检查索引、外键、check constraint。

禁止：

- 直接改数据库不写 migration。
- 修改已上线 migration。
- 在代码里假设不存在于文档的字段。
- 擅自新增帖子相关表。

## 7. API 变更规则

涉及 API 新增、删除或修改时必须：

- 更新 `05-api-design.md`。
- 保持统一响应格式。
- 明确登录要求和角色要求。
- 明确请求参数、响应格式和错误情况。
- 同步更新前端 API 客户端。

禁止：

- 新增未记录接口。
- 返回不符合统一格式的数据。
- 用前端约定代替后端权限校验。
- 擅自新增帖子相关接口。

## 8. 权限变更规则

涉及权限、角色、状态流转时必须：

- 更新 `06-permission-security.md`。
- 确认后端 service 层有权限校验。
- 确认前端只做体验控制，不作为安全边界。
- 添加或更新相关测试。TODO：测试框架后续确认。

禁止：

- 绕过后端权限校验。
- 信任请求体中的 `userId`、`role`。
- 让普通用户修改自己的角色。
- 允许前端直接创建通知。

## 9. 评论回复与通知规则

实现顶级文章评论时必须：

- 校验文章存在、未删除且状态为 `published`。
- 在后端生成通知接收人，即文章作者。
- 评论他人文章时创建 `article_comment` 通知。
- 评论自己的文章时不创建通知。
- 顶级评论创建和通知创建必须在同一事务中完成。

实现评论回复时必须：

- 校验被回复评论存在、未删除、可见。
- 校验被回复评论所属文章为 `published`。
- 校验父评论和文章关系一致。
- 在后端生成 `reply_to_user_id`。
- 回复他人评论时创建 `comment_reply` 通知。
- 回复自己时不创建通知。
- 评论回复创建和通知创建必须在同一事务中完成。

## 10. 认证安全规则

必须遵守：

- JWT 只允许存放在 httpOnly Cookie。
- 不得把 JWT 存入 localStorage。
- 不得把 JWT 存入 sessionStorage。
- 不得在 URL query 中传递 JWT。
- 密码必须使用 bcrypt。
- 不得记录密码、JWT、Cookie、密钥到日志。

## 11. 密钥和配置规则

必须遵守：

- 不要把密钥写进代码。
- 不要把生产 `.env` 提交到 Git。
- `.env.example` 只能写示例值。
- 前端 `NEXT_PUBLIC_*` 变量不得包含密钥。

## 12. 上传安全规则

实现上传时必须：

- 只允许图片 MIME。
- 限制文件大小。
- 使用后端生成文件名。
- 禁止用户控制存储路径。
- 保存数据库记录。
- 不把本地绝对路径返回给前端。

## 13. 文档同步规则

任一代码变更如影响以下内容，必须同步文档：

- 产品范围变化：更新 `01-product-requirements.md`。
- 技术选型变化：更新 `02-tech-stack.md`。
- 目录或规范变化：更新 `03-project-standards.md`。
- 数据库变化：更新 `04-database-design.md`。
- API 变化：更新 `05-api-design.md`。
- 权限或安全变化：更新 `06-permission-security.md`。
- 页面路由变化：更新 `07-pages-routes.md`。
- 开发阶段变化：更新 `08-development-plan.md`。
- 部署方式变化：更新 `09-deployment-operations.md`。
- 新增产品能力、发现功能缺口或改变范围：先按 `ForAI/PM` 流程判断，分别更新 `SCOPE.md`、`RELEASE.md`、`STATUS.md` 和必要的 `DECISIONS.md`，不得另建 TODO 清单形成第二事实源。
- 完成功能并验证后：更新 `ForAI/PM/STATUS.md` 和 `RELEASE.md` 中的状态与证据；范围决定发生变化时同步更新 `SCOPE.md`。

## 14. 不确定性处理

如果需求、字段、接口或权限存在不确定性：

- 在文档或代码 TODO 中标记。
- 不擅自做重大产品决策。
- 对安全、权限、数据丢失相关问题优先询问用户。

## 15. 中文与编码安全规则

处理包含中文的文档、页面文案、配置说明时必须遵守：

- 含中文文件不再以 PowerShell `Get-Content` 的显示结果作为编辑依据。`Get-Content` 只可用于粗略定位；真正读取内容时优先用按 UTF-8 读取的工具，或使用 `rg` 定位后通过 `apply_patch` 修改。
- 不得通过 `python -c "中文..."`、PowerShell 字符串拼接、重定向等 shell 文本链路写入中文内容。中文内容统一优先使用 `apply_patch`，避免经过控制台编码转换。
- 修改中文文档或中文 UI 文案后，必须做编码体检：检查是否出现 Unicode replacement character、常见 mojibake 片段、大面积无关 diff；若发现编码污染，必须先恢复文件再继续修改。
- 编码体检必须使用 `node scripts/check-encoding.mjs`；PowerShell 版脚本只可保留为历史参考，不作为最终准入。

## 16. 完成标准

AI 每次完成编码任务时必须说明：

- 改了哪些文件。
- 实现了什么。
- 如何验证。
- 哪些 TODO 或风险仍存在。

如果未能运行验证，必须明确说明原因。
