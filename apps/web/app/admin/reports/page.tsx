"use client";

import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ApiError } from "@/lib/api/client";
import {
  listAdminReports,
  resolveReport,
  type ArticleReport,
} from "@/lib/api/reports";

export default function AdminReportsPage() {
  const [reports, setReports] = useState<ArticleReport[]>([]);
  const [status, setStatus] = useState<ArticleReport["status"] | "">("pending");
  const [actingId, setActingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function load(nextStatus = status) {
    setReports(await listAdminReports(nextStatus || undefined));
  }

  useEffect(() => {
    load().catch((err) => {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        window.location.href = "/login";
        return;
      }
      setError("举报列表加载失败");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleResolve(id: number, nextStatus: "resolved" | "rejected") {
    setActingId(id);
    setError("");
    try {
      await resolveReport(id, nextStatus, nextStatus === "resolved" ? "已处理" : "不成立");
      await load(status);
    } catch {
      setError("处理失败");
    } finally {
      setActingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-3xl font-semibold text-ink">举报管理</h1>
        <select
          value={status}
          onChange={(event) => {
            const next = event.target.value as ArticleReport["status"] | "";
            setStatus(next);
            load(next);
          }}
          className="mt-5 h-10 rounded-md border border-stone-300 bg-white px-3"
        >
          <option value="">全部</option>
          <option value="pending">待处理</option>
          <option value="resolved">已处理</option>
          <option value="rejected">不成立</option>
        </select>
        {error && <div className="mt-4 text-red-700">{error}</div>}
        <div className="mt-5 grid gap-3">
          {reports.map((report) => (
            <div key={report.id} className="rounded-lg border border-stone-200 bg-white p-5">
              <div className="text-sm text-stone-500">
                #{report.id} / {report.status} / 文章 #{report.articleId} {report.articleTitle}
              </div>
              <p className="mt-2 text-sm text-stone-700">{report.reason}</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={actingId === report.id || report.status !== "pending"}
                  onClick={() => handleResolve(report.id, "resolved")}
                  className="rounded-md border border-stone-300 px-3 py-2 text-sm disabled:opacity-50"
                >
                  标记已处理
                </button>
                <button
                  type="button"
                  disabled={actingId === report.id || report.status !== "pending"}
                  onClick={() => handleResolve(report.id, "rejected")}
                  className="rounded-md border border-stone-300 px-3 py-2 text-sm disabled:opacity-50"
                >
                  标记不成立
                </button>
              </div>
            </div>
          ))}
          {reports.length === 0 && (
            <div className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
              暂无举报
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
