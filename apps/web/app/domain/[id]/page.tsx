"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ApiError } from "@/lib/api/client";
import { getDomain, type DomainSummary } from "@/lib/api/domains";

export default function DomainDetailPage() {
  const params = useParams<{ id: string }>();
  const [domain, setDomain] = useState<DomainSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      setError("领域不存在");
      setLoading(false);
      return;
    }

    getDomain(id)
      .then(setDomain)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("领域不存在");
          return;
        }
        setError("领域加载失败，请稍后重试");
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto max-w-5xl px-4 py-10 md:py-14">
        <Link
          href="/domain"
          className="text-sm font-medium text-moss underline-offset-4 hover:underline"
        >
          返回领域列表
        </Link>

        {loading && (
          <div className="mt-6 rounded-lg border border-stone-200 bg-white p-6 text-stone-600">
            正在加载领域...
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
            {error}
          </div>
        )}

        {domain && (
          <div className="mt-6 grid gap-5">
            <section className="rounded-lg border border-stone-200 bg-white p-6 shadow-soft">
              <p className="text-sm font-medium text-brass">{domain.slug}</p>
              <h1 className="mt-2 text-3xl font-semibold text-ink">
                {domain.name}
              </h1>
              {domain.description && (
                <p className="mt-4 max-w-3xl text-base leading-7 text-stone-600">
                  {domain.description}
                </p>
              )}
            </section>

            <section className="rounded-lg border border-stone-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-ink">版块</h2>
              {(!domain.modules || domain.modules.length === 0) && (
                <div className="mt-4 rounded-md border border-dashed border-stone-300 px-4 py-6 text-sm text-stone-500">
                  该领域下暂无版块
                </div>
              )}
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {domain.modules?.map((module) => (
                  <Link
                    key={module.id}
                    href={`/modules/${module.slug}`}
                    className="rounded-md border border-stone-200 bg-stone-50 p-4 hover:border-stone-300 hover:bg-white"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-medium text-ink">{module.name}</h3>
                      <span className="text-xs text-stone-500">{module.slug}</span>
                    </div>
                    {module.description && (
                      <p className="mt-2 text-sm leading-6 text-stone-600">
                        {module.description}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
