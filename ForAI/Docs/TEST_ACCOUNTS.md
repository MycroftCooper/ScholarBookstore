# 测试账号

本文件只记录本地开发库 `kb_dev` 的测试账号。项目上线或连接生产库前，不要复用这些账号和密码。

统一测试密码：

```text
Test@123456
```

| 身份 | 邮箱 | 用户名 | 密码 | 权限/绑定 |
| --- | --- | --- | --- | --- |
| 管理员 | `test.admin@example.test` | `test_admin` | `Test@123456` | 全站 `admin` |
| 领域主 | `test.domain.owner@example.test` | `test_domain_owner` | `Test@123456` | `AI 研究` 领域主 |
| 版主 | `test.module.moderator@example.test` | `test_module_moderator` | `Test@123456` | `机器学习工程` 版主 |
| 普通用户 | `test.user@example.test` | `test_user` | `Test@123456` | 普通 `user` |

验证时间：2026-07-05，本地 API 登录接口均返回 `200`。
