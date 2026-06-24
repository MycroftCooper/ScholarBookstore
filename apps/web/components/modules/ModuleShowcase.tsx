"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ContourBackdrop } from "@/components/layout/ContourBackdrop";
import { SiteFrame } from "@/components/layout/SiteFrame";
import { listArticles, type ArticleSummary } from "@/lib/api/articles";
import { ApiError } from "@/lib/api/client";
import { getModule, type ModuleSummary } from "@/lib/api/modules";
import { listTags, type TagItem } from "@/lib/api/tags";

type SortKey = "latest" | "random" | "hot";

type ModuleAuthor = {
  username: string;
  articleCount: number;
  views: number;
};

const sortTabs: Array<{ label: string; value: SortKey }> = [
  { label: "最新", value: "latest" },
  { label: "精选", value: "random" },
  { label: "热门", value: "hot" },
];

export function ModuleShowcase({ slug }: { slug: string }) {
  const [module, setModule] = useState<ModuleSummary | null>(null);
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [sort, setSort] = useState<SortKey>("latest");
  const [query, setQuery] = useState("");
  const [loadingModule, setLoadingModule] = useState(true);
  const [loadingArticles, setLoadingArticles] = useState(true);
  const [error, setError] = useState("");
  const [articleError, setArticleError] = useState("");

  useEffect(() => {
    if (!slug) {
      return;
    }

    setLoadingModule(true);
    setError("");
    getModule(slug)
      .then(setModule)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("版块不存在或已停用");
          return;
        }
        setError("版块加载失败，请稍后重试");
      })
      .finally(() => setLoadingModule(false));
  }, [slug]);

  useEffect(() => {
    if (!slug) {
      return;
    }

    const timer = window.setTimeout(() => {
      setLoadingArticles(true);
      setArticleError("");
      listArticles({
        moduleSlug: slug,
        q: query.trim() || undefined,
        sort,
        pageSize: 20,
      })
        .then(setArticles)
        .catch(() => setArticleError("文章加载失败，请稍后重试"))
        .finally(() => setLoadingArticles(false));
    }, 220);

    return () => window.clearTimeout(timer);
  }, [query, slug, sort]);

  useEffect(() => {
    listTags()
      .then((nextTags) => setTags(nextTags.slice(0, 12)))
      .catch(() => setTags([]));
  }, []);

  const authors = useMemo(() => collectAuthors(articles), [articles]);
  const totalViews = useMemo(
    () => articles.reduce((sum, article) => sum + article.viewCount, 0),
    [articles],
  );
  const moduleTags = useMemo(() => collectArticleTags(articles, tags), [articles, tags]);

  return (
    <SiteFrame>
      <div className="relative isolate overflow-hidden bg-[var(--color-page)] text-[var(--color-ink)]">
        <ContourBackdrop />
        <section className="relative mx-auto max-w-7xl px-4 py-7 md:px-6 lg:px-8">
          <Breadcrumb module={module} />

          {loadingModule && <ModuleState>正在加载版块...</ModuleState>}
          {error && <ModuleState tone="error">{error}</ModuleState>}

          {module && (
            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
              <div className="min-w-0 space-y-5">
                <ModuleHero
                  module={module}
                  articleCount={articles.length}
                  totalViews={totalViews}
                  query={query}
                  onQueryChange={setQuery}
                />

                <div className="flex items-center gap-8 border-b border-[var(--color-line)]">
                  {sortTabs.map((tab) => (
                    <button
                      type="button"
                      onClick={() => setSort(tab.value)}
                      className={`relative px-1 pb-4 pt-1 text-sm font-semibold transition ${
                        sort === tab.value
                          ? "text-[var(--color-ink)]"
                          : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                      }`}
                      key={tab.value}
                    >
                      {tab.label}
                      {sort === tab.value && (
                        <span className="absolute inset-x-0 bottom-0 h-1 bg-[var(--color-accent)]" />
                      )}
                    </button>
                  ))}
                </div>

                <ArticleFeed
                  articles={articles}
                  loading={loadingArticles}
                  error={articleError}
                />
              </div>

              <aside className="space-y-5">
                <ModuleIntro module={module} />
                <AuthorRank authors={authors} />
                <TagCloud tags={moduleTags} />
                <SubmissionGuide />
              </aside>
            </div>
          )}
        </section>
      </div>
    </SiteFrame>
  );
}

function Breadcrumb({ module }: { module: ModuleSummary | null }) {
  return (
    <nav className="flex flex-wrap items-center gap-3 text-xs font-medium text-[var(--color-muted)]">
      <Link href="/" className="hover:text-[var(--color-ink)]">
        首页
      </Link>
      <span>/</span>
      <Link href="/domain" className="hover:text-[var(--color-ink)]">
        领域
      </Link>
      {module && (
        <>
          <span>/</span>
          <Link href={`/domain/${module.domainId}`} className="hover:text-[var(--color-ink)]">
            {module.domainName}
          </Link>
          <span>/</span>
          <span className="text-[var(--color-ink)]">{module.name}</span>
        </>
      )}
    </nav>
  );
}

function ModuleHero({
  module,
  articleCount,
  totalViews,
  query,
  onQueryChange,
}: {
  module: ModuleSummary;
  articleCount: number;
  totalViews: number;
  query: string;
  onQueryChange: (value: string) => void;
}) {
  return (
    <section className="relative overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-soft)] md:p-8">
      <div className="absolute inset-0 opacity-45">
        <ContourBackdrop />
      </div>
      <div className="relative grid gap-8 md:grid-cols-[auto_minmax(0,1fr)_220px] md:items-center">
        <ModuleBadge name={module.name} />

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              {module.domainName} / {module.name}
            </h1>
            <span className="grid size-6 place-items-center rounded-full bg-[var(--color-accent)] text-xs font-bold text-[#171717]">
              ✓
            </span>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-muted)]">
            {module.description || "聚焦该版块的实践文章、经验复盘与知识整理。"}
          </p>

          <div className="mt-7 grid max-w-xl grid-cols-3 gap-5 text-sm">
            <ModuleStat label="文章数" value={formatCompact(articleCount)} />
            <ModuleStat label="阅读量" value={formatCompact(totalViews)} />
            <ModuleStat label="更新频率" value="持续更新" />
          </div>
        </div>

        <div className="space-y-5">
          <label className="relative block">
            <span className="sr-only">在本版块搜索</span>
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-muted)]">
              <SearchIcon />
            </span>
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="在本版块搜索"
              className="h-11 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] pl-11 pr-4 text-sm outline-none transition placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent-strong)]"
            />
          </label>
          <Link
            href="/me/submit"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-[#171717] transition hover:bg-[var(--color-accent-strong)]"
          >
            <PenIcon />
            发布新文章
          </Link>
        </div>
      </div>
    </section>
  );
}

function ModuleBadge({ name }: { name: string }) {
  const shortName = getBadgeText(name);

  return (
    <div className="grid size-28 shrink-0 place-items-center rounded-[28px] border border-[var(--color-line)] bg-[var(--color-surface-solid)] text-4xl font-semibold uppercase tracking-tight md:size-32">
      {shortName}
      <span className="absolute ml-24 mt-20 size-3 rounded-full bg-[var(--color-accent)] md:ml-28 md:mt-24" />
    </div>
  );
}

function ModuleStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="font-semibold text-[var(--color-ink)]">{value}</div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">{label}</div>
    </div>
  );
}

function ArticleFeed({
  articles,
  loading,
  error,
}: {
  articles: ArticleSummary[];
  loading: boolean;
  error: string;
}) {
  if (loading) {
    return <ModuleState>正在加载文章...</ModuleState>;
  }

  if (error) {
    return <ModuleState tone="error">{error}</ModuleState>;
  }

  if (articles.length === 0) {
    return <ModuleState>暂无文章</ModuleState>;
  }

  return (
    <div className="space-y-3">
      {articles.map((article) => (
        <ArticleCard article={article} key={article.id} />
      ))}
      <button
        type="button"
        className="h-11 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] text-sm font-semibold text-[var(--color-muted)]"
      >
        已显示全部文章
      </button>
    </div>
  );
}

function ArticleCard({ article }: { article: ArticleSummary }) {
  const tags = article.tags ?? [];

  return (
    <Link
      href={`/articles/${article.id}`}
      className="group block rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)] transition hover:border-[var(--color-accent-strong)] hover:bg-[var(--color-surface-solid)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="size-2 rounded-full bg-[var(--color-accent)]" />
            <h2 className="truncate text-xl font-semibold">{article.title}</h2>
          </div>
          {article.summary && (
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--color-muted)]">
              {article.summary}
            </p>
          )}
        </div>
        <span className="text-[var(--color-muted)] transition group-hover:text-[var(--color-ink)]">
          <BookmarkIcon />
        </span>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs text-[var(--color-muted)]">
        <span className="font-semibold text-[var(--color-ink)]">{article.authorUsername}</span>
        <span>{formatDate(article.publishedAt ?? article.createdAt)}</span>
        {tags.slice(0, 4).map((tag) => (
          <span
            className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-3 py-1"
            key={tag.id}
          >
            {tag.name}
          </span>
        ))}
        <span className="ml-auto flex items-center gap-5">
          <span>{formatCompact(article.viewCount)} 浏览</span>
          <span>{article.readingMinutes || 1} 分钟</span>
          <span>{formatCompact(article.wordCount)} 字</span>
        </span>
      </div>
    </Link>
  );
}

function ModuleIntro({ module }: { module: ModuleSummary }) {
  return (
    <SideCard title="版块简介">
      <p className="text-sm leading-7 text-[var(--color-muted)]">
        {module.description || "这里汇集该版块下的文章与经验分享，欢迎参与创作和交流。"}
      </p>
      <dl className="mt-6 space-y-3 text-sm">
        <InfoLine label="所属领域" value={module.domainName} />
        <InfoLine label="版块标识" value={module.slug} />
        <InfoLine label="创建时间" value={formatDate(module.createdAt)} />
      </dl>
      <Link
        href={`/domain/${module.domainId}`}
        className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        查看所属领域
        <span aria-hidden="true">→</span>
      </Link>
    </SideCard>
  );
}

function AuthorRank({ authors }: { authors: ModuleAuthor[] }) {
  return (
    <SideCard
      title="热门作者"
      action={
        <Link href="/discover" className="text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]">
          查看更多 →
        </Link>
      }
    >
      <div className="space-y-4">
        {authors.length > 0 ? (
          authors.slice(0, 5).map((author, index) => (
            <Link
              href={`/authors/${author.username}`}
              className="flex items-center gap-3"
              key={author.username}
            >
              <span className="w-4 text-center text-sm font-semibold text-[var(--color-accent-strong)]">
                {index + 1}
              </span>
              <span className="grid size-9 place-items-center rounded-full bg-[var(--color-faint)] text-xs font-semibold">
                {author.username.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{author.username}</span>
                <span className="text-xs text-[var(--color-muted)]">
                  文章 {author.articleCount} · 阅读 {formatCompact(author.views)}
                </span>
              </span>
              <span className="rounded-md border border-[var(--color-accent)] px-3 py-1 text-xs font-semibold">
                关注
              </span>
            </Link>
          ))
        ) : (
          <p className="text-sm text-[var(--color-muted)]">暂无作者数据</p>
        )}
      </div>
    </SideCard>
  );
}

function TagCloud({ tags }: { tags: TagItem[] }) {
  return (
    <SideCard
      title="推荐标签"
      action={
        <Link href="/discover" className="text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]">
          查看更多 →
        </Link>
      }
    >
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Link
              href={`/discover?tag=${encodeURIComponent(tag.slug)}`}
              className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-3 py-1.5 text-xs text-[var(--color-muted)] hover:border-[var(--color-accent-strong)] hover:text-[var(--color-ink)]"
              key={tag.id}
            >
              {tag.name}
              <span className="ml-2">{formatCompact(tag.usageCount)}</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--color-muted)]">暂无标签</p>
      )}
    </SideCard>
  );
}

function SubmissionGuide() {
  return (
    <SideCard title="投稿说明">
      <ul className="space-y-3 text-sm leading-6 text-[var(--color-muted)]">
        <li>内容需与本版块主题相关，质量优先。</li>
        <li>鼓励原创实践、深度思考与工程经验总结。</li>
        <li>严禁广告、引流与低质量内容。</li>
        <li>投稿即视为同意社区规范。</li>
      </ul>
      <Link
        href="/me/submit"
        className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-[var(--color-ink)]"
      >
        查看详细规范
        <span aria-hidden="true">→</span>
      </Link>
    </SideCard>
  );
}

function SideCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-soft)]">
      <div className="absolute inset-0 opacity-25">
        <ContourBackdrop />
      </div>
      <div className="relative">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h3 className="flex items-center gap-3 text-lg font-semibold">
            {title}
            <span className="size-2 rounded-full bg-[var(--color-accent)]" />
          </h3>
          {action}
        </div>
        {children}
      </div>
    </section>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4">
      <dt className="w-16 shrink-0 text-[var(--color-muted)]">{label}</dt>
      <dd className="min-w-0 truncate font-medium">{value}</dd>
    </div>
  );
}

function ModuleState({
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

  return <div className={`rounded-md border p-6 text-sm ${toneClass}`}>{children}</div>;
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

function PenIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        d="M5 19h4L19 9l-4-4L5 15v4Zm9-13 4 4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        d="M7 4h10v16l-5-3-5 3V4Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function collectAuthors(articles: ArticleSummary[]) {
  const authors = new Map<string, ModuleAuthor>();

  articles.forEach((article) => {
    const current = authors.get(article.authorUsername) ?? {
      username: article.authorUsername,
      articleCount: 0,
      views: 0,
    };

    authors.set(article.authorUsername, {
      ...current,
      articleCount: current.articleCount + 1,
      views: current.views + article.viewCount,
    });
  });

  return Array.from(authors.values()).sort((a, b) => b.views - a.views);
}

function collectArticleTags(articles: ArticleSummary[], fallbackTags: TagItem[]) {
  const tags = new Map<number, TagItem>();

  articles.forEach((article) => {
    (article.tags ?? []).forEach((tag) => {
      tags.set(tag.id, {
        ...tag,
        createdAt: "",
        updatedAt: "",
      });
    });
  });

  const articleTags = Array.from(tags.values()).sort((a, b) => b.usageCount - a.usageCount);
  return articleTags.length > 0 ? articleTags.slice(0, 12) : fallbackTags;
}

function getBadgeText(name: string) {
  const ascii = name.match(/[A-Za-z]+/g)?.join("");
  if (ascii) {
    return ascii.slice(0, 2);
  }

  return name.slice(0, 2);
}

function formatDate(value: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
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
