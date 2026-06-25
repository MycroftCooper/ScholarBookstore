"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { SiteFrame } from "@/components/layout/SiteFrame";
import { UserAvatar } from "@/components/users/UserAvatar";
import { ApiError } from "@/lib/api/client";
import {
  followUser,
  getFollowState,
  getPublicAuthorProfile,
  unfollowUser,
  type FollowState,
  type PublicAuthorProfile,
} from "@/lib/api/users";

type SortMode = "latest" | "hot" | "featured";

const authorTags = ["后端开发", "Go", "云原生", "系统设计", "技术写作"];

export default function AuthorProfilePage() {
  const params = useParams<{ username: string }>();
  const [profile, setProfile] = useState<PublicAuthorProfile | null>(null);
  const [followState, setFollowState] = useState<FollowState | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("latest");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const username = params?.username ? decodeURIComponent(params.username) : "";
    if (!username) {
      setError("用户不存在");
      setLoading(false);
      return;
    }

    getPublicAuthorProfile(username)
      .then((item) => {
        setProfile(item);
        return getFollowState(item.username)
          .then(setFollowState)
          .catch((err) => {
            if (err instanceof ApiError && err.status === 401) {
              setFollowState(null);
              return;
            }
            throw err;
          });
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("用户不存在");
          return;
        }
        setError("作者主页加载失败，请稍后重试");
      })
      .finally(() => setLoading(false));
  }, [params?.username]);

  const visibleArticles = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const articles = [...(profile?.articles ?? [])].filter((article) => {
      if (!keyword) {
        return true;
      }
      return `${article.title} ${article.summary} ${article.moduleName}`
        .toLowerCase()
        .includes(keyword);
    });

    if (sort === "hot") {
      return articles.sort((a, b) => b.viewCount - a.viewCount);
    }
    if (sort === "featured") {
      return articles.sort((a, b) => b.bookmarkCount - a.bookmarkCount);
    }
    return articles.sort(
      (a, b) =>
        new Date(b.publishedAt ?? b.updatedAt).getTime() -
        new Date(a.publishedAt ?? a.updatedAt).getTime(),
    );
  }, [profile?.articles, query, sort]);

  const moduleStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const article of profile?.articles ?? []) {
      counts.set(article.moduleName, (counts.get(article.moduleName) ?? 0) + 1);
    }
    const total = profile?.articles.length || 1;
    return [...counts.entries()]
      .map(([name, count]) => ({
        name,
        count,
        percent: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [profile?.articles]);

  async function handleFollowToggle() {
    if (!profile || acting) {
      return;
    }
    setActing(true);
    setError("");
    try {
      const next = followState?.following
        ? await unfollowUser(profile.username)
        : await followUser(profile.username);
      setFollowState(next);
      setProfile((current) =>
        current
          ? {
              ...current,
              followersCount: next.followersCount,
              followingCount: next.followingCount,
            }
          : current,
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        window.location.href = "/login";
        return;
      }
      setError("关注操作失败，请稍后重试");
    } finally {
      setActing(false);
    }
  }

  return (
    <SiteFrame>
      <section className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
        {loading && <StateCard>正在加载作者主页...</StateCard>}
        {error && <StateCard tone="error">{error}</StateCard>}

        {profile && (
          <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)_300px]">
            <aside className="space-y-5">
              <AuthorCard
                profile={profile}
                followState={followState}
                acting={acting}
                onFollowToggle={handleFollowToggle}
              />
              <SocialLinks />
              <ContributionHistory articles={profile.articles} />
            </aside>

            <main className="min-w-0 space-y-5">
              <HeroCard profile={profile} />
              <ArticleTabs />
              <ArticleTools
                query={query}
                sort={sort}
                onQuery={setQuery}
                onSort={setSort}
              />
              <ArticleList articles={visibleArticles} />
            </main>

            <aside className="space-y-5">
              <PopularArticles articles={profile.articles} />
              <ActiveModules modules={moduleStats} />
              <RecommendedUsers />
            </aside>
          </div>
        )}
      </section>
    </SiteFrame>
  );
}

function AuthorCard({
  profile,
  followState,
  acting,
  onFollowToggle,
}: {
  profile: PublicAuthorProfile;
  followState: FollowState | null;
  acting: boolean;
  onFollowToggle: () => void;
}) {
  return (
    <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-6 text-center shadow-[var(--shadow-soft)]">
      <div className="mx-auto w-fit rounded-full border border-[var(--color-line)] bg-[var(--color-surface-solid)] p-2">
        <UserAvatar username={profile.username} avatarUrl={profile.avatarUrl} size="lg" />
      </div>
      <h1 className="mt-4 text-2xl font-semibold text-[var(--color-ink)]">
        {profile.username}
      </h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">@{profile.username}</p>
      <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
        {profile.bio || "这位作者还没有填写个人简介。"}
      </p>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {authorTags.slice(0, 4).map((tag) => (
          <Badge key={tag}>{tag}</Badge>
        ))}
      </div>

      <div className="mt-5">
        {followState ? (
          <button
            type="button"
            disabled={acting}
            onClick={onFollowToggle}
            className={`h-11 w-full rounded-md px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
              followState.following
                ? "border border-[var(--color-line)] bg-[var(--color-surface-solid)] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                : "bg-[var(--color-accent)] text-black hover:brightness-95"
            }`}
          >
            {acting ? "处理中..." : followState.following ? "已关注" : "+ 关注"}
          </button>
        ) : (
          <Link
            href="/login"
            className="inline-flex h-11 w-full items-center justify-center rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-black hover:brightness-95"
          >
            登录后关注
          </Link>
        )}
      </div>

      <div className="mt-5 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] p-4 text-left">
        <h2 className="text-sm font-semibold text-[var(--color-ink)]">资料信息</h2>
        <div className="mt-3 space-y-3 text-sm text-[var(--color-muted)]">
          <InfoLine label="所在地" value={profile.school || "未填写"} />
          <InfoLine label="组织" value={profile.company || "未填写"} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-4 gap-2 border-t border-[var(--color-line)] pt-5 text-center">
        <MiniStat label="文章" value={String(profile.publishedArticleCount)} />
        <MiniStat label="收藏" value={formatCompact(profile.bookmarkCount)} />
        <MiniStat label="粉丝" value={formatCompact(profile.followersCount)} />
        <MiniStat label="关注" value={formatCompact(profile.followingCount)} />
      </div>
    </section>
  );
}

function SocialLinks() {
  return (
    <Panel title="社交与链接">
      <EmptyLine text="暂无公开社交链接" />
    </Panel>
  );
}

function ContributionHistory({
  articles,
}: {
  articles: PublicAuthorProfile["articles"];
}) {
  const activeDays = new Set(
    articles
      .map((article) => (article.publishedAt ?? article.createdAt).slice(0, 10))
      .filter(Boolean),
  );
  const days = Array.from({ length: 84 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (83 - index));
    const key = date.toISOString().slice(0, 10);
    return {
      key,
      active: activeDays.has(key),
    };
  });

  return (
    <Panel title="贡献历程">
      <div className="grid grid-cols-12 gap-1">
        {days.map((day) => (
          <span
            key={day.key}
            title={day.key}
            className={`h-3 rounded-sm ${
              day.active ? "bg-[var(--color-accent)]" : "bg-[var(--color-surface-solid)]"
            }`}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-[var(--color-muted)]">
        <span>少</span>
        <span>{articles.length} 篇公开文章</span>
        <span>多</span>
      </div>
    </Panel>
  );
}

function HeroCard({ profile }: { profile: PublicAuthorProfile }) {
  return (
    <section className="relative overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-8 shadow-[var(--shadow-soft)]">
      <ContourLayer />
      <div className="relative max-w-2xl">
        <h2 className="text-3xl font-semibold text-[var(--color-ink)]">
          {profile.bio ? profile.bio.slice(0, 28) : `来自 ${profile.username} 的技术主页`}
        </h2>
        <p className="mt-4 text-sm leading-7 text-[var(--color-muted)]">
          {profile.bio || "浏览作者公开发布的文章、关注数据与技术领域分布。"}
        </p>
        <div className="mt-5 flex flex-wrap gap-4 text-sm text-[var(--color-muted)]">
          <span>{profile.school || "地区未填写"}</span>
          <span>{formatJoinDate(profile.articles)}</span>
        </div>
      </div>
    </section>
  );
}

function ArticleTabs() {
  return (
    <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]">
      <div className="flex gap-8 border-b border-[var(--color-line)] px-5">
        {["文章", "收藏", "简历"].map((item, index) => (
          <button
            key={item}
            type="button"
            disabled={index !== 0}
            className={`border-b-2 py-4 text-sm font-semibold ${
              index === 0
                ? "border-[var(--color-accent)] text-[var(--color-ink)]"
                : "border-transparent text-[var(--color-muted)] opacity-60"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
    </section>
  );
}

function ArticleTools({
  query,
  sort,
  onQuery,
  onSort,
}: {
  query: string;
  sort: SortMode;
  onQuery: (value: string) => void;
  onSort: (value: SortMode) => void;
}) {
  return (
    <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)]">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2">
          {[
            ["latest", "最新"],
            ["hot", "热门"],
            ["featured", "精选"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => onSort(value as SortMode)}
              className={`h-10 rounded-md border px-4 text-sm font-semibold transition ${
                sort === value
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-black"
                  : "border-[var(--color-line)] bg-[var(--color-surface-solid)] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="搜索该作者文章..."
          className="h-11 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-4 text-sm text-[var(--color-ink)] outline-none transition focus:border-[var(--color-accent)] xl:max-w-sm"
        />
      </div>
    </section>
  );
}

function ArticleList({ articles }: { articles: PublicAuthorProfile["articles"] }) {
  return (
    <section className="overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]">
      <div className="divide-y divide-[var(--color-line)]">
        {articles.map((article, index) => (
          <Link
            key={article.id}
            href={`/articles/${article.id}`}
            className="grid gap-4 px-5 py-5 transition hover:bg-[var(--color-surface-solid)] md:grid-cols-[minmax(0,1fr)_180px]"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {index === 0 && <StatusPill>新帖</StatusPill>}
                <h3 className="text-xl font-semibold leading-7 text-[var(--color-ink)]">
                  {article.title}
                </h3>
              </div>
              <p className="mt-2 line-clamp-2 text-sm leading-7 text-[var(--color-muted)]">
                {article.summary || "这篇文章暂时没有摘要。"}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-[var(--color-muted)]">
                <Badge>{article.moduleName}</Badge>
                <span>{formatDate(article.publishedAt ?? article.updatedAt)}</span>
              </div>
            </div>
            <div className="relative hidden overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] md:block">
              <ContourLayer />
              <div className="relative grid h-full min-h-28 place-items-center px-4 text-center text-sm font-semibold text-[var(--color-muted)]">
                {article.moduleName}
              </div>
            </div>
          </Link>
        ))}

        {articles.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-[var(--color-muted)]">
            暂无符合条件的文章。
          </div>
        )}
      </div>
    </section>
  );
}

function PopularArticles({ articles }: { articles: PublicAuthorProfile["articles"] }) {
  const items = [...articles].sort((a, b) => b.viewCount - a.viewCount).slice(0, 5);
  return (
    <Panel title="热门文章">
      <div className="space-y-3">
        {items.map((article, index) => (
          <Link
            key={article.id}
            href={`/articles/${article.id}`}
            className="grid grid-cols-[24px_minmax(0,1fr)_auto] gap-3 text-sm"
          >
            <span className="font-semibold text-[var(--color-accent)]">{index + 1}</span>
            <span className="line-clamp-2 font-semibold leading-6 text-[var(--color-ink)]">
              {article.title}
            </span>
            <span className="text-xs text-[var(--color-muted)]">
              {formatCompact(article.viewCount)}
            </span>
          </Link>
        ))}
        {items.length === 0 && <EmptyLine text="暂无文章" />}
      </div>
    </Panel>
  );
}

function ActiveModules({
  modules,
}: {
  modules: Array<{ name: string; count: number; percent: number }>;
}) {
  return (
    <Panel title="活跃领域">
      <div className="space-y-4">
        {modules.map((item) => (
          <div key={item.name}>
            <div className="mb-1 flex justify-between text-sm text-[var(--color-muted)]">
              <span>{item.name}</span>
              <span>{item.percent}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--color-surface-solid)]">
              <div
                className="h-full rounded-full bg-[var(--color-accent)]"
                style={{ width: `${item.percent}%` }}
              />
            </div>
          </div>
        ))}
        {modules.length === 0 && <EmptyLine text="暂无领域分布" />}
      </div>
    </Panel>
  );
}

function RecommendedUsers() {
  return (
    <Panel title="推荐其他用户">
      <EmptyLine text="推荐用户接口暂未接入" />
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

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-[var(--color-muted)]">{label}</span>
      <span className="text-right font-semibold text-[var(--color-ink)]">{value}</span>
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

function StatusPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md bg-[var(--color-accent)] px-2 py-1 text-xs font-semibold text-black">
      {children}
    </span>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-[var(--color-line)] px-4 py-6 text-center text-sm text-[var(--color-muted)]">
      {text}
    </div>
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

function formatCompact(value: number) {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}w`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }
  return String(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return "时间未知";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function formatJoinDate(articles: PublicAuthorProfile["articles"]) {
  const earliest = articles
    .map((item) => new Date(item.createdAt).getTime())
    .filter((value) => !Number.isNaN(value))
    .sort((a, b) => a - b)[0];
  if (!earliest) {
    return "暂无发布记录";
  }
  return `${new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
  }).format(new Date(earliest))} 开始发布`;
}
