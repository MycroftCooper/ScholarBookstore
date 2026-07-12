"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ContourBackdrop } from "@/components/layout/ContourBackdrop";
import { SiteFrame } from "@/components/layout/SiteFrame";
import { listArticles, type ArticleSummary } from "@/lib/api/articles";
import { ApiError } from "@/lib/api/client";
import {
  followModule,
  getModule,
  getModuleFollowState,
  unfollowModule,
  type ModuleFollowState,
  type ModuleSummary,
} from "@/lib/api/modules";

type SortKey = "latest" | "hot" | "random";

export function ModuleShowcase({ slug }: { slug: string }) {
  const [module, setModule] = useState<ModuleSummary | null>(null);
  const [followState, setFollowState] = useState<ModuleFollowState | null>(null);
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("latest");
  const [loading, setLoading] = useState(true);
  const [articleLoading, setArticleLoading] = useState(true);
  const [followBusy, setFollowBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) {
      return;
    }
    setLoading(true);
    getModule(slug)
      .then((item) => {
        setModule(item);
        return getModuleFollowState(item.slug)
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
        setError(err instanceof ApiError ? err.message : "版块加载失败");
      })
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!slug) {
      return;
    }
    const timer = window.setTimeout(() => {
      setArticleLoading(true);
      listArticles({
        moduleSlug: slug,
        q: query.trim() || undefined,
        sort,
        pageSize: 20,
      })
        .then(setArticles)
        .catch(() => setArticles([]))
        .finally(() => setArticleLoading(false));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [query, slug, sort]);

  const totalViews = useMemo(
    () => articles.reduce((sum, article) => sum + article.viewCount, 0),
    [articles],
  );

  async function toggleFollow() {
    if (!module || followBusy) {
      return;
    }
    if (!followState) {
      window.location.href = "/login";
      return;
    }
    setFollowBusy(true);
    try {
      const next = followState.following ? await unfollowModule(module.slug) : await followModule(module.slug);
      setFollowState(next);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        window.location.href = "/login";
        return;
      }
      setError(err instanceof ApiError ? err.message : "关注操作失败");
    } finally {
      setFollowBusy(false);
    }
  }

  return (
    <SiteFrame>
      <div className="relative isolate overflow-hidden bg-[var(--color-page)] text-[var(--color-ink)]">
        <ContourBackdrop />
        <section className="relative mx-auto max-w-7xl px-4 py-7 md:px-6 lg:px-8">
          {loading && <StateCard>正在加载版块...</StateCard>}
          {error && <StateCard tone="error">{error}</StateCard>}

          {module && (
            <div className="space-y-5">
              <section className="relative overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-soft)] md:p-8">
                <div className="absolute inset-0 opacity-30">
                  <ContourBackdrop />
                </div>
                <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
                  <div>
                    <nav className="mb-4 flex flex-wrap gap-2 text-sm text-[var(--color-muted)]">
                      <Link href="/domain" className="hover:text-[var(--color-ink)]">领域</Link>
                      <span>/</span>
                      <Link href={`/domain/${module.domainId}`} className="hover:text-[var(--color-ink)]">{module.domainName}</Link>
                      <span>/</span>
                      <span>{module.name}</span>
                    </nav>
                    <h1 className="text-3xl font-semibold md:text-4xl">{module.name}</h1>
                    <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-muted)]">
                      {module.description || "这里汇集该版块下的实践文章、经验复盘与知识整理。"}
                    </p>
                    <div className="mt-6 grid max-w-xl grid-cols-3 gap-3">
                      <Stat label="文章" value={articles.length} />
                      <Stat label="阅读" value={totalViews} />
                      <Stat label="关注" value={followState?.followersCount ?? 0} />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="在本版块搜索"
                      className="h-11 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-4 text-sm outline-none focus:border-[var(--color-accent-strong)]"
                    />
                    <select
                      value={sort}
                      onChange={(event) => setSort(event.target.value as SortKey)}
                      className="h-11 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-4 text-sm outline-none focus:border-[var(--color-accent-strong)]"
                    >
                      <option value="latest">最新</option>
                      <option value="hot">热门</option>
                      <option value="random">随机</option>
                    </select>
                    <button
                      type="button"
                      disabled={followBusy}
                      onClick={toggleFollow}
                      className="h-11 w-full rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-[#171717] disabled:opacity-60"
                    >
                      {followBusy ? "处理中..." : followState?.following ? "已关注" : "关注版块"}
                    </button>
                    <Link
                      href="/me/submit"
                      className="grid h-11 place-items-center rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] text-sm font-semibold text-[var(--color-ink)]"
                    >
                      发布新文章
                    </Link>
                  </div>
                </div>
              </section>

              {articleLoading ? <StateCard>正在加载文章...</StateCard> : <ArticleFeed articles={articles} />}
            </div>
          )}
        </section>
      </div>
    </SiteFrame>
  );
}

function ArticleFeed({ articles }: { articles: ArticleSummary[] }) {
  if (articles.length === 0) {
    return <StateCard>暂无文章</StateCard>;
  }
  return (
    <div className="space-y-3">
      {articles.map((article) => (
        <Link
          key={article.id}
          href={`/articles/${article.id}`}
          className="block rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)] hover:bg-[var(--color-surface-solid)]"
        >
          <h2 className="text-xl font-semibold text-[var(--color-ink)]">{article.title}</h2>
          <p className="mt-2 line-clamp-2 text-sm leading-7 text-[var(--color-muted)]">
            {article.summary || "这篇文章暂时没有摘要。"}
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-[var(--color-muted)]">
            <span>{article.authorUsername}</span>
            <span>{formatDate(article.publishedAt ?? article.createdAt)}</span>
            <span>{article.viewCount} 阅读</span>
            <span>{article.readingMinutes || 1} 分钟</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] p-4">
      <div className="text-2xl font-semibold">{value}</div>
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
