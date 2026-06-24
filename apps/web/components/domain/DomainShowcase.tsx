"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ContourBackdrop } from "@/components/layout/ContourBackdrop";
import { listArticles, type ArticleSummary } from "@/lib/api/articles";
import { listDomains, type DomainSummary } from "@/lib/api/domains";
import { listModules, type ModuleSummary } from "@/lib/api/modules";

type DomainGroup = {
  domain: DomainSummary;
  modules: ModuleSummary[];
  articles: ArticleSummary[];
  authors: AuthorSummary[];
};

type AuthorSummary = {
  username: string;
  title: string;
  moduleName: string;
};

const iconStyles = [
  { label: "</>", path: "M10 8 6 12l4 4M14 8l4 4-4 4M13 6l-2 12" },
  { label: "DOC", path: "M8 5h6l4 4v10H8V5Zm6 0v4h4M10 13h6M10 16h4" },
  { label: "PEN", path: "M6 16l1.5 2L18 7.5 16.5 6 6 16Zm8.5-8.5 2 2" },
  { label: "BOX", path: "M5 9l7-4 7 4v7l-7 4-7-4V9Zm7 4 7-4M12 13 5 9M12 13v7" },
  { label: "UP", path: "M6 18V9M12 18V6M18 18v-5M5 18h14" },
  { label: "MEG", path: "M5 13h3l8 4V7l-8 4H5v2Zm3 0v4" },
];

export function DomainShowcase() {
  const [domains, setDomains] = useState<DomainSummary[]>([]);
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      listDomains(),
      listModules(),
      listArticles({ sort: "hot", pageSize: 12 }),
    ])
      .then(([nextDomains, nextModules, nextArticles]) => {
        setDomains(nextDomains.filter((domain) => domain.isActive));
        setModules(nextModules.filter((module) => module.isActive));
        setArticles(nextArticles);
      })
      .catch(() => setError("领域加载失败，请稍后重试"))
      .finally(() => setLoading(false));
  }, []);

  const groups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return domains
      .map((domain) => {
        const domainModules = modules.filter((module) => module.domainId === domain.id);
        const moduleSlugSet = new Set(domainModules.map((module) => module.slug));
        const domainArticles = articles.filter((article) =>
          moduleSlugSet.has(article.moduleSlug),
        );
        const authors = collectAuthors(domainArticles);

        return {
          domain,
          modules: domainModules,
          articles: domainArticles,
          authors,
        };
      })
      .filter((group) => {
        if (!normalizedQuery) {
          return true;
        }

        const haystack = [
          group.domain.name,
          group.domain.slug,
          group.domain.description,
          ...group.modules.flatMap((module) => [
            module.name,
            module.slug,
            module.description,
          ]),
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedQuery);
      });
  }, [articles, domains, modules, query]);

  return (
    <div className="relative isolate overflow-hidden bg-[var(--color-page)] text-[var(--color-ink)]">
      <ContourBackdrop />
      <section className="relative mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-12 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">领域</h1>
              <span className="size-2.5 bg-[var(--color-accent)]" />
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-muted)] md:text-base">
              按领域探索知识体系，深入版块，阅读优质文章。
            </p>
          </div>
          <DomainFilters
            query={query}
            onQueryChange={setQuery}
          />
        </div>

        {loading && <DomainState>正在加载领域...</DomainState>}
        {error && <DomainState tone="error">{error}</DomainState>}
        {!loading && !error && groups.length === 0 && (
          <DomainState>暂无匹配领域</DomainState>
        )}

        {!loading && !error && groups.length > 0 && (
          <>
            <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {groups.map((group, index) => (
                <DomainOverviewCard group={group} iconIndex={index} key={group.domain.id} />
              ))}
            </div>

            <div className="mt-7 space-y-3">
              {groups.map((group, index) => (
                <DomainDetailRow group={group} iconIndex={index} key={group.domain.id} />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function DomainFilters({
  query,
  onQueryChange,
}: {
  query: string;
  onQueryChange: (value: string) => void;
}) {
  return (
    <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
      <label className="relative">
        <span className="sr-only">搜索领域</span>
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-muted)]">
          <SearchIcon />
        </span>
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索领域..."
          className="h-11 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] pl-11 pr-4 text-sm outline-none transition placeholder:text-[var(--color-muted)] hover:bg-[var(--color-surface-solid)] focus:border-[var(--color-accent-strong)] sm:w-80"
        />
      </label>
    </div>
  );
}

function DomainOverviewCard({ group, iconIndex }: { group: DomainGroup; iconIndex: number }) {
  const moduleCount = group.modules.length;
  const articleCount = group.articles.length;

  return (
    <Link
      href={`/domain/${group.domain.id}`}
      className="group relative min-h-44 overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:border-[var(--color-accent-strong)] hover:bg-[var(--color-surface-solid)]"
    >
      <CornerAccent />
      <div className="flex items-start gap-4">
        <DomainIcon index={iconIndex} />
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold">{group.domain.name}</h2>
          <p className="mt-4 line-clamp-2 text-sm leading-6 text-[var(--color-muted)]">
            {group.domain.description || "探索该领域下的知识版块与精选文章。"}
          </p>
        </div>
      </div>
      <div className="mt-8 flex gap-7 text-xs text-[var(--color-muted)]">
        <span>文章 {formatCompact(articleCount)}</span>
        <span>版块 {moduleCount}</span>
      </div>
    </Link>
  );
}

function DomainDetailRow({ group, iconIndex }: { group: DomainGroup; iconIndex: number }) {
  const featuredArticles = group.articles.slice(0, 3);
  const fallbackModules = group.modules.slice(0, 3);

  return (
    <section className="grid overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)] lg:grid-cols-[1.15fr_1fr_2fr_1.45fr]">
      <Link
        href={`/domain/${group.domain.id}`}
        className="group relative min-h-48 border-b border-[var(--color-line)] p-7 transition hover:bg-[var(--color-surface-solid)] lg:border-b-0 lg:border-r"
      >
        <div className="absolute inset-0 opacity-40">
          <ContourBackdrop />
        </div>
        <div className="relative">
          <DomainIcon index={iconIndex} size="lg" />
          <h3 className="mt-5 text-2xl font-semibold">{group.domain.name}</h3>
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--color-muted)]">
            {group.domain.description || "探索知识体系、实践路径和创作经验。"}
          </p>
          <div className="mt-7 flex gap-8 text-xs text-[var(--color-muted)]">
            <span>文章 {formatCompact(group.articles.length)}</span>
            <span>版块 {group.modules.length}</span>
          </div>
          <span className="mt-5 inline-flex items-center gap-3 text-xs font-medium text-[var(--color-muted)] transition group-hover:text-[var(--color-ink)]">
            进入领域详情
            <span aria-hidden="true">→</span>
          </span>
        </div>
      </Link>

      <Panel title="热门版块">
        <div className="space-y-3">
          {fallbackModules.length > 0 ? (
            fallbackModules.map((module, index) => (
              <Link
                href={`/modules/${module.slug}`}
                className="flex items-center gap-3 rounded-md border border-transparent p-1.5 transition hover:border-[var(--color-line)] hover:bg-[var(--color-surface-solid)]"
                key={module.id}
              >
                <DomainMiniIcon index={index} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{module.name}</span>
                  <span className="text-xs text-[var(--color-muted)]">
                    {module.slug}
                  </span>
                </span>
              </Link>
            ))
          ) : (
            <EmptyLine>暂无版块</EmptyLine>
          )}
        </div>
        <PanelLink href={`/domain/${group.domain.id}`}>
          查看全部 {group.modules.length} 个版块
        </PanelLink>
      </Panel>

      <Panel title="精选文章">
        <div className="space-y-2">
          {featuredArticles.length > 0 ? (
            featuredArticles.map((article) => (
              <ArticleLine article={article} key={article.id} />
            ))
          ) : (
            fallbackModules.map((module) => (
              <Link
                href={`/modules/${module.slug}`}
                className="block rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-4 py-3 text-sm font-semibold transition hover:border-[var(--color-accent-strong)]"
                key={module.id}
              >
                查看「{module.name}」版块文章
              </Link>
            ))
          )}
        </div>
      </Panel>

      <Panel title="热门作者">
        <div className="space-y-3">
          {group.authors.length > 0 ? (
            group.authors.slice(0, 3).map((author) => (
              <AuthorLine author={author} key={author.username} />
            ))
          ) : (
            <EmptyLine>暂无作者数据</EmptyLine>
          )}
        </div>
        <PanelLink href="/discover">查看全部</PanelLink>
      </Panel>
    </section>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-[var(--color-line)] p-5 lg:border-b-0 lg:border-r last:lg:border-r-0">
      <h4 className="mb-4 text-sm font-semibold">{title}</h4>
      {children}
    </div>
  );
}

function ArticleLine({ article }: { article: ArticleSummary }) {
  return (
    <Link
      href={`/articles/${article.id}`}
      className="grid gap-2 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-4 py-3 text-sm transition hover:border-[var(--color-accent-strong)] md:grid-cols-[1fr_auto]"
    >
      <span className="min-w-0">
        <span className="block truncate font-semibold">{article.title}</span>
        <span className="text-xs text-[var(--color-muted)]">{article.authorUsername}</span>
      </span>
      <span className="flex items-center gap-4 text-xs text-[var(--color-muted)]">
        <span>{formatCompact(article.viewCount)} 浏览</span>
        <span>{article.readingMinutes || 1} 分钟</span>
      </span>
    </Link>
  );
}

function AuthorLine({ author }: { author: AuthorSummary }) {
  return (
    <Link
      href={`/authors/${author.username}`}
      className="flex items-center justify-between gap-3 rounded-md p-1.5 transition hover:bg-[var(--color-surface-solid)]"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--color-faint)] text-xs font-semibold">
          {author.username.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">{author.username}</span>
          <span className="block truncate text-xs text-[var(--color-muted)]">
            {author.title}
          </span>
        </span>
      </span>
      <span className="rounded border border-[var(--color-line)] px-2 py-1 text-xs text-[var(--color-muted)]">
        {author.moduleName}
      </span>
    </Link>
  );
}

function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="mt-5 inline-flex items-center gap-3 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-ink)]"
    >
      {children}
      <span aria-hidden="true">→</span>
    </Link>
  );
}

function DomainState({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "error";
}) {
  const toneClass =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]";

  return (
    <div className={`mt-8 rounded-md border p-6 text-sm ${toneClass}`}>
      {children}
    </div>
  );
}

function EmptyLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-[var(--color-line)] p-4 text-sm text-[var(--color-muted)]">
      {children}
    </div>
  );
}

function DomainIcon({
  index,
  size = "md",
}: {
  index: number;
  size?: "md" | "lg";
}) {
  const icon = iconStyles[index % iconStyles.length];
  const sizeClass = size === "lg" ? "size-16" : "size-14";

  return (
    <span
      className={`relative grid ${sizeClass} shrink-0 place-items-center rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-solid)]`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="size-8">
        <path
          d={icon.path}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
      <span className="absolute -bottom-1 -right-1 size-2 rounded-full bg-[var(--color-accent)]" />
    </span>
  );
}

function DomainMiniIcon({ index }: { index: number }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-solid)]">
      <svg viewBox="0 0 24 24" className="size-5">
        <path
          d={iconStyles[index % iconStyles.length].path}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    </span>
  );
}

function CornerAccent() {
  return (
    <>
      <span className="absolute right-0 top-0 h-5 w-5 border-r-2 border-t-2 border-[var(--color-accent)] opacity-0 transition group-hover:opacity-100" />
      <span className="absolute bottom-0 left-0 h-5 w-5 border-b-2 border-l-2 border-[var(--color-accent)] opacity-0 transition group-hover:opacity-100" />
    </>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        d="m15.5 15.5 4 4M10.5 17a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function collectAuthors(articles: ArticleSummary[]) {
  const authors = new Map<string, AuthorSummary>();

  articles.forEach((article) => {
    if (!authors.has(article.authorUsername)) {
      authors.set(article.authorUsername, {
        username: article.authorUsername,
        title: article.title,
        moduleName: article.moduleName,
      });
    }
  });

  return Array.from(authors.values());
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
