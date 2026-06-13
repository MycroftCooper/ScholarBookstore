"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { createArticle } from "@/lib/api/articles";
import { getCurrentUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { listModules, type ModuleSummary } from "@/lib/api/modules";

export default function SubmitPage() {
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [moduleId, setModuleId] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [contentMd, setContentMd] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [createdId, setCreatedId] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      try {
        await getCurrentUser();
        const items = await listModules();
        setModules(items);
        if (items[0]) {
          setModuleId(String(items[0].id));
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          window.location.href = "/login";
          return;
        }
        setError("投稿页加载失败，请稍后重试");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setCreatedId(null);

    try {
      const created = await createArticle({
        moduleId: Number(moduleId),
        title,
        summary,
        contentMd,
      });
      setCreatedId(created.id);
      setTitle("");
      setSummary("");
      setContentMd("");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("投稿失败，请稍后重试");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto max-w-4xl px-4 py-10 md:py-14">
        <div className="mb-8">
          <p className="text-sm font-medium text-brass">投稿</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">提交技术文章</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
            投稿后会进入待审核状态，审核通过后才会公开展示。
          </p>
        </div>

        {loading && (
          <div className="rounded-lg border border-stone-200 bg-white p-6 text-stone-600">
            正在加载...
          </div>
        )}

        {!loading && (
          <form
            onSubmit={handleSubmit}
            className="rounded-lg border border-stone-200 bg-white p-6 shadow-soft"
          >
            {modules.length === 0 ? (
              <div className="rounded-md border border-dashed border-stone-300 px-4 py-6 text-sm text-stone-500">
                暂无可投稿版块
              </div>
            ) : (
              <>
                <label className="mb-4 block">
                  <span className="mb-2 block text-sm font-medium text-stone-700">
                    版块
                  </span>
                  <select
                    value={moduleId}
                    onChange={(event) => setModuleId(event.target.value)}
                    className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
                  >
                    {modules.map((module) => (
                      <option key={module.id} value={module.id}>
                        {module.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="mb-4 block">
                  <span className="mb-2 block text-sm font-medium text-stone-700">
                    标题
                  </span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={160}
                    required
                    className="h-11 w-full rounded-md border border-stone-300 bg-white px-3 outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
                  />
                </label>

                <label className="mb-4 block">
                  <span className="mb-2 block text-sm font-medium text-stone-700">
                    摘要
                  </span>
                  <textarea
                    value={summary}
                    onChange={(event) => setSummary(event.target.value)}
                    maxLength={300}
                    rows={3}
                    className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
                  />
                </label>

                <label className="mb-5 block">
                  <span className="mb-2 block text-sm font-medium text-stone-700">
                    Markdown 正文
                  </span>
                  <textarea
                    value={contentMd}
                    onChange={(event) => setContentMd(event.target.value)}
                    required
                    rows={12}
                    className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
                  />
                </label>

                {error && (
                  <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </div>
                )}

                {createdId && (
                  <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                    投稿已提交，当前状态为待审核。
                    <Link
                      href="/me/articles"
                      className="ml-1 font-medium underline-offset-4 hover:underline"
                    >
                      查看我的投稿
                    </Link>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="h-11 rounded-md bg-moss px-5 font-medium text-white hover:bg-[#354f42] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "提交中..." : "提交投稿"}
                </button>
              </>
            )}
          </form>
        )}
      </section>
    </main>
  );
}
