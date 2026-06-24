"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SiteFrame } from "@/components/layout/SiteFrame";
import { MeSideNav } from "@/components/me/MeSideNav";
import { UserAvatar } from "@/components/users/UserAvatar";
import {
  listMyArticles,
  type ArticleSummary,
} from "@/lib/api/articles";
import { getCurrentUser, type CurrentUser } from "@/lib/api/auth";
import { listBookmarks, type BookmarkedArticle } from "@/lib/api/bookmarks";
import { ApiError } from "@/lib/api/client";
import { listMyComments, type CommentItem } from "@/lib/api/comments";
import {
  listNotifications,
  unreadNotificationCount,
  type NotificationItem,
} from "@/lib/api/notifications";
import {
  getPublicAuthorProfile,
  listFollowers,
  listFollowing,
  type FollowUser,
  type PublicAuthorProfile,
} from "@/lib/api/users";

type MeData = {
  user: CurrentUser;
  profile: PublicAuthorProfile | null;
  articles: ArticleSummary[];
  drafts: ArticleSummary[];
  bookmarks: BookmarkedArticle[];
  comments: CommentItem[];
  notifications: NotificationItem[];
  unreadCount: number;
  following: FollowUser[];
  followers: FollowUser[];
};

type MeMetrics = {
  published: ArticleSummary[];
  totalViews: number;
  totalWords: number;
  totalBookmarks: number;
  totalComments: number;
  receivedLikes: number;
  receivedComments: number;
  followersCount: number;
  followingCount: number;
};

export default function MePage() {
  const [data, setData] = useState<MeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const user = await getCurrentUser();
        const [
          profile,
          articles,
          drafts,
          bookmarks,
          comments,
          notifications,
          unread,
          following,
          followers,
        ] = await Promise.all([
          getPublicAuthorProfile(user.username).catch(() => null),
          listMyArticles(),
          listMyArticles("draft"),
          listBookmarks().catch(() => []),
          listMyComments().catch(() => []),
          listNotifications().catch(() => []),
          unreadNotificationCount().catch(() => ({ count: 0 })),
          listFollowing().catch(() => []),
          listFollowers().catch(() => []),
        ]);
        setData({
          user,
          profile,
          articles,
          drafts,
          bookmarks,
          comments,
          notifications,
          unreadCount: unread.count,
          following,
          followers,
        });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          window.location.href = "/login";
          return;
        }
        setError("个人中心加载失败，请稍后重试");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const metrics = useMemo(() => {
    if (!data) {
      return null;
    }
    const published = data.articles.filter((item) => item.status === "published");
    const totalViews = published.reduce((sum, item) => sum + item.viewCount, 0);
    const totalWords = data.articles.reduce((sum, item) => sum + item.wordCount, 0);
    const totalBookmarks = data.bookmarks.length;
    const totalComments = data.comments.length;
    const receivedLikes = data.comments.reduce((sum, item) => sum + item.upVotes, 0);
    const receivedComments = data.notifications.filter((item) => item.type === "article_comment").length;
    return {
      published,
      totalViews,
      totalWords,
      totalBookmarks,
      totalComments,
      receivedLikes,
      receivedComments,
      followersCount: data.profile?.followersCount ?? data.followers.length,
      followingCount: data.profile?.followingCount ?? data.following.length,
    };
  }, [data]);

  return (
    <SiteFrame>
      <section className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
        {loading && <StateCard>正在加载个人中心...</StateCard>}
        {error && <StateCard tone="error">{error}</StateCard>}

        {data && metrics && (
          <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
            <aside className="space-y-5">
              <ProfileCard data={data} metrics={metrics} />
              <MeSideNav
                activeHref="/me"
                counts={{
                  following: data.following.length,
                  bookmarks: data.bookmarks.length,
                  comments: data.comments.length,
                }}
              />
            </aside>

            <main className="min-w-0 space-y-5">
              <HeroCard username={data.user.username} />
              <StatsGrid metrics={metrics} unreadCount={data.unreadCount} />
              <FollowingPanel following={data.following} />
              <BookmarkPanel bookmarks={data.bookmarks} />
              <DraftBox drafts={data.drafts.slice(0, 4)} />
              <RecentArticles articles={metrics.published.slice(0, 5)} />
            </main>

            <aside className="space-y-5">
              <PreferenceCard articles={data.articles} bookmarks={data.bookmarks} />
              <AccountInfo user={data.user} />
            </aside>
          </div>
        )}
      </section>
    </SiteFrame>
  );
}

function ProfileCard({
  data,
  metrics,
}: {
  data: MeData;
  metrics: MeMetrics;
}) {
  return (
    <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-6 text-center shadow-[var(--shadow-soft)]">
      <div className="mx-auto w-fit rounded-full border border-[var(--color-line)] bg-[var(--color-surface-solid)] p-2">
        <UserAvatar username={data.user.username} avatarUrl={data.user.avatarUrl} size="lg" />
      </div>
      <h1 className="mt-4 text-2xl font-semibold text-[var(--color-ink)]">{data.user.username}</h1>
      <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
        {data.user.bio || "热爱技术，热爱分享与思考"}
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Badge>{roleLabel(data.user.role)}</Badge>
        {data.user.company && <Badge>{data.user.company}</Badge>}
        {data.user.school && <Badge>{data.user.school}</Badge>}
      </div>
      <div className="mt-6 grid grid-cols-5 gap-2 border-t border-[var(--color-line)] pt-5 text-center">
        <MiniStat label="文章" value={String(metrics.published.length)} />
        <MiniStat label="草稿" value={String(data.drafts.length)} />
        <MiniStat label="获赞" value={formatCompact(metrics.receivedLikes)} />
        <MiniStat label="收藏" value={formatCompact(metrics.totalBookmarks)} />
        <MiniStat label="粉丝" value={formatCompact(metrics.followersCount)} />
      </div>
    </section>
  );
}

function HeroCard({ username }: { username: string }) {
  return (
    <section className="relative overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-7 shadow-[var(--shadow-soft)]">
      <ContourLayer />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">// Center</p>
        <h2 className="mt-3 text-3xl font-semibold text-[var(--color-ink)]">个人中心</h2>
        <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
          欢迎回来，{username}。继续整理你的文章、草稿、收藏与社区互动。
        </p>
      </div>
    </section>
  );
}

function StatsGrid({
  metrics,
  unreadCount,
}: {
  metrics: MeMetrics;
  unreadCount: number;
}) {
  const items = [
    ["已发布文章", metrics.published.length, "持续输出"],
    ["总阅读量", metrics.totalViews, "读者反馈"],
    ["新增关注", metrics.followersCount, "社区连接"],
    ["未读消息", unreadCount, "及时处理"],
  ];
  return (
    <section className="grid gap-4 md:grid-cols-4">
      {items.map(([label, value, hint]) => (
        <div key={label} className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)]">
          <div className="text-sm text-[var(--color-muted)]">{label}</div>
          <div className="mt-2 text-3xl font-semibold text-[var(--color-ink)]">
            {typeof value === "number" ? formatCompact(value) : value}
          </div>
          <div className="mt-2 text-xs text-green-600">{hint}</div>
        </div>
      ))}
    </section>
  );
}

function RecentArticles({ articles }: { articles: ArticleSummary[] }) {
  return (
    <Panel title="文章" actionHref="/me/articles" actionText="查看全部文章">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] table-fixed text-left text-sm">
          <thead className="text-xs text-[var(--color-muted)]">
            <tr className="border-b border-[var(--color-line)]">
              <th className="w-[32%] px-1 py-3 font-semibold">文章标题</th>
              <th className="w-8 px-1 py-3" />
              <th className="w-[18%] px-1 py-3 font-semibold">所属版块</th>
              <th className="w-[13%] px-1 py-3 font-semibold">状态</th>
              <th className="w-[12%] px-1 py-3 font-semibold">阅读量</th>
              <th className="w-[16%] px-1 py-3 font-semibold">最近更新时间</th>
              <th className="w-[13%] px-1 py-3 text-right font-semibold">操作</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((article) => (
              <tr key={article.id} className="border-b border-[var(--color-line)] last:border-b-0">
                <td className="px-1 py-3 font-semibold leading-6 text-[var(--color-ink)]">{article.title}</td>
                <td className="px-1 py-3 text-center text-[var(--color-muted)]">♡</td>
                <td className="px-1 py-3 text-[var(--color-muted)]">{article.moduleName}</td>
                <td className="px-1 py-3"><StatusBadge status={article.status} /></td>
                <td className="px-1 py-3 text-[var(--color-muted)]">{formatCompact(article.viewCount)}</td>
                <td className="px-1 py-3 text-[var(--color-muted)]">{formatDateTime(article.updatedAt)}</td>
                <td className="px-1 py-3 text-right">
                  <Link
                    href={article.status === "published" ? `/articles/${article.id}` : `/me/articles/${article.id}/edit`}
                    className={tableActionClass}
                  >
                    {article.status === "published" ? "查看" : "编辑"}
                  </Link>
                </td>
              </tr>
            ))}
            {articles.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[var(--color-muted)]">暂无文章</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function DraftBox({ drafts }: { drafts: ArticleSummary[] }) {
  return (
    <Panel title="草稿" actionHref="/me/articles?status=draft" actionText="查看全部草稿">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] table-fixed text-left text-sm">
          <thead className="text-xs text-[var(--color-muted)]">
            <tr className="border-b border-[var(--color-line)]">
              <th className="w-[38%] px-1 py-3 font-semibold">文章标题</th>
              <th className="w-[22%] px-1 py-3 font-semibold">所属版块</th>
              <th className="w-[20%] px-1 py-3 font-semibold">最后编辑时间</th>
              <th className="w-[10%] px-1 py-3 font-semibold">字数</th>
              <th className="w-[14%] px-1 py-3 text-right font-semibold">操作</th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((draft) => (
              <tr key={draft.id} className="border-b border-[var(--color-line)] last:border-b-0">
                <td className="px-1 py-3 font-semibold leading-6 text-[var(--color-ink)]">{draft.title || "未命名草稿"}</td>
                <td className="px-1 py-3 text-[var(--color-muted)]">{draft.moduleName}</td>
                <td className="px-1 py-3 text-[var(--color-muted)]">{formatDateTime(draft.updatedAt)}</td>
                <td className="px-1 py-3 text-[var(--color-muted)]">{formatCompact(draft.wordCount)}</td>
                <td className="px-1 py-3 text-right">
                  <Link href={`/me/articles/${draft.id}/edit`} className={tableActionClass}>
                    继续编辑
                  </Link>
                </td>
              </tr>
            ))}
            {drafts.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[var(--color-muted)]">暂无草稿</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function FollowingPanel({ following }: { following: FollowUser[] }) {
  return (
    <Panel title="关注" actionHref="/me/following" actionText="查看全部关注">
      <div className="flex flex-wrap gap-2">
        {following.slice(0, 8).map((user) => (
          <Link key={user.id} href={`/authors/${user.username}`} className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-3 py-2 text-sm">
            {user.username}
          </Link>
        ))}
        {following.length === 0 && <EmptyLine text="暂无关注" />}
      </div>
    </Panel>
  );
}

function BookmarkPanel({ bookmarks }: { bookmarks: BookmarkedArticle[] }) {
  const bookmarkedModules = uniqueBy(bookmarks, (item) => item.moduleName).slice(0, 8);
  return (
    <Panel title="收藏" actionHref="/me/bookmarks" actionText="查看全部收藏">
      <div className="grid gap-3 sm:grid-cols-2">
        {bookmarkedModules.map((item) => (
          <Link key={item.moduleName} href={`/modules/${item.moduleSlug}`} className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-3 py-2 text-sm">
            <span className="block font-semibold text-[var(--color-ink)]">{item.moduleName}</span>
            <span className="mt-1 block text-xs text-[var(--color-muted)]">
              收藏于 {formatDate(item.bookmarkedAt)}
            </span>
          </Link>
        ))}
        {bookmarkedModules.length === 0 && <EmptyLine text="暂无收藏" />}
      </div>
    </Panel>
  );
}

function PreferenceCard({
  articles,
  bookmarks,
}: {
  articles: ArticleSummary[];
  bookmarks: BookmarkedArticle[];
}) {
  const tags = collectTags(articles, bookmarks).slice(0, 12);
  return (
    <Panel title="个人偏好">
      <div className="mb-4 text-sm font-semibold text-[var(--color-muted)]">我感兴趣的标签</div>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}
        {tags.length === 0 && <span className="text-sm text-[var(--color-muted)]">发布或收藏文章后会逐步形成偏好标签。</span>}
      </div>
    </Panel>
  );
}

function AccountInfo({ user }: { user: CurrentUser }) {
  return (
    <Panel title="账号信息">
      <dl className="grid gap-3 text-sm">
        <InfoRow label="用户名" value={`@${user.username}`} />
        <InfoRow label="邮箱" value={user.email} />
        <InfoRow label="角色" value={roleLabel(user.role)} />
        <InfoRow label="加入时间" value={formatDate(user.createdAt)} />
      </dl>
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
  children: React.ReactNode;
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[var(--color-line)] pb-3 last:border-b-0 last:pb-0">
      <dt className="text-[var(--color-muted)]">{label}</dt>
      <dd className="min-w-0 truncate text-right font-semibold text-[var(--color-ink)]">{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: ArticleSummary["status"] }) {
  const labels: Record<ArticleSummary["status"], string> = {
    draft: "草稿",
    pending_review: "待审核",
    published: "已发布",
    rejected: "已退回",
    archived: "已下架",
  };
  return (
    <span className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-2 py-1 text-xs font-semibold text-[var(--color-muted)]">
      {labels[status]}
    </span>
  );
}

const tableActionClass =
  "inline-flex h-8 min-w-16 items-center justify-center rounded-md border border-[var(--color-accent-strong)] px-3 text-xs font-semibold text-[var(--color-ink)]";

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-3 py-1.5 text-xs font-semibold text-[var(--color-muted)]">
      {children}
    </span>
  );
}

function StateCard({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "error" }) {
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

function collectTags(articles: ArticleSummary[], bookmarks: BookmarkedArticle[]) {
  const set = new Set<string>();
  articles.forEach((article) => article.tags?.forEach((tag) => set.add(tag.name)));
  bookmarks.forEach((item) => set.add(item.moduleName));
  return Array.from(set);
}

function uniqueBy<T>(items: T[], keyFn: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function notificationText(item: NotificationItem) {
  if (item.type === "article_comment") {
    return `${item.actorUsername} 评论了你的文章《${item.articleTitle ?? "未命名文章"}》`;
  }
  if (item.type === "comment_reply") {
    return `${item.actorUsername} 回复了你的评论`;
  }
  if (item.type === "article_bookmark") {
    return `${item.actorUsername} 收藏了你的文章《${item.articleTitle ?? "未命名文章"}》`;
  }
  return `你关注的 ${item.actorUsername} 发布了新文章`;
}

function roleLabel(role: CurrentUser["role"]) {
  const labels = {
    user: "创作者",
    reviewer: "审核员",
    admin: "管理员",
  };
  return labels[role];
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
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
