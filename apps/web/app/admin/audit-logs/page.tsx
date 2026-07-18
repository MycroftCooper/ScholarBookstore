"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { UserAvatar } from "@/components/users/UserAvatar";
import { ApiError } from "@/lib/api/client";
import { listAdminUsers } from "@/lib/api/adminUsers";
import type { CurrentUser } from "@/lib/api/auth";
import { listDomains, type DomainSummary } from "@/lib/api/domains";
import { listModules, type ModuleSummary } from "@/lib/api/modules";
import {
  listAuditLogs,
  type AuditLog,
  type AuditLogFilter,
} from "@/lib/api/auditLogs";

const actionLabel: Record<string, string> = {
  article_review_approved: "审核通过文章",
  article_review_rejected: "驳回文章",
  article_archived: "归档文章",
  article_restored: "恢复文章",
  article_featured_update: "更新文章精选",
  content_report_take_down: "处理举报并下架",
  content_report_ignore: "忽略举报",
  content_report_resolved: "处理文章举报",
  comment_report_resolved: "处理评论举报",
  comment_report_ignored: "忽略评论举报",
  user_report_user_disabled: "处理用户举报并禁用",
  user_report_ignored: "忽略用户举报",
  user_report_resolved: "处理用户举报",
  task_article_approved: "待办审核通过",
  task_article_rejected: "待办审核驳回",
  task_article_taken_down: "待办文章下架",
  task_report_taken_down: "待办举报下架",
  task_report_ignored: "待办举报忽略",
  domain_created: "创建领域",
  domain_updated: "更新领域",
  domain_owner_add: "授予领域领主",
  domain_owner_remove: "移除领域领主",
  module_created: "创建版块",
  module_updated: "更新版块",
  module_deleted: "删除版块",
  module_moderator_add: "授予版块版主",
  module_moderator_remove: "移除版块版主",
  user_update: "更新用户",
  comment_hidden: "隐藏评论",
  comment_shown: "恢复评论",
  comment_deleted: "删除评论",
  report_resolved: "处理举报",
  tag_updated: "更新标签",
  tag_deleted: "删除标签",
  tag_merged: "合并标签",
};

const highRiskActions = new Set([
  "article_archived",
  "module_deleted",
  "domain_owner_remove",
  "module_moderator_remove",
  "user_update",
  "comment_deleted",
  "content_report_take_down",
  "user_report_user_disabled",
  "content_report_resolved",
  "comment_report_resolved",
  "task_article_taken_down",
  "task_report_taken_down",
]);

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<CurrentUser[]>([]);
  const [domains, setDomains] = useState<DomainSummary[]>([]);
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [filter, setFilter] = useState<AuditLogFilter>({ pageSize: 100 });
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load(nextFilter = filter, keepSelectedId = selectedId) {
    setLoading(true);
    setError("");
    try {
      const [nextLogs, nextUsers, nextDomains, nextModules] = await Promise.all([
        listAuditLogs({ ...nextFilter, pageSize: 100 }),
        listAdminUsers({ pageSize: 100 }),
        listDomains(true),
        listModules(true),
      ]);
      setLogs(nextLogs);
      setUsers(nextUsers);
      setDomains(nextDomains);
      setModules(nextModules);
      const nextSelected = nextLogs.find((log) => log.id === keepSelectedId) ?? nextLogs[0] ?? null;
      setSelectedId(nextSelected?.id ?? null);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        window.location.href = "/login";
        return;
      }
      setError(err instanceof ApiError ? err.message : "操作记录加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredLogs = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return logs;
    return logs.filter((log) => {
      const haystack = [
        actionText(log.action),
        log.action,
        log.actorName ?? "",
        log.targetType,
        String(log.targetId),
        log.domainName ?? "",
        log.moduleName ?? "",
        log.ip,
        log.userAgent,
        ...Object.values(log.detail ?? {}),
      ].join(" ").toLowerCase();
      return haystack.includes(keyword);
    });
  }, [logs, query]);

  const selected = filteredLogs.find((log) => log.id === selectedId) ?? filteredLogs[0] ?? null;
  const stats = useMemo(() => {
    const today = filteredLogs.filter((log) => sameDay(log.createdAt, new Date()));
    return {
      today: today.length,
      reviews: filteredLogs.filter((log) => log.action.includes("review") || log.action.includes("approve") || log.action.includes("reject")).length,
      permission: filteredLogs.filter((log) => log.action.includes("owner") || log.action.includes("moderator") || log.action.includes("user_update")).length,
      takedown: filteredLogs.filter((log) => log.action.includes("archive") || log.action.includes("take_down") || log.action.includes("deleted")).length,
      highRisk: filteredLogs.filter((log) => isHighRisk(log)).length,
    };
  }, [filteredLogs]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    load(filter);
  }

  function reset() {
    const next = { pageSize: 100 };
    setFilter(next);
    setQuery("");
    load(next);
  }

  function exportCsv() {
    const header = ["时间", "操作人", "动作", "目标类型", "目标ID", "领域", "版块", "IP", "详情"];
    const rows = filteredLogs.map((log) => [
      formatDate(log.createdAt),
      log.actorName ?? `#${log.actorId ?? "-"}`,
      actionText(log.action),
      log.targetType,
      String(log.targetId),
      log.domainName ?? "",
      log.moduleName ?? "",
      log.ip,
      JSON.stringify(log.detail ?? {}),
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminShell active="audit" title="操作日志">
      <div className="grid gap-5">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard title="今日操作数" value={stats.today} hint="按当前结果计算" />
          <MetricCard title="审核操作" value={stats.reviews} hint="审核/通过/驳回" tone="success" />
          <MetricCard title="权限变更" value={stats.permission} hint="用户/领主/版主" tone="warning" />
          <MetricCard title="下架记录" value={stats.takedown} hint="归档/删除/下架" tone="warning" />
          <MetricCard title="高风险提醒" value={stats.highRisk} hint="需重点关注" tone="danger" />
        </div>

        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_430px]">
          <section className="min-w-0 overflow-hidden rounded-2xl border border-[#e6e9ef] bg-white shadow-[0_10px_30px_rgba(17,24,39,0.035)]">
            <form onSubmit={submit} className="grid gap-3 border-b border-[#eef1f5] bg-white p-5 md:grid-cols-[minmax(0,1fr)_160px_150px_150px_150px_auto_auto]">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-12 rounded-xl border border-[#e6e9ef] bg-white px-4 text-sm outline-none focus:border-[#f8c400]"
                placeholder="搜索操作人 / 目标对象 / 操作内容"
              />
              <Select value={filter.action ?? ""} onChange={(value) => setFilter((current) => ({ ...current, action: value }))}>
                <option value="">操作类型：全部</option>
                {knownActions(logs).map((action) => (
                  <option key={action} value={action}>{actionText(action)}</option>
                ))}
              </Select>
              <Select value={filter.actorId ?? ""} onChange={(value) => setFilter((current) => ({ ...current, actorId: value }))}>
                <option value="">操作人：全部</option>
                {users.map((user) => <option key={user.id} value={user.id}>{user.username}</option>)}
              </Select>
              <Select value={filter.targetType ?? ""} onChange={(value) => setFilter((current) => ({ ...current, targetType: value }))}>
                <option value="">目标类型：全部</option>
                {knownTargets(logs).map((target) => <option key={target} value={target}>{target}</option>)}
              </Select>
              <Select value={filter.domainId ?? ""} onChange={(value) => setFilter((current) => ({ ...current, domainId: value }))}>
                <option value="">领域：全部</option>
                {domains.map((domain) => <option key={domain.id} value={domain.id}>{domain.name}</option>)}
              </Select>
              <button type="submit" className="h-12 rounded-xl border border-[#e6e9ef] bg-white px-4 text-sm font-bold text-[#374151]">刷新</button>
              <button type="button" onClick={reset} className="h-12 rounded-xl border border-[#e6e9ef] bg-white px-4 text-sm font-bold text-[#374151]">重置</button>
              <button type="button" onClick={exportCsv} className="h-12 rounded-xl bg-[#f8c400] px-5 text-sm font-black text-[#111827] md:col-start-7">导出日志</button>
            </form>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] table-fixed text-sm">
                <colgroup>
                  <col className="w-[170px]" />
                  <col className="w-[150px]" />
                  <col className="w-[120px]" />
                  <col className="w-[170px]" />
                  <col />
                  <col className="w-[170px]" />
                  <col className="w-[80px]" />
                  <col className="w-[120px]" />
                  <col className="w-[70px]" />
                </colgroup>
                <thead className="bg-[#fbfcfd] text-left text-xs font-semibold text-[#8a93a3]">
                  <tr>
                    <Th>时间</Th>
                    <Th>操作人</Th>
                    <Th>角色</Th>
                    <Th>操作类型</Th>
                    <Th>目标对象</Th>
                    <Th>所属领域/版块</Th>
                    <Th>结果</Th>
                    <Th>IP</Th>
                    <Th>详情</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => {
                    const active = selected?.id === log.id;
                    return (
                      <tr key={log.id} className={`border-t border-[#eef1f5] ${active ? "bg-[#fffaf0] outline outline-1 outline-[#f8c400]" : "hover:bg-[#fbfcfd]"}`}>
                        <Td>{formatDate(log.createdAt)}</Td>
                        <Td>
                          <button type="button" onClick={() => setSelectedId(log.id)} className="flex min-w-0 items-center gap-3 text-left">
                            <UserAvatar username={log.actorName ?? "system"} avatarUrl="" size="sm" />
                            <span className="min-w-0">
                              <span className="block truncate font-black text-[#111827]">{log.actorName ?? "系统"}</span>
                              <span className="block truncate text-xs text-[#8a93a3]">#{log.actorId ?? "-"}</span>
                            </span>
                          </button>
                        </Td>
                        <Td>{actorRole(log, users)}</Td>
                        <Td><ActionName log={log} /></Td>
                        <Td>{targetText(log)}</Td>
                        <Td>{scopeText(log)}</Td>
                        <Td><span className="font-bold text-[#16a34a]">成功</span></Td>
                        <Td>{log.ip || "-"}</Td>
                        <Td>
                          <button type="button" onClick={() => setSelectedId(log.id)} className="grid size-8 place-items-center rounded-lg border border-[#e6e9ef] text-[#667085] hover:border-[#f8c400]">
                            ⊙
                          </button>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!loading && filteredLogs.length === 0 && (
                <div className="border-t border-[#eef1f5] p-10 text-center text-sm text-[#8a93a3]">暂无操作记录</div>
              )}
              {loading && <div className="border-t border-[#eef1f5] p-10 text-center text-sm text-[#8a93a3]">正在加载...</div>}
            </div>
            <div className="flex items-center justify-between border-t border-[#eef1f5] px-5 py-4 text-sm text-[#8a93a3]">
              <span>共 {filteredLogs.length} 条</span>
              <span>最多显示 100 条/页</span>
            </div>
          </section>

          <aside className="grid gap-5">
            <AuditDetail log={selected} users={users} />
            <RiskPanel logs={filteredLogs} onSelect={setSelectedId} />
          </aside>
        </div>
      </div>
    </AdminShell>
  );
}

function AuditDetail({ log, users }: { log: AuditLog | null; users: CurrentUser[] }) {
  if (!log) {
    return <section className="rounded-2xl border border-[#e6e9ef] bg-white p-6 text-sm text-[#8a93a3]">请选择一条操作记录</section>;
  }
  return (
    <section className="rounded-2xl border border-[#e6e9ef] bg-white p-5 shadow-[0_10px_30px_rgba(17,24,39,0.035)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-black text-[#111827]">操作详情</h2>
        <span className="text-[#8a93a3]">×</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="rounded-md bg-[#fffaf0] px-2 py-1 text-xs font-bold text-[#b45309]">{actionText(log.action)}</span>
        <span className="rounded-md bg-green-50 px-2 py-1 text-xs font-bold text-green-600">成功</span>
        <span className="ml-auto text-xs text-[#8a93a3]">{formatDate(log.createdAt)}</span>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <UserAvatar username={log.actorName ?? "system"} avatarUrl="" size="sm" />
        <div>
          <div className="font-black text-[#111827]">{log.actorName ?? "系统"}</div>
          <div className="text-sm text-[#8a93a3]">{actorRole(log, users)} · IP {log.ip || "-"}</div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-[1fr_auto_1fr] gap-3">
        <ChangeBox title="操作对象" items={[["类型", log.targetType], ["ID", String(log.targetId)], ["范围", scopeText(log)]]} />
        <div className="grid place-items-center text-[#f8c400]">→</div>
        <ChangeBox title="操作结果" items={[["结果", "成功"], ["动作", actionText(log.action)], ["时间", formatDate(log.createdAt)]]} />
      </div>

      <section className="mt-5 rounded-xl border border-[#eef1f5] p-4">
        <h3 className="mb-3 text-sm font-black text-[#111827]">审计详情</h3>
        <div className="grid gap-2 text-sm">
          {Object.entries(log.detail ?? {}).map(([key, value]) => (
            <div key={key} className="grid grid-cols-[120px_1fr] gap-3">
              <span className="text-[#8a93a3]">{key}</span>
              <span className="break-words font-semibold text-[#374151]">{String(value)}</span>
            </div>
          ))}
          {Object.keys(log.detail ?? {}).length === 0 && <div className="text-[#8a93a3]">无额外详情</div>}
        </div>
      </section>

      <section className="mt-5 rounded-xl border border-[#eef1f5] p-4">
        <h3 className="mb-3 text-sm font-black text-[#111827]">环境信息</h3>
        <div className="grid gap-2 text-sm">
          <Info label="User-Agent" value={log.userAgent || "-"} />
          <Info label="目标" value={targetText(log)} />
        </div>
      </section>

      {targetHref(log) && (
        <Link href={targetHref(log)!} className="mt-4 grid h-11 place-items-center rounded-xl border border-[#e6e9ef] text-sm font-bold text-[#374151]">
          查看相关对象
        </Link>
      )}
    </section>
  );
}

function RiskPanel({ logs, onSelect }: { logs: AuditLog[]; onSelect: (id: number) => void }) {
  const risks = logs.filter(isHighRisk).slice(0, 7);
  return (
    <section className="rounded-2xl border border-red-100 bg-red-50/40 p-5 shadow-[0_10px_30px_rgba(17,24,39,0.035)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-black text-[#111827]">高风险操作预警</h2>
        <span className="text-sm text-[#ef4444]">{risks.length} 条</span>
      </div>
      <div className="grid gap-3 text-sm">
        {risks.map((log) => (
          <button key={log.id} type="button" className="grid grid-cols-[1fr_auto] gap-3 text-left" onClick={() => onSelect(log.id)}>
            <span className="truncate font-semibold text-[#374151]">△ {actionText(log.action)} · {targetText(log)}</span>
            <span className="text-xs text-[#8a93a3]">{formatTime(log.createdAt)}</span>
          </button>
        ))}
        {risks.length === 0 && <div className="text-[#8a93a3]">当前结果中暂无高风险操作</div>}
      </div>
      <Link href="/admin/tasks" className="mt-5 grid h-11 place-items-center rounded-xl border border-red-100 bg-white text-sm font-bold text-[#667085]">
        前往风险操作审计中心
      </Link>
    </section>
  );
}

function MetricCard({ title, value, hint, tone = "normal" }: { title: string; value: number; hint: string; tone?: "normal" | "success" | "warning" | "danger" }) {
  const color = tone === "danger" ? "text-[#ef4444]" : tone === "warning" ? "text-[#f59e0b]" : tone === "success" ? "text-[#16a34a]" : "text-[#111827]";
  return (
    <section className="rounded-2xl border border-[#e6e9ef] bg-white p-5 shadow-[0_10px_30px_rgba(17,24,39,0.035)]">
      <div className="text-sm font-semibold text-[#4b5563]">{title}</div>
      <div className={`mt-3 text-3xl font-black ${color}`}>{formatNumber(value)}</div>
      <div className="mt-2 text-xs text-[#8a93a3]">{hint}</div>
    </section>
  );
}

function ActionName({ log }: { log: AuditLog }) {
  const risk = isHighRisk(log);
  return (
    <span className="inline-flex items-center gap-2 font-semibold text-[#374151]">
      <span className={risk ? "text-[#ef4444]" : "text-[#16a34a]"}>●</span>
      {actionText(log.action)}
    </span>
  );
}

function ChangeBox({ title, items }: { title: string; items: Array<[string, string]> }) {
  return (
    <div className="rounded-xl border border-[#eef1f5] bg-[#fbfcfd] p-4 text-sm">
      <h3 className="mb-3 font-black text-[#111827]">{title}</h3>
      <div className="grid gap-2">
        {items.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[64px_1fr] gap-2">
            <span className="text-[#8a93a3]">{label}</span>
            <span className="break-words font-semibold text-[#374151]">{value || "-"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Select({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="h-12 min-w-0 rounded-xl border border-[#e6e9ef] bg-white px-4 text-sm font-semibold text-[#374151] outline-none focus:border-[#f8c400]">
      {children}
    </select>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs text-[#8a93a3]">{label}</span>
      <span className="break-words font-semibold text-[#374151]">{value}</span>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-semibold">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-middle text-[#667085]">{children}</td>;
}

function knownActions(logs: AuditLog[]) {
  return Array.from(new Set(logs.map((log) => log.action))).sort();
}

function knownTargets(logs: AuditLog[]) {
  return Array.from(new Set(logs.map((log) => log.targetType))).sort();
}

function actionText(action: string) {
  return actionLabel[action] ?? action;
}

function targetText(log: AuditLog) {
  const title = log.detail?.title || log.detail?.objectTitle || log.detail?.target || "";
  return `${log.targetType} #${log.targetId}${title ? ` · ${title}` : ""}`;
}

function scopeText(log: AuditLog) {
  if (log.domainName && log.moduleName) return `${log.domainName} / ${log.moduleName}`;
  if (log.moduleName) return log.moduleName;
  if (log.domainName) return log.domainName;
  return "-";
}

function actorRole(log: AuditLog, users: CurrentUser[]) {
  const user = users.find((item) => item.id === log.actorId);
  if (!user) return log.actorId ? "成员" : "系统";
  return user.role === "admin" ? "管理员" : user.role === "reviewer" ? "审核员" : "成员";
}

function isHighRisk(log: AuditLog) {
  return highRiskActions.has(log.action) || log.action.includes("remove") || log.action.includes("deleted");
}

function targetHref(log: AuditLog) {
  if (log.targetType === "article") return `/articles/${log.targetId}`;
  if (log.targetType === "user" && log.actorName) return `/authors/${log.actorName}`;
  if (log.targetType === "module" && log.moduleName) return "/admin/modules";
  if (log.targetType === "domain") return "/admin/domains";
  return "";
}

function sameDay(value: string, day: Date) {
  const date = new Date(value);
  return date.getFullYear() === day.getFullYear() && date.getMonth() === day.getMonth() && date.getDate() === day.getDate();
}

function csvCell(value: string) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
