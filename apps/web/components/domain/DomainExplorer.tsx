"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ContourBackdrop } from "@/components/layout/ContourBackdrop";
import { listModules, type ModuleSummary } from "@/lib/api/modules";

export function DomainExplorer() {
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listModules()
      .then(setModules)
      .catch(() => setError("\u9886\u57df\u52a0\u8f7d\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5"))
      .finally(() => setLoading(false));
  }, []);

  const activeModules = useMemo(
    () => modules.filter((module) => module.isActive),
    [modules],
  );
  const domainCount = useMemo(
    () => new Set(activeModules.map((module) => module.domainId)).size,
    [activeModules],
  );

  return (
    <div className="relative isolate overflow-hidden bg-[var(--color-page)] text-[var(--color-ink)]">
      <ContourBackdrop />
      <section className="relative mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-[1.08fr_0.92fr] md:px-6 md:py-16 lg:px-8">
        <div>
          <div className="flex items-center gap-3 text-xs font-semibold tracking-[0.24em] text-[var(--color-muted)]">
            <span className="h-px w-10 bg-[var(--color-line)]" />
            MODULE / EXPLORE
          </div>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
            {"\u63a2\u7d22\u4e0d\u540c\u9886\u57df\u7684\u77e5\u8bc6\u4e0e\u5b9e\u8df5"}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--color-muted)]">
            {"\u6240\u6709\u7248\u5757\u6765\u81ea\u540e\u7aef\u9886\u57df\u4e0e\u7248\u5757\u914d\u7f6e\uff0c\u70b9\u51fb\u8fdb\u5165\u5bf9\u5e94\u7684\u516c\u5f00\u6587\u7ae0\u5217\u8868\u3002"}
          </p>
          <div className="mt-8 grid max-w-lg grid-cols-2 border border-[var(--color-line)] bg-[var(--color-surface)]">
            <Stat label="\u9886\u57df" value={domainCount} />
            <Stat label="\u7248\u5757" value={activeModules.length} />
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-7xl px-4 pb-12 md:px-6 lg:px-8">
        {loading && (
          <div className="border border-[var(--color-line)] bg-[var(--color-surface)] p-6 text-[var(--color-muted)]">
            {"\u6b63\u5728\u52a0\u8f7d\u9886\u57df..."}
          </div>
        )}
        {error && (
          <div className="border border-red-300 bg-red-50 p-6 text-red-700">
            {error}
          </div>
        )}
        {!loading && !error && activeModules.length === 0 && (
          <div className="border border-dashed border-[var(--color-line)] bg-[var(--color-surface)] p-8 text-center text-[var(--color-muted)]">
            {"\u6682\u65e0\u53ef\u6d4f\u89c8\u7248\u5757"}
          </div>
        )}
        {!loading && !error && activeModules.length > 0 && (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {activeModules.map((module) => (
              <ModuleCard key={module.id} module={module} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border-[var(--color-line)] px-5 py-4 first:border-r">
      <div className="text-2xl font-semibold">{value.toLocaleString("zh-CN")}</div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">{label}</div>
    </div>
  );
}

function ModuleCard({ module }: { module: ModuleSummary }) {
  return (
    <Link
      href={`/modules/${module.slug}`}
      className="group min-h-40 border border-[var(--color-line)] bg-[var(--color-surface)] p-5 transition hover:-translate-y-0.5 hover:border-[var(--color-accent-strong)] hover:bg-[var(--color-surface-solid)]"
    >
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-accent-strong)]">
        {module.domainName}
      </div>
      <h2 className="mt-3 text-xl font-semibold text-[var(--color-ink)]">{module.name}</h2>
      {module.description && (
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-[var(--color-muted)]">
          {module.description}
        </p>
      )}
      <div className="mt-5 text-xs text-[var(--color-muted)]">{module.slug}</div>
    </Link>
  );
}
