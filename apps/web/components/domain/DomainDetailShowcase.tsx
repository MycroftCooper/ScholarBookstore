"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ContourBackdrop } from "@/components/layout/ContourBackdrop";
import { SiteFrame } from "@/components/layout/SiteFrame";
import { listArticles, type ArticleSummary, type ArticleTag } from "@/lib/api/articles";
import { ApiError } from "@/lib/api/client";
import { getDomain, type DomainSummary } from "@/lib/api/domains";
import { type ModuleSummary } from "@/lib/api/modules";
import { listTags, type TagItem } from "@/lib/api/tags";

type SortKey = "recommended" | "latest" | "hot";

type ModuleWithArticles = {
  module: ModuleSummary;
  articles: ArticleSummary[];
  featuredArticles: ArticleSummary[];
};

type DomainAuthor = {
  username: string;
  articleCount: number;
  views: number;
};

const sortOptions: Array<{ label: string; value: SortKey }> = [
  { label: "推荐", value: "recommended" },
  { label: "最新", value: "latest" },
  { label: "热门", value: "hot" },
];

const iconPaths = [
  "M10 8 6 12l4 4M14 8l4 4-4 4M13 6l-2 12",
  "M5 9l7-4 7 4v7l-7 4-7-4V9Zm7 4 7-4M12 13 5 9M12 13v7",
  "M7 5h10v14H7V5Zm3 4h4M10 13h4",
  "M6 16l1.5 2L18 7.5 16.5 6 6 16Zm8.5-8.5 2 2",
  "M5 18h14M8 18v-7l4-4 4 4v7",
  "M6 9h12v9H6V9Zm3 0V6h6v3",
];

export function DomainDetailShowcase({ id }: { id: string }) {
  const [domain, setDomain] = useState<DomainSummary | null>(null);
  const [moduleGroups, setModuleGroups] = useState<ModuleWithArticles[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recommended");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const domainId = Number(id);
    if (!Number.isInteger(domainId) || domainId <= 0) {
      setError("领域不存在");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    getDomain(domainId)
      .then(async (nextDomain) => {
        const modules = nextDomain.modules ?? [];
        const [articleLists, featuredLists] = await Promise.all([
          Promise.all(
            modules.map((module) =>
              listArticles({ moduleSlug: module.slug, sort: "hot", pageSize: 6 }).catch(
                () => [] as ArticleSummary[],
              ),
            ),
          ),
          Promise.all(
            modules.map((module) =>
              listArticles({ moduleSlug: module.slug, featured: true, pageSize: 3 }).catch(
                () => [] as ArticleSummary[],
              ),
            ),
          ),
        ]);

        setDomain(nextDomain);
        setModuleGroups(
          modules.map((module, index) => ({
            module,
            articles: articleLists[index] ?? [],
            featuredArticles: featuredLists[index] ?? [],
          })),
        );
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("领域不存在");
          return;
        }
        setError("领域加载失败，请稍后重试");
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    listTags()
      .then((nextTags) => setTags(nextTags.slice(0, 18)))
      .catch(() => setTags([]));
  }, []);

  const allArticles = useMemo(
    () =>
      moduleGroups.flatMap((group) => {
        const articles = new Map<number, ArticleSummary>();
        [...group.articles, ...group.featuredArticles].forEach((article) => {
          articles.set(article.id, article);
        });
        return Array.from(articles.values());
      }),
    [moduleGroups],
  );

  const filteredGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const groups = moduleGroups.filter((group) => {
      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        group.module.name,
        group.module.slug,
        group.module.description,
        ...[...group.articles, ...group.featuredArticles].flatMap((article) => [
          article.title,
          article.summary,
          ...(article.tags ?? []).map((tag) => tag.name),
        ]),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });

    return [...groups].sort((a, b) => {
      if (sort === "latest") {
        return getLatestTime(b.articles) - getLatestTime(a.articles);
      }

      const aViews = sumViews(a.articles);
      const bViews = sumViews(b.articles);
      if (sort === "hot") {
        return bViews - aViews;
      }

      return (
        b.featuredArticles.length * 2000 +
        b.articles.length * 1000 +
        bViews -
        (a.featuredArticles.length * 2000 + a.articles.length * 1000 + aViews)
      );
    });
  }, [moduleGroups, query, sort]);

  const domainTags = useMemo(
    () => collectTags(allArticles, tags),
    [allArticles, tags],
  );
  const authors = useMemo(() => collectAuthors(allArticles), [allArticles]);
  const stats = useMemo(
    () => ({
      articleCount: allArticles.length,
      moduleCount: moduleGroups.length,
      followers: allArticles.reduce((sum, article) => sum + article.viewCount, 0),
      updateCount: allArticles.filter((article) => isRecent(article.updatedAt)).length,
    }),
    [allArticles, moduleGroups.length],
  );

  return (
    <SiteFrame>
      <div className="relative isolate overflow-hidden bg-[var(--color-page)] text-[var(--color-ink)]">
        <ContourBackdrop />
        <section className="relative mx-auto max-w-7xl px-4 py-7 md:px-6 lg:px-8">
          <Breadcrumb domain={domain} />

          {loading && <DomainState>正在加载领域...</DomainState>}
          {error && <DomainState tone="error">{error}</DomainState>}

          {domain && (
            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
              <div className="min-w-0 space-y-5">
                <DomainHero
                  domain={domain}
                  stats={stats}
                  query={query}
                  sort={sort}
                  onQueryChange={setQuery}
                  onSortChange={setSort}
                />

                <QuickModuleNav groups={moduleGroups} />

                <section>
                  <h2 className="mb-3 text-lg font-semibold">
                    全部版块（{filteredGroups.length}）
                  </h2>
                  {filteredGroups.length > 0 ? (
                    <div className="space-y-0 overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]">
                      {filteredGroups.map((group, index) => (
                        <ModuleRow group={group} index={index} key={group.module.id} />
                      ))}
                    </div>
                  ) : (
                    <DomainState>暂无匹配版块</DomainState>
                  )}
                </section>
              </div>

              <aside className="space-y-5">
                <DomainIntro domain={domain} />
                <OwnerRank authors={authors} />
                <TagCloud tags={domainTags} />
                <PostingGuide />
              </aside>
            </div>
          )}
        </section>
      </div>
    </SiteFrame>
  );
}

function Breadcrumb({ domain }: { domain: DomainSummary | null }) {
  return (
    <nav className="flex flex-wrap items-center gap-3 text-xs font-medium text-[var(--color-muted)]">
      <Link href="/domain" className="hover:text-[var(--color-ink)]">
        领域
      </Link>
      {domain && (
        <>
          <span>/</span>
          <span className="text-[var(--color-ink)]">{domain.name}</span>
        </>
      )}
    </nav>
  );
}

function DomainHero({
  domain,
  stats,
  query,
  sort,
  onQueryChange,
  onSortChange,
}: {
  domain: DomainSummary;
  stats: {
    articleCount: number;
    moduleCount: number;
    followers: number;
    updateCount: number;
  };
  query: string;
  sort: SortKey;
  onQueryChange: (value: string) => void;
  onSortChange: (value: SortKey) => void;
}) {
  return (
    <section className="relative overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-soft)] md:p-8">
      <div className="absolute inset-0 opacity-45">
        <ContourBackdrop />
      </div>
      <div className="relative grid gap-8 md:grid-cols-[auto_minmax(0,1fr)_360px] md:items-center">
        <DomainBadge domain={domain} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              {domain.name}
            </h1>
            <span className="grid size-6 place-items-center rounded-full bg-[var(--color-accent)] text-xs font-bold text-[#171717]">
              ✓
            </span>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-muted)]">
            {domain.description || "聚焦该领域下的知识版块、实践经验与优质文章。"}
          </p>
          <div className="mt-7 grid max-w-xl grid-cols-2 gap-5 text-sm md:grid-cols-4">
            <HeroStat label="文章" value={formatCompact(stats.articleCount)} />
            <HeroStat label="版块" value={formatCompact(stats.moduleCount)} />
            <HeroStat label="关注者" value={formatCompact(stats.followers)} />
            <HeroStat label="更新频率" value={`每日 ${stats.updateCount || stats.moduleCount}+ 篇`} />
          </div>
        </div>
        <div className="space-y-4">
          <label className="relative block">
            <span className="sr-only">搜索该领域内版块</span>
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-muted)]">
              <SearchIcon />
            </span>
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="搜索该领域内版块..."
              className="h-11 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] pl-11 pr-4 text-sm outline-none transition placeholder:text-[var(--color-muted)] focus:border-[var(--color-accent-strong)]"
            />
          </label>
          <label className="block">
            <span className="sr-only">排序</span>
            <select
              value={sort}
              onChange={(event) => onSortChange(event.target.value as SortKey)}
              className="h-11 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-4 text-sm outline-none transition focus:border-[var(--color-accent-strong)]"
            >
              {sortOptions.map((option) => (
                <option value={option.value} key={option.value}>
                  排序：{option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </section>
  );
}

function DomainBadge({ domain }: { domain: DomainSummary }) {
  return (
    <div className="relative grid size-28 shrink-0 place-items-center rounded-[28px] border border-[var(--color-line)] bg-[var(--color-surface-solid)] text-3xl font-semibold uppercase md:size-32">
      {getBadgeText(domain.name)}
      <span className="absolute bottom-5 right-5 size-3 rounded-full bg-[var(--color-accent)]" />
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="font-semibold text-[var(--color-ink)]">{value}</div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">{label}</div>
    </div>
  );
}

function QuickModuleNav({ groups }: { groups: ModuleWithArticles[] }) {
  if (groups.length === 0) {
    return null;
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">快速导航</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {groups.slice(0, 8).map((group, index) => (
          <Link
            href={`/modules/${group.module.slug}`}
            className="flex items-center gap-3 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-soft)] transition hover:border-[var(--color-accent-strong)] hover:bg-[var(--color-surface-solid)]"
            key={group.module.id}
          >
            <ModuleIcon index={index} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{group.module.name}</span>
              <span className="text-xs text-[var(--color-muted)]">
                {formatCompact(group.articles.length)} 篇文章
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ModuleRow({ group, index }: { group: ModuleWithArticles; index: number }) {
  const featuredArticles = group.featuredArticles.slice(0, 3);
  const tags = collectModuleTags(group.articles);

  return (
    <article className="grid border-b border-[var(--color-line)] last:border-b-0 lg:grid-cols-[1.45fr_1.25fr_1.1fr]">
      <Link
        href={`/modules/${group.module.slug}`}
        className="group flex min-w-0 gap-4 p-5 transition hover:bg-[var(--color-surface-solid)]"
      >
        <ModuleBigIcon index={index} name={group.module.name} />
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate text-xl font-semibold">{group.module.name}</span>
            <span className="size-1.5 rounded-full bg-[var(--color-accent)]" />
          </span>
          <span className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--color-muted)]">
            {group.module.description || "进入该版块阅读文章与经验分享。"}
          </span>
          <span className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--color-muted)]">
            <span>文章 {formatCompact(group.articles.length)}</span>
            <span>关注者 {formatCompact(sumViews(group.articles))}</span>
            <span>今日更新 {group.articles.filter((article) => isRecent(article.updatedAt)).length}</span>
          </span>
        </span>
      </Link>

      <div className="border-t border-[var(--color-line)] p-5 lg:border-l lg:border-t-0">
        <h3 className="mb-3 text-sm font-semibold">精选文章</h3>
        {featuredArticles.length > 0 ? (
          <ul className="space-y-2 text-sm text-[var(--color-muted)]">
            {featuredArticles.map((article) => (
              <li key={article.id}>
                <Link
                  href={`/articles/${article.id}`}
                  className="line-clamp-1 hover:text-[var(--color-ink)]"
                >
                  · {article.title}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--color-muted)]">暂无精选文章</p>
        )}
      </div>

      <div className="border-t border-[var(--color-line)] p-5 lg:border-l lg:border-t-0">
        <h3 className="mb-3 text-sm font-semibold">热门标签</h3>
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tags.slice(0, 6).map((tag) => (
              <Link
                href={`/discover?tag=${encodeURIComponent(tag.slug)}`}
                className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-3 py-1.5 text-xs text-[var(--color-muted)] hover:border-[var(--color-accent-strong)] hover:text-[var(--color-ink)]"
                key={tag.id}
              >
                {tag.name}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-muted)]">暂无标签</p>
        )}
      </div>

    </article>
  );
}

function DomainIntro({ domain }: { domain: DomainSummary }) {
  return (
    <SideCard title="领域简介">
      <p className="text-sm leading-7 text-[var(--color-muted)]">
        {domain.description || "这里汇集该领域下的知识版块、优质文章与实践经验。"}
      </p>
      <ul className="mt-5 space-y-3 text-sm leading-6 text-[var(--color-muted)]">
        <li>覆盖该领域下的核心方向与专题。</li>
        <li>强调工程实践与可落地的解决方案。</li>
        <li>鼓励深度讨论与开放协作。</li>
      </ul>
      <Link
        href="/domain"
        className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        查看领域规则
        <span aria-hidden="true">→</span>
      </Link>
    </SideCard>
  );
}

function OwnerRank({ authors }: { authors: DomainAuthor[] }) {
  return (
    <SideCard
      title="热门版主"
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
                  文章 {author.articleCount} · 关注 {formatCompact(author.views)}
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

function PostingGuide() {
  return (
    <SideCard title="发帖指引">
      <ul className="space-y-3 text-sm leading-6 text-[var(--color-muted)]">
        <li>发布高质量、原创或翻译内容。</li>
        <li>遵循版块主题，选择合适的领域发布。</li>
        <li>禁止广告、灌水与侵权内容。</li>
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
  action?: ReactNode;
  children: ReactNode;
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

function ModuleIcon({ index }: { index: number }) {
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-solid)]">
      <IconPath index={index} className="size-5" />
    </span>
  );
}

function ModuleBigIcon({ index, name }: { index: number; name: string }) {
  const text = getBadgeText(name);

  return (
    <span className="grid size-20 shrink-0 place-items-center rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-solid)] text-xl font-semibold uppercase">
      {text.length <= 2 ? text : <IconPath index={index} className="size-8" />}
    </span>
  );
}

function IconPath({ index, className }: { index: number; className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d={iconPaths[index % iconPaths.length]}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function DomainState({
  children,
  tone = "default",
}: {
  children: ReactNode;
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

function collectAuthors(articles: ArticleSummary[]) {
  const authors = new Map<string, DomainAuthor>();

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

function collectTags(articles: ArticleSummary[], fallbackTags: TagItem[]) {
  const tags = new Map<number, TagItem>();

  articles.forEach((article) => {
    (article.tags ?? []).forEach((tag) => {
      tags.set(tag.id, articleTagToTagItem(tag));
    });
  });

  const articleTags = Array.from(tags.values()).sort((a, b) => b.usageCount - a.usageCount);
  return articleTags.length > 0 ? articleTags.slice(0, 18) : fallbackTags;
}

function collectModuleTags(articles: ArticleSummary[]) {
  const tags = new Map<number, ArticleTag>();

  articles.forEach((article) => {
    (article.tags ?? []).forEach((tag) => tags.set(tag.id, tag));
  });

  return Array.from(tags.values()).sort((a, b) => b.usageCount - a.usageCount);
}

function articleTagToTagItem(tag: ArticleTag): TagItem {
  return {
    ...tag,
    createdAt: "",
    updatedAt: "",
  };
}

function sumViews(articles: ArticleSummary[]) {
  return articles.reduce((sum, article) => sum + article.viewCount, 0);
}

function getLatestTime(articles: ArticleSummary[]) {
  return articles.reduce((latest, article) => {
    const time = new Date(article.updatedAt || article.createdAt).getTime();
    return Number.isNaN(time) ? latest : Math.max(latest, time);
  }, 0);
}

function isRecent(value: string) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) {
    return false;
  }

  return Date.now() - time < 1000 * 60 * 60 * 24 * 7;
}

function getBadgeText(name: string) {
  const ascii = name.match(/[A-Za-z]+/g)?.join("");
  if (ascii) {
    return ascii.slice(0, 2);
  }

  return name.slice(0, 2);
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
