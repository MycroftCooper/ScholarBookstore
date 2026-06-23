"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ContourBackdrop } from "@/components/layout/ContourBackdrop";
import {
  getHomeOverview,
  type HomeArticleCard,
  type HomeCreator,
  type HomeDiscussion,
  type HomeModuleInsight,
  type HomeOverview as HomeOverviewData,
} from "@/lib/api/home";

const emptyOverview: HomeOverviewData = {
  stats: {
    publishedArticles: 0,
    activeModules: 0,
    visibleComments: 0,
    activeUsers: 0,
  },
  featured: [],
  modules: [],
  hotDiscussions: [],
  creators: [],
};

const heroSnippets = [
  "const shelf = new GameScholarBookstore();",
  "shelf.collect('papers', 'design notes');",
  "shelf.connect('players', 'developers');",
  "shelf.publish({ review: 'curated' });",
];

export function HomeOverview() {
  const [overview, setOverview] = useState<HomeOverviewData>(emptyOverview);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getHomeOverview()
      .then((result) => setOverview(normalizeOverview(result)))
      .catch(() => setError("\u9996\u9875\u6570\u636e\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5"))
      .finally(() => setLoading(false));
  }, []);

  const primaryModule = overview.modules[0];
  const primaryModuleHref = primaryModule ? `/modules/${primaryModule.slug}` : "/modules";

  return (
    <div className="relative isolate overflow-hidden bg-[var(--color-page)] text-[var(--color-ink)]">
      <ContourBackdrop />

      <section className="relative mx-auto grid min-h-[650px] max-w-7xl gap-10 px-4 pb-8 pt-12 md:grid-cols-[1.03fr_0.97fr] md:px-6 md:pt-16 lg:px-8">
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-3 text-xs font-semibold tracking-[0.24em] text-[var(--color-muted)]">
            <span className="h-px w-10 bg-[var(--color-line)]" />
            READ / PLAY / RESEARCH
          </div>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight text-[var(--color-ink)] md:text-6xl">
            {"\u8ba9\u6e38\u620f\u77e5\u8bc6\uff0c\u6210\u4e3a\u6bcf\u4e00\u6b21\u63a2\u7d22\u7684\u5b58\u6863\u70b9"}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-[var(--color-muted)]">
            {"GameScholarBookstore \u6c47\u96c6\u6e38\u620f\u7814\u7a76\u3001\u8bbe\u8ba1\u65b9\u6cd5\u3001\u5f00\u53d1\u7b14\u8bb0\u548c\u73a9\u5bb6\u89c2\u5bdf\uff0c\u7528\u53ef\u6295\u7a3f\u3001\u53ef\u5ba1\u6838\u3001\u53ef\u8ba8\u8bba\u7684\u65b9\u5f0f\u6c89\u6dc0\u957f\u671f\u6709\u4ef7\u503c\u7684\u5185\u5bb9\u3002"}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={primaryModuleHref}
              className="inline-flex items-center gap-3 rounded-md bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-[#171717] shadow-[0_14px_30px_rgba(242,194,0,0.24)] hover:bg-[var(--color-accent-strong)]"
            >
              {"\u5f00\u59cb\u6d4f\u89c8"} <span aria-hidden="true">-&gt;</span>
            </Link>
            <Link
              href="/me/submit"
              className="inline-flex items-center gap-3 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-3 text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-surface-solid)]"
            >
              <span aria-hidden="true">+</span> {"\u6295\u9012\u6587\u7ae0"}
            </Link>
          </div>

          <StatsGrid overview={overview} loading={loading} />
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </div>

        <HeroConsole />
      </section>

      <section className="relative mx-auto max-w-7xl px-4 pb-8 md:px-6 lg:px-8">
        <div className="flex items-center justify-between border-y border-[var(--color-line)] py-4">
          <h2 className="text-sm font-semibold text-[var(--color-ink)]">{"\u6700\u65b0\u6587\u7ae0"}</h2>
          <Link href="/discover" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]">
            {"\u67e5\u770b\u5168\u90e8"} -&gt;
          </Link>
        </div>
        {loading ? (
          <LoadingPanel text="\u6b63\u5728\u52a0\u8f7d\u6587\u7ae0..." />
        ) : overview.featured.length > 0 ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {overview.featured.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <EmptyPanel text="\u6682\u65e0\u5df2\u53d1\u5e03\u6587\u7ae0" />
        )}
      </section>

      <section className="relative mx-auto grid max-w-7xl gap-4 px-4 pb-10 md:grid-cols-[0.95fr_0.85fr_0.8fr] md:px-6 lg:px-8">
        <ModulePanel modules={overview.modules} loading={loading} />
        <DiscussionPanel discussions={overview.hotDiscussions} loading={loading} />
        <CreatorPanel creators={overview.creators} loading={loading} />
      </section>
    </div>
  );
}

function normalizeOverview(overview: HomeOverviewData): HomeOverviewData {
  return {
    ...emptyOverview,
    ...overview,
    stats: overview.stats ?? emptyOverview.stats,
    featured: overview.featured ?? [],
    modules: overview.modules ?? [],
    hotDiscussions: overview.hotDiscussions ?? [],
    creators: overview.creators ?? [],
  };
}

function StatsGrid({
  overview,
  loading,
}: {
  overview: HomeOverviewData;
  loading: boolean;
}) {
  const stats = useMemo(
    () => [
      ["\u6587\u7ae0", overview.stats.publishedArticles],
      ["\u9886\u57df", overview.stats.activeModules],
      ["\u8ba8\u8bba", overview.stats.visibleComments],
      ["\u7528\u6237", overview.stats.activeUsers],
    ],
    [overview.stats],
  );

  return (
    <div className="mt-9 grid max-w-2xl grid-cols-2 border border-[var(--color-line)] bg-[var(--color-surface)] backdrop-blur md:grid-cols-4">
      {stats.map(([label, value]) => (
        <div key={label} className="border-[var(--color-line)] px-5 py-4 md:border-r md:last:border-r-0">
          <div className="text-2xl font-semibold text-[var(--color-ink)]">
            {loading ? "..." : formatNumber(value as number)}
          </div>
          <div className="mt-1 text-xs text-[var(--color-muted)]">{label}</div>
        </div>
      ))}
    </div>
  );
}

function HeroConsole() {
  return (
    <div className="relative hidden items-center md:flex">
      <div className="w-full border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)] backdrop-blur">
        <div className="flex items-center justify-between border-b border-[var(--color-line)] px-6 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
          <span>archive.ts</span>
          <span className="text-[var(--color-accent-strong)]">GAME.SYS</span>
        </div>
        <div className="grid grid-cols-[1fr_170px] gap-5 p-7">
          <div className="font-mono text-sm leading-8 text-[var(--color-muted)]">
            {heroSnippets.map((line, index) => (
              <div key={line} className="grid grid-cols-[2.5rem_1fr] gap-4">
                <span className="text-[var(--color-muted)]">{String(index + 1).padStart(2, "0")}</span>
                <span>{line}</span>
              </div>
            ))}
            <div className="mt-5 text-[var(--color-muted)]">
              // archive game research into searchable knowledge
            </div>
          </div>
          <div className="relative border border-dashed border-[var(--color-line)] bg-[var(--color-code)] p-4">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--color-line)_1px,transparent_1px),linear-gradient(var(--color-line)_1px,transparent_1px)] bg-[size:18px_18px]" />
            <div className="relative space-y-3 pt-2">
              {[42, 76, 58, 105, 66, 128, 92, 48].map((width, index) => (
                <span
                  key={index}
                  className="block h-1 bg-[var(--color-muted)]"
                  style={{ width: `${width}px`, marginLeft: `${(index % 3) * 18}px` }}
                />
              ))}
              {[68, 34, 118].map((width, index) => (
                <span
                  key={`gold-${index}`}
                  className="block h-1 bg-[var(--color-accent)]"
                  style={{ width: `${width}px`, marginLeft: `${index * 27}px` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ArticleCard({ article }: { article: HomeArticleCard }) {
  return (
    <Link
      href={`/articles/${article.id}`}
      className="group flex min-h-52 flex-col border border-[var(--color-line)] bg-[var(--color-surface)] p-5 transition hover:-translate-y-0.5 hover:border-[var(--color-accent-strong)] hover:bg-[var(--color-surface-solid)] hover:shadow-[var(--shadow-soft)]"
    >
      <div className="text-xs font-semibold text-[var(--color-accent-strong)]">{article.moduleName}</div>
      <h3 className="mt-3 text-lg font-semibold leading-7 text-[var(--color-ink)]">
        {article.title}
      </h3>
      <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--color-muted)]">{article.summary}</p>
      <div className="mt-auto flex items-center justify-between pt-5 text-xs text-[var(--color-muted)]">
        <span>{article.authorUsername}</span>
        {article.publishedAt && <span>{new Date(article.publishedAt).toLocaleDateString()}</span>}
      </div>
    </Link>
  );
}

function ModulePanel({
  modules,
  loading,
}: {
  modules: HomeModuleInsight[];
  loading: boolean;
}) {
  return (
    <section className="border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--color-ink)]">{"\u77e5\u8bc6\u9886\u57df"}</h2>
        <Link href="/modules" className="text-xs text-[var(--color-muted)] hover:text-[var(--color-ink)]">
          {"\u5168\u90e8\u9886\u57df"} -&gt;
        </Link>
      </div>
      {loading ? (
        <LoadingPanel text="\u6b63\u5728\u52a0\u8f7d\u9886\u57df..." compact />
      ) : modules.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
          {modules.map((module) => (
            <Link
              key={module.id}
              href={`/modules/${module.slug}`}
              className="border-b border-[var(--color-line)] pb-3 last:border-b-0 lg:last:border-b"
            >
              <div className="font-medium text-[var(--color-ink)]">{module.name}</div>
              <div className="mt-1 text-xs text-[var(--color-muted)]">
                {module.articleCount} {"\u7bc7\u6587\u7ae0"}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyPanel text="\u6682\u65e0\u9886\u57df" compact />
      )}
    </section>
  );
}

function DiscussionPanel({
  discussions,
  loading,
}: {
  discussions: HomeDiscussion[];
  loading: boolean;
}) {
  return (
    <section className="border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--color-ink)]">{"\u70ed\u95e8\u8ba8\u8bba"}</h2>
        <span className="text-xs text-[var(--color-muted)]">LIVE</span>
      </div>
      {loading ? (
        <LoadingPanel text="\u6b63\u5728\u52a0\u8f7d\u8ba8\u8bba..." compact />
      ) : discussions.length > 0 ? (
        <div className="mt-4 grid gap-3">
          {discussions.map((discussion) => (
            <Link
              key={discussion.articleId}
              href={`/articles/${discussion.articleId}`}
              className="grid grid-cols-[1fr_auto] gap-3 border-b border-[var(--color-line)] pb-3 last:border-b-0"
            >
              <span className="text-sm font-medium leading-6 text-[var(--color-ink)]">
                {discussion.articleTitle}
              </span>
              <span className="rounded-sm bg-[var(--color-accent)] px-2 py-1 text-xs font-semibold text-[#171717]">
                {discussion.commentCount}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyPanel text="\u6682\u65e0\u516c\u5f00\u8ba8\u8bba" compact />
      )}
    </section>
  );
}

function CreatorPanel({
  creators,
  loading,
}: {
  creators: HomeCreator[];
  loading: boolean;
}) {
  return (
    <section className="border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--color-ink)]">{"\u4f18\u79c0\u521b\u4f5c\u8005"}</h2>
        <span className="text-xs text-[var(--color-muted)]">RANK</span>
      </div>
      {loading ? (
        <LoadingPanel text="\u6b63\u5728\u52a0\u8f7d\u521b\u4f5c\u8005..." compact />
      ) : creators.length > 0 ? (
        <div className="mt-4 grid gap-3">
          {creators.map((creator) => (
            <div key={creator.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[var(--color-ink)]">{creator.username}</div>
                <div className="mt-1 text-xs text-[var(--color-muted)]">
                  {"\u6587\u7ae0"} {creator.publishedCount}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyPanel text="\u6682\u65e0\u521b\u4f5c\u8005\u6570\u636e" compact />
      )}
    </section>
  );
}

function LoadingPanel({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <div className={`${compact ? "mt-4" : "mt-5"} border border-[var(--color-line)] bg-[var(--color-surface)] p-5 text-sm text-[var(--color-muted)]`}>
      {text}
    </div>
  );
}

function EmptyPanel({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <div className={`${compact ? "mt-4" : "mt-5"} border border-dashed border-[var(--color-line)] bg-[var(--color-surface)] p-5 text-sm text-[var(--color-muted)]`}>
      {text}
    </div>
  );
}

function formatNumber(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  }
  return String(value);
}
