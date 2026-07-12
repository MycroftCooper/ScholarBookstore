"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SiteFrame } from "@/components/layout/SiteFrame";
import { UserAvatar } from "@/components/users/UserAvatar";
import { ApiError } from "@/lib/api/client";
import { createUserReport } from "@/lib/api/reports";
import {
  followUser,
  getFollowState,
  getPublicAuthorProfile,
  unfollowUser,
  type AuthorArticle,
  type FollowState,
  type PublicAuthorProfile,
} from "@/lib/api/users";

type SortMode = "latest" | "hot" | "bookmarks";

export default function AuthorProfilePage() {
  const params = useParams<{ username: string }>();
  const username = params?.username ? decodeURIComponent(params.username) : "";
  const [profile, setProfile] = useState<PublicAuthorProfile | null>(null);
  const [followState, setFollowState] = useState<FollowState | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("latest");
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
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
        setError(err instanceof ApiError ? err.message : "作者主页加载失败");
      })
      .finally(() => setLoading(false));
  }, [username]);

  const articles = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const items = [...(profile?.articles ?? [])].filter((article) =>
      `${article.title} ${article.summary} ${article.moduleName}`.toLowerCase().includes(keyword),
    );
    if (sort === "hot") {
      return items.sort((a, b) => b.viewCount - a.viewCount);
    }
    if (sort === "bookmarks") {
      return items.sort((a, b) => b.bookmarkCount - a.bookmarkCount);
    }
    return items.sort(
      (a, b) =>
        new Date(b.publishedAt ?? b.updatedAt).getTime() -
        new Date(a.publishedAt ?? a.updatedAt).getTime(),
    );
  }, [profile?.articles, query, sort]);

  async function toggleFollow() {
    if (!profile || busy) {
      return;
    }
    if (!followState) {
      window.location.href = "/login";
      return;
    }
    setBusy(true);
    try {
      const next = followState.following ? await unfollowUser(profile.username) : await followUser(profile.username);
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
      setError(err instanceof ApiError ? err.message : "关注操作失败");
    } finally {
      setBusy(false);
    }
  }

  async function reportUser() {
    if (!profile || reporting || reportSent) {
      return;
    }
    if (!followState) {
      window.location.href = "/login";
      return;
    }
    setReporting(true);
    try {
      await createUserReport(profile.username, "用户主页存在违规内容");
      setReportSent(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        window.location.href = "/login";
        return;
      }
      setError(err instanceof ApiError ? err.message : "举报失败");
    } finally {
      setReporting(false);
    }
  }

  return (
    <SiteFrame>
      <section className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
        {loading && <StateCard>正在加载作者主页...</StateCard>}
        {error && <StateCard tone="error">{error}</StateCard>}

        {profile && (
          <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="space-y-5">
              <AuthorCard
                profile={profile}
                followState={followState}
                busy={busy}
                reporting={reporting}
                reportSent={reportSent}
                onFollow={toggleFollow}
                onReport={reportUser}
              />
            </aside>

            <main className="min-w-0 space-y-5">
              <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-soft)]">
                <h1 className="text-3xl font-semibold text-[var(--color-ink)]">{profile.username}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-muted)]">
                  {profile.bio || "浏览作者公开发布的文章和技术领域分布。"}
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-4">
                  <Stat label="文章" value={profile.publishedArticleCount} />
                  <Stat label="收藏" value={profile.bookmarkCount} />
                  <Stat label="粉丝" value={profile.followersCount} />
                  <Stat label="关注" value={profile.followingCount} />
                </div>
              </section>

              <InterestPanel profile={profile} />

              <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)]">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="搜索该作者文章"
                    className="h-11 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-4 text-sm outline-none focus:border-[var(--color-accent-strong)]"
                  />
                  <select
                    value={sort}
                    onChange={(event) => setSort(event.target.value as SortMode)}
                    className="h-11 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-4 text-sm outline-none focus:border-[var(--color-accent-strong)]"
                  >
                    <option value="latest">最新发布</option>
                    <option value="hot">阅读最多</option>
                    <option value="bookmarks">收藏最多</option>
                  </select>
                </div>
              </section>

              <ArticleList articles={articles} />
            </main>
          </div>
        )}
      </section>
    </SiteFrame>
  );
}

function AuthorCard({
  profile,
  followState,
  busy,
  reporting,
  reportSent,
  onFollow,
  onReport,
}: {
  profile: PublicAuthorProfile;
  followState: FollowState | null;
  busy: boolean;
  reporting: boolean;
  reportSent: boolean;
  onFollow: () => void;
  onReport: () => void;
}) {
  return (
    <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-6 text-center shadow-[var(--shadow-soft)]">
      <UserAvatar username={profile.username} avatarUrl={profile.avatarUrl} size="lg" />
      <h2 className="mt-4 text-2xl font-semibold text-[var(--color-ink)]">{profile.username}</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
        {profile.bio || "这位作者还没有填写个人简介。"}
      </p>
      <div className="mt-5 grid gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onFollow}
          className="h-11 rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-[#171717] disabled:opacity-60"
        >
          {busy ? "处理中..." : followState?.following ? "已关注" : "关注"}
        </button>
        {followState ? (
          <button
            type="button"
            disabled={reporting || reportSent}
            onClick={onReport}
            className="h-10 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-4 text-sm font-semibold text-[var(--color-muted)] disabled:opacity-60"
          >
            {reportSent ? "已提交举报" : reporting ? "提交中..." : "举报用户"}
          </button>
        ) : (
          <Link
            href="/login"
            className="grid h-10 place-items-center rounded-md border border-[var(--color-line)] text-sm font-semibold text-[var(--color-muted)]"
          >
            登录后可举报
          </Link>
        )}
      </div>
      <div className="mt-5 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] p-4 text-left text-sm text-[var(--color-muted)]">
        <div>学校：{profile.school || "未填写"}</div>
        <div className="mt-2">组织：{profile.company || "未填写"}</div>
      </div>
    </section>
  );
}

function InterestPanel({ profile }: { profile: PublicAuthorProfile }) {
  const modules = profile.followingModules ?? [];
  const domains = profile.followingDomains ?? [];
  return (
    <section className="grid gap-5 lg:grid-cols-2">
      <FollowPanel title="关注的领域" emptyText="暂未关注领域">
        {domains.map((domain) => (
          <Link
            key={domain.id}
            href={`/domain/${domain.id}`}
            className="block rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-4 hover:border-[var(--color-accent-strong)]"
          >
            <span className="block truncate font-semibold text-[var(--color-ink)]">{domain.name}</span>
            <span className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--color-muted)]">
              {domain.description || domain.slug}
            </span>
          </Link>
        ))}
      </FollowPanel>
      <FollowPanel title="关注的版块" emptyText="暂未关注版块">
        {modules.map((module) => (
          <Link
            key={module.id}
            href={`/modules/${module.slug}`}
            className="block rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-4 hover:border-[var(--color-accent-strong)]"
          >
            <span className="block truncate font-semibold text-[var(--color-ink)]">{module.name}</span>
            <span className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--color-muted)]">
              {module.domainName} / {module.description || module.slug}
            </span>
          </Link>
        ))}
      </FollowPanel>
    </section>
  );
}

function FollowPanel({
  title,
  emptyText,
  children,
}: {
  title: string;
  emptyText: string;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children : [children];
  const hasItems = items.some(Boolean);
  return (
    <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] p-5 shadow-[var(--shadow-soft)]">
      <h2 className="mb-4 text-lg font-semibold text-[var(--color-ink)]">{title}</h2>
      <div className="grid gap-3">
        {hasItems ? children : <EmptyLine text={emptyText} />}
      </div>
    </section>
  );
}

function ArticleList({ articles }: { articles: AuthorArticle[] }) {
  return (
    <section className="overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]">
      {articles.map((article) => (
        <Link
          key={article.id}
          href={`/articles/${article.id}`}
          className="block border-b border-[var(--color-line)] p-5 last:border-b-0 hover:bg-[var(--color-surface-solid)]"
        >
          <h2 className="text-xl font-semibold text-[var(--color-ink)]">{article.title}</h2>
          <p className="mt-2 line-clamp-2 text-sm leading-7 text-[var(--color-muted)]">
            {article.summary || "这篇文章暂时没有摘要。"}
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-[var(--color-muted)]">
            <span>{article.moduleName}</span>
            <span>{formatDate(article.publishedAt ?? article.updatedAt)}</span>
            <span>{article.viewCount} 阅读</span>
            <span>{article.bookmarkCount} 收藏</span>
          </div>
        </Link>
      ))}
      {articles.length === 0 && <EmptyLine text="暂无文章" />}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] p-4">
      <div className="text-2xl font-semibold text-[var(--color-ink)]">{value}</div>
      <div className="mt-1 text-sm text-[var(--color-muted)]">{label}</div>
    </div>
  );
}

function StateCard({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "error";
}) {
  return (
    <div
      className={`rounded-md border p-5 text-sm ${
        tone === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]"
      }`}
    >
      {children}
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <div className="p-8 text-center text-sm text-[var(--color-muted)]">{text}</div>;
}

function formatDate(value: string | null) {
  if (!value) {
    return "未知时间";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
