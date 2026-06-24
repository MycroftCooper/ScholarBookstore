"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { SiteFrame } from "@/components/layout/SiteFrame";
import { MeSideNav } from "@/components/me/MeSideNav";
import { UserAvatar } from "@/components/users/UserAvatar";
import { listMyArticles, type ArticleSummary } from "@/lib/api/articles";
import { getCurrentUser, type CurrentUser } from "@/lib/api/auth";
import { listBookmarks, type BookmarkedArticle } from "@/lib/api/bookmarks";
import { ApiError } from "@/lib/api/client";
import { listMyComments, type CommentItem } from "@/lib/api/comments";
import { listModules, type ModuleSummary } from "@/lib/api/modules";
import { listNotifications, type NotificationItem } from "@/lib/api/notifications";
import {
  getPublicAuthorProfile,
  listFollowers,
  type FollowUser,
  type PublicAuthorProfile,
} from "@/lib/api/users";

type PageData = {
  user: CurrentUser;
  profile: PublicAuthorProfile | null;
  articles: ArticleSummary[];
  modules: ModuleSummary[];
  bookmarks: BookmarkedArticle[];
  comments: CommentItem[];
  notifications: NotificationItem[];
  followers: FollowUser[];
};

type StatusFilter = ArticleSummary["status"] | "";

type Metrics = {
  published: ArticleSummary[];
  drafts: ArticleSummary[];
  totalViews: number;
  totalComments: number;
  followersCount: number;
  receivedLikes: number;
};

const statusFilters: Array<{ value: StatusFilter; label: string }> = [
  { value: "", label: "全部" },
  { value: "published", label: "已发布" },
  { value: "pending_review", label: "待审核" },
  { value: "draft", label: "草稿" },
  { value: "rejected", label: "已拒绝" },
  { value: "archived", label: "已下架" },
];

export default function MyArticlesPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [status, setStatus] = useState<StatusFilter>("");
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("");
  const [module, setModule] = useState("");
  const [sort, setSort] = useState<"updated" | "views" | "title">("updated");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const requestedStatus = parseStatusFilter(new URLSearchParams(window.location.search).get("status"));
    if (requestedStatus) {
      setStatus(requestedStatus);
    }
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const user = await getCurrentUser();
        const [profile, articles, modules, bookmarks, comments, notifications, followers] = await Promise.all([
          getPublicAuthorProfile(user.username).catch(() => null),
          listMyArticles(),
          listModules().catch(() => []),
          listBookmarks().catch(() => []),
          listMyComments().catch(() => []),
          listNotifications().catch(() => []),
          listFollowers().catch(() => []),
        ]);
        setData({ user, profile, articles, modules, bookmarks, comments, notifications, followers });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          window.location.href = "/login";
          return;
        }
        setError("我的文章加载失败，请稍后重试");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [query, status, domain, module, sort]);

  const moduleById = useMemo(
    () => new Map((data?.modules ?? []).map((item) => [item.id, item])),
    [data?.modules],
  );

  const commentCounts = useMemo(() => {
    const counts = new Map<number, number>();
    data?.notifications.forEach((item) => {
      if (item.type === "article_comment" && item.articleId) {
        counts.set(item.articleId, (counts.get(item.articleId) ?? 0) + 1);
      }
    });
    return counts;
  }, [data?.notifications]);

  const metrics = useMemo<Metrics>(() => {
    const articles = data?.articles ?? [];
    const published = articles.filter((item) => item.status === "published");
    const drafts = articles.filter((item) => item.status === "draft");
    return {
      published,
      drafts,
      totalViews: published.reduce((sum, item) => sum + item.viewCount, 0),
      totalComments: published.reduce((sum, item) => sum + (commentCounts.get(item.id) ?? 0), 0),
      followersCount: data?.profile?.followersCount ?? data?.followers.length ?? 0,
      receivedLikes: data?.comments.reduce((sum, item) => sum + item.upVotes, 0) ?? 0,
    };
  }, [commentCounts, data]);

  const domains = useMemo(
    () => uniqueStrings((data?.modules ?? []).map((item) => item.domainName)),
    [data?.modules],
  );
  const modules = useMemo(
    () => uniqueStrings((data?.articles ?? []).map((item) => item.moduleName)),
    [data?.articles],
  );

  const filteredArticles = useMemo(() => {
    let items = [...(data?.articles ?? [])];
    const keyword = query.trim().toLowerCase();
    if (keyword) {
      items = items.filter((item) =>
        `${item.title} ${item.summary} ${item.moduleName}`.toLowerCase().includes(keyword),
      );
    }
    if (status) {
      items = items.filter((item) => item.status === status);
    }
    if (domain) {
      items = items.filter((item) => moduleById.get(item.moduleId)?.domainName === domain);
    }
    if (module) {
      items = items.filter((item) => item.moduleName === module);
    }
    items.sort((a, b) => {
      if (sort === "views") {
        return b.viewCount - a.viewCount;
      }
      if (sort === "title") {
        return a.title.localeCompare(b.title, "zh-CN");
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return items;
  }, [data?.articles, domain, module, moduleById, query, sort, status]);

  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(filteredArticles.length / pageSize));
  const visibleArticles = filteredArticles.slice((page - 1) * pageSize, page * pageSize);
  const popular = [...metrics.published].sort((a, b) => b.viewCount - a.viewCount).slice(0, 3);

  return (
    <SiteFrame>
      <section className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
        {loading && <StateCard>正在加载我的文章...</StateCard>}
        {error && <StateCard tone="error">{error}</StateCard>}

        {data && (
          <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
            <aside className="space-y-5">
              <ProfileCard data={data} metrics={metrics} />
              <MeSideNav
                activeHref="/me/articles"
                counts={{
                  bookmarks: data.bookmarks.length,
                  comments: data.comments.length,
                }}
              />
            </aside>

            <main className="min-w-0 space-y-5">
              <HeroCard />
              <StatsGrid articles={data.articles} metrics={metrics} />
              <ArticleTools
                query={query}
                status={status}
                sort={sort}
                domain={domain}
                module={module}
                domains={domains}
                modules={modules}
                onQuery={setQuery}
                onStatus={setStatus}
                onSort={setSort}
                onDomain={setDomain}
                onModule={setModule}
                onReset={() => {
                  setQuery("");
                  setStatus("");
                  setDomain("");
                  setModule("");
                  setSort("updated");
                }}
              />
              <ArticleTable
                articles={visibleArticles}
                commentCounts={commentCounts}
                total={filteredArticles.length}
                page={page}
                pageCount={pageCount}
                onPage={setPage}
              />
            </main>

            <aside className="space-y-5">
              <CreationInsight metrics={metrics} />
              <PopularArticles articles={popular} />
              <TipsCard />
            </aside>
          </div>
        )}
      </section>
    </SiteFrame>
  );
}

function ProfileCard({ data, metrics }: { data: PageData; metrics: Metrics }) {
  return (
    <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-6 text-center shadow-[var(--shadow-soft)]">
      <div className="mx-auto w-fit rounded-full border border-[var(--color-line)] bg-[var(--color-surface-solid)] p-2">
        <UserAvatar username={data.user.username} avatarUrl={data.user.avatarUrl} size="lg" />
      </div>
      <h1 className="mt-4 text-2xl font-semibold text-[var(--color-ink)]">{data.user.username}</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">@{data.user.username}</p>
      <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
        {data.user.bio || "热爱技术，热爱分享与思考"}
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Badge>程序</Badge>
        <Badge>{roleLabel(data.user.role)}</Badge>
        <Badge>写作者</Badge>
      </div>
      <div className="mt-6 grid grid-cols-5 gap-2 border-t border-[var(--color-line)] pt-5 text-center">
        <MiniStat label="文章" value={String(metrics.published.length)} />
        <MiniStat label="草稿" value={String(metrics.drafts.length)} />
        <MiniStat label="获赞" value={formatCompact(metrics.receivedLikes)} />
        <MiniStat label="收藏" value={formatCompact(data.bookmarks.length)} />
        <MiniStat label="粉丝" value={formatCompact(metrics.followersCount)} />
      </div>
    </section>
  );
}

function HeroCard() {
  return (
    <section className="relative overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-7 shadow-[var(--shadow-soft)]">
      <ContourLayer />
      <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">// Articles</p>
          <h2 className="mt-3 text-3xl font-semibold text-[var(--color-ink)]">我的文章</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
            集中管理你的全部文章、投稿状态与阅读表现。
          </p>
        </div>
        <Link
          href="/me/submit"
          className="grid h-11 w-full place-items-center rounded-md bg-[var(--color-accent)] px-6 text-sm font-semibold text-[#171717] md:w-36"
        >
          写新文章
        </Link>
      </div>
    </section>
  );
}

function StatsGrid({ articles, metrics }: { articles: ArticleSummary[]; metrics: Metrics }) {
  const items: Array<[string, number, string]> = [
    ["全部文章数", articles.length, "含草稿与审核中"],
    ["已发布", metrics.published.length, "公开展示"],
    ["草稿", metrics.drafts.length, "待继续编辑"],
    ["累计阅读", metrics.totalViews, "已发布文章"],
  ];
  return (
    <section className="grid gap-4 md:grid-cols-4">
      {items.map(([label, value, hint]) => (
        <div key={label} className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)]">
          <div className="text-sm text-[var(--color-muted)]">{label}</div>
          <div className="mt-2 text-3xl font-semibold text-[var(--color-ink)]">{formatCompact(value)}</div>
          <div className="mt-2 text-xs text-[var(--color-muted)]">{hint}</div>
        </div>
      ))}
    </section>
  );
}

function ArticleTools({
  query,
  status,
  sort,
  domain,
  module,
  domains,
  modules,
  onQuery,
  onStatus,
  onSort,
  onDomain,
  onModule,
  onReset,
}: {
  query: string;
  status: StatusFilter;
  sort: "updated" | "views" | "title";
  domain: string;
  module: string;
  domains: string[];
  modules: string[];
  onQuery: (value: string) => void;
  onStatus: (value: StatusFilter) => void;
  onSort: (value: "updated" | "views" | "title") => void;
  onDomain: (value: string) => void;
  onModule: (value: string) => void;
  onReset: () => void;
}) {
  return (
    <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)]">
      <div className="grid gap-4">
        <div>
          <input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="搜索我的文章标题..."
            className="h-11 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-4 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-accent-strong)]"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {statusFilters.map((item) => (
            <button
              key={item.value || "all"}
              type="button"
              onClick={() => onStatus(item.value)}
              className={`h-11 rounded-md border px-4 text-sm font-semibold ${
                status === item.value
                  ? "border-[var(--color-accent-strong)] bg-[var(--color-accent)] text-[#171717]"
                  : "border-[var(--color-line)] bg-[var(--color-surface-solid)] text-[var(--color-muted)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
          <select value={sort} onChange={(event) => onSort(event.target.value as "updated" | "views" | "title")} className={selectClass}>
            <option value="updated">排序：最近更新</option>
            <option value="views">排序：阅读量</option>
            <option value="title">排序：标题</option>
          </select>
          <select value={domain} onChange={(event) => onDomain(event.target.value)} className={selectClass}>
            <option value="">所属领域：全部领域</option>
            {domains.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={module} onChange={(event) => onModule(event.target.value)} className={selectClass}>
            <option value="">所属版块：全部版块</option>
            {modules.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <button type="button" onClick={onReset} className="h-11 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-5 text-sm font-semibold text-[var(--color-muted)]">
            重置
          </button>
        </div>
      </div>
    </section>
  );
}

function ArticleTable({
  articles,
  commentCounts,
  total,
  page,
  pageCount,
  onPage,
}: {
  articles: ArticleSummary[];
  commentCounts: Map<number, number>;
  total: number;
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  return (
    <section className="overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="text-xs text-[var(--color-muted)]">
            <tr className="border-b border-[var(--color-line)]">
              <th className="px-4 py-3 font-semibold">文章标题</th>
              <th className="px-4 py-3 font-semibold">所属版块</th>
              <th className="px-4 py-3 font-semibold">状态</th>
              <th className="px-4 py-3 font-semibold">阅读量</th>
              <th className="px-4 py-3 font-semibold">评论数</th>
              <th className="px-4 py-3 font-semibold">最近更新时间</th>
              <th className="px-4 py-3 text-right font-semibold">操作</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((article) => (
              <tr key={article.id} className="border-b border-[var(--color-line)] last:border-b-0">
                <td className="max-w-[260px] px-4 py-4 font-semibold text-[var(--color-ink)]">{article.title || "未命名文章"}</td>
                <td className="px-4 py-4 text-[var(--color-muted)]">{article.moduleName}</td>
                <td className="px-4 py-4"><StatusBadge status={article.status} /></td>
                <td className="px-4 py-4 text-[var(--color-muted)]">{article.status === "published" ? formatCompact(article.viewCount) : "-"}</td>
                <td className="px-4 py-4 text-[var(--color-muted)]">{commentCounts.get(article.id) ?? 0}</td>
                <td className="px-4 py-4 text-[var(--color-muted)]">{formatDateTime(article.updatedAt)}</td>
                <td className="px-4 py-4 text-right">
                  <ArticleAction article={article} />
                </td>
              </tr>
            ))}
            {articles.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-[var(--color-muted)]">
                  暂无符合条件的文章
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-line)] px-4 py-4 text-sm text-[var(--color-muted)]">
        <span>共 {total} 条</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            className="h-9 rounded-md border border-[var(--color-line)] px-3 disabled:opacity-50"
          >
            上一页
          </button>
          <span>{page} / {pageCount}</span>
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => onPage(page + 1)}
            className="h-9 rounded-md border border-[var(--color-line)] px-3 disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      </div>
    </section>
  );
}

function ArticleAction({ article }: { article: ArticleSummary }) {
  if (article.status === "published") {
    return (
      <div className="inline-flex gap-2">
        <Link href={`/articles/${article.id}`} className={actionClass}>查看</Link>
        <Link href={`/me/articles/${article.id}/edit`} className={actionClass}>修订</Link>
      </div>
    );
  }
  if (article.status === "archived") {
    return <span className="text-xs text-[var(--color-muted)]">已下架</span>;
  }
  return <Link href={`/me/articles/${article.id}/edit`} className={actionClass}>编辑</Link>;
}

function CreationInsight({ metrics }: { metrics: Metrics }) {
  return (
    <Panel title="创作洞察">
      <div className="grid grid-cols-3 gap-3 text-center">
        <MiniStat label="发布文章" value={String(metrics.published.length)} />
        <MiniStat label="阅读量" value={formatCompact(metrics.totalViews)} />
        <MiniStat label="获赞数" value={formatCompact(metrics.receivedLikes)} />
      </div>
      <p className="mt-5 text-sm leading-7 text-[var(--color-muted)]">
        统计来自当前账号的真实文章与互动数据，用来快速观察创作状态。
      </p>
    </Panel>
  );
}

function PopularArticles({ articles }: { articles: ArticleSummary[] }) {
  return (
    <Panel title="最受欢迎文章" actionHref="/me/articles" actionText="查看全部">
      <div className="grid gap-4">
        {articles.map((article, index) => (
          <Link key={article.id} href={`/articles/${article.id}`} className="grid grid-cols-[24px_1fr] gap-3">
            <span className="font-semibold text-[var(--color-accent-strong)]">{index + 1}</span>
            <span>
              <span className="block font-semibold text-[var(--color-ink)]">{article.title}</span>
              <span className="mt-1 block text-xs text-[var(--color-muted)]">
                阅读 {formatCompact(article.viewCount)}
              </span>
            </span>
          </Link>
        ))}
        {articles.length === 0 && <EmptyLine text="暂无已发布文章" />}
      </div>
    </Panel>
  );
}

function TipsCard() {
  const tips = [
    ["稳定更新", "保持节奏，文章会更容易积累阅读与讨论。"],
    ["标题具体", "标题说明技术对象、场景和收益，会显著提升点击率。"],
    ["结构清晰", "善用标题、代码块和总结，能提升读者停留时间。"],
  ];
  return (
    <Panel title="创作小贴士">
      <div className="grid gap-4">
        {tips.map(([title, text]) => (
          <div key={title} className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] p-4">
            <div className="font-semibold text-[var(--color-ink)]">{title}</div>
            <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{text}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Panel({
  title,
  actionHref,
  actionText,
  children,
}: {
  title: string;
  actionHref?: string;
  actionText?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">{title}</h2>
        {actionHref && (
          <Link href={actionHref} className="text-sm font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)]">
            {actionText ?? "查看全部"} →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-semibold text-[var(--color-ink)]">{value}</div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: ArticleSummary["status"] }) {
  const labels: Record<ArticleSummary["status"], string> = {
    draft: "草稿",
    pending_review: "待审核",
    published: "已发布",
    rejected: "已拒绝",
    archived: "已下架",
  };
  const color = status === "published"
    ? "text-green-700"
    : status === "pending_review"
      ? "text-[var(--color-accent-strong)]"
      : status === "rejected"
        ? "text-red-600"
        : "text-[var(--color-muted)]";
  return (
    <span className={`rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-2 py-1 text-xs font-semibold ${color}`}>
      {labels[status]}
    </span>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-3 py-1.5 text-xs font-semibold text-[var(--color-muted)]">
      {children}
    </span>
  );
}

function StateCard({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "error" }) {
  return (
    <div className={`rounded-md border p-6 text-sm ${tone === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]"}`}>
      {children}
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-[var(--color-line)] px-4 py-5 text-center text-sm text-[var(--color-muted)]">{text}</div>;
}

function ContourLayer() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-[0.16]"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at 80% 0%, transparent 0 18%, var(--color-line) 18.5% 19%, transparent 19.5% 25%, var(--color-line) 25.5% 26%, transparent 26.5%), radial-gradient(ellipse at 10% 100%, transparent 0 16%, var(--color-line) 16.5% 17%, transparent 17.5% 24%, var(--color-line) 24.5% 25%, transparent 25.5%)",
      }}
    />
  );
}

const selectClass =
  "h-11 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-3 text-sm text-[var(--color-muted)] outline-none focus:border-[var(--color-accent-strong)]";

const actionClass =
  "inline-flex h-8 items-center rounded-md border border-[var(--color-accent-strong)] px-3 text-xs font-semibold text-[var(--color-ink)]";

function roleLabel(role: CurrentUser["role"]) {
  return {
    user: "写作者",
    moderator: "版主",
    domain_owner: "领主",
    reviewer: "审核员",
    admin: "管理员",
  }[role];
}

function uniqueStrings(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function parseStatusFilter(value: string | null): StatusFilter {
  if (
    value === "draft" ||
    value === "pending_review" ||
    value === "published" ||
    value === "rejected" ||
    value === "archived"
  ) {
    return value;
  }
  return "";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCompact(value: number) {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}w`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return String(value);
}
