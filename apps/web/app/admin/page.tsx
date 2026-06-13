"use client";

import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import {
  approveArticle,
  listPendingReviews,
  rejectArticle,
  type ArticleSummary,
} from "@/lib/api/articles";
import { getCurrentUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

export default function AdminPage() {
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const user = await getCurrentUser();
      if (user.role !== "admin" && user.role !== "reviewer") {
        setError("权限不足");
        return;
      }
      const items = await listPendingReviews();
      setArticles(items);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        window.location.href = "/login";
        return;
      }
      setError("审核列表加载失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleApprove(id: number) {
    setActingId(id);
    setError("");
    try {
      await approveArticle(id, notes[id] ?? "通过");
      await load();
    } catch {
      setError("审核通过失败，请稍后重试");
    } finally {
      setActingId(null);
    }
  }

  async function handleReject(id: number) {
    const note = (notes[id] ?? "").trim();
    if (!note) {
      setError("拒绝时必须填写原因");
      return;
    }

    setActingId(id);
    setError("");
    try {
      await rejectArticle(id, note);
      await load();
    } catch {
      setError("审核拒绝失败，请稍后重试");
    } finally {
      setActingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <div className="mb-8">
          <p className="text-sm font-medium text-brass">管理后台</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">文章审核</h1>
        </div>

        {loading && (
          <div className="rounded-lg border border-stone-200 bg-white p-6 text-stone-600">
            正在加载...
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {!loading && articles.length === 0 && !error && (
          <div className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
            暂无待审核投稿
          </div>
        )}

        <div className="grid gap-4">
          {articles.map((article) => (
            <article
              key={article.id}
              className="rounded-lg border border-stone-200 bg-white p-5 shadow-soft"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-stone-500">
                    {article.moduleName} / {article.authorUsername}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-ink">
                    {article.title}
                  </h2>
                  {article.summary && (
                    <p className="mt-2 text-sm leading-6 text-stone-600">
                      {article.summary}
                    </p>
                  )}
                </div>
                <span className="rounded-md bg-stone-100 px-2 py-1 text-xs text-stone-700">
                  待审核
                </span>
              </div>

              <pre className="mt-4 max-h-64 overflow-auto rounded-md bg-stone-50 p-4 text-sm leading-6 text-stone-700">
                {article.contentMd}
              </pre>

              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-medium text-stone-700">
                  审核说明
                </span>
                <textarea
                  value={notes[article.id] ?? ""}
                  onChange={(event) =>
                    setNotes((current) => ({
                      ...current,
                      [article.id]: event.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
                />
              </label>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => handleApprove(article.id)}
                  disabled={actingId === article.id}
                  className="rounded-md bg-moss px-4 py-2 text-sm font-medium text-white hover:bg-[#354f42] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  通过
                </button>
                <button
                  type="button"
                  onClick={() => handleReject(article.id)}
                  disabled={actingId === article.id}
                  className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:border-red-300"
                >
                  拒绝
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
