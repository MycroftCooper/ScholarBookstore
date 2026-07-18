# 举报与处罚模块

本文记录举报处理第一期实现范围，以及后续未完成项。

## 1. 设计原则

举报对象和处置动作解耦。

- 举报对象：文章、评论、用户主页。
- 处理结论：忽略、处理完成。
- 处置动作：隐藏/下架单个内容、禁用账号、限制用户能力。

第一期避免引入批量处置和复杂申诉，优先保证闭环完整、动作可审计、限制可到期。

## 2. 已实现

### 2.1 举报入口

- 文章举报：文章详情页可提交举报原因。
- 用户主页举报：作者主页点击“举报用户”后弹出文本框，用户输入原因后提交。
- 评论举报：评论区每条非本人评论可点击“举报”，弹出文本框，用户输入原因后提交。

### 2.2 后端举报表

- `article_reports`：文章举报。
- `user_reports`：用户主页举报。
- `comment_reports`：评论/回复举报。

每类举报均限制同一举报人对同一对象只能存在一条待处理举报。

### 2.3 后台统一待办

统一进入 `/admin/tasks`。

支持任务类型：

- `content_report`：文章举报。
- `comment_report`：评论举报。
- `user_report`：用户主页举报。

后台详情展示举报原因、对象预览、提交人、处理备注和可选处置动作。

### 2.4 第一处罚模型

新增 `moderation_penalties` 表。

当前处罚类型：

| penalty_type | 含义 | 执行方式 |
| --- | --- | --- |
| `account_disabled` | 禁用账号 | 同步将 `users.status` 改为 `disabled` |
| `follow_restricted` | 限制关注 | 关注用户、领域、版块时拦截 |
| `article_create_banned` | 禁止发文章 | 创建文章、提交审核时拦截 |
| `comment_create_banned` | 禁止发评论 | 发表评论、回复时拦截 |

处罚支持 `expires_at`。到期后行为拦截自动失效。

### 2.5 后台处置动作

文章举报可选：

- 下架被举报文章。
- 禁用账号。
- 限制关注 x 天。
- 禁止发文章 x 天。
- 禁止发评论 x 天。

评论举报可选：

- 隐藏被举报评论。
- 禁用账号。
- 限制关注 x 天。
- 禁止发文章 x 天。
- 禁止发评论 x 天。

用户主页举报可选：

- 禁用账号。
- 限制关注 x 天。
- 禁止发文章 x 天。
- 禁止发评论 x 天。

所有处理动作写入 `audit_logs`。

## 3. 未实现

以下能力暂不在第一期范围内：

- 批量下架用户全部文章。
- 批量隐藏用户全部评论。
- 临时下架内容到期后自动恢复。
- 手动撤销处罚。
- 用户处罚历史管理页。
- 申诉流程。
- 举报合并、恶意举报识别、自动风控规则。
- 针对用户主页资料的单独隐藏能力；当前用户主页举报主要通过限制关注、限制发文/评论或禁用账号处理。

## 4. 当前接口

用户侧：

- `POST /api/v1/articles/{id}/reports`
- `POST /api/v1/users/{username}/reports`
- `POST /api/v1/comments/{id}/reports`

后台：

- `GET /api/v1/admin/tasks?taskType=content_report`
- `GET /api/v1/admin/tasks?taskType=comment_report`
- `GET /api/v1/admin/tasks?taskType=user_report`
- `POST /api/v1/admin/tasks/{id}/ignore`
- `POST /api/v1/admin/tasks/{id}/take-down`

后台处理请求示例：

```json
{
  "note": "确认违规，隐藏评论并限制评论 7 天",
  "actions": [
    { "type": "hide_content" },
    { "type": "ban_comment_create", "durationDays": 7 }
  ]
}
```

可用 action：

- `hide_content`
- `disable_account`
- `restrict_follow`
- `ban_article_create`
- `ban_comment_create`
