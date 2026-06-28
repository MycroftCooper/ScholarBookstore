"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  approveAdminTask,
  getAdminTask,
  ignoreAdminTask,
  rejectAdminTask,
  takeDownAdminTask,
  type AdminTask,
} from "@/lib/api/adminTasks";
import { ApiError } from "@/lib/api/client";

export default function AdminTaskDetailPage() {
  const params = useParams<{ id: string }>();
  const taskId = Number(params.id);
  const [task, setTask] = useState<AdminTask | null>(null);
  const [note, setNote] = useState("");
  const [acting, setActing] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setTask(await getAdminTask(taskId));
  }

  useEffect(() => {
    load().catch((err) => {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        window.location.href = "/login";
        return;
      }
      setError("待办详情加载失败");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function act(key: string, action: () => Promise<AdminTask>) {
    setActing(key);
    setError("");
    try {
      const updated = await action();
      setTask(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "操作失败");
    } finally {
      setActing("");
    }
  }

  return (
    <AdminShell active="tasks" title="待办详情">
      <section className="mx-auto max-w-5xl">
        <Link href="/admin/tasks" className="text-sm text-moss">
          返回待办列表
        </Link>

        {error && <div className="mt-4 text-red-700">{error}</div>}
        {!task && !error && (
          <div className="mt-5 rounded-2xl border border-[#e6e9ef] bg-white p-6">正在加载...</div>
        )}

        {task && (
          <article className="mt-5 rounded-2xl border border-[#e6e9ef] bg-white p-6 shadow-[0_10px_30px_rgba(17,24,39,0.035)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs text-stone-500">
                  {task.taskType}
                  {task.domainName ? ` / ${task.domainName}` : ""}
                  {task.moduleName ? ` / ${task.moduleName}` : ""}
                </p>
                <h1 className="mt-2 text-2xl font-semibold text-ink">{task.title}</h1>
              </div>
              <span className="rounded-md bg-[#eef1f5] px-2 py-1 text-xs text-[#667085]">
                {task.status}
              </span>
            </div>

            {task.summary && <p className="mt-4 text-sm leading-6 text-stone-700">{task.summary}</p>}

            <dl className="mt-5 grid gap-3 text-sm md:grid-cols-2">
              <Info label="关联对象" value={`${task.objectType} #${task.objectId}`} />
              <Info label="对象状态" value={task.objectStatus ?? "-"} />
              <Info label="提交人" value={task.submitterName ?? "-"} />
              <Info label="处理人" value={task.assigneeName ?? "-"} />
            </dl>

            {task.objectContentMd && (
              <pre className="mt-5 max-h-[520px] overflow-auto rounded-md bg-stone-50 p-4 text-sm leading-6 text-stone-700">
                {task.objectContentMd}
              </pre>
            )}

            {task.status === "pending" || task.status === "processing" ? (
              <div className="mt-5">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-stone-700">
                    处理备注
                  </span>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
                  />
                </label>

                <div className="mt-4 flex flex-wrap gap-3">
                  {task.taskType === "article_review" && (
                    <>
                      <ActionButton disabled={acting === "approve"} onClick={() => act("approve", () => approveAdminTask(task.id, note))}>
                        通过
                      </ActionButton>
                      <ActionButton danger disabled={acting === "reject"} onClick={() => act("reject", () => rejectAdminTask(task.id, note))}>
                        驳回
                      </ActionButton>
                    </>
                  )}
                  {task.taskType === "content_report" && (
                    <>
                      <ActionButton danger disabled={acting === "take-down"} onClick={() => act("take-down", () => takeDownAdminTask(task.id, note))}>
                        下架内容
                      </ActionButton>
                      <ActionButton disabled={acting === "ignore"} onClick={() => act("ignore", () => ignoreAdminTask(task.id, note))}>
                        忽略举报
                      </ActionButton>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-md bg-stone-50 p-4 text-sm text-stone-700">
                处理结果：{task.resolution || task.status}
                {task.resolutionNote ? ` / ${task.resolutionNote}` : ""}
              </div>
            )}
          </article>
        )}
      </section>
    </AdminShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-stone-50 p-3">
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className="mt-1 text-stone-800">{value}</dd>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  danger = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
        danger
          ? "border border-red-200 bg-red-50 text-red-700 hover:border-red-300"
          : "bg-moss text-white hover:bg-[#354f42]"
      }`}
    >
      {children}
    </button>
  );
}
