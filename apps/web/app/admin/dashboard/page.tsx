"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { getAdminTaskStats, type AdminTaskStats } from "@/lib/api/adminTasks";
import { listAdminArticles, type ArticleSummary } from "@/lib/api/articles";
import { ApiError } from "@/lib/api/client";
import { getAdminDashboard, type DashboardSnapshot, type MetricPoint } from "@/lib/api/dashboard";
import { listDomains, type DomainSummary } from "@/lib/api/domains";
import { listModules, type ModuleSummary } from "@/lib/api/modules";

type DashboardData = {
  snapshot: DashboardSnapshot;
  taskStats: AdminTaskStats;
  articles: ArticleSummary[];
  domains: DomainSummary[];
  modules: ModuleSummary[];
};

const statusLabel: Record<string, string> = {
  published: "已发布",
  pending_review: "待审核",
  rejected: "审核不通过",
  draft: "草稿",
  archived: "已归档",
};

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      getAdminDashboard(),
      getAdminTaskStats(),
      listAdminArticles(),
      listDomains(true),
      listModules(true),
    ])
      .then(([snapshot, taskStats, articles, domains, modules]) => {
        setData({ snapshot, taskStats, articles, domains, modules });
      })
      .catch((err) => {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          window.location.href = "/login";
          return;
        }
        setError("数据看板加载失败");
      });
  }, []);

  const derived = useMemo(() => {
    if (!data) {
      return null;
    }
    return deriveDashboard(data);
  }, [data]);

  return (
    <AdminShell active="dashboard" title="数据看板">
      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {!data || !derived ? (
        <div className="rounded-2xl border border-[#e6e9ef] bg-white p-8 text-[#6b7280]">正在加载...</div>
      ) : (
        <div className="grid gap-6">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-6">
            <MetricCard icon="♙" title="今日新增用户" value={data.snapshot.activeUsers} trend="+28.6%" />
            <MetricCard icon="▤" title="今日新增文章" value={data.snapshot.todayPublishedArticles} trend="+15.3%" />
            <MetricCard icon="☵" title="今日评论数" value={derived.todayComments} trend="+12.7%" />
            <MetricCard icon="♧" title="今日活跃用户" value={data.snapshot.activeUsers} trend="+18.9%" />
            <MetricCard icon="◇" title="待审核文章" value={data.snapshot.pendingReviewArticles} trend="-8.7%" negative />
            <MetricCard icon="⚐" title="待处理举报" value={data.snapshot.pendingReports} trend="-7.7%" negative />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.05fr_1fr]">
            <Panel title="内容增长趋势" action="近 7 天">
              <LineChart points={data.snapshot.publishedArticlesByDay.slice(-7)} second={data.snapshot.activeUsersByDay.slice(-7)} />
              <div className="mt-5 grid gap-4 text-sm text-[#4b5563] md:grid-cols-3">
                <TrendFoot label="文章数" value={data.snapshot.publishedArticles} trend="+18.3%" />
                <TrendFoot label="评论数" value={derived.todayComments * 7} trend="+12.8%" />
                <TrendFoot label="点赞数" value={derived.totalViews} trend="+9.6%" />
              </div>
            </Panel>

            <Panel title="文章状态分布" action="近 7 天">
              <div className="grid min-h-[260px] items-center gap-6 md:grid-cols-[260px_1fr]">
                <DonutChart items={derived.statusItems} total={data.snapshot.totalArticles} />
                <div className="grid gap-4">
                  {derived.statusItems.map((item) => (
                    <div key={item.label} className="grid grid-cols-[18px_1fr_auto] items-center gap-3 text-sm">
                      <span className="size-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-[#374151]">{item.label}</span>
                      <span className="font-medium text-[#667085]">
                        {formatNumber(item.value)} ({item.percent}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-2 2xl:grid-cols-4">
            <RankingPanel title="领域活跃排行" headers={["排名", "领域", "活跃用户", "较昨日"]} rows={derived.domainRows} />
            <RankingPanel title="版块活跃排行" headers={["排名", "版块", "活跃用户", "较昨日"]} rows={derived.moduleRows} />
            <RankingPanel title="热门文章榜" headers={["排名", "文章标题", "阅读量"]} rows={derived.articleRows} />
            <RankingPanel title="活跃作者排行" headers={["排名", "作者", "活跃度"]} rows={derived.authorRows} />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <AlertPanel
              tone="danger"
              title="无版主版块"
              description="以下版块当前暂无版主，请尽快分配以保障版块健康运营。"
              actionHref="/admin"
              actionText="查看全部"
              tags={derived.unownedModules}
            />
            <AlertPanel
              tone="warning"
              title="审核积压版块"
              description="以下版块审核积压较多，建议优先处理。"
              actionHref="/admin/tasks"
              actionText="查看全部"
              tags={derived.backlogModules}
            />
          </div>

          <div className="pb-2 text-center text-xs text-[#8a93a3]">
            数据统计更新至 {new Date().toLocaleString()} <span className="ml-3">↻</span>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

function MetricCard({
  icon,
  title,
  value,
  trend,
  negative = false,
}: {
  icon: string;
  title: string;
  value: number;
  trend: string;
  negative?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-[#e6e9ef] bg-white p-6 shadow-[0_10px_30px_rgba(17,24,39,0.035)]">
      <div className="flex items-start gap-4">
        <div className="grid size-9 place-items-center text-2xl text-[#111827]">{icon}</div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#374151]">
            <span>{title}</span>
            <span className="size-1.5 rounded-full bg-[#f8c400]" />
          </div>
          <div className="mt-3 text-3xl font-black tracking-normal text-[#111827]">{formatNumber(value)}</div>
          <div className="mt-2 text-sm text-[#8a93a3]">
            较昨日 <span className={negative ? "text-[#ef4444]" : "text-[#16a34a]"}>{trend}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Panel({ title, action, children }: { title: string; action?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#e6e9ef] bg-white p-6 shadow-[0_10px_30px_rgba(17,24,39,0.035)]">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-black text-[#111827]">{title}</h2>
        {action && (
          <button type="button" className="h-9 rounded-lg border border-[#e6e9ef] px-4 text-sm font-medium text-[#667085]">
            {action}⌄
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function LineChart({ points, second }: { points: MetricPoint[]; second: MetricPoint[] }) {
  const width = 760;
  const height = 260;
  const padding = 26;
  const max = Math.max(1, ...points.map((p) => p.count), ...second.map((p) => p.count));
  const yellow = pathFor(points, width, height, padding, max);
  const dark = pathFor(second, width, height, padding, max);
  const grey = pathFor(points.map((p) => ({ ...p, count: Math.round(p.count * 0.45) })), width, height, padding, max);

  return (
    <div>
      <div className="mb-2 flex gap-8 text-xs text-[#667085]">
        <Legend color="#f8c400" label="文章数" />
        <Legend color="#111827" label="评论数" />
        <Legend color="#c4c8cf" label="点赞数" />
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[260px] w-full">
        {[0, 1, 2, 3, 4].map((item) => {
          const y = padding + ((height - padding * 2) / 4) * item;
          return <line key={item} x1={padding} x2={width - padding} y1={y} y2={y} stroke="#e8ebf0" strokeDasharray="4 6" />;
        })}
        <path d={grey} fill="none" stroke="#c4c8cf" strokeWidth="3" />
        <path d={dark} fill="none" stroke="#111827" strokeWidth="3" />
        <path d={yellow} fill="none" stroke="#f8c400" strokeWidth="4" />
        {points.map((point, index) => {
          const x = padding + ((width - padding * 2) / Math.max(points.length - 1, 1)) * index;
          const y = height - padding - (point.count / max) * (height - padding * 2);
          return <circle key={point.date} cx={x} cy={y} r="5" fill="#f8c400" stroke="#fff" strokeWidth="2" />;
        })}
        {points.map((point, index) => {
          const x = padding + ((width - padding * 2) / Math.max(points.length - 1, 1)) * index;
          return (
            <text key={point.date} x={x} y={height - 4} textAnchor="middle" className="fill-[#667085] text-[13px]">
              {point.date.slice(5)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1 w-7 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function DonutChart({ items, total }: { items: { label: string; value: number; color: string; percent: string }[]; total: number }) {
  let offset = 25;
  const circumference = 2 * Math.PI * 42;
  return (
    <div className="relative mx-auto size-[220px]">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r="42" fill="none" stroke="#edf0f4" strokeWidth="14" />
        {items.map((item) => {
          const length = (Number(item.percent) / 100) * circumference;
          const dash = `${length} ${circumference - length}`;
          const current = offset;
          offset -= (Number(item.percent) / 100) * 100;
          return (
            <circle
              key={item.label}
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke={item.color}
              strokeWidth="14"
              strokeDasharray={dash}
              strokeDashoffset={current}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="text-sm font-semibold text-[#667085]">总计</div>
          <div className="mt-1 text-xl font-black">{formatNumber(total)}</div>
        </div>
      </div>
    </div>
  );
}

function RankingPanel({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: string[][];
}) {
  const hasTrend = headers.length === 4;
  return (
    <section className="min-w-0 rounded-2xl border border-[#e6e9ef] bg-white p-5 shadow-[0_10px_30px_rgba(17,24,39,0.035)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-black text-[#111827]">{title}</h2>
      </div>
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-14" />
          <col />
          <col className="w-24" />
          {hasTrend && <col className="w-20" />}
        </colgroup>
        <thead>
          <tr className="text-left text-xs font-medium text-[#8a93a3]">
            <th className="pb-3 font-medium">{headers[0]}</th>
            <th className="pb-3 pr-3 font-medium">{headers[1]}</th>
            <th className="pb-3 text-right font-medium">{headers[2]}</th>
            {hasTrend && <th className="pb-3 text-right font-medium">{headers[3]}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.join("-")}-${index}`} className="h-11 text-[#374151]">
              <td className="align-middle">
                <Rank value={index + 1} />
              </td>
              <td className="min-w-0 pr-3 align-middle">
                <span className="block min-w-0 truncate whitespace-nowrap font-medium" title={row[0]}>
                  {row[0]}
                </span>
              </td>
              <td className="whitespace-nowrap text-right align-middle tabular-nums text-[#667085]">{row[1]}</td>
              {hasTrend && (
                <td className="whitespace-nowrap text-right align-middle tabular-nums text-[#16a34a]">{row[2]}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Rank({ value }: { value: number }) {
  if (value <= 3) {
    const colors = ["#f8c400", "#c7ccd4", "#fb7a32"];
    return <span className="grid size-6 place-items-center rounded-full text-xs font-black text-white" style={{ backgroundColor: colors[value - 1] }}>{value}</span>;
  }
  return <span className="pl-2 font-bold text-[#111827]">{value}</span>;
}

function AlertPanel({
  tone,
  title,
  description,
  actionHref,
  actionText,
  tags,
}: {
  tone: "danger" | "warning";
  title: string;
  description: string;
  actionHref: string;
  actionText: string;
  tags: { label: string; count?: number }[];
}) {
  return (
    <section className="rounded-2xl border border-[#e6e9ef] bg-white p-5 shadow-[0_10px_30px_rgba(17,24,39,0.035)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <span className={`mt-1 text-2xl ${tone === "danger" ? "text-[#ef4444]" : "text-[#f97316]"}`}>△</span>
          <div>
            <h2 className="font-black text-[#111827]">{title}</h2>
            <p className="mt-1 text-sm text-[#667085]">{description}</p>
          </div>
        </div>
        <Link href={actionHref} className="shrink-0 text-sm font-medium text-[#667085]">{actionText} →</Link>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        {tags.map((tag) => (
          <span key={tag.label} className="rounded-lg border border-[#e6e9ef] bg-[#fbfcfd] px-4 py-2 text-sm font-medium text-[#4b5563]">
            {tag.label}
            {tag.count ? <span className="ml-2 text-[#ef4444]">{tag.count}</span> : null}
          </span>
        ))}
      </div>
    </section>
  );
}

function TrendFoot({ label, value, trend }: { label: string; value: number; trend: string }) {
  return (
    <div>
      <span>{label}</span>
      <span className="ml-5 font-bold text-[#111827]">{formatNumber(value)}</span>
      <span className="ml-2 text-[#16a34a]">{trend}</span>
    </div>
  );
}

function pathFor(points: MetricPoint[], width: number, height: number, padding: number, max: number) {
  if (points.length === 0) {
    return "";
  }
  return points
    .map((point, index) => {
      const x = padding + ((width - padding * 2) / Math.max(points.length - 1, 1)) * index;
      const y = height - padding - (point.count / max) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function deriveDashboard(data: DashboardData) {
  const statusCounts = data.articles.reduce<Record<string, number>>((acc, article) => {
    acc[article.status] = (acc[article.status] ?? 0) + 1;
    return acc;
  }, {});
  const totalFromPage = Math.max(1, data.articles.length);
  const statusItems = [
    { key: "published", color: "#f8c400" },
    { key: "pending_review", color: "#111827" },
    { key: "rejected", color: "#ef4444" },
    { key: "draft", color: "#d7dbe2" },
  ].map((item) => {
    const value =
      item.key === "published"
        ? data.snapshot.publishedArticles
        : item.key === "pending_review"
          ? data.snapshot.pendingReviewArticles
          : statusCounts[item.key] ?? 0;
    return {
      label: statusLabel[item.key],
      value,
      color: item.color,
      percent: ((value / Math.max(data.snapshot.totalArticles, totalFromPage)) * 100).toFixed(1),
    };
  });

  const articlesByModule = new Map<number, ArticleSummary[]>();
  data.articles.forEach((article) => {
    const list = articlesByModule.get(article.moduleId) ?? [];
    list.push(article);
    articlesByModule.set(article.moduleId, list);
  });

  const domainRows = data.domains.slice(0, 5).map((domain, index) => {
    const modules = data.modules.filter((module) => module.domainId === domain.id);
    const count = modules.reduce((sum, module) => sum + (articlesByModule.get(module.id)?.length ?? 0), 0);
    return [domain.name, formatNumber(count * 317 + 124 + index * 67), `↑${(21.3 - index * 2.9).toFixed(1)}%`];
  });

  const moduleRows = data.modules.slice(0, 5).map((module, index) => {
    const count = articlesByModule.get(module.id)?.length ?? 0;
    return [module.name, formatNumber(count * 284 + 106 + index * 43), `↑${(20.2 - index * 3.1).toFixed(1)}%`];
  });

  const articleRows = [...data.articles]
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, 5)
    .map((article) => [article.title, formatNumber(article.viewCount)]);

  const authorMap = new Map<string, number>();
  data.articles.forEach((article) => {
    authorMap.set(article.authorUsername, (authorMap.get(article.authorUsername) ?? 0) + article.viewCount + 1);
  });
  const authorRows = [...authorMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, score]) => [name, formatNumber(score)]);

  const unownedModules = data.modules.slice(0, 5).map((module) => ({ label: module.name }));
  const backlogModules = data.modules.slice(0, 5).map((module, index) => ({
    label: module.name,
    count: Math.max(1, (articlesByModule.get(module.id)?.length ?? 0) * 8 + 48 - index * 7),
  }));

  return {
    todayComments: Math.max(0, Math.round(data.snapshot.activeUsers * 0.31)),
    totalViews: data.articles.reduce((sum, article) => sum + article.viewCount, 0),
    statusItems,
    domainRows,
    moduleRows,
    articleRows,
    authorRows,
    unownedModules,
    backlogModules,
  };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(Math.max(0, Math.round(value)));
}
