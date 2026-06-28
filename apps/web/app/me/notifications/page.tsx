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
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
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

type PageData = {
  user: CurrentUser;
  profile: PublicAuthorProfile | null;
  articles: ArticleSummary[];
  bookmarks: BookmarkedArticle[];
  comments: CommentItem[];
  notifications: NotificationItem[];
  unreadCount: number;
  following: FollowUser[];
  followers: FollowUser[];
};

type MessageTab = "all" | "unread" | "comments" | "engagement" | "follows";
type TimeRange = "all" | "week" | "month";

const tabs: Array<{ value: MessageTab; label: string }> = [
  { value: "all", label: "全部消息" },
  { value: "unread", label: "未读" },
  { value: "comments", label: "评论与回复" },
  { value: "engagement", label: "收藏" },
  { value: "follows", label: "关注更新" },
];

export default function NotificationsPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<MessageTab>("all");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const user = await getCurrentUser();
    const [
      profile,
      articles,
      bookmarks,
      comments,
      notifications,
      unread,
      following,
      followers,
    ] = await Promise.all([
      getPublicAuthorProfile(user.username).catch(() => null),
      listMyArticles().catch(() => []),
      listBookmarks().catch(() => []),
      listMyComments().catch(() => []),
      listNotifications({ pageSize: 100 }).catch(() => []),
      unreadNotificationCount().catch(() => ({ count: 0 })),
      listFollowing().catch(() => []),
      listFollowers().catch(() => []),
    ]);
    setData({
      user,
      profile,
      articles,
      bookmarks,
      comments,
      notifications,
      unreadCount: unread.count,
      following,
      followers,
    });
  }

  useEffect(() => {
    load()
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          window.location.href = "/login";
          return;
        }
        setError("消息加载失败，请稍后重试");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [query, tab, timeRange]);

  const metrics = useMemo(() => {
    const notifications = data?.notifications ?? [];
    return {
      unread: data?.unreadCount ?? notifications.filter((item) => !item.readAt).length,
      comments: notifications.filter((item) => item.type === "article_comment" || item.type === "comment_reply").length,
      bookmarks: notifications.filter((item) => item.type === "article_bookmark").length,
      follows: notifications.filter((item) => item.type === "followee_article").length,
    };
  }, [data]);

  const filteredNotifications = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return [...(data?.notifications ?? [])]
      .filter((item) => {
        if (tab === "unread" && item.readAt) {
          return false;
        }
        if (tab === "comments" && item.type !== "article_comment" && item.type !== "comment_reply") {
          return false;
        }
        if (tab === "engagement" && item.type !== "article_bookmark") {
          return false;
        }
        if (tab === "follows" && item.type !== "followee_article") {
          return false;
        }
        if (timeRange === "week" && !isWithinDays(item.createdAt, 7)) {
          return false;
        }
        if (timeRange === "month" && !isWithinDays(item.createdAt, 30)) {
          return false;
        }
        if (!keyword) {
          return true;
        }
        return `${item.actorUsername} ${item.articleTitle ?? ""} ${notificationTitle(item)}`
          .toLowerCase()
          .includes(keyword);
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [data?.notifications, query, tab, timeRange]);

  const pageSize = 8;
  const pageCount = Math.max(1, Math.ceil(filteredNotifications.length / pageSize));
  const visibleNotifications = filteredNotifications.slice((page - 1) * pageSize, page * pageSize);

  async function handleRead(id: number) {
    setActingId(id);
    setError("");
    try {
      await markNotificationRead(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "标记已读失败，请稍后重试");
    } finally {
      setActingId(null);
    }
  }

  async function handleOpen(notification: NotificationItem) {
    if (notification.readAt) {
      return;
    }
    setData((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        unreadCount: Math.max(0, current.unreadCount - 1),
        notifications: current.notifications.map((item) =>
          item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item,
        ),
      };
    });
    markNotificationRead(notification.id).catch(() => undefined);
  }

  async function handleReadAll() {
    setActingId(-1);
    setError("");
    try {
      await markAllNotificationsRead();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "全部标记已读失败，请稍后重试");
    } finally {
      setActingId(null);
    }
  }

  return (
    <SiteFrame>
      <section className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
        {loading && <StateCard>正在加载消息...</StateCard>}
        {error && <StateCard tone="error">{error}</StateCard>}

        {data && (
          <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
            <aside className="space-y-5">
              <ProfileCard data={data} />
              <MeSideNav
                activeHref="/me/notifications"
                counts={{
                  following: data.following.length,
                  bookmarks: data.bookmarks.length,
                  comments: data.comments.length,
                  notifications: data.unreadCount,
                }}
              />
            </aside>

            <main className="min-w-0 space-y-5">
              <HeroCard unreadCount={metrics.unread} onReadAll={handleReadAll} disabled={actingId === -1 || metrics.unread === 0} />
              <StatsGrid total={data.notifications.length} metrics={metrics} />
              <MessageTools
                query={query}
                tab={tab}
                timeRange={timeRange}
                onQuery={setQuery}
                onTab={setTab}
                onTimeRange={setTimeRange}
              />
              <MessageList
                notifications={visibleNotifications}
                total={filteredNotifications.length}
                page={page}
                pageCount={pageCount}
                actingId={actingId}
                onPage={setPage}
                onRead={handleRead}
                onOpen={handleOpen}
              />
            </main>

            <aside className="space-y-5">
              <MessageScopeCard metrics={metrics} />
              <MessageActionCard onReadAll={handleReadAll} unreadCount={metrics.unread} disabled={actingId === -1 || metrics.unread === 0} />
            </aside>
          </div>
        )}
      </section>
    </SiteFrame>
  );
}

function ProfileCard({ data }: { data: PageData }) {
  const published = data.articles.filter((item) => item.status === "published");
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
        <Badge>{roleLabel(data.user.role)}</Badge>
        {data.user.company && <Badge>{data.user.company}</Badge>}
        {data.user.school && <Badge>{data.user.school}</Badge>}
      </div>
      <div className="mt-6 grid grid-cols-5 gap-2 border-t border-[var(--color-line)] pt-5 text-center">
        <MiniStat label="文章" value={String(published.length)} />
        <MiniStat label="草稿" value={String(data.articles.filter((item) => item.status === "draft").length)} />
        <MiniStat label="收藏" value={formatCompact(data.bookmarks.length)} />
        <MiniStat label="关注" value={formatCompact(data.following.length)} />
        <MiniStat label="粉丝" value={formatCompact(data.profile?.followersCount ?? data.followers.length)} />
      </div>
    </section>
  );
}

function HeroCard({
  unreadCount,
  disabled,
  onReadAll,
}: {
  unreadCount: number;
  disabled: boolean;
  onReadAll: () => void;
}) {
  return (
    <section className="relative overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-7 shadow-[var(--shadow-soft)]">
      <ContourLayer />
      <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">// Messages</p>
          <h2 className="mt-3 text-3xl font-semibold text-[var(--color-ink)]">我的消息</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
            集中查看文章评论、回复、收藏与关注更新。
          </p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={onReadAll}
          className="h-11 rounded-md bg-[var(--color-accent)] px-5 text-sm font-semibold text-[#171717] transition hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {unreadCount > 0 ? `全部已读 ${unreadCount}` : "已全部读完"}
        </button>
      </div>
    </section>
  );
}

function StatsGrid({
  total,
  metrics,
}: {
  total: number;
  metrics: { unread: number; comments: number; bookmarks: number; follows: number };
}) {
  const items = [
    ["全部消息", total, "最近 100 条"],
    ["未读消息", metrics.unread, "待处理"],
    ["评论与回复", metrics.comments, "讨论互动"],
    ["收藏提醒", metrics.bookmarks, "文章反馈"],
  ];
  return (
    <section className="grid gap-4 md:grid-cols-4">
      {items.map(([label, value, hint]) => (
        <div key={label} className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)]">
          <div className="text-sm text-[var(--color-muted)]">{label}</div>
          <div className="mt-2 text-3xl font-semibold text-[var(--color-ink)]">{formatCompact(Number(value))}</div>
          <div className="mt-2 text-xs text-[var(--color-muted)]">{hint}</div>
        </div>
      ))}
    </section>
  );
}

function MessageTools({
  query,
  tab,
  timeRange,
  onQuery,
  onTab,
  onTimeRange,
}: {
  query: string;
  tab: MessageTab;
  timeRange: TimeRange;
  onQuery: (value: string) => void;
  onTab: (value: MessageTab) => void;
  onTimeRange: (value: TimeRange) => void;
}) {
  return (
    <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)]">
      <div className="grid gap-3">
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="搜索触发人、文章标题或消息类型..."
          className="h-11 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-4 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-accent)]"
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onTab(item.value)}
              className={`h-10 shrink-0 rounded-md border px-4 text-sm font-semibold transition ${
                tab === item.value
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-black"
                  : "border-[var(--color-line)] bg-[var(--color-surface-solid)] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        <select
          value={timeRange}
          onChange={(event) => onTimeRange(event.target.value as TimeRange)}
          className="h-10 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-3 text-sm text-[var(--color-muted)] outline-none"
        >
          <option value="all">全部时间</option>
          <option value="week">近 7 天</option>
          <option value="month">近 30 天</option>
        </select>
      </div>
    </section>
  );
}

function MessageList({
  notifications,
  total,
  page,
  pageCount,
  actingId,
  onPage,
  onRead,
  onOpen,
}: {
  notifications: NotificationItem[];
  total: number;
  page: number;
  pageCount: number;
  actingId: number | null;
  onPage: (page: number) => void;
  onRead: (id: number) => void;
  onOpen: (notification: NotificationItem) => void;
}) {
  return (
    <section className="overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-4">
        <h3 className="text-lg font-semibold text-[var(--color-ink)]">消息列表</h3>
        <span className="text-sm text-[var(--color-muted)]">共 {total} 条</span>
      </div>
      <div className="divide-y divide-[var(--color-line)]">
        {notifications.map((notification) => (
          <article key={notification.id} className={`px-5 py-4 ${notification.readAt ? "" : "bg-[rgba(242,194,0,0.08)]"}`}>
            <div className="grid gap-4 md:grid-cols-[44px_1fr_auto] md:items-start">
              <UserAvatar username={notification.actorUsername} size="sm" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/authors/${notification.actorUsername}`} className="font-semibold text-[var(--color-ink)] hover:text-[var(--color-accent-strong)]">
                    {notification.actorUsername}
                  </Link>
                  <StatusPill>{notificationTitle(notification)}</StatusPill>
                  {!notification.readAt && <UnreadDot />}
                </div>
                <Link
                  href={notification.articleId ? `/articles/${notification.articleId}` : "/me/notifications"}
                  onClick={() => onOpen(notification)}
                  className="mt-2 block font-semibold leading-6 text-[var(--color-ink)] hover:text-[var(--color-accent-strong)]"
                >
                  {notification.articleTitle ?? "关联内容"}
                </Link>
                <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
                  {notificationDescription(notification)}
                </p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--color-muted)]">
                  <span>{formatRelative(notification.createdAt)}</span>
                  <span>{notification.readAt ? `已读 ${formatRelative(notification.readAt)}` : "未读"}</span>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
                {notification.articleId && (
                  <Link href={`/articles/${notification.articleId}`} onClick={() => onOpen(notification)} className={actionClass}>
                    查看文章
                  </Link>
                )}
                {!notification.readAt && (
                  <button
                    type="button"
                    disabled={actingId === notification.id}
                    onClick={() => onRead(notification.id)}
                    className={actionClass}
                  >
                    标记已读
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
        {notifications.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-[var(--color-muted)]">
            暂无符合条件的消息。
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-line)] px-5 py-4 text-sm text-[var(--color-muted)]">
        <span>第 {page} / {pageCount} 页</span>
        <div className="flex items-center gap-2">
          <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className={pagerClass}>
            上一页
          </button>
          <button type="button" disabled={page >= pageCount} onClick={() => onPage(page + 1)} className={pagerClass}>
            下一页
          </button>
        </div>
      </div>
    </section>
  );
}

function MessageScopeCard({
  metrics,
}: {
  metrics: { comments: number; bookmarks: number; follows: number };
}) {
  const items = [
    ["评论与回复", metrics.comments],
    ["文章收藏", metrics.bookmarks],
    ["关注更新", metrics.follows],
  ];
  return (
    <Panel title="消息来源">
      <div className="grid gap-3">
        {items.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-3 py-3 text-sm">
            <span className="text-[var(--color-muted)]">{label}</span>
            <span className="font-semibold text-[var(--color-ink)]">{value}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function MessageActionCard({
  unreadCount,
  disabled,
  onReadAll,
}: {
  unreadCount: number;
  disabled: boolean;
  onReadAll: () => void;
}) {
  return (
    <Panel title="快捷操作">
      <button
        type="button"
        disabled={disabled}
        onClick={onReadAll}
        className="h-11 w-full rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-[#171717] transition hover:bg-[var(--color-accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {unreadCount > 0 ? `全部标记已读 (${unreadCount})` : "没有未读消息"}
      </button>
      <p className="mt-4 text-sm leading-6 text-[var(--color-muted)]">
        当前消息来自后端已实现的站内通知类型。
      </p>
    </Panel>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)]">
      <h3 className="text-lg font-semibold text-[var(--color-ink)]">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md bg-[var(--color-surface-solid)] px-3 py-1 text-xs font-semibold text-[var(--color-muted)]">
      {children}
    </span>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-[var(--color-muted)]">{label}</div>
      <div className="mt-1 text-sm font-semibold text-[var(--color-ink)]">{value}</div>
    </div>
  );
}

function StatusPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md bg-[var(--color-surface-solid)] px-2 py-0.5 text-xs font-semibold text-[var(--color-muted)]">
      {children}
    </span>
  );
}

function UnreadDot() {
  return <span className="h-2 w-2 rounded-full bg-[var(--color-accent-strong)]" aria-label="未读" />;
}

function StateCard({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "error" }) {
  return (
    <div className={`rounded-md border p-5 text-sm shadow-[var(--shadow-soft)] ${tone === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]"}`}>
      {children}
    </div>
  );
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

function notificationTitle(notification: NotificationItem) {
  if (notification.type === "article_comment") {
    return "评论了你的文章";
  }
  if (notification.type === "comment_reply") {
    return "回复了你的评论";
  }
  if (notification.type === "article_bookmark") {
    return "收藏了你的文章";
  }
  return "发布了新文章";
}

function notificationDescription(notification: NotificationItem) {
  if (notification.type === "followee_article") {
    return `你关注的 ${notification.actorUsername} 发布了新文章，点击查看内容。`;
  }
  if (notification.type === "article_bookmark") {
    return `${notification.actorUsername} 收藏了你的文章。`;
  }
  if (notification.type === "article_comment") {
    return `${notification.actorUsername} 在你的文章下留下了评论。`;
  }
  return `${notification.actorUsername} 回复了你参与的评论讨论。`;
}

function roleLabel(role: CurrentUser["role"]) {
  if (role === "admin") {
    return "管理员";
  }
  if (role === "reviewer") {
    return "审核员";
  }
  return "写作者";
}

function formatRelative(value: string) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) {
    return "时间未知";
  }
  const diff = Date.now() - time;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < hour) {
    return `${Math.max(1, Math.floor(diff / minute))} 分钟前`;
  }
  if (diff < day) {
    return `${Math.floor(diff / hour)} 小时前`;
  }
  if (diff < 7 * day) {
    return `${Math.floor(diff / day)} 天前`;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function isWithinDays(value: string, days: number) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) {
    return false;
  }
  return Date.now() - time <= days * 24 * 60 * 60 * 1000;
}

function formatCompact(value: number) {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}w`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }
  return String(value);
}

const actionClass =
  "inline-flex h-9 items-center rounded-md border border-[var(--color-line)] px-3 text-sm font-semibold text-[var(--color-muted)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-60";

const pagerClass =
  "h-9 rounded-md border border-[var(--color-line)] px-3 transition hover:border-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50";
