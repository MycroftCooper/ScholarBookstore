"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { listMyArticles, type ArticleSummary } from "@/lib/api/articles";
import { ApiError } from "@/lib/api/client";

export default function MyDraftsPage() {
  const [drafts, setDrafts] = useState<ArticleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listMyArticles("draft")
      .then(setDrafts)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          window.location.href = "/login";
          return;
        }
        setError("草稿加载失败，请稍后重试");
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
            <h1 className="mt-2 text-3xl font-semibold text-ink">我的草稿</h1>
          </div>
          <Link
            href="/me/submit"
            className="rounded-md bg-moss px-4 py-2 text-sm font-medium text-white hover:bg-[#354f42]"
          >
            新建草稿
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

        {!loading && !error && drafts.length === 0 && (
          <div className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
            暂无草稿
          </div>
        )}

        <div className="grid gap-3">
          {drafts.map((draft) => (
            <div
              key={draft.id}
              className="rounded-lg border border-stone-200 bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-stone-500">{draft.moduleName}</p>
                  <h2 className="mt-1 font-medium text-ink">{draft.title}</h2>
                </div>
                <Link
                  href={`/me/articles/${draft.id}/edit`}
                  className="inline-flex h-9 items-center rounded-md border border-stone-300 px-3 text-sm font-medium text-stone-700 hover:border-moss hover:text-moss"
                >
                  继续编辑
                </Link>
              </div>
              {draft.summary && (
                <p className="mt-3 text-sm leading-6 text-stone-600">
                  {draft.summary}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-stone-500">
                <span>{draft.wordCount} 字</span>
                <span>约 {draft.readingMinutes} 分钟</span>
                <span>更新于 {new Date(draft.updatedAt).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
