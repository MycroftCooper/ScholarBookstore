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
import { listNotifications, type NotificationItem } from "@/lib/api/notifications";
import {
  getPublicAuthorProfile,
  listFollowers,
  listFollowing,
  unfollowUser,
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
  following: FollowUser[];
  followers: FollowUser[];
};

type Metrics = {
  published: ArticleSummary[];
  drafts: ArticleSummary[];
  totalBookmarks: number;
  receivedLikes: number;
  followersCount: number;
  followUpdates: NotificationItem[];
};

type Tab = "all" | "authors" | "modules" | "domains";

const tabs: Array<{ value: Tab; label: string }> = [
  { value: "all", label: "全部" },
  { value: "authors", label: "作者" },
  { value: "modules", label: "版块" },
  { value: "domains", label: "领域" },
];

export default function FollowingPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [sort, setSort] = useState<"latest" | "name">("latest");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyUser, setBusyUser] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const user = await getCurrentUser();
        const [profile, articles, bookmarks, comments, notifications, following, followers] = await Promise.all([
          getPublicAuthorProfile(user.username).catch(() => null),
          listMyArticles().catch(() => []),
          listBookmarks().catch(() => []),
          listMyComments().catch(() => []),
          listNotifications().catch(() => []),
          listFollowing(),
          listFollowers().catch(() => []),
        ]);
        setData({ user, profile, articles, bookmarks, comments, notifications, following, followers });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          window.location.href = "/login";
          return;
        }
        setError("关注列表加载失败，请稍后重试");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const metrics = useMemo(() => {
    const articles = data?.articles ?? [];
    const published = articles.filter((item) => item.status === "published");
    return {
      published,
      drafts: articles.filter((item) => item.status === "draft"),
      totalBookmarks: data?.bookmarks.length ?? 0,
      receivedLikes: data?.comments.reduce((sum, item) => sum + item.upVotes, 0) ?? 0,
      followersCount: data?.profile?.followersCount ?? data?.followers.length ?? 0,
      followUpdates: (data?.notifications ?? []).filter((item) => item.type === "followee_article"),
    };
  }, [data]);

  const visibleUsers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    let users = [...(data?.following ?? [])];
    if (keyword) {
      users = users.filter((user) => `${user.username} ${user.bio}`.toLowerCase().includes(keyword));
    }
    if (sort === "name") {
      users.sort((a, b) => a.username.localeCompare(b.username, "zh-CN"));
    } else {
      users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return users;
  }, [data?.following, query, sort]);

  async function handleUnfollow(username: string) {
    setBusyUser(username);
    try {
      await unfollowUser(username);
      setData((current) =>
        current
          ? {
              ...current,
              following: current.following.filter((item) => item.username !== username),
            }
          : current,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "取消关注失败，请稍后重试");
    } finally {
      setBusyUser("");
    }
  }

  return (
    <SiteFrame>
      <section className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
        {loading && <StateCard>正在加载关注列表...</StateCard>}
        {error && <StateCard tone="error">{error}</StateCard>}

        {data && (
          <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
            <aside className="space-y-5">
              <ProfileCard data={data} metrics={metrics} />
              <MeSideNav
                activeHref="/me/following"
                counts={{
                  following: data.following.length,
                  bookmarks: data.bookmarks.length,
                  comments: data.comments.length,
                }}
              />
            </aside>

            <main className="min-w-0 space-y-5">
              <HeroCard />
              <StatsGrid following={data.following.length} updates={metrics.followUpdates.length} />
              <FollowTools query={query} tab={tab} sort={sort} onQuery={setQuery} onTab={setTab} onSort={setSort} />
              {(tab === "all" || tab === "authors") && (
                <AuthorPanel users={visibleUsers} busyUser={busyUser} onUnfollow={handleUnfollow} />
              )}
              {(tab === "all" || tab === "modules") && <FollowedModulesPanel />}
              {(tab === "all" || tab === "domains") && <FollowedDomainsPanel />}
            </main>

            <aside className="space-y-5">
              <FollowSummary following={data.following.length} updates={metrics.followUpdates.length} />
              <RecentUpdatePanel updates={metrics.followUpdates} />
              <RecommendationPanel />
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
        <Badge>{roleLabel(data.user.role)}</Badge>
        {data.user.company && <Badge>{data.user.company}</Badge>}
        {data.user.school && <Badge>{data.user.school}</Badge>}
      </div>
      <div className="mt-6 grid grid-cols-5 gap-2 border-t border-[var(--color-line)] pt-5 text-center">
        <MiniStat label="文章" value={String(metrics.published.length)} />
        <MiniStat label="草稿" value={String(metrics.drafts.length)} />
        <MiniStat label="获赞" value={formatCompact(metrics.receivedLikes)} />
        <MiniStat label="收藏" value={formatCompact(metrics.totalBookmarks)} />
        <MiniStat label="粉丝" value={formatCompact(metrics.followersCount)} />
      </div>
    </section>
  );
}

function HeroCard() {
  return (
    <section className="relative overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-7 shadow-[var(--shadow-soft)]">
      <ContourLayer />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">// Following</p>
        <h2 className="mt-3 text-3xl font-semibold text-[var(--color-ink)]">我的关注</h2>
        <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
          追踪你关注的作者，及时获取他们发布的新文章。
        </p>
      </div>
    </section>
  );
}

function StatsGrid({ following, updates }: { following: number; updates: number }) {
  const items: Array<[string, number, string]> = [
    ["关注作者", following, "位作者"],
    ["关注版块", 0, "未开放"],
    ["关注领域", 0, "未开放"],
    ["最近更新", updates, "条动态"],
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

function FollowTools({
  query,
  tab,
  sort,
  onQuery,
  onTab,
  onSort,
}: {
  query: string;
  tab: Tab;
  sort: "latest" | "name";
  onQuery: (value: string) => void;
  onTab: (value: Tab) => void;
  onSort: (value: "latest" | "name") => void;
}) {
  return (
    <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)]">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="搜索关注对象..."
          className="h-11 min-w-0 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-4 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-accent-strong)]"
        />
        <div className="grid grid-cols-3 gap-2 sm:flex">
          {tabs.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onTab(item.value)}
              className={`h-11 rounded-md border px-4 text-sm font-semibold ${
                tab === item.value
                  ? "border-[var(--color-accent-strong)] bg-[var(--color-accent)] text-[#171717]"
                  : "border-[var(--color-line)] bg-[var(--color-surface-solid)] text-[var(--color-muted)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <select
          value={sort}
          onChange={(event) => onSort(event.target.value as "latest" | "name")}
          className="h-10 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-3 text-sm text-[var(--color-muted)] outline-none focus:border-[var(--color-accent-strong)]"
        >
          <option value="latest">排序：最近关注</option>
          <option value="name">排序：用户名</option>
        </select>
        <select
          disabled
          className="h-10 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-3 text-sm text-[var(--color-muted)] opacity-70"
        >
          <option>领域：全部</option>
        </select>
      </div>
    </section>
  );
}

function AuthorPanel({
  users,
  busyUser,
  onUnfollow,
}: {
  users: FollowUser[];
  busyUser: string;
  onUnfollow: (username: string) => void;
}) {
  return (
    <Panel title="关注作者" actionHref="/me/following" actionText="查看全部">
      <div className="divide-y divide-[var(--color-line)]">
        {users.slice(0, 8).map((user) => (
          <div key={user.id} className="grid gap-4 py-4 md:grid-cols-[1fr_auto_auto] md:items-center">
            <Link href={`/authors/${user.username}`} className="flex min-w-0 items-center gap-3">
              <UserAvatar username={user.username} avatarUrl={user.avatarUrl} />
              <span className="min-w-0">
                <span className="block truncate font-semibold text-[var(--color-ink)]">{user.username}</span>
                <span className="mt-1 line-clamp-1 text-sm text-[var(--color-muted)]">
                  {user.bio || "这个作者暂未填写简介"}
                </span>
              </span>
            </Link>
            <div className="text-sm text-[var(--color-muted)]">
              关注于 {formatDate(user.createdAt)}
            </div>
            <div className="flex gap-2 md:justify-end">
              <Link href={`/authors/${user.username}`} className={tableActionClass}>查看主页</Link>
              <button
                type="button"
                disabled={busyUser === user.username}
                onClick={() => onUnfollow(user.username)}
                className="inline-flex h-8 items-center justify-center rounded-md border border-red-200 px-3 text-xs font-semibold text-red-600 disabled:opacity-50"
              >
                {busyUser === user.username ? "取消中" : "取消关注"}
              </button>
            </div>
          </div>
        ))}
        {users.length === 0 && <EmptyLine text="暂无关注作者" />}
      </div>
    </Panel>
  );
}

function FollowedModulesPanel() {
  return (
    <Panel title="关注版块">
      <EmptyLine text="关注版块功能暂未开放" />
    </Panel>
  );
}

function FollowedDomainsPanel() {
  return (
    <Panel title="关注领域">
      <EmptyLine text="关注领域功能暂未开放" />
    </Panel>
  );
}

function FollowSummary({ following, updates }: { following: number; updates: number }) {
  return (
    <Panel title="关注数据">
      <div className="grid grid-cols-2 gap-3 text-center">
        <MiniStat label="作者关注" value={String(following)} />
        <MiniStat label="本周动态" value={String(updates)} />
        <MiniStat label="版块关注" value="0" />
        <MiniStat label="领域关注" value="0" />
      </div>
      <p className="mt-5 text-sm leading-7 text-[var(--color-muted)]">
        目前系统只支持关注作者；版块和领域关注需要后端能力补齐后再接入。
      </p>
    </Panel>
  );
}

function RecentUpdatePanel({ updates }: { updates: NotificationItem[] }) {
  return (
    <Panel title="最近活跃关注" actionHref="/me/notifications" actionText="查看全部">
      <div className="grid gap-3">
        {updates.slice(0, 4).map((item) => (
          <Link key={item.id} href={item.articleId ? `/articles/${item.articleId}` : "/me/notifications"} className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] p-3">
            <div className="font-semibold text-[var(--color-ink)]">{item.actorUsername}</div>
            <div className="mt-1 line-clamp-2 text-sm text-[var(--color-muted)]">{item.articleTitle ?? "发布了新文章"}</div>
            <div className="mt-2 text-xs text-[var(--color-muted)]">{formatDateTime(item.createdAt)}</div>
          </Link>
        ))}
        {updates.length === 0 && <EmptyLine text="暂无更新" />}
      </div>
    </Panel>
  );
}

function RecommendationPanel() {
  return (
    <Panel title="推荐关注">
      <EmptyLine text="推荐关注需要推荐接口，暂未开放" />
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

const tableActionClass =
  "inline-flex h-8 min-w-16 items-center justify-center rounded-md border border-[var(--color-accent-strong)] px-3 text-xs font-semibold text-[var(--color-ink)]";

function roleLabel(role: CurrentUser["role"]) {
  return {
    user: "写作者",
    reviewer: "审核员",
    admin: "管理员",
  }[role];
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("zh-CN", {
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
