"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ContourBackdrop } from "@/components/layout/ContourBackdrop";
import { SiteFrame } from "@/components/layout/SiteFrame";
import { listArticles, type ArticleSummary } from "@/lib/api/articles";
import { ApiError } from "@/lib/api/client";
import {
  followDomain,
  getDomain,
  getDomainFollowState,
  unfollowDomain,
  type DomainFollowState,
  type DomainSummary,
} from "@/lib/api/domains";
import { type ModuleSummary } from "@/lib/api/modules";

type ModuleGroup = {
  module: ModuleSummary;
  articles: ArticleSummary[];
};

export function DomainDetailShowcase({ id }: { id: string }) {
  const domainID = Number(id);
  const [domain, setDomain] = useState<DomainSummary | null>(null);
  const [followState, setFollowState] = useState<DomainFollowState | null>(null);
  const [groups, setGroups] = useState<ModuleGroup[]>([]);
  const [query, setQuery] = useState("");
  const [followBusy, setFollowBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!Number.isInteger(domainID) || domainID <= 0) {
      setError("领域不存在");
      setLoading(false);
      return;
    }

    setLoading(true);
    getDomain(domainID)
      .then(async (item) => {
        const modules = item.modules ?? [];
        const lists = await Promise.all(
          modules.map((module) =>
            listArticles({ moduleSlug: module.slug, sort: "hot", pageSize: 6 }).catch(
              () => [] as ArticleSummary[],
            ),
          ),
        );
        setDomain(item);
        setGroups(modules.map((module, index) => ({ module, articles: lists[index] ?? [] })));
        return getDomainFollowState(item.id)
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
        setError(err instanceof ApiError ? err.message : "领域加载失败");
      })
      .finally(() => setLoading(false));
  }, [domainID]);

  const visibleGroups = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return groups;
    }
    return groups.filter((group) =>
      `${group.module.name} ${group.module.slug} ${group.module.description}`.toLowerCase().includes(keyword),
    );
  }, [groups, query]);

  const allArticles = useMemo(() => groups.flatMap((group) => group.articles), [groups]);
  const totalViews = useMemo(
    () => allArticles.reduce((sum, article) => sum + article.viewCount, 0),
    [allArticles],
  );

  async function toggleFollow() {
    if (!domain || followBusy) {
      return;
    }
    if (!followState) {
      window.location.href = "/login";
      return;
    }
    setFollowBusy(true);
    try {
      const next = followState.following ? await unfollowDomain(domain.id) : await followDomain(domain.id);
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
          {loading && <StateCard>正在加载领域...</StateCard>}
          {error && <StateCard tone="error">{error}</StateCard>}

          {domain && (
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
                      <span>{domain.name}</span>
                    </nav>
                    <h1 className="text-3xl font-semibold md:text-4xl">{domain.name}</h1>
                    <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-muted)]">
                      {domain.description || "这里汇集该领域下的知识版块、实践经验与优质文章。"}
                    </p>
                    <div className="mt-6 grid max-w-xl grid-cols-4 gap-3">
                      <Stat label="版块" value={groups.length} />
                      <Stat label="文章" value={allArticles.length} />
                      <Stat label="阅读" value={totalViews} />
                      <Stat label="关注" value={followState?.followersCount ?? 0} />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="搜索领域内版块"
                      className="h-11 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-4 text-sm outline-none focus:border-[var(--color-accent-strong)]"
                    />
                    <button
                      type="button"
                      disabled={followBusy}
                      onClick={toggleFollow}
                      className="h-11 w-full rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-[#171717] disabled:opacity-60"
                    >
                      {followBusy ? "处理中..." : followState?.following ? "已关注" : "关注领域"}
                    </button>
                  </div>
                </div>
              </section>

              <section className="overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]">
                {visibleGroups.map((group) => (
                  <ModuleRow key={group.module.id} group={group} />
                ))}
                {visibleGroups.length === 0 && <EmptyLine text="暂无匹配版块" />}
              </section>
            </div>
          )}
        </section>
      </div>
    </SiteFrame>
  );
}

function ModuleRow({ group }: { group: ModuleGroup }) {
  return (
    <article className="grid gap-4 border-b border-[var(--color-line)] p-5 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <Link href={`/modules/${group.module.slug}`} className="min-w-0">
        <h2 className="text-xl font-semibold text-[var(--color-ink)]">{group.module.name}</h2>
        <p className="mt-2 line-clamp-2 text-sm leading-7 text-[var(--color-muted)]">
          {group.module.description || "进入该版块阅读文章与经验分享。"}
        </p>
        <div className="mt-4 text-xs text-[var(--color-muted)]">{group.articles.length} 篇文章</div>
      </Link>
      <div className="space-y-2">
        {group.articles.slice(0, 3).map((article) => (
          <Link
            key={article.id}
            href={`/articles/${article.id}`}
            className="block truncate text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            {article.title}
          </Link>
        ))}
        {group.articles.length === 0 && <p className="text-sm text-[var(--color-muted)]">暂无文章</p>}
      </div>
    </article>
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

function EmptyLine({ text }: { text: string }) {
  return <div className="p-8 text-center text-sm text-[var(--color-muted)]">{text}</div>;
}
