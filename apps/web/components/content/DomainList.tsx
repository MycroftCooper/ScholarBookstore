"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listDomains, type DomainSummary } from "@/lib/api/domains";

export function DomainList() {
  const [domains, setDomains] = useState<DomainSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listDomains()
      .then(setDomains)
      .catch(() => setError("领域加载失败，请稍后重试"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-md bg-stone-50 p-3 text-sm text-stone-500">
        正在加载领域...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (domains.length === 0) {
    return (
      <div className="rounded-md bg-stone-50 p-3 text-sm text-stone-500">
        暂无领域
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {domains.map((domain) => (
        <Link
          key={domain.id}
          href={`/domain/${domain.id}`}
          className="rounded-md border border-stone-200 bg-stone-50 p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-medium text-ink">{domain.name}</h3>
            <span className="text-xs text-stone-500">{domain.slug}</span>
          </div>
          {domain.description && (
            <p className="mt-2 text-sm leading-6 text-stone-600">
              {domain.description}
            </p>
          )}
        </Link>
      ))}
    </div>
  );
}
