"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArticleList } from "@/components/content/ArticleList";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { getModule, type ModuleSummary } from "@/lib/api/modules";
import { ApiError } from "@/lib/api/client";

export default function ModuleDetailPage() {
  const params = useParams<{ slug: string }>();
  const [module, setModule] = useState<ModuleSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!params.slug) {
      return;
    }

    getModule(params.slug)
      .then(setModule)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("版块不存在或已停用");
          return;
        }
        setError("版块加载失败，请稍后重试");
      })
      .finally(() => setLoading(false));
  }, [params.slug]);

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto max-w-5xl px-4 py-10 md:py-14">
        <Link
          href="/"
          className="text-sm font-medium text-moss underline-offset-4 hover:underline"
        >
          返回主页
        </Link>

        {loading && (
          <div className="mt-6 rounded-lg border border-stone-200 bg-white p-6 text-stone-600">
            正在加载版块...
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
            {error}
          </div>
        )}

        {module && (
          <div className="mt-6 grid gap-5">
            <section className="rounded-lg border border-stone-200 bg-white p-6 shadow-soft">
              <p className="text-sm font-medium text-brass">{module.slug}</p>
              <h1 className="mt-2 text-3xl font-semibold text-ink">
                {module.name}
              </h1>
              {module.description && (
                <p className="mt-4 max-w-3xl text-base leading-7 text-stone-600">
                  {module.description}
                </p>
              )}
            </section>

            <section className="rounded-lg border border-stone-200 bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-ink">文章</h2>
                <Link
                  href="/submit"
                  className="rounded-md bg-moss px-4 py-2 text-sm font-medium text-white hover:bg-[#354f42]"
                >
                  投稿
                </Link>
              </div>
              <div className="mt-4">
                <ArticleList moduleSlug={module.slug} />
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
