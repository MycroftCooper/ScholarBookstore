"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { ApiError } from "@/lib/api/client";
import { getCurrentUser } from "@/lib/api/auth";
import { deleteAllErrorLogs, deleteErrorLog, listErrorLogs, type ErrorLog, type ErrorLogFilter } from "@/lib/api/errorLogs";

export default function AdminErrorLogsPage() {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [filter, setFilter] = useState<ErrorLogFilter>({ pageSize: 100 });
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load(nextFilter = filter, keepSelectedId = selectedId) {
    setLoading(true);
    setError("");
    try {
      const nextLogs = await listErrorLogs({ ...nextFilter, pageSize: 100 });
      setLogs(nextLogs);
      const nextSelected = nextLogs.find((item) => item.id === keepSelectedId) ?? nextLogs[0] ?? null;
      setSelectedId(nextSelected?.id ?? null);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        window.location.href = "/login";
        return;
      }
      setError(err instanceof ApiError ? err.message : "错误日志加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        if (user.role !== "admin") {
          window.location.href = "/admin/tasks";
          return;
        }
        load();
      })
      .catch(() => {
        window.location.href = "/login";
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredLogs = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return logs;
    return logs.filter((log) => {
      const haystack = [
        log.message,
        log.stack,
        log.username ?? "",
        log.path,
        log.source,
        log.fingerprint,
        log.requestId,
        log.ip,
        log.userAgent,
        ...Object.values(log.metadata ?? {}),
      ].join(" ").toLowerCase();
      return haystack.includes(keyword);
    });
  }, [logs, query]);

  const selected = filteredLogs.find((item) => item.id === selectedId) ?? filteredLogs[0] ?? null;
  const stats = useMemo(() => ({
    groups: filteredLogs.length,
    occurrences: filteredLogs.reduce((sum, item) => sum + item.occurrenceCount, 0),
    client: filteredLogs.filter((item) => item.source === "client").length,
    server: filteredLogs.filter((item) => item.source === "server").length,
  }), [filteredLogs]);

  function updateSource(source: string) {
    const next = { ...filter, source: source || undefined };
    setFilter(next);
    load(next);
  }

  async function handleDeleteLog(log: ErrorLog) {
    const ok = window.confirm(`确定删除这组错误吗？\n\n${log.message}\n\n删除后如果同样错误再次出现，会重新生成一条记录。`);
    if (!ok) return;
    setError("");
    try {
      await deleteErrorLog(log.id);
      await load(filter, selectedId === log.id ? null : selectedId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "删除错误日志失败");
    }
  }

  async function handleDeleteAll() {
    const ok = window.confirm("确定清空全部错误日志吗？\n\n这个操作会删除所有错误组和累计次数，适合修复后重新观察是否复发。");
    if (!ok) return;
    const secondOk = window.confirm("请再次确认：要清空整个错误日志数据库吗？");
    if (!secondOk) return;
    setError("");
    try {
      await deleteAllErrorLogs();
      setSelectedId(null);
      await load(filter, null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "清空错误日志失败");
    }
  }

  return (
    <AdminShell active="errors" title="错误日志">
      <div className="grid gap-5">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <div className="grid gap-4 md:grid-cols-4">
          <Metric title="错误组" value={stats.groups} hint="已按堆栈去重" />
          <Metric title="累计次数" value={stats.occurrences} hint="同组错误累计发生" tone="danger" />
          <Metric title="前端组" value={stats.client} hint="浏览器和渲染错误" />
          <Metric title="后端组" value={stats.server} hint="服务端 panic" />
        </div>

        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_520px]">
          <section className="min-w-0 overflow-hidden rounded-2xl border border-[#e6e9ef] bg-white shadow-[0_10px_30px_rgba(17,24,39,0.035)]">
            <div className="grid gap-3 border-b border-[#eef1f5] p-5 md:grid-cols-[minmax(0,1fr)_160px_auto_auto]">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-11 rounded-xl border border-[#e6e9ef] bg-white px-4 text-sm outline-none focus:border-[#f8c400]"
                placeholder="搜索消息、堆栈、路径、用户、指纹"
              />
              <select
                value={filter.source ?? ""}
                onChange={(event) => updateSource(event.target.value)}
                className="h-11 rounded-xl border border-[#e6e9ef] bg-white px-4 text-sm font-semibold text-[#374151] outline-none focus:border-[#f8c400]"
              >
                <option value="">来源：全部</option>
                <option value="client">前端</option>
                <option value="server">后端</option>
              </select>
              <button type="button" onClick={() => load(filter)} className="h-11 rounded-xl bg-[#f8c400] px-5 text-sm font-black text-[#111827]">
                刷新
              </button>
              <button type="button" onClick={handleDeleteAll} disabled={logs.length === 0} className="h-11 rounded-xl border border-red-200 bg-white px-5 text-sm font-black text-red-600 disabled:cursor-not-allowed disabled:opacity-50">
                清空全部
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] table-fixed text-sm">
                <colgroup>
                  <col className="w-[88px]" />
                  <col />
                  <col className="w-[92px]" />
                  <col className="w-[170px]" />
                  <col className="w-[140px]" />
                  <col className="w-[180px]" />
                  <col className="w-[128px]" />
                </colgroup>
                <thead className="bg-[#fbfcfd] text-left text-xs font-semibold text-[#8a93a3]">
                  <tr>
                    <Th>来源</Th>
                    <Th>错误</Th>
                    <Th>次数</Th>
                    <Th>用户</Th>
                    <Th>路径</Th>
                    <Th>最后发生</Th>
                    <Th>删除</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => {
                    const active = selected?.id === log.id;
                    return (
                      <tr key={log.id} className={`border-t border-[#eef1f5] ${active ? "bg-[#fffaf0] outline outline-1 outline-[#f8c400]" : "hover:bg-[#fbfcfd]"}`}>
                        <Td><SourceBadge source={log.source} /></Td>
                        <Td>
                          <button type="button" onClick={() => setSelectedId(log.id)} className="block max-w-full text-left">
                            <span className="block truncate font-black text-[#111827]">{log.message}</span>
                            <span className="block truncate text-xs text-[#8a93a3]">{log.fingerprint.slice(0, 12)}</span>
                          </button>
                        </Td>
                        <Td><span className="font-black text-[#ef4444]">{formatNumber(log.occurrenceCount)}</span></Td>
                        <Td>{log.username ?? (log.userId ? `#${log.userId}` : "匿名")}</Td>
                        <Td><span className="block truncate">{log.path || "-"}</span></Td>
                        <Td>{formatDate(log.lastSeenAt)}</Td>
                        <Td>
                          <button type="button" onClick={() => handleDeleteLog(log)} className="h-8 rounded-lg border border-red-200 px-3 text-xs font-bold text-red-600">
                            删除
                          </button>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {loading && <div className="border-t border-[#eef1f5] p-10 text-center text-sm text-[#8a93a3]">正在加载...</div>}
              {!loading && filteredLogs.length === 0 && <div className="border-t border-[#eef1f5] p-10 text-center text-sm text-[#8a93a3]">暂无错误日志</div>}
            </div>
          </section>

          <ErrorDetail log={selected} />
        </div>
      </div>
    </AdminShell>
  );
}

function ErrorDetail({ log }: { log: ErrorLog | null }) {
  if (!log) {
    return <section className="rounded-2xl border border-[#e6e9ef] bg-white p-6 text-sm text-[#8a93a3]">请选择一条错误日志</section>;
  }

  return (
    <section className="min-w-0 rounded-2xl border border-[#e6e9ef] bg-white p-5 shadow-[0_10px_30px_rgba(17,24,39,0.035)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-black text-[#111827]">错误详情</h2>
        <SourceBadge source={log.source} />
      </div>
      <div className="rounded-xl border border-red-100 bg-red-50 p-4">
        <div className="text-sm font-black text-red-700">{log.message}</div>
        <div className="mt-2 text-xs text-red-500">累计 {formatNumber(log.occurrenceCount)} 次</div>
      </div>

      <div className="mt-5 grid gap-3 text-sm">
        <Info label="指纹" value={log.fingerprint} />
        <Info label="首次发生" value={formatDate(log.firstSeenAt)} />
        <Info label="最后发生" value={formatDate(log.lastSeenAt)} />
        <Info label="最近用户" value={log.username ?? (log.userId ? `#${log.userId}` : "匿名")} />
        <Info label="最近请求" value={`${log.method || "-"} ${log.path || "-"}`} />
        <Info label="Request ID" value={log.requestId || "-"} />
        <Info label="IP" value={log.ip || "-"} />
        <Info label="User-Agent" value={log.userAgent || "-"} />
      </div>

      <section className="mt-5">
        <h3 className="mb-2 text-sm font-black text-[#111827]">堆栈</h3>
        <pre className="max-h-[360px] overflow-auto rounded-xl bg-[#111827] p-4 text-xs leading-5 text-[#e5e7eb]">
          {log.stack || "No stack"}
        </pre>
      </section>

      {Object.keys(log.metadata ?? {}).length > 0 && (
        <section className="mt-5">
          <h3 className="mb-2 text-sm font-black text-[#111827]">Metadata</h3>
          <div className="grid gap-2 rounded-xl border border-[#eef1f5] p-4 text-sm">
            {Object.entries(log.metadata).map(([key, value]) => (
              <div key={key} className="grid grid-cols-[120px_1fr] gap-3">
                <span className="text-[#8a93a3]">{key}</span>
                <span className="break-words font-semibold text-[#374151]">{value}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

function Metric({ title, value, hint, tone = "normal" }: { title: string; value: number; hint: string; tone?: "normal" | "danger" }) {
  return (
    <section className="rounded-2xl border border-[#e6e9ef] bg-white p-5 shadow-[0_10px_30px_rgba(17,24,39,0.035)]">
      <div className="text-sm font-semibold text-[#4b5563]">{title}</div>
      <div className={`mt-3 text-3xl font-black ${tone === "danger" ? "text-[#ef4444]" : "text-[#111827]"}`}>{formatNumber(value)}</div>
      <div className="mt-2 text-xs text-[#8a93a3]">{hint}</div>
    </section>
  );
}

function SourceBadge({ source }: { source: ErrorLog["source"] }) {
  const className = source === "server" ? "border-orange-200 bg-orange-50 text-orange-700" : "border-blue-200 bg-blue-50 text-blue-700";
  return <span className={`rounded-md border px-2 py-1 text-xs font-black ${className}`}>{source === "server" ? "后端" : "前端"}</span>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold text-[#8a93a3]">{label}</div>
      <div className="mt-1 break-words font-semibold text-[#374151]">{value}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-semibold">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-middle text-[#667085]">{children}</td>;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}
