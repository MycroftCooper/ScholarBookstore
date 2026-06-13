"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { listMyArticles, type ArticleSummary } from "@/lib/api/articles";
import { ApiError } from "@/lib/api/client";

const statusLabel: Record<ArticleSummary["status"], string> = {
  draft: "草稿",
  pending_review: "待审核",
  published: "已发布",
  rejected: "已拒绝",
  archived: "已归档",
};

export default function MyArticlesPage() {
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listMyArticles()
      .then(setArticles)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          window.location.href = "/login";
          return;
        }
        setError("我的投稿加载失败，请稍后重试");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto max-w-5xl px-4 py-10 md:py-14">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-brass">个人中心</p>
            <h1 className="mt-2 text-3xl font-semibold text-ink">我的投稿</h1>
          </div>
          <Link
            href="/submit"
            className="rounded-md bg-moss px-4 py-2 text-sm font-medium text-white hover:bg-[#354f42]"
          >
            新投稿
          </Link>
        </div>

        {loading && (
          <div className="rounded-lg border border-stone-200 bg-white p-6 text-stone-600">
            正在加载...
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && articles.length === 0 && (
          <div className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
            暂无投稿
          </div>
        )}

        <div className="grid gap-3">
          {articles.map((article) => (
            <div
              key={article.id}
              className="rounded-lg border border-stone-200 bg-white p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-stone-500">{article.moduleName}</p>
                  <h2 className="mt-1 font-medium text-ink">{article.title}</h2>
                </div>
                <span className="rounded-md bg-stone-100 px-2 py-1 text-xs text-stone-700">
                  {statusLabel[article.status]}
                </span>
              </div>
              {article.summary && (
                <p className="mt-3 text-sm leading-6 text-stone-600">
                  {article.summary}
                </p>
              )}
              {article.reviewNote && (
                <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {article.reviewNote}
                </p>
              )}
              {["draft", "pending_review", "rejected"].includes(article.status) && (
                <div className="mt-4">
                  <Link
                    href={`/me/articles/${article.id}/edit`}
                    className="inline-flex h-9 items-center rounded-md border border-stone-300 px-3 text-sm font-medium text-stone-700 hover:border-moss hover:text-moss"
                  >
                    {article.status === "rejected" ? "修改并重提" : "编辑投稿"}
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
