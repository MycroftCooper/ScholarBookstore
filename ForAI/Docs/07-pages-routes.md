# 页面与路由设计文档

## 1. 总体约定

- 当前 MVP 只做 Web。PWA 安装与离线能力后续迭代。
- 前端使用 Next.js App Router。
- 产品结构为 `网站 -> 领域 -> 版块 -> 文章`。
- 第一版不做论坛、帖子详情页、主题帖列表。
- 页面需要适配移动端。
- 所有需要登录的页面必须处理未登录状态。
- 所有列表页必须有空状态、加载状态和错误状态。

## 2. 首页 `/`

用途：

- 展示站点入口、版块列表和最新发布文章。

展示内容：

- 顶部导航。
- 领域入口。
- 最新文章列表。
- 登录入口或用户菜单。
- 通知入口，已登录时显示未读数量。

用户操作：

- 进入版块页。
- 进入发现页。
- 进入文章详情。
- 登录、注册或投稿。
- 已登录用户进入个人中心。

调用 API：

- `GET /api/v1/domains`
- `GET /api/v1/articles`
- `GET /api/v1/me/notifications/unread-count`，仅登录后调用。

登录要求：

- 浏览不需要登录。

空状态：

- 无领域时展示“暂无领域”。
- 无文章时展示“暂无文章”。

错误状态：

- API 失败时展示可重试提示。

移动端要求：

- 领域和文章列表单列展示。
- 导航收敛为移动端菜单。

## 2a. 发现页 `/discover`

用途：

- 搜索已发布文章，展示热点文章和随机文章。

展示内容：

- 关键词搜索框。
- Tag 筛选框。
- 最新、热点、随机排序切换。
- 搜索结果列表。
- 热点文章聚合。
- 随机文章聚合。

用户操作：

- 按关键词搜索文章。
- 按 Tag 筛选文章。
- 点击文章进入详情页。
- 点击文章 Tag 跳转或刷新 `/discover?tag={slug}`。

调用 API：

- `GET /api/v1/articles?q={keyword}&tag={slug}&sort={latest|hot|random}`

登录要求：

- 浏览不需要登录。

空状态：

- 无结果时展示“未找到相关文章”。

错误状态：

- API 失败时展示错误提示。

## 3a. 领域列表 `/domain`

用途：

- 展示公开领域入口。

调用 API：

- `GET /api/v1/domains`

登录要求：

- 浏览不需要登录。

空状态：

- 无领域时展示“暂无领域”。

## 3b. 领域详情 `/domain/[id]`

用途：

- 展示某个领域下的版块列表。

调用 API：

- `GET /api/v1/domains/{id}`

登录要求：

- 浏览不需要登录。

空状态：

- 领域下无版块时展示“该领域下暂无版块”。

错误状态：

- 领域不存在时展示 404。

## 3. 登录页 `/login`

用途：

- 用户登录。

展示内容：

- 邮箱输入框。
- 密码输入框。
- 记住我展示项。
- 找回密码入口，跳转 `/forgot-password`。
- 登录按钮。
- 注册入口。
- 设计风格使用游学书屋品牌登录场景，不展示未接入的真实第三方登录能力。

调用 API：

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`

登录要求：

- 未登录访问。
- 已登录访问时跳转首页或来源页。

错误状态：

- 登录失败展示统一错误，不区分邮箱不存在和密码错误。

移动端要求：

- 表单宽度适配小屏。
- 输入框和按钮可触摸区域足够大。

## 3c. 注册页 `/register`

用途：

- 用户创建账号。

展示内容：

- 用户名输入框。
- 邮箱输入框。
- 密码输入框。
- 确认密码输入框。
- 用户协议与隐私政策勾选项。
- 登录入口。

调用 API：

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`，注册成功后自动登录。

当前实现说明：

- 前端校验两次密码一致。
- 前端要求勾选用户协议与隐私政策。
- 后端当前仅校验用户名长度、邮箱格式和密码最小长度；复杂密码策略仍在 TODO 中。

登录要求：

- 未登录访问。

错误状态：

- 注册失败展示后端返回错误或统一失败提示。

移动端要求：

- 表单单列展示，底部信息不遮挡提交按钮。

## 3d. 找回密码页 `/forgot-password`

用途：

- 用户通过邮箱发起密码找回流程。

展示内容：

- 注册邮箱输入框。
- 发送重置链接按钮。
- 返回登录入口。
- 下一步流程提示。

调用 API：

- 暂无。当前后端没有找回密码令牌、邮件发送和重设密码接口。

当前实现说明：

- 页面只提供前端外壳。
- 提交后明确提示“找回密码后端接口尚未接入，当前未发送重置邮件”，不展示假成功。
- 后端缺口记录在 `TODO.md` 的“登录页扩展登录能力”中。

登录要求：

- 未登录访问。

移动端要求：

- 表单单列展示，流程提示可换行。

## 4. 版块页 `/modules/[slug]`

用途：

- 展示某个版块下的技术文章。

展示内容：

- 版块名称、描述。
- 文章列表。
- 投稿按钮。

用户操作：

- 浏览文章。
- 登录后投稿。

调用 API：

- `GET /api/v1/modules/{slug}`
- `GET /api/v1/articles?moduleSlug={slug}`

登录要求：

- 浏览不需要登录。
- 投稿需要登录。

空状态：

- 无文章时展示空文章提示。

错误状态：

- 版块不存在时展示 404。
- 列表加载失败时展示重试。

移动端要求：

- 文章列表单列展示。
- 投稿入口清晰但不遮挡内容。

## 5. 文章详情页 `/articles/[id]`

用途：

- 阅读文章、查看评论、回复评论、对评论赞踩。

展示内容：

- 文章标题、作者、版块、发布时间。
- Tags 与使用次数。
- 文章目录（TOC），从 Markdown `h1`-`h3` 生成。
- Markdown 正文。
- 图片内容。
- 登录后展示评论列表。
- 登录后展示评论回复列表。
- 登录后展示评论输入框。
- 登录后展示回复评论输入框。
- 作者信息区展示关注/取关入口。
- 隐藏或已删除评论展示占位内容。

用户操作：

- 浏览文章。
- 登录后发表评论。
- 登录后回复评论。
- 登录后加载更多评论。
- 登录后收藏文章，并选择保存到哪个收藏夹。
- 登录后关注/取关作者。
- 作者或管理角色删除评论和回复。

调用 API：

- `GET /api/v1/articles/{id}`
- `GET /api/v1/me/bookmark-collections`
- `GET /api/v1/articles/{id}/bookmark`
- `POST /api/v1/articles/{id}/bookmark`
- `DELETE /api/v1/articles/{id}/bookmark`
- `GET /api/v1/articles/{id}/comments`，仅登录后调用
- `POST /api/v1/articles/{id}/comments`
- `POST /api/v1/comments/{id}/replies`
- `PUT /api/v1/comments/{id}/vote`
- `DELETE /api/v1/comments/{id}`
- `GET /api/v1/users/{username}/follow`
- `POST /api/v1/users/{username}/follow`
- `DELETE /api/v1/users/{username}/follow`

当前实现说明：

- 文章详情展示 `wordCount`、`readingMinutes`、`viewCount`、`revisionCount`。
- 成功读取已发布文章详情后，后端递增 `viewCount`。
- 文章详情展示标签，标签内显示 `usageCount`。
- 登录用户评论区支持最新/最热排序。
- 登录用户评论区支持加载更多。
- 登录用户可对评论和回复点赞、点踩、取消或切换赞踩。
- 文章详情页作者信息区已接入关注按钮。
- 登录用户收藏文章时先选择收藏夹，再提交收藏；已收藏文章可直接取消收藏。
- Markdown 标题自动生成锚点，右侧目录可跳转。

登录要求：

- 阅读不需要登录。
- 查看评论、评论和回复需要登录。

空状态：

- 无评论时展示“暂无评论”。

错误状态：

- 文章不存在、未发布或无权访问时展示 404。
- 评论或回复提交失败时保留输入内容并提示。

移动端要求：

- Markdown 内容在小屏不横向溢出。
- 图片自适应容器宽度。
- 代码块可横向滚动。
- 回复按钮和输入框不能遮挡正文。

## 5a. 作者公开主页 `/authors/[username]`

用途：

- 展示作者公开信息和已发布文章。

展示内容：

- 左侧作者资料卡：头像、用户名、Bio、技术标签、关注按钮、资料信息、文章数、收藏数、粉丝数和关注数。
- 左侧补充展示社交与链接、贡献历程模块；当前无社交链接字段时展示空状态。
- 中间作者主页封面、文章/收藏/简历 tab（当前仅文章 tab 可用，简历为后续预留）。
- 文章筛选区：最新、热门、精选和作者文章搜索。
- 作者已发布文章列表，点击进入文章详情。
- 右侧展示热门文章、活跃领域和推荐其他用户空状态；热门文章展示真实浏览量。

用户操作：

- 登录用户关注/取关该作者。
- 点击文章进入详情页。
- 点击头像/用户名进入作者主页（已在该页）。
- 不提供私信、收藏主页、动态和关于入口。

调用 API：

- `GET /api/v1/users/{username}`
- `GET /api/v1/users/{username}/follow`
- `POST /api/v1/users/{username}/follow`
- `DELETE /api/v1/users/{username}/follow`

当前实现说明：

- 作者资料、已发布文章列表、关注按钮和关注统计已接真实数据。
- 作者文章被收藏总数、文章浏览量和文章收藏数由 `GET /api/v1/users/{username}` 返回并接入页面。
- 活跃领域按作者已发布文章所属版块聚合计算。
- 贡献历程按作者已发布文章日期做前端聚合展示。
- 暂无推荐用户接口和社交链接字段，因此推荐其他用户、社交与链接模块展示空状态，不造假数据。
- 文章接口当前未返回点赞数、封面图、简历或成就数据，因此页面不展示虚假点赞、封面、简历和成就。

登录要求：

- 浏览不需要登录。
- 关注/取关需要登录。

空状态：

- 用户不存在时展示 404。
- 无已发布文章时展示"该用户暂无文章"。

## 6. 投稿页 `/me/submit`

用途：

- 登录用户投稿文章。

展示内容：

- 版块选择。
- 标题输入。
- 摘要输入。
- Tag 输入，最多 9 个。
- Markdown 编辑区。
- 图片上传入口。
- 预览区域。TODO：是否 MVP 做实时预览需确认。

调用 API：

- `GET /api/v1/modules`
- `POST /api/v1/uploads/article-images`
- `POST /api/v1/articles`

当前实现说明：

- `POST /api/v1/articles` 可传 `status = draft` 保存草稿。
- `POST /api/v1/articles` 可传 `status = pending_review` 提交审核。
- 草稿允许正文为空；提交审核必须有正文。
- 可添加最多 9 个 Tags，后端自由创建。

登录要求：

- 必须登录。

空状态：

- 无可投稿版块时提示“暂无可投稿版块”。

错误状态：

- 表单校验失败展示字段错误。
- 上传失败展示文件错误。
- 提交失败保留草稿内容。

移动端要求：

- 编辑区可用，但优先保证表单可提交。
- 上传按钮和提交按钮不遮挡键盘。

## 7. 个人中心 `/me`

用途：

- 已登录用户查看自己的投稿、评论、通知和基础账户信息。

展示内容：

- 用户基础信息。
- 用户头像、Bio、学校/公司。
- 我的投稿入口。
- 我的评论入口。
- 我的通知入口和未读数量。
- 编辑资料入口。

调用 API：

- `GET /api/v1/auth/me`
- `GET /api/v1/me/notifications/unread-count`

当前实现说明：

- 草稿统一在 `/me/articles` 中通过状态筛选管理，不再提供独立草稿页。

登录要求：

- 必须登录。

错误状态：

- 未登录跳转登录页。
- 加载失败展示重试。

移动端要求：

- 入口以单列列表或标签页展示。

## 7a. 编辑个人资料 `/me/profile`

用途：

- 已登录用户在“设置”页编辑头像、Bio、学校和公司信息，并预览公开资料展示。

展示内容：

- 左侧个人信息卡与个人中心通用侧边导航。
- 顶部“编辑个人信息”说明区。
- 个人资料 tab；账号安全、通知设置、隐私设置暂为禁用展示。
- 基本信息区：当前头像、头像上传入口、只读昵称/用户名、Bio 输入框。
- 技术标签、展示设置、个人封面为静态展示占位，后续补字段后接入保存。
- 联系方式区：邮箱只读脱敏展示，学校和公司可编辑。
- 右侧资料预览、资料完整度和资料优化建议。
- 保存更改、预览主页、取消按钮。

调用 API：

- `GET /api/v1/auth/me`
- `PATCH /api/v1/me/profile`
- `POST /api/v1/me/avatar`
- `GET /api/v1/me/articles`
- `GET /api/v1/me/bookmarks`
- `GET /api/v1/me/comments`
- `GET /api/v1/me/following`
- `GET /api/v1/me/followers`

登录要求：

- 必须登录。

错误状态：

- 未登录跳转登录页。
- 头像上传失败展示文件错误。
- 保存失败保留输入内容并提示。

## 8. 我的投稿页 `/me/articles`

用途：

- 用户查看自己的投稿和审核状态。

展示内容：

- 投稿列表。
- 状态筛选。
- 审核拒绝原因。
- 编辑入口。

调用 API：

- `GET /api/v1/me/articles`

当前实现说明：

- 页面支持按 `draft`、`pending_review`、`published`、`rejected`、`archived` 筛选。
- 列表展示字数、预计阅读时长、浏览量、修订次数。
- 已发布文章展示“发起修订”入口。

登录要求：

- 必须登录。

空状态：

- 无投稿时展示投稿入口。

## 8a. 草稿管理

用途：

- 草稿不再提供独立 `/me/drafts` 页面，统一归入 `/me/articles` 的状态筛选中管理。

展示内容：

- `/me/articles` 通过“草稿”状态筛选展示草稿。
- 个人中心总览的“草稿”模块只作为概览，查看全部跳转 `/me/articles`。
- 草稿行展示标题、所属版块、最后编辑时间、字数和继续编辑入口。

调用 API：

- `GET /api/v1/me/articles`

登录要求：

- 必须登录。

空状态：

- `/me/articles` 无草稿时在表格中展示空状态。

## 9. 投稿编辑页 `/me/articles/[id]/edit`

用途：

- 作者编辑自己的未发布投稿。
- 被拒投稿修改后重新提交审核。

展示内容：

- 当前状态。
- 被拒文章的审核说明。
- 标题、摘要、Markdown 正文。
- Tag 输入，最多 9 个。
- 图片上传入口。
- 版块只读展示。

调用 API：

- `GET /api/v1/me/articles/{id}`
- `PATCH /api/v1/articles/{id}`
- `POST /api/v1/uploads/article-images`

当前实现说明：

- 草稿可保存为 `draft`，也可提交为 `pending_review`。
- 拒绝稿展示审核说明，修改后提交审核。
- 已发布文章可发起修订，提交后创建 `pending_review` 修订稿，原文继续公开。

登录要求：

- 必须登录。
- 仅作者可访问自己的投稿。

状态规则：

- `draft`、`pending_review`、`rejected` 可编辑。
- `rejected` 保存后重新进入 `pending_review`。
- `published` 可发起修订，但不直接修改原文。
- `archived` 不允许直接编辑。

## 10. 我的评论页 `/me/comments`

用途：

- 用户查看自己发表过的评论和回复。

展示内容：

- 评论内容摘要。
- 所属文章标题。
- 评论赞踩互动数据。
- 隐藏状态。
- 发布时间。
- 删除入口。

调用 API：

- `GET /api/v1/me/comments`
- `DELETE /api/v1/comments/{id}`

登录要求：

- 必须登录。

空状态：

- 无评论时展示“暂无评论”。

## 11. 我的收藏页 `/me/bookmarks`

用途：

- 用户查看自己收藏的文章，按收藏夹筛选，并管理收藏夹。

展示内容：

- 左侧复用个人资料与个人中心导航。
- 中间展示我的收藏 Hero、收藏统计、搜索/筛选、收藏内容表格。
- 右侧展示最近收藏、收藏夹管理和收藏夹提示。
- 收藏夹下拉筛选。
- 新建收藏夹表单。
- 收藏夹重命名、删除。
- 收藏文章列表。
- 将收藏移动到其他收藏夹。
- 收藏页只管理文章收藏和收藏夹；版块、作者不作为收藏对象，不展示收藏趋势图。

调用 API：

- `GET /api/v1/auth/me`
- `GET /api/v1/users/{username}`
- `GET /api/v1/me/articles`
- `GET /api/v1/me/comments`
- `GET /api/v1/me/following`
- `GET /api/v1/me/followers`
- `GET /api/v1/me/bookmark-collections`
- `POST /api/v1/me/bookmark-collections`
- `PATCH /api/v1/me/bookmark-collections/{id}`
- `DELETE /api/v1/me/bookmark-collections/{id}`
- `GET /api/v1/me/bookmarks`
- `PATCH /api/v1/me/bookmarks/{id}`
- `DELETE /api/v1/articles/{id}/bookmark`

登录要求：

- 必须登录。

空状态：

- 无收藏时展示“暂无收藏”。

## 12. 关注列表 `/me/following`

用途：

- 查看当前用户关注的作者，并追踪关注作者的新文章动态。

展示内容：

- 左侧复用个人资料与个人中心导航。
- 中间展示关注概览、关注作者、关注版块、关注领域三个模块。
- 右侧展示关注数据摘要、最近活跃关注和推荐关注空状态。
- 当前后端只支持关注作者；关注版块、关注领域、推荐关注暂不接入假数据。

用户操作：

- 搜索关注作者。
- 按“全部 / 作者 / 版块 / 领域”切换视图。
- 查看作者主页。
- 取消关注作者。

调用 API：

- `GET /api/v1/auth/me`
- `GET /api/v1/users/{username}`
- `GET /api/v1/me/articles`
- `GET /api/v1/me/bookmarks`
- `GET /api/v1/me/comments`
- `GET /api/v1/me/notifications`
- `GET /api/v1/me/following`
- `GET /api/v1/me/followers`
- `DELETE /api/v1/users/{username}/follow`

登录要求：

- 必须登录。

## 13. 粉丝列表 `/me/followers`

用途：

- 查看关注当前用户的用户。

调用 API：

- `GET /api/v1/me/followers`

登录要求：

- 必须登录。

## 14. 我的通知页 `/me/notifications`

用途：

- 用户查看文章评论通知和评论回复通知。

展示内容：

- 通知列表。
- 未读状态。
- 触发用户。
- 关联文章和评论入口。

用户操作：

- 查看通知。
- 标记单条已读。
- 全部标记已读。
- 跳转到对应文章。评论锚点方案后续迭代。

调用 API：

- `GET /api/v1/me/notifications`
- `POST /api/v1/me/notifications/{id}/read`
- `POST /api/v1/me/notifications/read-all`

登录要求：

- 必须登录。

## 15. 举报处理入口 `/admin/tasks`

用途：

- reviewer/admin 在统一待办页查看和处理文章举报。原独立 `/admin/reports` 页面已删除。

调用 API：

- `GET /api/v1/admin/tasks?type=content_report`
- `POST /api/v1/admin/tasks/{id}/actions`
- `GET /api/v1/admin/reports`
- `POST /api/v1/admin/reports/{id}/resolve`

登录要求：

- reviewer、admin。

空状态：

- 无举报待办时展示"暂无待办"。

## 12. 管理后台 `/admin`

用途：

- 审核文章、管理版块、处理内容。

展示内容：

- 文章审核 tab。
- 版块管理 tab。
- 内容管理 tab。

调用 API：

- `GET /api/v1/admin/articles/reviews`
- `POST /api/v1/admin/articles/{id}/approve`
- `POST /api/v1/admin/articles/{id}/reject`
- `GET /api/v1/admin/articles`
- `POST /api/v1/admin/articles/{id}/archive`
- `POST /api/v1/admin/articles/{id}/restore`
- `POST /api/v1/admin/modules`
- `PATCH /api/v1/admin/modules/{id}`
- `GET /api/v1/domains?includeInactive=true`
- `POST /api/v1/admin/domains`
- `PATCH /api/v1/admin/domains/{id}`
- `GET /api/v1/admin/comments`
- `POST /api/v1/admin/comments/{id}/hide`
- `POST /api/v1/admin/comments/{id}/show`
- `DELETE /api/v1/comments/{id}`

登录要求：

- 必须登录。
- reviewer、admin 可进入文章审核和内容管理。
- 仅 admin 可进入版块管理。
- MVP 暂不提供用户角色管理 UI。

空状态：

- 无待审核文章时展示“暂无待审核投稿”。
- 无文章时展示“暂无文章”。
- 无评论时展示“暂无评论”。

错误状态：

- 权限不足展示 403。
- 接口失败展示重试和错误提示。

移动端要求：

- 管理后台可移动端访问，但优先保证桌面体验。
- 表格在小屏可改为列表卡片。

## 16. 404 页面 `app/not-found.tsx`

用途：

- 展示未匹配路由的友好错误页。

展示内容：

- 游学书屋品牌导航。
- 404 大标题和页面走丢提示。
- 搜索框，提交后跳转 `/discover?q={keyword}`。
- 返回首页、去发现按钮。
- 浏览文章、按领域查看、去发现、投递文章推荐入口。
- 右侧线稿装饰，仅桌面展示。

调用 API：

- 无。搜索框只跳转发现页，由 `/discover` 使用现有文章列表接口加载结果。

移动端要求：

- 不展示右侧装饰图形。
- 无横向溢出。

### 2026-06-24 文章详情页补充

- 文章详情页仅在 `summary` 有值时展示摘要区域，不再生成或展示占位摘要。
- 文章信息里的协议项改为来源，展示 `Article.sourceType` 对应的原创/转载。
- 游客不读取评论接口，评论区展示“登录后查看评论”的提示；查看评论、评论、回复和互动操作仍需要登录。

## 2026-06-24 关于与规则页面补充

- `/about`：关于游学书屋的静态说明页，入口放在全站页脚，不放入页眉。
- `/about/writing`：写作规范静态页，说明文章主题、结构、代码图片、摘要标签等要求。
- `/about/review`：审核规则静态页，说明审核范围、流程、退回原因和提交前自查项。
- 文章编辑页右侧“查看写作规范”跳转 `/about/writing`，“了解更多审核规则”跳转 `/about/review`。

## 2026-06-24 个人中心页改版

- `/me` 改为三栏个人中心布局：左侧用户资料统计与导航，中间个人概览、关注、收藏、草稿、文章，右侧个人偏好与账号信息。
- 页面使用现有接口聚合数据：`/auth/me`、`/me/articles`、`/me/bookmarks`、`/me/comments`、`/me/notifications`、`/me/following`、`/me/followers`、`/users/{username}`。
- 本轮不实现成就系统，个人中心不展示成就模块；不展示假的图表统计。

## 2026-06-24 我的文章页改版

- `/me/articles` 改为三栏“我的文章”管理页：左侧复用个人资料与个人中心导航，中间展示文章概览、状态筛选、领域/版块筛选和文章表格，右侧展示创作洞察、最受欢迎文章和创作小贴士。
- 页面只接入已有接口，不新增后端接口：`/auth/me`、`/me/articles`、`/modules`、`/me/bookmarks`、`/me/comments`、`/me/notifications`、`/me/followers`、`/users/{username}`。
- 数据要求：文章数量、草稿数量、阅读量、收藏、粉丝等数字来自接口；不展示假的趋势图或成就系统。
- 表格操作按文章状态区分：已发布文章可进入文章详情并可修订；草稿、待审核、已拒绝文章进入编辑页；已下架文章只显示下架状态。

## 2026-06-24 首页与个人中心展示顺序调整

- `/me` 总览侧边导航只保留“我的文章”，草稿作为文章状态在 `/me/articles` 内筛选查看。
- `/me` 总览内容顺序调整为：关注、收藏、草稿、文章，并移除最近互动模块。
- `/me/articles` 筛选区改为搜索、状态、下拉筛选三段布局，避免窄屏或中等宽度下按钮错位。
- `/` 首页 Hero 后优先展示知识领域、热门版块、热门文章，再展示最新文章和优秀创作者。
