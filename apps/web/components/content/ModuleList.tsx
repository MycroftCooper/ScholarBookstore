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
      .catch(() => setError("版块加载失败，请稍后重试"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-md bg-stone-50 p-3 text-sm text-stone-500">
        正在加载版块...
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

  if (modules.length === 0) {
    return (
      <div className="rounded-md bg-stone-50 p-3 text-sm text-stone-500">
        暂无版块
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {modules.map((module) => (
        <Link
          key={module.id}
          href={`/modules/${module.slug}`}
          className="rounded-md border border-stone-200 bg-stone-50 p-4"
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
  );
}
