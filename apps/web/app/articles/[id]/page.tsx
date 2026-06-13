"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CommentSection } from "@/components/content/CommentSection";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { MarkdownContent } from "@/components/markdown/MarkdownContent";
import { getArticle, type ArticleSummary } from "@/lib/api/articles";
import { ApiError } from "@/lib/api/client";

export default function ArticleDetailPage() {
  const params = useParams<{ id: string }>();
  const [article, setArticle] = useState<ArticleSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      setError("文章不存在");
      setLoading(false);
      return;
    }

    getArticle(id)
      .then(setArticle)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("文章不存在或尚未发布");
          return;
        }
        setError("文章加载失败，请稍后重试");
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <article className="mx-auto max-w-4xl px-4 py-10 md:py-14">
        <Link
          href="/"
          className="text-sm font-medium text-moss underline-offset-4 hover:underline"
        >
          返回主页
        </Link>

        {loading && (
          <div className="mt-6 rounded-lg border border-stone-200 bg-white p-6 text-stone-600">
            正在加载文章...
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
            {error}
          </div>
        )}

        {article && (
          <>
            <div className="mt-6 rounded-lg border border-stone-200 bg-white p-6 shadow-soft">
              <div className="flex flex-wrap items-center gap-2 text-sm text-stone-500">
                <span>{article.moduleName}</span>
                <span>/</span>
                <span>{article.authorUsername}</span>
              </div>
              <h1 className="mt-3 text-3xl font-semibold leading-tight text-ink">
                {article.title}
              </h1>
              {article.summary && (
                <p className="mt-4 text-base leading-7 text-stone-600">
                  {article.summary}
                </p>
              )}
              <div className="mt-8 border-t border-stone-200 pt-6">
                <MarkdownContent content={article.contentMd ?? ""} />
              </div>
            </div>
            <CommentSection articleId={article.id} />
          </>
        )}
      </article>
    </main>
  );
}
