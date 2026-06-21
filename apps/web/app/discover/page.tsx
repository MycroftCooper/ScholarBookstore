"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import {
  listArticles,
  type ArticleListParams,
  type ArticleSummary,
} from "@/lib/api/articles";

type SortMode = "latest" | "hot" | "random";

export default function DiscoverPage() {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState<SortMode>("latest");
  const [results, setResults] = useState<ArticleSummary[]>([]);
  const [hotArticles, setHotArticles] = useState<ArticleSummary[]>([]);
  const [randomArticles, setRandomArticles] = useState<ArticleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextSort = params.get("sort");
    setQuery(params.get("q") ?? "");
    setTag(params.get("tag") ?? "");
    if (nextSort === "latest" || nextSort === "hot" || nextSort === "random") {
      setSort(nextSort);
    }
  }, []);

  const searchParams = useMemo<ArticleListParams>(
    () => ({
      q: query.trim() || undefined,
      tag: tag.trim() || undefined,
      sort,
      pageSize: 20,
    }),
    [query, tag, sort],
  );

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([
      listArticles(searchParams),
      listArticles({ sort: "hot", pageSize: 5 }),
      listArticles({ sort: "random", pageSize: 5 }),
    ])
      .then(([searchItems, hotItems, randomItems]) => {
        setResults(searchItems);
        setHotArticles(hotItems);
        setRandomArticles(randomItems);
      })
      .catch(() => setError("发现页加载失败，请稍后重试"))
      .finally(() => setLoading(false));
  }, [searchParams]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) {
      params.set("q", query.trim());
    }
    if (tag.trim()) {
      params.set("tag", tag.trim());
    }
    const queryString = params.toString();
    window.history.replaceState(null, "", queryString ? `/discover?${queryString}` : "/discover");
    setSort("latest");
  }

  function selectTag(slug: string) {
    setTag(slug);
    const params = new URLSearchParams(window.location.search);
    params.set("tag", slug);
    window.history.replaceState(null, "", `/discover?${params.toString()}`);
  }

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-brass">发现</p>
            <h1 className="mt-2 text-3xl font-semibold text-ink">
              搜索与发现文章
            </h1>
          </div>
          <Link
            href="/me/submit"
            className="rounded-md bg-moss px-4 py-2 text-sm font-medium text-white hover:bg-[#354f42]"
          >
            投稿
          </Link>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mb-6 grid gap-3 rounded-lg border border-stone-200 bg-white p-4 shadow-soft md:grid-cols-[minmax(0,1fr)_220px_auto]"
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="关键词"
            placeholder="关键词"
            className="h-11 rounded-md border border-stone-300 px-3 outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
          />
          <input
            value={tag}
            onChange={(event) => setTag(event.target.value)}
            aria-label="Tag"
            placeholder="Tag"
            className="h-11 rounded-md border border-stone-300 px-3 outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
          />
          <button
            type="submit"
            className="h-11 rounded-md bg-moss px-5 text-sm font-medium text-white hover:bg-[#354f42]"
          >
            搜索
          </button>
        </form>

        <div className="mb-5 flex flex-wrap gap-2">
          {(["latest", "hot", "random"] as SortMode[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setSort(item)}
              className={`h-9 rounded-md border px-3 text-sm font-medium ${
                sort === item
                  ? "border-moss bg-moss text-white"
                  : "border-stone-300 bg-white text-stone-700 hover:border-moss hover:text-moss"
              }`}
            >
              {item === "latest" ? "最新" : item === "hot" ? "热点" : "随机"}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
            {error}
          </div>
        )}

        {loading && !error && (
          <div className="rounded-lg border border-stone-200 bg-white p-6 text-stone-600">
            正在加载...
          </div>
        )}

        {!loading && !error && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <section>
              <h2 className="mb-3 text-lg font-semibold text-ink">搜索结果</h2>
              <ArticleCards articles={results} onTagClick={selectTag} />
            </section>

            <aside className="grid content-start gap-5">
              <section className="rounded-lg border border-stone-200 bg-white p-5">
                <h2 className="text-lg font-semibold text-ink">热点文章</h2>
                <div className="mt-4">
                  <CompactArticles articles={hotArticles} onTagClick={selectTag} />
                </div>
              </section>
              <section className="rounded-lg border border-stone-200 bg-white p-5">
                <h2 className="text-lg font-semibold text-ink">随机看看</h2>
                <div className="mt-4">
                  <CompactArticles
                    articles={randomArticles}
                    onTagClick={selectTag}
                  />
                </div>
              </section>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}

function ArticleCards({
  articles,
  onTagClick,
}: {
  articles: ArticleSummary[];
  onTagClick: (tag: string) => void;
}) {
  if (articles.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
        未找到相关文章
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {articles.map((article) => (
        <ArticleCard key={article.id} article={article} onTagClick={onTagClick} />
      ))}
    </div>
  );
}

function CompactArticles({
  articles,
  onTagClick,
}: {
  articles: ArticleSummary[];
  onTagClick: (tag: string) => void;
}) {
  if (articles.length === 0) {
    return <p className="text-sm text-stone-500">暂无文章</p>;
  }

  return (
    <div className="grid gap-3">
      {articles.map((article) => {
        const tags = article.tags ?? [];
        return (
          <div key={article.id}>
            <Link
              href={`/articles/${article.id}`}
              className="font-medium text-ink hover:text-moss"
            >
              {article.title}
            </Link>
            <div className="mt-1 flex flex-wrap gap-2 text-xs text-stone-500">
              <span>{article.viewCount} 次浏览</span>
              {tags.slice(0, 2).map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => onTagClick(tag.slug)}
                  className="text-moss underline-offset-4 hover:underline"
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ArticleCard({
  article,
  onTagClick,
}: {
  article: ArticleSummary;
  onTagClick: (tag: string) => void;
}) {
  const tags = article.tags ?? [];
  return (
    <article className="rounded-lg border border-stone-200 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
        <span>{article.moduleName}</span>
        <span>/</span>
        <span>{article.authorUsername}</span>
        {article.publishedAt && (
          <>
            <span>/</span>
            <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
          </>
        )}
      </div>
      <Link href={`/articles/${article.id}`}>
        <h3 className="mt-2 text-lg font-semibold text-ink hover:text-moss">
          {article.title}
        </h3>
      </Link>
      {article.summary && (
        <p className="mt-2 text-sm leading-6 text-stone-600">{article.summary}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-stone-500">
        <span>{article.wordCount} 字</span>
        <span>{article.viewCount} 次浏览</span>
      </div>
      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => onTagClick(tag.slug)}
              className="rounded-md bg-stone-100 px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-200"
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}
    </article>
  );
}
