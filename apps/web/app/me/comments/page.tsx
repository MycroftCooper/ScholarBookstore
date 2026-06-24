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
import {
  deleteComment,
  listMyComments,
  type CommentItem,
} from "@/lib/api/comments";
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
  following: FollowUser[];
  followers: FollowUser[];
};

type Metrics = {
  published: ArticleSummary[];
  drafts: ArticleSummary[];
  totalBookmarks: number;
  receivedLikes: number;
  followersCount: number;
};

type Tab = "all" | "comments" | "replies" | "liked";
type TimeRange = "all" | "week" | "month";

const tabs: Array<{ value: Tab; label: string }> = [
  { value: "all", label: "全部" },
  { value: "comments", label: "我的评论" },
  { value: "replies", label: "我的回复" },
  { value: "liked", label: "已获赞" },
];

export default function MyCommentsPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [timeRange, setTimeRange] = useState<TimeRange>("all");
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const user = await getCurrentUser();
    const [profile, articles, bookmarks, comments, following, followers] =
      await Promise.all([
        getPublicAuthorProfile(user.username).catch(() => null),
        listMyArticles().catch(() => []),
        listBookmarks().catch(() => []),
        listMyComments().catch(() => []),
        listFollowing().catch(() => []),
        listFollowers().catch(() => []),
      ]);
    setData({ user, profile, articles, bookmarks, comments, following, followers });
  }

  useEffect(() => {
    load()
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          window.location.href = "/login";
          return;
        }
        setError("我的评论加载失败，请稍后重试");
      })
      .finally(() => setLoading(false));
  }, []);

  const metrics = useMemo<Metrics | null>(() => {
    if (!data) {
      return null;
    }
    const published = data.articles.filter((item) => item.status === "published");
    return {
      published,
      drafts: data.articles.filter((item) => item.status === "draft"),
      totalBookmarks: data.bookmarks.length,
      receivedLikes: data.comments.reduce((sum, item) => sum + item.upVotes, 0),
      followersCount: data.profile?.followersCount ?? data.followers.length,
    };
  }, [data]);

  const filteredComments = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return [...(data?.comments ?? [])]
      .filter((comment) => {
        if (tab === "comments" && comment.parentId) {
          return false;
        }
        if (tab === "replies" && !comment.parentId) {
          return false;
        }
        if (tab === "liked" && comment.upVotes <= 0) {
          return false;
        }
        if (timeRange === "week" && !isWithinDays(comment.createdAt, 7)) {
          return false;
        }
        if (timeRange === "month" && !isWithinDays(comment.createdAt, 30)) {
          return false;
        }
        if (!keyword) {
          return true;
        }
        return `${comment.articleTitle} ${comment.content}`
          .toLowerCase()
          .includes(keyword);
      })
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
  }, [data?.comments, query, tab, timeRange]);

  async function handleDelete(commentId: number) {
    if (!window.confirm("确定要删除这条评论吗？")) {
      return;
    }
    setActingId(commentId);
    setError("");
    try {
      await deleteComment(commentId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "删除评论失败，请稍后重试");
    } finally {
      setActingId(null);
    }
  }

  return (
    <SiteFrame>
      <section className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
        {loading && <StateCard>正在加载我的评论...</StateCard>}
        {error && <StateCard tone="error">{error}</StateCard>}

        {data && metrics && (
          <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
            <aside className="space-y-5">
              <ProfileCard data={data} metrics={metrics} />
              <MeSideNav
                activeHref="/me/comments"
                counts={{
                  following: data.following.length,
                  bookmarks: data.bookmarks.length,
                  comments: data.comments.length,
                }}
              />
            </aside>

            <main className="min-w-0 space-y-5">
              <HeroCard />
              <StatsGrid comments={data.comments} />
              <CommentTools
                query={query}
                tab={tab}
                timeRange={timeRange}
                onQuery={setQuery}
                onTab={setTab}
                onTimeRange={setTimeRange}
              />
              <CommentList
                comments={filteredComments}
                actingId={actingId}
                onDelete={handleDelete}
              />
            </main>

            <aside className="space-y-5">
              <CommentGuide />
              <InteractionTips />
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
      <h1 className="mt-4 text-2xl font-semibold text-[var(--color-ink)]">
        {data.user.username}
      </h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">@{data.user.username}</p>
      <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
        {data.user.bio || "热爱技术，热衷分享与思考"}
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
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
          // Comments
        </p>
        <h2 className="mt-3 text-3xl font-semibold text-[var(--color-ink)]">
          我的评论
        </h2>
        <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
          回顾你参与讨论的内容，管理回复互动与历史评论记录。
        </p>
      </div>
    </section>
  );
}

function StatsGrid({ comments }: { comments: CommentItem[] }) {
  const items = [
    ["全部评论", comments.length, "累计发表"],
    ["本周新增", comments.filter((item) => isWithinDays(item.createdAt, 7)).length, "近 7 天"],
    ["我的回复", comments.filter((item) => item.parentId).length, "参与讨论"],
    ["获赞", comments.reduce((sum, item) => sum + item.upVotes, 0), "真实统计"],
  ];
  return (
    <section className="grid gap-4 md:grid-cols-4">
      {items.map(([label, value, hint]) => (
        <div
          key={label}
          className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)]"
        >
          <div className="text-sm text-[var(--color-muted)]">{label}</div>
          <div className="mt-2 text-3xl font-semibold text-[var(--color-ink)]">
            {formatCompact(Number(value))}
          </div>
          <div className="mt-2 text-xs text-[var(--color-muted)]">{hint}</div>
        </div>
      ))}
    </section>
  );
}

function CommentTools({
  query,
  tab,
  timeRange,
  onQuery,
  onTab,
  onTimeRange,
}: {
  query: string;
  tab: Tab;
  timeRange: TimeRange;
  onQuery: (value: string) => void;
  onTab: (value: Tab) => void;
  onTimeRange: (value: TimeRange) => void;
}) {
  return (
    <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)]">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="搜索评论内容或文章..."
          className="h-11 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-4 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-accent)] xl:max-w-sm"
        />
        <div className="flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onTab(item.value)}
              className={`h-10 rounded-md border px-4 text-sm font-semibold transition ${
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

function CommentList({
  comments,
  actingId,
  onDelete,
}: {
  comments: CommentItem[];
  actingId: number | null;
  onDelete: (commentId: number) => void;
}) {
  return (
    <section className="overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-4">
        <h3 className="text-lg font-semibold text-[var(--color-ink)]">评论记录</h3>
        <span className="text-sm text-[var(--color-muted)]">共 {comments.length} 条</span>
      </div>

      <div className="divide-y divide-[var(--color-line)]">
        {comments.map((comment) => (
          <article key={comment.id} className="px-5 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/articles/${comment.articleId}`}
                    className="font-semibold leading-6 text-[var(--color-ink)] hover:text-[var(--color-accent)]"
                  >
                    {comment.articleTitle}
                  </Link>
                  <StatusPill>
                    {comment.parentId ? "回复" : "评论"}
                  </StatusPill>
                  {comment.visibility === "hidden" && <StatusPill tone="warn">已隐藏</StatusPill>}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--color-muted)]">
                  {comment.content}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[var(--color-muted)]">
                  <span>赞 {formatCompact(comment.upVotes)}</span>
                  <span>踩 {formatCompact(comment.downVotes)}</span>
                  <span>得分 {formatCompact(comment.score)}</span>
                  <span>{formatRelative(comment.createdAt)}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 md:flex-col md:items-end">
                <Link href={`/articles/${comment.articleId}`} className={tableActionClass}>
                  查看原文
                </Link>
                <Link href={`/articles/${comment.articleId}#comments`} className={tableActionClass}>
                  继续讨论
                </Link>
                <button
                  type="button"
                  disabled={actingId === comment.id}
                  onClick={() => onDelete(comment.id)}
                  className="rounded-md px-3 py-1.5 text-sm font-semibold text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  删除
                </button>
              </div>
            </div>
          </article>
        ))}

        {comments.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-[var(--color-muted)]">
            暂无符合条件的评论。
          </div>
        )}
      </div>
    </section>
  );
}

function CommentGuide() {
  return (
    <Panel title="评论说明">
      <div className="space-y-4 text-sm leading-6 text-[var(--color-muted)]">
        <p>这里仅展示你自己发表过的评论和回复。</p>
        <p>删除评论会保留必要的讨论结构，不会删除文章或其他用户的回复。</p>
        <p>被隐藏的评论不会在公开文章页展示，但仍会保留在你的记录中。</p>
      </div>
    </Panel>
  );
}

function InteractionTips() {
  const tips = [
    {
      title: "表达观点，提供依据",
      text: "用事实、数据或经验支撑你的观点，更容易获得认可。",
      icon: "▰",
    },
    {
      title: "尊重他人，友好交流",
      text: "保持建设性讨论，避免无意义争论，共建良好社区氛围。",
      icon: "◇",
    },
    {
      title: "持续参与，深度贡献",
      text: "持续参与优质讨论，让你的知识和观点创造更大价值。",
      icon: "✦",
    },
  ];

  return (
    <Panel title="互动建议">
      <div className="space-y-5">
        {tips.map((tip) => (
          <div key={tip.title} className="flex gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--color-line)] bg-[var(--color-surface-solid)] text-sm font-semibold text-[var(--color-accent)]">
              {tip.icon}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[var(--color-ink)]">
                {tip.title}
              </h4>
              <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
                {tip.text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)]">
      <h3 className="text-lg font-semibold text-[var(--color-ink)]">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StateCard({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "error";
}) {
  return (
    <div
      className={`rounded-md border p-5 text-sm shadow-[var(--shadow-soft)] ${
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]"
      }`}
    >
      {children}
    </div>
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

function StatusPill({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "warn";
}) {
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
        tone === "warn"
          ? "bg-amber-50 text-amber-700"
          : "bg-[var(--color-surface-solid)] text-[var(--color-muted)]"
      }`}
    >
      {children}
    </span>
  );
}

function ContourLayer() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-50"
      style={{
        backgroundImage:
          "radial-gradient(circle at 80% 20%, rgba(245,197,24,0.18), transparent 12rem), repeating-radial-gradient(circle at 55% 35%, transparent 0 14px, rgba(148,163,184,0.14) 15px 16px)",
      }}
    />
  );
}

function roleLabel(role: CurrentUser["role"]) {
  if (role === "admin") {
    return "管理员";
  }
  if (role === "reviewer") {
    return "审核员";
  }
  return "程序员";
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

const tableActionClass =
  "rounded-md border border-[var(--color-line)] px-3 py-1.5 text-sm font-semibold text-[var(--color-muted)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-ink)]";
