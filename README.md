# ScholarBookstore

知识库社区网站项目。

项目规范与开发上下文见 `ForAI/Docs`。

新设备本地环境搭建见 `ENV_SETUP.md`。

## MVP 当前能力

- 注册、登录、退出、个人中心。
- 版块列表、版块详情、文章列表、文章详情。
- 投稿 Markdown 文章，支持本地图片上传并插入 Markdown。
- 投稿审核、拒绝后修改重提。
- 评论、回复、删除评论。
- 文章评论通知、评论回复通知、未读数、标记已读。
- 管理后台：文章审核、版块管理、文章隐藏/恢复、评论隐藏/恢复/删除。

## 本地验收

后端：

```bash
cd services/api
go test ./...
```

前端：

```bash
cd apps/web
npm.cmd run typecheck
```
