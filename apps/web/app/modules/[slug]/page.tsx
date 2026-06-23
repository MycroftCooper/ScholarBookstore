"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArticleList } from "@/components/content/ArticleList";
import { SiteFrame } from "@/components/layout/SiteFrame";
import { ApiError } from "@/lib/api/client";
import { getModule, type ModuleSummary } from "@/lib/api/modules";

export default function ModuleDetailPage() {
  const params = useParams<{ slug: string }>();
  const [module, setModule] = useState<ModuleSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!params.slug) {
      return;
    }

    setLoading(true);
    setError("");
    getModule(params.slug)
      .then(setModule)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("\u7248\u5757\u4e0d\u5b58\u5728\u6216\u5df2\u505c\u7528");
          return;
        }
        setError("\u7248\u5757\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5");
      })
      .finally(() => setLoading(false));
  }, [params.slug]);

  return (
    <SiteFrame>
      <section className="relative mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10 lg:px-8">
        <Link
          href="/modules"
          className="text-sm font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          &lt;- {"\u8fd4\u56de\u5168\u90e8\u9886\u57df"}
        </Link>

        {loading && (
          <div className="mt-6 border border-[var(--color-line)] bg-[var(--color-surface)] p-6 text-[var(--color-muted)]">
            {"\u6b63\u5728\u52a0\u8f7d\u7248\u5757..."}
          </div>
        )}

        {error && (
          <div className="mt-6 border border-red-300 bg-red-50 p-6 text-red-700">
            {error}
          </div>
        )}

        {module && (
          <div className="mt-6 grid gap-5">
            <section className="border border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-soft)] md:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-accent-strong)]">
                {module.domainName} / {module.slug}
              </p>
              <h1 className="mt-3 text-4xl font-semibold leading-tight text-[var(--color-ink)] md:text-5xl">
                {module.name}
              </h1>
              {module.description && (
                <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--color-muted)]">
                  {module.description}
                </p>
              )}
            </section>

            <section className="border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-[var(--color-ink)]">
                  {"\u6587\u7ae0"}
                </h2>
                <Link
                  href="/me/submit"
                  className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#171717] hover:bg-[var(--color-accent-strong)]"
                >
                  {"\u6295\u7a3f"}
                </Link>
              </div>
              <div className="mt-4">
                <ArticleList moduleSlug={module.slug} />
              </div>
            </section>
          </div>
        )}
      </section>
    </SiteFrame>
  );
}
