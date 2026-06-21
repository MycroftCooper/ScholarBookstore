"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { listDomains, type DomainSummary } from "@/lib/api/domains";

export default function DomainListPage() {
  const [domains, setDomains] = useState<DomainSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listDomains()
      .then(setDomains)
      .catch(() => setError("领域加载失败，请稍后重试"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto max-w-5xl px-4 py-10 md:py-14">
        <div className="mb-8">
          <p className="text-sm font-medium text-brass">领域</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">知识领域</h1>
        </div>

        {loading && (
          <div className="rounded-lg border border-stone-200 bg-white p-6 text-stone-600">
            正在加载领域...
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && domains.length === 0 && (
          <div className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
            暂无领域
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {domains.map((domain) => (
            <Link
              key={domain.id}
              href={`/domain/${domain.id}`}
              className="rounded-lg border border-stone-200 bg-white p-5 shadow-soft hover:border-stone-300"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-ink">{domain.name}</h2>
                <span className="text-xs text-stone-500">{domain.slug}</span>
              </div>
              {domain.description && (
                <p className="mt-3 text-sm leading-6 text-stone-600">
                  {domain.description}
                </p>
              )}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
