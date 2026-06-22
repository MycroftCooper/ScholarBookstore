"use client";

import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ApiError } from "@/lib/api/client";
import { getAdminDashboard, type DashboardSnapshot } from "@/lib/api/dashboard";

export default function AdminDashboardPage() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminDashboard()
      .then(setSnapshot)
      .catch((err) => {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          window.location.href = "/login";
          return;
        }
        setError("数据看板加载失败");
      });
  }, []);

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-3xl font-semibold text-ink">数据看板</h1>
        {error && <div className="mt-4 text-red-700">{error}</div>}
        {!snapshot && !error && <div className="mt-5 rounded-lg border border-stone-200 bg-white p-6">正在加载...</div>}
        {snapshot && (
          <>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <Metric label="文章总数" value={snapshot.totalArticles} />
              <Metric label="已发布文章" value={snapshot.publishedArticles} />
              <Metric label="活跃用户" value={snapshot.activeUsers} />
              <Metric label="今日发布" value={snapshot.todayPublishedArticles} />
              <Metric label="待审核" value={snapshot.pendingReviewArticles} />
              <Metric label="待处理举报" value={snapshot.pendingReports} />
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Trend title="30 天发布趋势" items={snapshot.publishedArticlesByDay} />
              <Trend title="30 天活跃用户" items={snapshot.activeUsersByDay} />
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-5">
      <div className="text-sm text-stone-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-ink">{value}</div>
    </div>
  );
}

function Trend({ title, items }: { title: string; items: { date: string; count: number }[] }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-5">
      <h2 className="font-semibold text-ink">{title}</h2>
      <div className="mt-3 max-h-80 overflow-auto text-sm">
        {items.map((item) => (
          <div key={item.date} className="flex justify-between border-t border-stone-100 py-2">
            <span>{item.date}</span>
            <span>{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
