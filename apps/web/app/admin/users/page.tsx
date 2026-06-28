"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { UserAvatar } from "@/components/users/UserAvatar";
import { listAdminArticles, type ArticleSummary } from "@/lib/api/articles";
import { listAdminUsers, updateAdminUser } from "@/lib/api/adminUsers";
import type { CurrentUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

type StatusFilter = CurrentUser["status"] | "";

const statusLabel: Record<CurrentUser["status"], string> = {
  active: "正常",
  disabled: "封禁",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<CurrentUser[]>([]);
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [openActionId, setOpenActionId] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("");
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(keepSelectedId = selectedId) {
    setError("");
    const [nextUsers, nextArticles] = await Promise.all([
      listAdminUsers({ q, status, pageSize: 100 }),
      listAdminArticles(undefined, 100),
    ]);
    setUsers(nextUsers);
    setArticles(nextArticles);
    const nextSelected = nextUsers.find((user) => user.id === keepSelectedId) ?? nextUsers[0] ?? null;
    setSelectedId(nextSelected?.id ?? null);
  }

  useEffect(() => {
    load()
      .catch((err) => {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          window.location.href = "/login";
          return;
        }
        setError("用户数据加载失败");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => deriveUsers(users, articles), [articles, users]);
  const selected = rows.find((row) => row.user.id === selectedId) ?? rows[0] ?? null;
  const stats = useMemo(
    () => ({
      total: rows.length,
      today: rows.filter((row) => daysAgo(row.user.createdAt) === 0).length,
      active: rows.filter((row) => row.user.status === "active").length,
      disabled: rows.filter((row) => row.user.status === "disabled").length,
      authors: rows.filter((row) => row.articleCount > 0).length,
    }),
    [rows],
  );

  async function applyFilters() {
    setLoading(true);
    try {
      await load(selectedId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "用户数据加载失败");
    } finally {
      setLoading(false);
    }
  }

  async function updateUserStatus(id: number, nextStatus: CurrentUser["status"]) {
    setActingId(id);
    setError("");
    try {
      await updateAdminUser(id, { status: nextStatus });
      setOpenActionId(null);
      await load(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "操作失败");
    } finally {
      setActingId(null);
    }
  }

  function selectUser(row: UserRow) {
    setSelectedId(row.user.id);
  }

  return (
    <AdminShell active="users" title="用户管理">
      <div className="grid gap-5">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard title="用户总数" value={stats.total} hint="当前筛选样本" />
          <MetricCard title="今日新增用户" value={stats.today} hint="按注册时间计算" tone="success" />
          <MetricCard title="正常用户" value={stats.active} hint="状态为 active" tone="success" />
          <MetricCard title="被禁用用户" value={stats.disabled} hint="状态为 disabled" tone="danger" />
          <MetricCard title="有发文用户" value={stats.authors} hint="当前样本内作者" tone="warning" />
        </div>

        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_460px]">
          <div className="min-w-0 overflow-hidden rounded-2xl border border-[#e6e9ef] bg-white shadow-[0_10px_30px_rgba(17,24,39,0.035)]">
            <div className="grid gap-3 border-b border-[#eef1f5] bg-white p-5 md:grid-cols-[minmax(0,1fr)_160px_auto]">
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                className="h-12 rounded-xl border border-[#e6e9ef] bg-white px-4 text-sm outline-none focus:border-[#f8c400]"
                placeholder="搜索昵称、UID、邮箱..."
              />
              <Select value={status} onChange={(value) => setStatus(value as StatusFilter)}>
                <option value="">全部状态</option>
                <option value="active">正常</option>
                <option value="disabled">封禁</option>
              </Select>
              <button type="button" onClick={applyFilters} className="h-12 rounded-xl bg-[#f8c400] px-6 text-sm font-black text-[#111827]">
                查询
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] table-fixed text-sm">
                <colgroup>
                  <col className="w-[42px]" />
                  <col />
                  <col className="w-[106px]" />
                  <col className="w-[150px]" />
                  <col className="w-[106px]" />
                  <col className="w-[106px]" />
                  <col className="w-[150px]" />
                  <col className="w-[92px]" />
                  <col className="w-[80px]" />
                </colgroup>
                <thead className="bg-[#fbfcfd] text-left text-xs font-semibold text-[#8a93a3]">
                  <tr>
                    <Th />
                    <Th>用户</Th>
                    <Th>UID</Th>
                    <Th>注册时间</Th>
                    <Th>发文数</Th>
                    <Th>阅读量</Th>
                    <Th>最近活跃</Th>
                    <Th>状态</Th>
                    <Th>操作</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const active = selected?.user.id === row.user.id;
                    return (
                      <Fragment key={row.user.id}>
                        <tr className={`border-t border-[#eef1f5] ${active ? "bg-[#fffaf0] outline outline-1 outline-[#f8c400]" : "hover:bg-[#fbfcfd]"}`}>
                          <Td>
                            <input checked={active} onChange={() => selectUser(row)} type="checkbox" className="size-4 rounded border-[#d8dde6] accent-[#f8c400]" />
                          </Td>
                          <Td>
                            <button type="button" onClick={() => selectUser(row)} className="flex min-w-0 items-center gap-3 text-left">
                              <UserAvatar username={row.user.username} avatarUrl={row.user.avatarUrl} size="sm" />
                              <span className="min-w-0">
                                <span className="block truncate font-black text-[#111827]">{row.user.username}</span>
                                <span className="block truncate text-xs text-[#8a93a3]">@{row.user.username.toLowerCase()}</span>
                              </span>
                            </button>
                          </Td>
                          <Td>{String(10000000 + row.user.id)}</Td>
                          <Td>{formatDate(row.user.createdAt)}</Td>
                          <Td>{formatNumber(row.articleCount)}</Td>
                          <Td>{formatNumber(row.viewCount)}</Td>
                          <Td>{formatDate(row.lastActiveAt)}</Td>
                          <Td><StatusBadge status={row.user.status} /></Td>
                          <Td>
                            <button
                              type="button"
                              onClick={() => {
                                selectUser(row);
                                setOpenActionId((current) => (current === row.user.id ? null : row.user.id));
                              }}
                              className="grid size-8 place-items-center rounded-lg border border-[#e6e9ef] text-[#667085] hover:border-[#f8c400]"
                              aria-expanded={openActionId === row.user.id}
                              aria-label={`${row.user.username} 操作`}
                            >
                              ...
                            </button>
                          </Td>
                        </tr>
                        {openActionId === row.user.id && (
                          <tr className="border-t border-[#f7e4a2] bg-[#fffdf5]">
                            <td colSpan={9} className="px-4 py-3">
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <span className="mr-auto text-sm font-semibold text-[#667085]">正在操作：{row.user.username}</span>
                                <ActionButton onClick={() => selectUser(row)}>查看详情</ActionButton>
                                <Link href={`/authors/${row.user.username}`} className="grid h-9 place-items-center rounded-lg border border-[#e6e9ef] bg-white px-4 text-sm font-bold text-[#374151] hover:border-[#f8c400]">
                                  查看主页
                                </Link>
                                <ActionButton danger disabled={actingId === row.user.id} onClick={() => updateUserStatus(row.user.id, row.user.status === "active" ? "disabled" : "active")}>
                                  {row.user.status === "active" ? "封禁" : "解封"}
                                </ActionButton>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
              {!loading && rows.length === 0 && (
                <div className="border-t border-[#eef1f5] p-10 text-center text-sm text-[#8a93a3]">暂无匹配用户</div>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-[#eef1f5] px-5 py-4 text-sm text-[#8a93a3]">
              <span>共 {rows.length} 条</span>
              <span>最多显示 100 条/页</span>
            </div>
          </div>

          <UserDetail
            row={selected}
            acting={actingId === selected?.user.id}
            onToggleStatus={() => selected && updateUserStatus(selected.user.id, selected.user.status === "active" ? "disabled" : "active")}
            onResetStatus={() => selected && updateUserStatus(selected.user.id, "active")}
          />
        </div>
      </div>
    </AdminShell>
  );
}

type UserRow = ReturnType<typeof deriveUsers>[number];

function deriveUsers(users: CurrentUser[], articles: ArticleSummary[]) {
  return users.map((user) => {
    const userArticles = articles.filter((article) => article.authorId === user.id);
    return {
      user,
      articles: userArticles,
      articleCount: userArticles.length,
      viewCount: userArticles.reduce((sum, article) => sum + article.viewCount, 0),
      featuredCount: userArticles.filter((article) => article.isFeatured).length,
      pendingCount: userArticles.filter((article) => article.status === "pending_review").length,
      lastActiveAt: latestDate(userArticles.map((article) => article.updatedAt)) ?? user.createdAt,
      recentArticles: userArticles
        .slice()
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 3),
    };
  });
}

function UserDetail({
  row,
  acting,
  onToggleStatus,
  onResetStatus,
}: {
  row: UserRow | null;
  acting: boolean;
  onToggleStatus: () => void;
  onResetStatus: () => void;
}) {
  if (!row) {
    return <aside className="rounded-2xl border border-[#e6e9ef] bg-white p-6 text-sm text-[#8a93a3]">请选择用户查看详情</aside>;
  }
  return (
    <aside className="grid gap-5">
      <section className="rounded-2xl border border-[#e6e9ef] bg-white shadow-[0_10px_30px_rgba(17,24,39,0.035)]">
        <div className="flex items-start gap-4 border-b border-[#eef1f5] p-5">
          <UserAvatar username={row.user.username} avatarUrl={row.user.avatarUrl} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-xl font-black text-[#111827]">{row.user.username}</h2>
              <StatusBadge status={row.user.status} />
            </div>
            <div className="mt-1 text-sm text-[#8a93a3]">@{row.user.username.toLowerCase()}</div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <Badge tone="dark">UID: {10000000 + row.user.id}</Badge>
              <Badge>注册 {formatDateShort(row.user.createdAt)}</Badge>
            </div>
          </div>
        </div>

        <div className="grid gap-5 p-5">
          <section>
            <h3 className="mb-3 font-black text-[#111827]">账号信息</h3>
            <div className="grid gap-3 text-sm">
              <Info label="邮箱" value={row.user.email} />
              <Info label="学校" value={row.user.school || "-"} />
              <Info label="公司" value={row.user.company || "-"} />
              <Info label="自我介绍" value={row.user.bio || "暂无简介"} />
            </div>
          </section>

          <section className="border-t border-[#eef1f5] pt-4">
            <h3 className="mb-3 font-black text-[#111827]">内容统计</h3>
            <div className="grid grid-cols-4 gap-3 text-sm">
              <Info label="发文数" value={formatNumber(row.articleCount)} />
              <Info label="阅读量" value={formatNumber(row.viewCount)} />
              <Info label="精选数" value={formatNumber(row.featuredCount)} />
              <Info label="待审核" value={formatNumber(row.pendingCount)} />
            </div>
          </section>

          <section className="border-t border-[#eef1f5] pt-4">
            <h3 className="mb-3 font-black text-[#111827]">最近内容</h3>
            <div className="grid gap-3 text-sm">
              {row.recentArticles.map((article) => (
                <Link key={article.id} href={`/articles/${article.id}`} className="grid grid-cols-[1fr_auto] gap-3 rounded-xl bg-[#fbfcfd] p-3 hover:bg-[#fffaf0]">
                  <span className="truncate font-semibold text-[#374151]">{article.title}</span>
                  <span className="text-xs text-[#8a93a3]">{formatDateShort(article.updatedAt)}</span>
                </Link>
              ))}
              {row.recentArticles.length === 0 && <div className="text-[#8a93a3]">暂无真实内容记录</div>}
            </div>
          </section>
        </div>
      </section>

      <section className="rounded-2xl border border-[#e6e9ef] bg-white p-5 shadow-[0_10px_30px_rgba(17,24,39,0.035)]">
        <h3 className="mb-4 font-black text-[#111827]">账号操作</h3>
        <div className="grid grid-cols-2 gap-3">
          <Link href={`/authors/${row.user.username}`} className="grid h-11 place-items-center rounded-xl border border-[#e6e9ef] text-sm font-bold text-[#374151]">查看主页</Link>
          <button type="button" disabled={acting} onClick={onResetStatus} className="h-11 rounded-xl border border-[#e6e9ef] text-sm font-bold text-[#374151] disabled:opacity-50">重置状态</button>
          <button type="button" disabled={acting} onClick={onToggleStatus} className="col-span-2 h-11 rounded-xl border border-red-200 bg-red-50 text-sm font-bold text-[#ef4444] disabled:opacity-50">
            {row.user.status === "active" ? "封禁" : "解封"}
          </button>
        </div>
      </section>
    </aside>
  );
}

function MetricCard({ title, value, hint, tone = "normal" }: { title: string; value: number; hint: string; tone?: "normal" | "success" | "danger" | "warning" }) {
  const color = tone === "danger" ? "text-[#ef4444]" : tone === "warning" ? "text-[#f59e0b]" : tone === "success" ? "text-[#16a34a]" : "text-[#111827]";
  return (
    <section className="rounded-2xl border border-[#e6e9ef] bg-white p-5 shadow-[0_10px_30px_rgba(17,24,39,0.035)]">
      <div className="text-sm font-semibold text-[#4b5563]">{title}</div>
      <div className={`mt-3 text-3xl font-black ${color}`}>{formatNumber(value)}</div>
      <div className="mt-2 text-xs text-[#8a93a3]">{hint}</div>
    </section>
  );
}

function StatusBadge({ status }: { status: CurrentUser["status"] }) {
  const className = status === "active" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600";
  return <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-bold ${className}`}>{statusLabel[status]}</span>;
}

function Badge({ children, tone = "normal" }: { children: React.ReactNode; tone?: "normal" | "dark" }) {
  const className = tone === "dark" ? "border-[#e6e9ef] bg-[#111827] text-white" : "border-[#e6e9ef] bg-[#fbfcfd] text-[#667085]";
  return <span className={`rounded-md border px-2 py-1 text-xs font-bold ${className}`}>{children}</span>;
}

function Select({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="h-12 min-w-0 rounded-xl border border-[#e6e9ef] bg-white px-4 text-sm font-semibold text-[#374151] outline-none focus:border-[#f8c400]">
      {children}
    </select>
  );
}

function ActionButton({ children, danger, disabled, onClick }: { children: React.ReactNode; danger?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        danger
          ? "h-9 rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-bold text-[#ef4444] disabled:opacity-50"
          : "h-9 rounded-lg border border-[#e6e9ef] bg-white px-4 text-sm font-bold text-[#374151] hover:border-[#f8c400] disabled:opacity-50"
      }
    >
      {children}
    </button>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-xs text-[#8a93a3]">{label}</div>
      <div className="mt-1 truncate font-bold text-[#374151]">{value}</div>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-4 py-3 font-semibold">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-middle text-[#667085]">{children}</td>;
}

function latestDate(values: string[]) {
  const times = values.map((value) => new Date(value).getTime()).filter(Number.isFinite);
  if (times.length === 0) return null;
  return new Date(Math.max(...times)).toISOString();
}

function daysAgo(value: string) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - time) / 86400000);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatDateShort(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
