"use client";

import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ApiError } from "@/lib/api/client";
import { deleteTag, listAdminTags, mergeTags, updateTag, type TagItem } from "@/lib/api/tags";

export default function AdminTagsPage() {
  const [tags, setTags] = useState<TagItem[]>([]);
  const [q, setQ] = useState("");
  const [targetId, setTargetId] = useState(0);
  const [sourceIds, setSourceIds] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setError("");
    const items = await listAdminTags(q);
    setTags(items);
    setTargetId((current) => current || items[0]?.id || 0);
  }

  useEffect(() => {
    load().catch((err) => {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        window.location.href = "/login";
        return;
      }
      setError("Tag 加载失败");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(action: () => Promise<unknown>) {
    setError("");
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "操作失败");
    }
  }

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-3xl font-semibold text-ink">Tag 管理</h1>
        <div className="mt-5 flex flex-wrap gap-3">
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="搜索 Tag" className="h-10 rounded-md border border-stone-300 bg-white px-3" />
          <button type="button" onClick={load} className="rounded-md bg-moss px-4 py-2 text-sm text-white">查询</button>
        </div>
        <div className="mt-5 rounded-lg border border-stone-200 bg-white p-4">
          <h2 className="font-semibold text-ink">合并 Tag</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            <select value={targetId} onChange={(event) => setTargetId(Number(event.target.value))} className="h-10 rounded-md border border-stone-300 bg-white px-3">
              {tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
            </select>
            <input value={sourceIds} onChange={(event) => setSourceIds(event.target.value)} placeholder="源 Tag ID，用逗号分隔" className="h-10 rounded-md border border-stone-300 bg-white px-3" />
            <button type="button" onClick={() => run(() => mergeTags(targetId, sourceIds.split(",").map((id) => Number(id.trim())).filter(Boolean)))} className="rounded-md border border-stone-300 px-4 py-2 text-sm">合并</button>
          </div>
        </div>
        {error && <div className="mt-4 text-red-700">{error}</div>}
        <div className="mt-5 grid gap-3">
          {tags.map((tag) => (
            <div key={tag.id} className="rounded-lg border border-stone-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-ink">#{tag.id} {tag.name}</div>
                  <div className="text-sm text-stone-500">{tag.slug} / {tag.usageCount} 次</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => {
                    const name = window.prompt("新的 Tag 名称", tag.name);
                    if (name) run(() => updateTag(tag.id, name));
                  }} className="rounded-md border border-stone-300 px-3 py-2 text-sm">重命名</button>
                  <button type="button" onClick={() => run(() => deleteTag(tag.id))} className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">删除</button>
                </div>
              </div>
            </div>
          ))}
          {tags.length === 0 && <div className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">暂无 Tag</div>}
        </div>
      </section>
    </main>
  );
}
