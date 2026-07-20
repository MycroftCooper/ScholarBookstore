"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  approveAdminTask,
  getAdminTask,
  getAdminTaskStats,
  ignoreAdminTask,
  listAdminTasks,
  rejectAdminTask,
  takeDownAdminTask,
  type AdminTask,
  type AdminTaskFilter,
  type AdminTaskStats,
  type ModerationAction,
} from "@/lib/api/adminTasks";
import { ApiError } from "@/lib/api/client";
import { listDomains, type DomainSummary } from "@/lib/api/domains";
import { listModules, type ModuleSummary } from "@/lib/api/modules";

const taskTypeLabel: Record<string, string> = {
  article_review: "文章审核",
  content_report: "举报处理",
  comment_report: "评论举报",
  user_report: "用户举报",
};

const statusLabel: Record<string, string> = {
  pending: "待处理",
  processing: "处理中",
  approved: "已通过",
  rejected: "已驳回",
  resolved: "已完成",
  ignored: "已忽略",
  cancelled: "已取消",
};

const priorityLabel: Record<number, string> = {
  0: "低",
  1: "中",
  2: "高",
  3: "高",
};

type ActionKind = "approve" | "reject" | "take-down" | "ignore";
type ModerationActionType = ModerationAction["type"];

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [selected, setSelected] = useState<AdminTask | null>(null);
  const [stats, setStats] = useState<AdminTaskStats | null>(null);
  const [domains, setDomains] = useState<DomainSummary[]>([]);
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [filter, setFilter] = useState<AdminTaskFilter>({ status: "pending" });
  const [activeTab, setActiveTab] = useState("");
  const [note, setNote] = useState("");
  const [moderationActions, setModerationActions] = useState<ModerationActionType[]>([]);
  const [actionDurations, setActionDurations] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<ActionKind | "">("");
  const [error, setError] = useState("");

  async function load(nextFilter = filter, keepSelectedId = selected?.id) {
    setError("");
    const [nextStats, nextTasks, nextDomains, nextModules] = await Promise.all([
      getAdminTaskStats(),
      listAdminTasks(nextFilter),
      listDomains(true),
      listModules(true),
    ]);
    setStats(nextStats);
    setTasks(nextTasks);
    setDomains(nextDomains);
    setModules(nextModules);

    const nextSelected = nextTasks.find((task) => task.id === keepSelectedId) ?? nextTasks[0] ?? null;
    if (nextSelected) {
      setSelected(await getAdminTask(nextSelected.id));
    } else {
      setSelected(null);
    }
  }

  useEffect(() => {
    load().catch((err) => {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        window.location.href = "/login";
        return;
      }
      setError("待办加载失败");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const derived = useMemo(() => deriveTasks(tasks), [tasks]);

  useEffect(() => {
    if (!selected) {
      setModerationActions([]);
      setActionDurations({});
      return;
    }
    setModerationActions(defaultModerationActions(selected));
    setActionDurations({});
  }, [selected?.id, selected?.taskType]);

  function updateFilter(next: AdminTaskFilter) {
    setFilter(next);
    setNote("");
    setModerationActions([]);
    setActionDurations({});
    load(next).catch(() => setError("待办加载失败"));
  }

  function switchTab(taskType: string) {
    setActiveTab(taskType);
    updateFilter({ ...filter, taskType: taskType || undefined });
  }

  async function openTask(task: AdminTask) {
    setError("");
    setNote("");
    try {
      setSelected(await getAdminTask(task.id));
    } catch {
      setError("任务详情加载失败");
    }
  }

  async function handleAction(kind: ActionKind) {
    if (!selected) {
      return;
    }
    const trimmed = note.trim();
    if ((kind === "reject" || kind === "take-down" || kind === "ignore") && !trimmed) {
      setError("驳回、下架或忽略必须填写处理备注");
      return;
    }
    setActing(kind);
    setError("");
    try {
      const updated =
        kind === "approve"
          ? await approveAdminTask(selected.id, trimmed || "通过")
          : kind === "reject"
            ? await rejectAdminTask(selected.id, trimmed)
            : kind === "take-down"
              ? await takeDownAdminTask(selected.id, trimmed, buildModerationActions(selected, moderationActions, actionDurations))
              : await ignoreAdminTask(selected.id, trimmed);
      setSelected(updated);
      setNote("");
      await load(filter, updated.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "操作失败");
    } finally {
      setActing("");
    }
  }

  return (
    <AdminShell active="tasks" title="待办事项">
      <div className="grid gap-6">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard icon="♧" title="我的待办" value={stats?.myPending ?? 0} />
          <MetricCard icon="▤" title="待审核文章" value={stats?.pendingReviews ?? 0} tone="danger" />
          <MetricCard icon="⚐" title="待处理举报" value={stats?.pendingReports ?? 0} tone="danger" />
          <MetricCard icon="◷" title="超时待办" value={stats?.overdueTasks ?? 0} tone="danger" />
          <MetricCard icon="✎" title="今日已处理" value={stats?.resolvedToday ?? 0} tone="success" />
        </div>

        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_496px]">
          <section className="min-w-0 overflow-hidden rounded-2xl border border-[#e6e9ef] bg-white shadow-[0_10px_30px_rgba(17,24,39,0.035)]">
            <div className="border-b border-[#e6e9ef] px-5 pt-4">
              <div className="flex h-11 gap-8 text-sm font-bold text-[#4b5563]">
                {[
                  ["", "全部"],
                  ["article_review", "文章审核"],
                  ["content_report", "举报处理"],
                  ["user_report", "用户举报"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => switchTab(key)}
                    className={`relative h-11 ${activeTab === key ? "text-[#111827]" : "text-[#667085]"}`}
                  >
                    {label}
                    {activeTab === key && <span className="absolute inset-x-0 bottom-0 h-1 rounded-t-full bg-[#f8c400]" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 border-b border-[#e6e9ef] bg-[#fbfcfd] px-5 py-4">
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                <FilterSelect label="任务类型" value={filter.taskType ?? ""} onChange={(value) => updateFilter({ ...filter, taskType: value || undefined })}>
                  <option value="">全部</option>
                  <option value="article_review">文章审核</option>
                  <option value="content_report">举报处理</option>
                  <option value="comment_report">评论举报</option>
                  <option value="user_report">用户举报</option>
                </FilterSelect>
                <FilterSelect label="状态" value={filter.status ?? ""} onChange={(value) => updateFilter({ ...filter, status: value || undefined })}>
                  <option value="">全部</option>
                  <option value="pending">待处理</option>
                  <option value="processing">处理中</option>
                  <option value="approved">已通过</option>
                  <option value="rejected">已驳回</option>
                  <option value="resolved">已完成</option>
                  <option value="ignored">已忽略</option>
                </FilterSelect>
                <FilterSelect label="优先级" value={filter.priority ?? ""} onChange={(value) => updateFilter({ ...filter, priority: value || undefined })}>
                  <option value="">全部</option>
                  <option value="0">低</option>
                  <option value="1">中</option>
                  <option value="2">高</option>
                </FilterSelect>
                <FilterSelect label="领域" value={filter.domainId ?? ""} onChange={(value) => updateFilter({ ...filter, domainId: value || undefined })}>
                  <option value="">全部领域</option>
                  {domains.map((domain) => (
                    <option key={domain.id} value={domain.id}>
                      {domain.name}
                    </option>
                  ))}
                </FilterSelect>
                <FilterSelect label="版块" value={filter.moduleId ?? ""} onChange={(value) => updateFilter({ ...filter, moduleId: value || undefined })}>
                  <option value="">全部版块</option>
                  {modules.map((module) => (
                    <option key={module.id} value={module.id}>
                      {module.name}
                    </option>
                  ))}
                </FilterSelect>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("");
                    updateFilter({ status: "pending" });
                  }}
                  className="mt-5 h-10 rounded-lg border border-[#e6e9ef] bg-white px-4 text-sm font-semibold text-[#4b5563]"
                >
                  ↻ 重置
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] table-fixed text-sm">
                <colgroup>
                  <col className="w-[110px]" />
                  <col />
                  <col className="w-[120px]" />
                  <col className="w-[130px]" />
                  <col className="w-[120px]" />
                  <col className="w-[110px]" />
                  <col className="w-[86px]" />
                  <col className="w-[96px]" />
                  <col className="w-[150px]" />
                  <col className="w-[100px]" />
                  <col className="w-[72px]" />
                </colgroup>
                <thead className="bg-white text-left text-xs font-semibold text-[#8a93a3]">
                  <tr>
                    <Th>任务类型</Th>
                    <Th>任务标题</Th>
                    <Th>所属领域</Th>
                    <Th>所属版块</Th>
                    <Th>提交人</Th>
                    <Th>处理人</Th>
                    <Th>优先级</Th>
                    <Th>状态</Th>
                    <Th>创建时间</Th>
                    <Th>等待时长</Th>
                    <Th>操作</Th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => {
                    const active = selected?.id === task.id;
                    return (
                      <tr
                        key={task.id}
                        className={`border-t border-[#eef1f5] ${active ? "bg-[#fffaf0] outline outline-1 outline-[#f8c400]" : "bg-white hover:bg-[#fbfcfd]"}`}
                      >
                        <Td>
                          <span className="inline-flex items-center gap-2 font-semibold text-[#374151]">
                            <span>{task.taskType === "article_review" ? "▤" : task.taskType === "user_report" ? "人" : "⚐"}</span>
                            {taskTypeLabel[task.taskType] ?? task.taskType}
                          </span>
                        </Td>
                        <Td>
                          <button type="button" onClick={() => openTask(task)} className="block max-w-full truncate text-left font-semibold text-[#1f2937]">
                            {task.title}
                          </button>
                        </Td>
                        <Td>{task.domainName ?? "-"}</Td>
                        <Td>{task.moduleName ?? "-"}</Td>
                        <Td>{task.submitterName ?? "-"}</Td>
                        <Td>{task.assigneeName ?? "未分配"}</Td>
                        <Td>
                          <PriorityBadge value={task.priority} />
                        </Td>
                        <Td>
                          <StatusBadge status={task.status} />
                        </Td>
                        <Td>{formatDate(task.createdAt)}</Td>
                        <Td>{waitTime(task.createdAt, task.resolvedAt)}</Td>
                        <Td>
                          <button type="button" onClick={() => openTask(task)} className="grid size-8 place-items-center rounded-lg border border-[#e6e9ef] text-[#667085] hover:border-[#f8c400]">
                            ◎
                          </button>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {tasks.length === 0 && (
                <div className="border-t border-[#eef1f5] p-10 text-center text-sm text-[#8a93a3]">暂无真实待办数据</div>
              )}
            </div>
          </section>

          <aside className="grid gap-5">
            <TaskDetailPanel
              task={selected}
              note={note}
              acting={acting}
              moderationActions={moderationActions}
              actionDurations={actionDurations}
              onNoteChange={setNote}
              onModerationActionsChange={setModerationActions}
              onActionDurationChange={(type, value) => setActionDurations((current) => ({ ...current, [type]: value }))}
              onAction={handleAction}
            />
            <SideList
              tone="danger"
              title="审核超时提醒"
              summary={`${derived.overdue.length} 个任务已超时`}
              items={derived.overdue}
              empty="暂无超时任务"
            />
            <SideList
              tone="warning"
              title="待分配管理者"
              summary={`${derived.unassigned.length} 个申请等待分配`}
              items={derived.unassigned}
              empty="暂无待分配任务"
            />
          </aside>
        </div>
      </div>
    </AdminShell>
  );
}

function MetricCard({ icon, title, value, tone = "normal" }: { icon: string; title: string; value: number; tone?: "normal" | "danger" | "success" }) {
  return (
    <section className="rounded-2xl border border-[#e6e9ef] bg-white p-6 shadow-[0_10px_30px_rgba(17,24,39,0.035)]">
      <div className="flex items-start gap-4">
        <div className="grid size-9 place-items-center text-2xl text-[#111827]">{icon}</div>
        <div>
          <div className="text-sm font-semibold text-[#374151]">{title}</div>
          <div className="mt-3 text-3xl font-black text-[#111827]">{value}</div>
          <div className="mt-2 text-sm text-[#8a93a3]">
            实时统计
            <span className={tone === "danger" ? "ml-2 text-[#ef4444]" : tone === "success" ? "ml-2 text-[#16a34a]" : "ml-2 text-[#16a34a]"}>
              ●
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-xs font-semibold text-[#667085]">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-lg border border-[#e6e9ef] bg-white px-3 text-sm font-medium text-[#374151] outline-none focus:border-[#f8c400]">
        {children}
      </select>
    </label>
  );
}

function ModerationActionPicker({
  task,
  selected,
  durations,
  onChange,
  onDurationChange,
}: {
  task: AdminTask;
  selected: ModerationActionType[];
  durations: Record<string, string>;
  onChange: (value: ModerationActionType[]) => void;
  onDurationChange: (type: ModerationActionType, value: string) => void;
}) {
  const options = moderationOptions(task);
  function toggle(type: ModerationActionType) {
    onChange(selected.includes(type) ? selected.filter((item) => item !== type) : [...selected, type]);
  }
  return (
    <section className="mt-4 rounded-xl border border-[#eef1f5] bg-[#fbfcfd] p-4">
      <div className="mb-3 text-sm font-black text-[#111827]">处置动作</div>
      <div className="grid gap-3">
        {options.map((option) => (
          <label key={option.type} className="grid gap-2 rounded-lg border border-[#e6e9ef] bg-white p-3 text-sm">
            <span className="flex items-center gap-2 font-semibold text-[#374151]">
              <input
                type="checkbox"
                checked={selected.includes(option.type)}
                onChange={() => toggle(option.type)}
              />
              {option.label}
            </span>
            {option.duration && selected.includes(option.type) && (
              <span className="flex items-center gap-2 text-xs text-[#667085]">
                时长
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={durations[option.type] ?? "7"}
                  onChange={(event) => onDurationChange(option.type, event.target.value)}
                  className="h-8 w-24 rounded-md border border-[#e6e9ef] px-2 outline-none focus:border-[#f8c400]"
                />
                天
              </span>
            )}
          </label>
        ))}
      </div>
    </section>
  );
}

function TaskDetailPanel({
  task,
  note,
  acting,
  moderationActions,
  actionDurations,
  onNoteChange,
  onModerationActionsChange,
  onActionDurationChange,
  onAction,
}: {
  task: AdminTask | null;
  note: string;
  acting: string;
  moderationActions: ModerationActionType[];
  actionDurations: Record<string, string>;
  onNoteChange: (value: string) => void;
  onModerationActionsChange: (value: ModerationActionType[]) => void;
  onActionDurationChange: (type: ModerationActionType, value: string) => void;
  onAction: (kind: ActionKind) => void;
}) {
  if (!task) {
    return (
      <section className="rounded-2xl border border-[#e6e9ef] bg-white p-6 text-sm text-[#8a93a3] shadow-[0_10px_30px_rgba(17,24,39,0.035)]">
        请选择一条任务查看详情
      </section>
    );
  }
  const canAct = task.status === "pending" || task.status === "processing";
  return (
    <section className="rounded-2xl border border-[#e6e9ef] bg-white p-5 shadow-[0_10px_30px_rgba(17,24,39,0.035)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-black text-[#111827]">任务详情</h2>
        <span className="text-[#8a93a3]">×</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-md border border-[#e6e9ef] px-3 py-1 text-xs font-semibold text-[#667085]">
          {taskTypeLabel[task.taskType] ?? task.taskType}
        </span>
        <StatusBadge status={task.status} />
      </div>
      <h3 className="mt-4 text-xl font-black leading-snug text-[#111827]">{task.objectTitle ?? task.title}</h3>
      <div className="mt-3 grid gap-2 text-sm text-[#667085]">
        <div>提交人：<span className="font-semibold text-[#374151]">{task.submitterName ?? "-"}</span></div>
        <div>任务编号：T-{String(task.id).padStart(6, "0")}</div>
        <div>提交时间：{formatDate(task.createdAt)}</div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 border-y border-[#eef1f5] py-4 text-sm">
        <Info label="所属领域" value={task.domainName ?? "-"} />
        <Info label="所属版块" value={task.moduleName ?? "-"} />
        <Info label="等待时长" value={waitTime(task.createdAt, task.resolvedAt)} />
        <Info label="优先级" value={priorityLabel[task.priority] ?? "低"} />
      </div>
      <div className="mt-4">
        <div className="mb-2 text-sm font-black text-[#111827]">内容摘要</div>
        <p className="line-clamp-4 text-sm leading-6 text-[#667085]">{task.summary || "暂无摘要"}</p>
        {task.objectContentMd && (
          <pre className="mt-3 max-h-52 overflow-auto rounded-xl bg-[#fbfcfd] p-3 text-xs leading-5 text-[#4b5563]">
            {task.objectContentMd}
          </pre>
        )}
      </div>
      {canAct ? (
        <>
          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-black text-[#111827]">审核备注</span>
            <textarea
              value={note}
              onChange={(event) => onNoteChange(event.target.value)}
              rows={3}
              className="w-full rounded-xl border border-[#e6e9ef] px-3 py-2 text-sm outline-none focus:border-[#f8c400]"
              placeholder="驳回、下架或忽略时必须填写原因"
            />
          </label>
          {isReportTask(task) && (
            <ModerationActionPicker
              task={task}
              selected={moderationActions}
              durations={actionDurations}
              onChange={onModerationActionsChange}
              onDurationChange={onActionDurationChange}
            />
          )}
          <div className="mt-4 grid grid-cols-4 gap-3">
            {task.taskType === "article_review" && (
              <>
                <ActionButton disabled={acting === "approve"} onClick={() => onAction("approve")} primary>通过</ActionButton>
                <ActionButton disabled={acting === "reject"} onClick={() => onAction("reject")}>驳回</ActionButton>
                <ActionButton disabled={acting === "take-down"} onClick={() => onAction("take-down")}>下架</ActionButton>
              </>
            )}
            {task.taskType === "content_report" && (
              <>
                <ActionButton disabled={acting === "take-down"} onClick={() => onAction("take-down")} primary>处理</ActionButton>
                <ActionButton disabled={acting === "ignore"} onClick={() => onAction("ignore")}>忽略</ActionButton>
              </>
            )}
            {task.taskType === "comment_report" && (
              <>
                <ActionButton disabled={acting === "take-down"} onClick={() => onAction("take-down")} primary>处理</ActionButton>
                <ActionButton disabled={acting === "ignore"} onClick={() => onAction("ignore")}>忽略</ActionButton>
              </>
            )}
            {task.taskType === "user_report" && (
              <>
                <ActionButton disabled={acting === "take-down"} onClick={() => onAction("take-down")} primary>处理</ActionButton>
                <ActionButton disabled={acting === "ignore"} onClick={() => onAction("ignore")}>忽略</ActionButton>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-xl bg-[#fbfcfd] p-4 text-sm text-[#667085]">
          处理结果：{task.resolution || statusLabel[task.status] || task.status}
          {task.resolutionNote ? ` / ${task.resolutionNote}` : ""}
        </div>
      )}
    </section>
  );
}

function SideList({ tone, title, summary, items, empty }: { tone: "danger" | "warning"; title: string; summary: string; items: AdminTask[]; empty: string }) {
  return (
    <section className="rounded-2xl border border-[#e6e9ef] bg-white p-5 shadow-[0_10px_30px_rgba(17,24,39,0.035)]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={tone === "danger" ? "text-[#ef4444]" : "text-[#f59e0b]"}>△</span>
          <h2 className="font-black text-[#111827]">{title}</h2>
        </div>
        <span className={tone === "danger" ? "text-sm text-[#ef4444]" : "text-sm text-[#f59e0b]"}>{summary}</span>
      </div>
      <div className="grid gap-3 text-sm">
        {items.slice(0, 3).map((task) => (
          <div key={task.id} className="grid grid-cols-[1fr_auto] gap-3 text-[#667085]">
            <span className="truncate">• {task.title}</span>
            <span className={tone === "danger" ? "text-[#ef4444]" : "text-[#f59e0b]"}>{waitTime(task.createdAt, task.resolvedAt)}</span>
          </div>
        ))}
        {items.length === 0 && <div className="text-[#8a93a3]">{empty}</div>}
      </div>
    </section>
  );
}

function ActionButton({ children, disabled, primary, onClick }: { children: React.ReactNode; disabled?: boolean; primary?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={primary ? "h-10 rounded-lg bg-[#f8c400] px-4 text-sm font-black text-[#111827] disabled:opacity-60" : "h-10 rounded-lg border border-[#e6e9ef] bg-white px-4 text-sm font-semibold text-[#374151] disabled:opacity-60"}
    >
      {children}
    </button>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-[#8a93a3]">{label}</div>
      <div className="mt-1 font-semibold text-[#374151]">{value}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-semibold">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-middle text-[#667085]">{children}</td>;
}

function PriorityBadge({ value }: { value: number }) {
  const label = priorityLabel[value] ?? "低";
  const className =
    label === "高"
      ? "border-red-200 bg-red-50 text-red-600"
      : label === "中"
        ? "border-orange-200 bg-orange-50 text-orange-600"
        : "border-green-200 bg-green-50 text-green-600";
  return <span className={`rounded-md border px-2 py-1 text-xs font-bold ${className}`}>{label}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "processing"
      ? "border-blue-200 bg-blue-50 text-blue-600"
      : status === "resolved" || status === "approved"
        ? "border-green-200 bg-green-50 text-green-600"
        : "border-yellow-200 bg-yellow-50 text-yellow-700";
  return <span className={`rounded-md border px-2 py-1 text-xs font-bold ${className}`}>{statusLabel[status] ?? status}</span>;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function waitTime(createdAt: string, resolvedAt: string | null) {
  const start = new Date(createdAt).getTime();
  const end = resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return "-";
  }
  const minutes = Math.round((end - start) / 60000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours <= 0) {
    return `${rest}分钟`;
  }
  return `${hours}小时${rest}分`;
}

function deriveTasks(tasks: AdminTask[]) {
  const now = Date.now();
  const overdue = tasks.filter((task) => {
    if (task.dueAt) {
      return new Date(task.dueAt).getTime() < now && (task.status === "pending" || task.status === "processing");
    }
    return now - new Date(task.createdAt).getTime() > 3 * 60 * 60 * 1000 && (task.status === "pending" || task.status === "processing");
  });
  const unassigned = tasks.filter((task) => !task.assigneeId && (task.status === "pending" || task.status === "processing"));
  return { overdue, unassigned };
}

function isReportTask(task: AdminTask) {
  return task.taskType === "content_report" || task.taskType === "comment_report" || task.taskType === "user_report";
}

function defaultModerationActions(task: AdminTask): ModerationActionType[] {
  if (task.taskType === "content_report" || task.taskType === "comment_report") {
    return ["hide_content"];
  }
  if (task.taskType === "user_report") {
    return ["disable_account"];
  }
  return [];
}

function moderationOptions(task: AdminTask): Array<{ type: ModerationActionType; label: string; duration?: boolean }> {
  const common: Array<{ type: ModerationActionType; label: string; duration?: boolean }> = [
    { type: "disable_account", label: "禁用账号" },
    { type: "restrict_follow", label: "限制关注", duration: true },
    { type: "ban_article_create", label: "禁止发文章", duration: true },
    { type: "ban_comment_create", label: "禁止发评论", duration: true },
  ];
  if (task.taskType === "content_report") {
    return [{ type: "hide_content", label: "下架被举报文章" }, ...common];
  }
  if (task.taskType === "comment_report") {
    return [{ type: "hide_content", label: "隐藏被举报评论" }, ...common];
  }
  if (task.taskType === "user_report") {
    return common;
  }
  return [];
}

function buildModerationActions(task: AdminTask, selected: ModerationActionType[], durations: Record<string, string>): ModerationAction[] | undefined {
  if (!isReportTask(task)) {
    return undefined;
  }
  return selected.map((type) => {
    if (type === "restrict_follow" || type === "ban_article_create" || type === "ban_comment_create") {
      const parsed = Number.parseInt(durations[type] ?? "7", 10);
      return { type, durationDays: Number.isFinite(parsed) && parsed > 0 ? parsed : 7 };
    }
    return { type };
  });
}
