"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listArticles, type ArticleSummary } from "@/lib/api/articles";

type ArticleListProps = {
  moduleSlug?: string;
};

export function ArticleList({ moduleSlug }: ArticleListProps) {
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listArticles(moduleSlug)
      .then(setArticles)
      .catch(() => setError("文章加载失败，请稍后重试"))
      .finally(() => setLoading(false));
  }, [moduleSlug]);

  if (loading) {
    return (
      <div className="rounded-md bg-stone-50 p-4 text-sm text-stone-500">
        正在加载文章...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-stone-300 px-4 py-6 text-sm text-stone-500">
        暂无文章
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {articles.map((article) => (
        <Link
          key={article.id}
          href={`/articles/${article.id}`}
          className="rounded-md border border-stone-200 bg-stone-50 p-4 hover:border-stone-300 hover:bg-white"
        >
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
            <span>{article.moduleName}</span>
            <span>/</span>
            <span>{article.authorUsername}</span>
          </div>
          <h3 className="mt-2 font-medium text-ink">{article.title}</h3>
          {article.summary && (
            <p className="mt-2 text-sm leading-6 text-stone-600">
              {article.summary}
            </p>
          )}
        </Link>
      ))}
    </div>
  );
}
