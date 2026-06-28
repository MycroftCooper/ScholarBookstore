"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { ContourBackdrop } from "@/components/layout/ContourBackdrop";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { UserAvatar } from "@/components/users/UserAvatar";
import {
  listArticles,
  type ArticleListParams,
  type ArticleSummary,
} from "@/lib/api/articles";
import { listDomains, type DomainSummary } from "@/lib/api/domains";
import { listModules, type ModuleSummary } from "@/lib/api/modules";
import { listTags, type TagItem } from "@/lib/api/tags";

type SearchTab = "all" | "domains" | "modules" | "articles" | "authors";
type SortMode = "latest" | "hot" | "random";

type AuthorResult = {
  username: string;
  articleCount: number;
  viewCount: number;
  modules: string[];
};

const searchTabs: Array<{ key: SearchTab; label: string }> = [
  { key: "all", label: "全部" },
  { key: "domains", label: "领域" },
  { key: "modules", label: "版块" },
  { key: "articles", label: "文章" },
  { key: "authors", label: "作者" },
];

const sortModes: Array<{ key: SortMode; label: string }> = [
  { key: "latest", label: "最新" },
  { key: "hot", label: "热门" },
  { key: "random", label: "随机" },
];

export default function DiscoverPage() {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState<SortMode>("latest");
  const [tab, setTab] = useState<SearchTab>("all");
  const [tags, setTags] = useState<TagItem[]>([]);
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [domains, setDomains] = useState<DomainSummary[]>([]);
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextSort = params.get("sort");
    const nextTab = params.get("type");

    setQuery(params.get("q") ?? "");
    setTag(params.get("tag") ?? "");
    if (nextSort === "latest" || nextSort === "hot" || nextSort === "random") {
      setSort(nextSort);
    }
    if (
      nextTab === "all" ||
      nextTab === "domains" ||
      nextTab === "modules" ||
      nextTab === "articles" ||
      nextTab === "authors"
    ) {
      setTab(nextTab);
    }
    setInitialized(true);
  }, []);

  useEffect(() => {
    listTags()
      .then((items) => setTags(items.slice(0, 12)))
      .catch(() => setTags([]));
  }, []);

  const hasSearchIntent = query.trim().length > 0 || tag.trim().length > 0;
  const articleParams = useMemo<ArticleListParams>(
    () => ({
      q: query.trim() || undefined,
      tag: tag.trim() || undefined,
      sort,
      pageSize: 24,
    }),
    [query, tag, sort],
  );

  useEffect(() => {
    if (!initialized || !hasSearchIntent) {
      setArticles([]);
      setDomains([]);
      setModules([]);
      setLoading(false);
      setError("");
      return;
    }

    setLoading(true);
    setError("");
    Promise.allSettled([
      listArticles(articleParams),
      listDomains(),
      listModules(),
    ])
      .then(([articleResult, domainResult, moduleResult]) => {
        const nextArticles = articleResult.status === "fulfilled" ? articleResult.value : [];
        const nextDomains = domainResult.status === "fulfilled" ? domainResult.value.filter((item) => item.isActive) : [];
        const nextModules = moduleResult.status === "fulfilled" ? moduleResult.value.filter((item) => item.isActive) : [];

        setArticles(nextArticles);
        setDomains(nextDomains);
        setModules(nextModules);

        if (
          articleResult.status === "rejected" &&
          domainResult.status === "rejected" &&
          moduleResult.status === "rejected"
        ) {
          setError("搜索数据加载失败，请稍后重试。");
        }
      })
      .finally(() => setLoading(false));
  }, [articleParams, hasSearchIntent, initialized]);

  const keyword = query.trim().toLowerCase();
  const matchedDomains = useMemo(
    () => domains.filter((item) => matchText(keyword, item.name, item.slug, item.description)),
    [domains, keyword],
  );
  const matchedModules = useMemo(
    () => modules.filter((item) => matchText(keyword, item.name, item.slug, item.description, item.domainName)),
    [modules, keyword],
  );
  const authors = useMemo(() => deriveAuthors(articles), [articles]);
  const matchedAuthors = useMemo(
    () => authors.filter((item) => matchText(keyword, item.username, ...item.modules)),
    [authors, keyword],
  );
  const resultCount = visibleCount(tab, articles, matchedDomains, matchedModules, matchedAuthors);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = query.trim();
    const nextTag = tag.trim();
    updateUrl({ q: nextQuery, tag: nextTag, sort, type: tab });
  }

  function selectTag(slug: string) {
    setQuery(slug);
    setTag(slug);
    setTab("all");
    updateUrl({ q: slug, tag: slug, sort, type: "all" });
  }

  function switchTab(nextTab: SearchTab) {
    setTab(nextTab);
    updateUrl({ q: query.trim(), tag: tag.trim(), sort, type: nextTab });
  }

  function switchSort(nextSort: SortMode) {
    setSort(nextSort);
    updateUrl({ q: query.trim(), tag: tag.trim(), sort: nextSort, type: tab });
  }

  return (
    <main className="min-h-screen bg-[var(--color-page)] text-[var(--color-ink)]">
      <SiteHeader />
      <div className="relative isolate overflow-hidden">
        <ContourBackdrop />
        <section className="relative mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-12 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0">
              <SearchHero
                query={query}
                setQuery={setQuery}
                sort={sort}
                tab={tab}
                onSubmit={handleSubmit}
                onTabChange={switchTab}
                onSortChange={switchSort}
              />

              {!hasSearchIntent && <EmptySearch tags={tags} onTagClick={selectTag} />}

              {hasSearchIntent && (
                <div className="mt-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-[var(--color-ink)]">搜索结果</h2>
                      <p className="mt-1 text-sm text-[var(--color-muted)]">
                        {loading ? "正在检索真实内容..." : `共 ${resultCount} 条匹配结果`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        setTag("");
                        setTab("all");
                        updateUrl({ q: "", tag: "", sort, type: "all" });
                      }}
                      className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm font-semibold text-[var(--color-muted)] hover:bg-[var(--color-surface-solid)] hover:text-[var(--color-ink)]"
                    >
                      清空搜索
                    </button>
                  </div>

                  {error && (
                    <Panel>
                      <p className="text-sm text-red-600">{error}</p>
                    </Panel>
                  )}
                  {loading && !error && <LoadingPanel />}
                  {!loading && !error && (
                    <SearchResults
                      tab={tab}
                      articles={articles}
                      domains={matchedDomains}
                      modules={matchedModules}
                      authors={matchedAuthors}
                      onTagClick={selectTag}
                    />
                  )}
                </div>
              )}
            </div>

            <aside className="grid content-start gap-4">
              <SidePanel title="热门标签">
                <div className="flex flex-wrap gap-2">
                  {tags.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectTag(item.slug)}
                      className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-sm font-semibold text-[var(--color-ink)] hover:border-[var(--color-accent-strong)] hover:bg-[var(--color-surface-solid)]"
                    >
                      {item.name}
                      <span className="ml-2 text-xs text-[var(--color-muted)]">{formatCompact(item.usageCount)}</span>
                    </button>
                  ))}
                  {tags.length === 0 && <p className="text-sm text-[var(--color-muted)]">暂无标签数据</p>}
                </div>
              </SidePanel>

              <SidePanel title="搜索范围">
                <div className="grid gap-2 text-sm text-[var(--color-muted)]">
                  <p>支持搜索文章标题、摘要、标签、领域、版块与作者。</p>
                  <p>结果只在发起搜索后展示，避免把发现页变成信息流。</p>
                </div>
              </SidePanel>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

function SearchHero({
  query,
  setQuery,
  sort,
  tab,
  onSubmit,
  onTabChange,
  onSortChange,
}: {
  query: string;
  setQuery: (value: string) => void;
  sort: SortMode;
  tab: SearchTab;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTabChange: (tab: SearchTab) => void;
  onSortChange: (sort: SortMode) => void;
}) {
  return (
    <section className="border border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-soft)] backdrop-blur md:p-8">
      <div className="flex items-center gap-3 text-xs font-semibold tracking-[0.24em] text-[var(--color-muted)]">
        <span className="h-px w-10 bg-[var(--color-line)]" />
        DISCOVER / SEARCH
      </div>
      <h1 className="mt-5 text-3xl font-semibold leading-tight text-[var(--color-ink)] md:text-5xl">
        全站搜索
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--color-muted)] md:text-base">
        输入关键词后，再从文章、领域、版块和作者中定位你要找的内容。
      </p>

      <form onSubmit={onSubmit} className="mt-7 grid gap-3 md:grid-cols-[minmax(0,1fr)_112px]">
        <label className="relative min-w-0">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-muted)]">
            <SearchIcon />
          </span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-12 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] pl-11 pr-4 text-sm text-[var(--color-ink)] outline-none transition placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent-strong)]"
            placeholder="搜索文章、领域、版块、作者或标签..."
            aria-label="搜索关键词"
          />
        </label>
        <button
          type="submit"
          className="h-12 rounded-md bg-[var(--color-accent)] px-6 text-sm font-semibold text-[#171717] hover:bg-[var(--color-accent-strong)]"
        >
          搜索
        </button>
      </form>

      <div className="mt-6 flex flex-wrap gap-2 border-t border-[var(--color-line)] pt-5">
        {searchTabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onTabChange(item.key)}
            className={`h-10 rounded-md border px-4 text-sm font-semibold transition ${
              tab === item.key
                ? "border-[var(--color-accent-strong)] bg-[var(--color-accent)] text-[#171717]"
                : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:bg-[var(--color-surface-solid)] hover:text-[var(--color-ink)]"
            }`}
          >
            {item.label}
          </button>
        ))}
        <div className="flex flex-wrap gap-2 md:ml-auto">
          {sortModes.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onSortChange(item.key)}
              className={`h-10 rounded-md border px-4 text-sm font-semibold transition ${
                sort === item.key
                  ? "border-[var(--color-accent-strong)] text-[var(--color-ink)]"
                  : "border-[var(--color-line)] text-[var(--color-muted)] hover:bg-[var(--color-surface-solid)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function EmptySearch({ tags, onTagClick }: { tags: TagItem[]; onTagClick: (slug: string) => void }) {
  return (
    <Panel className="mt-6">
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_280px] md:items-center">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-ink)]">输入关键词开始探索</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
            默认状态不会展示全部内容。选择一个标签或输入关键词后，页面才会加载并显示匹配结果。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.slice(0, 6).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onTagClick(item.slug)}
              className="rounded-md bg-[var(--color-faint)] px-3 py-2 text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-accent)] hover:text-[#171717]"
            >
              {item.name}
            </button>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function SearchResults({
  tab,
  articles,
  domains,
  modules,
  authors,
  onTagClick,
}: {
  tab: SearchTab;
  articles: ArticleSummary[];
  domains: DomainSummary[];
  modules: ModuleSummary[];
  authors: AuthorResult[];
  onTagClick: (tag: string) => void;
}) {
  const showArticles = tab === "all" || tab === "articles";
  const showDomains = tab === "all" || tab === "domains";
  const showModules = tab === "all" || tab === "modules";
  const showAuthors = tab === "all" || tab === "authors";

  return (
    <div className="grid gap-6">
      {showArticles && (
        <ResultSection title="文章" count={articles.length}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard key={article.id} article={article} onTagClick={onTagClick} />
            ))}
          </div>
          {articles.length === 0 && <EmptyState text="未找到相关文章" />}
        </ResultSection>
      )}

      {showDomains && (
        <ResultSection title="领域" count={domains.length}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {domains.map((domain) => (
              <DomainCard key={domain.id} domain={domain} />
            ))}
          </div>
          {domains.length === 0 && <EmptyState text="未找到相关领域" />}
        </ResultSection>
      )}

      {showModules && (
        <ResultSection title="版块" count={modules.length}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {modules.map((module) => (
              <ModuleCard key={module.id} module={module} />
            ))}
          </div>
          {modules.length === 0 && <EmptyState text="未找到相关版块" />}
        </ResultSection>
      )}

      {showAuthors && (
        <ResultSection title="作者" count={authors.length}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {authors.map((author) => (
              <AuthorCard key={author.username} author={author} />
            ))}
          </div>
          {authors.length === 0 && <EmptyState text="未找到相关作者" />}
        </ResultSection>
      )}
    </div>
  );
}

function ResultSection({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section className="border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)] backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h3 className="text-base font-semibold text-[var(--color-ink)]">{title}</h3>
        <span className="shrink-0 text-sm text-[var(--color-muted)]">{count} 条</span>
      </div>
      {children}
    </section>
  );
}

function ArticleCard({ article, onTagClick }: { article: ArticleSummary; onTagClick: (tag: string) => void }) {
  const tags = article.tags ?? [];
  return (
    <article className="min-h-52 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] p-5 transition hover:-translate-y-0.5 hover:border-[var(--color-accent-strong)]">
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted)]">
        <span>{article.moduleName}</span>
        <span>/</span>
        <span>{article.authorUsername}</span>
      </div>
      <Link href={`/articles/${article.id}`}>
        <h4 className="mt-3 line-clamp-2 text-lg font-semibold leading-7 text-[var(--color-ink)] hover:text-[var(--color-accent-strong)]">
          {article.title}
        </h4>
      </Link>
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--color-muted)]">
        {article.summary || "暂无摘要"}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {tags.slice(0, 3).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onTagClick(item.slug)}
            className="rounded-md bg-[var(--color-faint)] px-2 py-1 text-xs font-semibold text-[var(--color-muted)] hover:bg-[var(--color-accent)] hover:text-[#171717]"
          >
            {item.name}
          </button>
        ))}
      </div>
      <div className="mt-4 text-xs text-[var(--color-muted)]">
        {article.wordCount} 字 · 阅读 {formatCompact(article.viewCount)}
      </div>
    </article>
  );
}

function DomainCard({ domain }: { domain: DomainSummary }) {
  return (
    <Link href={`/domain/${domain.id}`} className="block min-h-36 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] p-5 transition hover:-translate-y-0.5 hover:border-[var(--color-accent-strong)]">
      <div className="text-lg font-semibold text-[var(--color-ink)]">{domain.name}</div>
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--color-muted)]">{domain.description || "暂无领域描述"}</p>
      <div className="mt-4 text-xs font-semibold text-[var(--color-accent-strong)]">{domain.slug}</div>
    </Link>
  );
}

function ModuleCard({ module }: { module: ModuleSummary }) {
  return (
    <Link href={`/modules/${module.slug}`} className="block min-h-36 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] p-5 transition hover:-translate-y-0.5 hover:border-[var(--color-accent-strong)]">
      <div className="text-xs font-semibold text-[var(--color-accent-strong)]">{module.domainName}</div>
      <div className="mt-2 text-lg font-semibold text-[var(--color-ink)]">{module.name}</div>
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--color-muted)]">{module.description || "暂无版块描述"}</p>
    </Link>
  );
}

function AuthorCard({ author }: { author: AuthorResult }) {
  return (
    <Link href={`/authors/${author.username}`} className="flex min-h-28 items-center gap-4 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] p-5 transition hover:-translate-y-0.5 hover:border-[var(--color-accent-strong)]">
      <UserAvatar username={author.username} avatarUrl="" size="lg" />
      <div className="min-w-0">
        <div className="truncate text-lg font-semibold text-[var(--color-ink)]">{author.username}</div>
        <div className="mt-1 text-sm text-[var(--color-muted)]">
          文章 {author.articleCount} · 阅读 {formatCompact(author.viewCount)}
        </div>
        <div className="mt-2 truncate text-xs text-[var(--color-accent-strong)]">
          {author.modules.slice(0, 2).join(" / ") || "作者"}
        </div>
      </div>
    </Link>
  );
}

function SidePanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)] backdrop-blur">
      <h2 className="mb-4 text-sm font-semibold text-[var(--color-ink)]">{title}</h2>
      {children}
    </section>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)] backdrop-blur ${className}`}>
      {children}
    </section>
  );
}

function LoadingPanel() {
  return (
    <Panel>
      <p className="text-sm text-[var(--color-muted)]">正在搜索...</p>
    </Panel>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-[var(--color-line)] bg-[var(--color-surface)] p-8 text-center text-sm text-[var(--color-muted)]">
      {text}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="7" />
      <path d="m16.5 16.5 3.5 3.5" />
    </svg>
  );
}

function deriveAuthors(articles: ArticleSummary[]): AuthorResult[] {
  const map = new Map<string, AuthorResult>();
  for (const article of articles) {
    const current = map.get(article.authorUsername) ?? {
      username: article.authorUsername,
      articleCount: 0,
      viewCount: 0,
      modules: [],
    };
    current.articleCount += 1;
    current.viewCount += article.viewCount;
    if (!current.modules.includes(article.moduleName)) {
      current.modules.push(article.moduleName);
    }
    map.set(article.authorUsername, current);
  }
  return Array.from(map.values()).sort((a, b) => b.viewCount - a.viewCount || b.articleCount - a.articleCount);
}

function visibleCount(
  tab: SearchTab,
  articles: ArticleSummary[],
  domains: DomainSummary[],
  modules: ModuleSummary[],
  authors: AuthorResult[],
) {
  if (tab === "articles") return articles.length;
  if (tab === "domains") return domains.length;
  if (tab === "modules") return modules.length;
  if (tab === "authors") return authors.length;
  return articles.length + domains.length + modules.length + authors.length;
}

function matchText(keyword: string, ...values: string[]) {
  if (!keyword) return true;
  return values.some((value) => value.toLowerCase().includes(keyword));
}

function updateUrl(input: { q?: string; tag?: string; sort: SortMode; type: SearchTab }) {
  const params = new URLSearchParams();
  if (input.q) params.set("q", input.q);
  if (input.tag) params.set("tag", input.tag);
  if (input.sort !== "latest") params.set("sort", input.sort);
  if (input.type !== "all") params.set("type", input.type);
  const nextQuery = params.toString();
  window.history.replaceState(null, "", nextQuery ? `/discover?${nextQuery}` : "/discover");
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
