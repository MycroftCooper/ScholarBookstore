"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listModules, type ModuleSummary } from "@/lib/api/modules";

export function ModuleList() {
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listModules()
      .then(setModules)
      .catch(() => setError("\u7248\u5757\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-md bg-[var(--color-surface)] p-3 text-sm text-[var(--color-muted)]">
        {"\u6b63\u5728\u52a0\u8f7d\u7248\u5757..."}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (modules.length === 0) {
    return (
      <div className="rounded-md bg-[var(--color-surface)] p-3 text-sm text-[var(--color-muted)]">
        {"\u6682\u65e0\u7248\u5757"}
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {modules.map((module) => (
        <Link
          key={module.id}
          href={`/modules/${module.slug}`}
          className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-4 hover:border-[var(--color-accent-strong)] hover:bg-[var(--color-surface-solid)]"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-medium text-[var(--color-ink)]">{module.name}</h3>
            <span className="text-xs text-[var(--color-muted)]">{module.slug}</span>
          </div>
          {module.description && (
            <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
              {module.description}
            </p>
          )}
        </Link>
      ))}
    </div>
  );
}
