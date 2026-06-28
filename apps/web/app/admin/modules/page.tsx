"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { UserAvatar } from "@/components/users/UserAvatar";
import { listAdminArticles, type ArticleSummary } from "@/lib/api/articles";
import { listAdminUsers } from "@/lib/api/adminUsers";
import { ApiError } from "@/lib/api/client";
import { listDomains, type DomainSummary } from "@/lib/api/domains";
import {
  addModuleModerator,
  createModule,
  listModules,
  removeModuleModerator,
  updateModule,
  type ModuleSummary,
} from "@/lib/api/modules";
import type { CurrentUser } from "@/lib/api/auth";

type ModuleForm = {
  domainId: string;
  slug: string;
  name: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
};

const emptyForm: ModuleForm = {
  domainId: "",
  slug: "",
  name: "",
  description: "",
  sortOrder: "0",
  isActive: true,
};

export default function AdminModulesPage() {
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [domains, setDomains] = useState<DomainSummary[]>([]);
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [users, setUsers] = useState<CurrentUser[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [openActionId, setOpenActionId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [domainId, setDomainId] = useState("all");
  const [status, setStatus] = useState("all");
  const [moderatorFilter, setModeratorFilter] = useState("all");
  const [mode, setMode] = useState<"create" | "edit" | "">("");
  const [form, setForm] = useState<ModuleForm>(emptyForm);
  const [moderatorUserId, setModeratorUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load(keepSelectedId = selectedId) {
    setError("");
    const [nextModules, nextDomains, nextArticles, nextUsers] = await Promise.all([
      listModules(true),
      listDomains(true),
      listAdminArticles(undefined, 100),
      listAdminUsers({ status: "active" }),
    ]);
    setModules(nextModules);
    setDomains(nextDomains);
    setArticles(nextArticles);
    setUsers(nextUsers);
    const nextSelected = nextModules.find((item) => item.id === keepSelectedId) ?? nextModules[0] ?? null;
    setSelectedId(nextSelected?.id ?? null);
  }

  useEffect(() => {
    load()
      .catch((err) => {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          window.location.href = "/login";
          return;
        }
        setError("版块数据加载失败");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => deriveModules(modules, articles), [articles, modules]);
  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesKeyword =
        !keyword ||
        row.module.name.toLowerCase().includes(keyword) ||
        row.module.slug.toLowerCase().includes(keyword) ||
        row.module.description.toLowerCase().includes(keyword);
      const matchesDomain = domainId === "all" || row.module.domainId === Number(domainId);
      const matchesStatus =
        status === "all" ||
        (status === "active" && row.module.isActive) ||
        (status === "inactive" && !row.module.isActive) ||
        (status === "pending" && row.pendingCount > 0);
      const matchesModerator =
        moderatorFilter === "all" ||
        (moderatorFilter === "owned" && row.moderators.length > 0) ||
        (moderatorFilter === "empty" && row.moderators.length === 0);
      return matchesKeyword && matchesDomain && matchesStatus && matchesModerator;
    });
  }, [domainId, moderatorFilter, query, rows, status]);

  const selected = rows.find((row) => row.module.id === selectedId) ?? rows[0] ?? null;
  const stats = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((row) => row.module.isActive).length,
      noModerator: rows.filter((row) => row.moderators.length === 0).length,
      reviewPressure: rows.filter((row) => row.pendingCount > 0).length,
      inactive: rows.filter((row) => !row.module.isActive).length,
    }),
    [rows],
  );

  function startCreate() {
    setMode("create");
    setEditingId(null);
    setForm({ ...emptyForm, domainId: domains[0]?.id ? String(domains[0].id) : "" });
    setModeratorUserId("");
    setError("");
  }

  function startEdit(row = selected) {
    if (!row) return;
    setMode("edit");
    setEditingId(row.module.id);
    setForm({
      domainId: String(row.module.domainId),
      slug: row.module.slug,
      name: row.module.name,
      description: row.module.description,
      sortOrder: String(row.module.sortOrder),
      isActive: row.module.isActive,
    });
    setModeratorUserId("");
    setError("");
  }

  async function saveModule() {
    setSaving(true);
    setError("");
    try {
      const sortOrder = Number(form.sortOrder || 0);
      const saved =
        mode === "create"
          ? await createModule({
              domainId: Number(form.domainId),
              slug: form.slug.trim(),
              name: form.name.trim(),
              description: form.description.trim(),
              sortOrder,
              isActive: form.isActive,
            })
          : editingId
            ? await updateModule(editingId, {
                domainId: Number(form.domainId),
                name: form.name.trim(),
                description: form.description.trim(),
                sortOrder,
                isActive: form.isActive,
              })
            : null;
      if (saved && moderatorUserId) {
        await addModuleModerator(saved.id, Number(moderatorUserId));
      }
      setMode("");
      setEditingId(null);
      await load(saved?.id ?? selectedId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "保存版块失败");
    } finally {
      setSaving(false);
    }
  }

  async function assignModerator() {
    if (!selected || !moderatorUserId) return;
    setSaving(true);
    setError("");
    try {
      await addModuleModerator(selected.module.id, Number(moderatorUserId));
      setModeratorUserId("");
      await load(selected.module.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "设置版主失败");
    } finally {
      setSaving(false);
    }
  }

  async function removeModerator(userId: number) {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      await removeModuleModerator(selected.module.id, userId);
      await load(selected.module.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "移除版主失败");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    if (!selected) return;
    await toggleRowActive(selected);
  }

  async function toggleRowActive(row: ModuleRow) {
    setSaving(true);
    setError("");
    try {
      await updateModule(row.module.id, { isActive: !row.module.isActive });
      setOpenActionId(null);
      await load(row.module.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "更新版块状态失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell active="modules" title="版块管理">
      <div className="grid gap-5">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard title="版块总数" value={stats.total} hint="全部可见版块" />
          <MetricCard title="活跃版块" value={stats.active} hint="isActive = true" tone="success" />
          <MetricCard title="无版主版块" value={stats.noModerator} hint="需要设置版主" tone="danger" />
          <MetricCard title="审核积压版块" value={stats.reviewPressure} hint="存在待审核文章" tone="warning" />
          <MetricCard title="已归档版块" value={stats.inactive} hint="停用但未删除" />
        </div>

        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_480px]">
          <div className="min-w-0 grid gap-5">
            <section className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_150px_160px_auto]">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-12 rounded-xl border border-[#e6e9ef] bg-white px-4 text-sm outline-none focus:border-[#f8c400]"
                placeholder="搜索版块名称或关键词..."
              />
              <Select value={domainId} onChange={setDomainId}>
                <option value="all">全部领域</option>
                {domains.map((domain) => (
                  <option key={domain.id} value={domain.id}>{domain.name}</option>
                ))}
              </Select>
              <Select value={status} onChange={setStatus}>
                <option value="all">全部状态</option>
                <option value="active">活跃</option>
                <option value="pending">审核中</option>
                <option value="inactive">已归档</option>
              </Select>
              <Select value={moderatorFilter} onChange={setModeratorFilter}>
                <option value="all">全部版主</option>
                <option value="owned">已设置版主</option>
                <option value="empty">无版主</option>
              </Select>
              <button
                type="button"
                onClick={startCreate}
                className="h-12 rounded-xl bg-[#f8c400] px-6 text-sm font-black text-[#111827] shadow-[0_10px_22px_rgba(248,196,0,0.22)]"
              >
                + 创建版块
              </button>
            </section>

            {mode && (
              <ModuleEditor
                mode={mode}
                form={form}
                domains={domains}
                users={users}
                moderatorUserId={moderatorUserId}
                saving={saving}
                onChange={setForm}
                onModeratorChange={setModeratorUserId}
                onCancel={() => setMode("")}
                onSave={saveModule}
              />
            )}

            <section className="overflow-hidden rounded-2xl border border-[#e6e9ef] bg-white shadow-[0_10px_30px_rgba(17,24,39,0.035)]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1060px] table-fixed text-sm">
                  <colgroup>
                    <col />
                    <col className="w-[130px]" />
                    <col className="w-[140px]" />
                    <col className="w-[100px]" />
                    <col className="w-[110px]" />
                    <col className="w-[110px]" />
                    <col className="w-[90px]" />
                    <col className="w-[92px]" />
                    <col className="w-[150px]" />
                    <col className="w-[86px]" />
                  </colgroup>
                  <thead className="bg-[#fbfcfd] text-left text-xs font-semibold text-[#8a93a3]">
                    <tr>
                      <Th>版块名称</Th>
                      <Th>所属领域</Th>
                      <Th>版主</Th>
                      <Th>关注人数</Th>
                      <Th>今日新增文章</Th>
                      <Th>待审核</Th>
                      <Th>精选文章</Th>
                      <Th>状态</Th>
                      <Th>更新时间</Th>
                      <Th>操作</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => {
                      const active = selected?.module.id === row.module.id;
                      return (
                        <Fragment key={row.module.id}>
                          <tr className={`border-t border-[#eef1f5] ${active ? "bg-[#fffaf0] outline outline-1 outline-[#f8c400]" : "hover:bg-[#fbfcfd]"}`}>
                            <Td>
                              <button type="button" onClick={() => setSelectedId(row.module.id)} className="grid min-w-0 text-left">
                                <span className="truncate font-black text-[#111827]">{row.module.name}</span>
                                <span className="truncate text-xs text-[#8a93a3]">{row.module.description || row.module.slug}</span>
                              </button>
                            </Td>
                            <Td>{row.module.domainName}</Td>
                            <Td>{row.moderators[0]?.username ?? "未设置"}</Td>
                            <Td>{formatNumber(row.followers)}</Td>
                            <Td>{formatNumber(row.todayArticles)}</Td>
                            <Td><span className={row.pendingCount > 0 ? "font-bold text-[#ef4444]" : ""}>{formatNumber(row.pendingCount)}</span></Td>
                            <Td>{formatNumber(row.featuredCount)}</Td>
                            <Td><StatusBadge row={row} /></Td>
                            <Td>{formatDate(row.module.updatedAt)}</Td>
                            <Td>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedId(row.module.id);
                                  setOpenActionId((current) => (current === row.module.id ? null : row.module.id));
                                }}
                                className="grid size-8 place-items-center rounded-lg border border-[#e6e9ef] text-[#667085] hover:border-[#f8c400]"
                                aria-expanded={openActionId === row.module.id}
                                aria-label={`${row.module.name} 操作`}
                              >
                                ...
                              </button>
                            </Td>
                          </tr>
                          {openActionId === row.module.id && (
                            <tr className="border-t border-[#f7e4a2] bg-[#fffdf5]">
                              <td colSpan={10} className="px-4 py-3">
                                <div className="flex flex-wrap items-center justify-end gap-2">
                                  <span className="mr-auto text-sm font-semibold text-[#667085]">正在操作：{row.module.name}</span>
                                  <ActionButton onClick={() => setSelectedId(row.module.id)}>查看详情</ActionButton>
                                  <ActionButton onClick={() => { setSelectedId(row.module.id); startEdit(row); setOpenActionId(null); }}>编辑版块</ActionButton>
                                  <ActionButton onClick={() => setSelectedId(row.module.id)}>设置版主</ActionButton>
                                  <ActionButton danger disabled={saving} onClick={() => toggleRowActive(row)}>
                                    {row.module.isActive ? "归档版块" : "恢复版块"}
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
                {!loading && filteredRows.length === 0 && (
                  <div className="border-t border-[#eef1f5] p-10 text-center text-sm text-[#8a93a3]">没有匹配的真实版块数据</div>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-[#eef1f5] px-5 py-4 text-sm text-[#8a93a3]">
                <span>共 {filteredRows.length} 条</span>
                <span>10 条/页</span>
              </div>
            </section>
          </div>

          <ModuleDetail
            row={selected}
            users={users}
            moderatorUserId={moderatorUserId}
            saving={saving}
            onModeratorChange={setModeratorUserId}
            onAssignModerator={assignModerator}
            onRemoveModerator={removeModerator}
            onEdit={() => startEdit()}
            onToggleActive={toggleActive}
          />
        </div>
      </div>
    </AdminShell>
  );
}

type ModuleRow = ReturnType<typeof deriveModules>[number];

function deriveModules(modules: ModuleSummary[], articles: ArticleSummary[]) {
  return modules
    .map((module) => {
      const moduleArticles = articles.filter((article) => article.moduleId === module.id);
      return {
        module,
        moderators: module.moderators ?? [],
        articles: moduleArticles,
        articleCount: moduleArticles.length,
        todayArticles: moduleArticles.filter((article) => daysAgo(article.createdAt) === 0).length,
        pendingCount: moduleArticles.filter((article) => article.status === "pending_review").length,
        featuredCount: moduleArticles.filter((article) => article.isFeatured).length,
        followers: new Set(moduleArticles.map((article) => article.authorId)).size,
        totalViews: moduleArticles.reduce((sum, article) => sum + article.viewCount, 0),
        totalWords: moduleArticles.reduce((sum, article) => sum + article.wordCount, 0),
        readingMinutes: moduleArticles.reduce((sum, article) => sum + article.readingMinutes, 0),
        recentFeatured: moduleArticles
          .filter((article) => article.isFeatured || article.status === "published")
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, 3),
      };
    })
    .sort((a, b) => a.module.domainName.localeCompare(b.module.domainName, "zh-CN") || a.module.sortOrder - b.module.sortOrder || a.module.id - b.module.id);
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

function ModuleEditor({
  mode,
  form,
  domains,
  users,
  moderatorUserId,
  saving,
  onChange,
  onModeratorChange,
  onCancel,
  onSave,
}: {
  mode: "create" | "edit";
  form: ModuleForm;
  domains: DomainSummary[];
  users: CurrentUser[];
  moderatorUserId: string;
  saving: boolean;
  onChange: (form: ModuleForm) => void;
  onModeratorChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <section className="rounded-2xl border border-[#e6e9ef] bg-white p-5 shadow-[0_10px_30px_rgba(17,24,39,0.035)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-black text-[#111827]">{mode === "create" ? "创建版块" : "编辑版块"}</h2>
        <button type="button" onClick={onCancel} className="text-sm font-semibold text-[#8a93a3]">取消</button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <Field label="所属领域">
          <Select value={form.domainId} onChange={(value) => onChange({ ...form, domainId: value })}>
            <option value="">选择领域</option>
            {domains.map((domain) => (
              <option key={domain.id} value={domain.id}>{domain.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Slug">
          <input disabled={mode === "edit"} value={form.slug} onChange={(event) => onChange({ ...form, slug: event.target.value })} className="h-12 rounded-xl border border-[#e6e9ef] bg-white px-4 text-sm font-semibold text-[#374151] outline-none focus:border-[#f8c400] disabled:bg-[#f3f5f8]" placeholder="go-backend" />
        </Field>
        <Field label="名称">
          <input value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} className="h-12 rounded-xl border border-[#e6e9ef] bg-white px-4 text-sm font-semibold text-[#374151] outline-none focus:border-[#f8c400]" placeholder="Go / 后端架构" />
        </Field>
        <Field label="排序">
          <input value={form.sortOrder} onChange={(event) => onChange({ ...form, sortOrder: event.target.value })} className="h-12 rounded-xl border border-[#e6e9ef] bg-white px-4 text-sm font-semibold text-[#374151] outline-none focus:border-[#f8c400]" inputMode="numeric" />
        </Field>
        <Field label="状态">
          <Select value={form.isActive ? "active" : "inactive"} onChange={(value) => onChange({ ...form, isActive: value === "active" })}>
            <option value="active">活跃</option>
            <option value="inactive">归档</option>
          </Select>
        </Field>
        <Field label="版主">
          <Select value={moderatorUserId} onChange={onModeratorChange}>
            <option value="">不变</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>{user.username}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="描述">
        <textarea value={form.description} onChange={(event) => onChange({ ...form, description: event.target.value })} rows={3} className="min-h-24 rounded-xl border border-[#e6e9ef] bg-white px-4 py-3 text-sm font-semibold text-[#374151] outline-none focus:border-[#f8c400]" />
      </Field>
      <button type="button" disabled={saving} onClick={onSave} className="mt-4 h-11 rounded-xl bg-[#f8c400] px-6 text-sm font-black text-[#111827] disabled:opacity-60">
        {saving ? "保存中..." : "保存版块"}
      </button>
    </section>
  );
}

function ModuleDetail({
  row,
  users,
  moderatorUserId,
  saving,
  onModeratorChange,
  onAssignModerator,
  onRemoveModerator,
  onEdit,
  onToggleActive,
}: {
  row: ModuleRow | null;
  users: CurrentUser[];
  moderatorUserId: string;
  saving: boolean;
  onModeratorChange: (value: string) => void;
  onAssignModerator: () => void;
  onRemoveModerator: (userId: number) => void;
  onEdit: () => void;
  onToggleActive: () => void;
}) {
  if (!row) {
    return <aside className="rounded-2xl border border-[#e6e9ef] bg-white p-6 text-sm text-[#8a93a3]">请选择版块查看详情</aside>;
  }
  return (
    <aside className="grid gap-5">
      <section className="rounded-2xl border border-[#e6e9ef] bg-white p-5 shadow-[0_10px_30px_rgba(17,24,39,0.035)]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-xl font-black text-[#111827]">{row.module.name}</h2>
              <StatusBadge row={row} />
            </div>
            <p className="mt-3 text-sm leading-6 text-[#667085]">{row.module.description || "暂无版块描述"}</p>
          </div>
        </div>

        <div className="mt-5 border-t border-[#eef1f5] pt-4">
          <h3 className="mb-3 text-sm font-black text-[#111827]">基本信息</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Info label="所属领域" value={row.module.domainName} />
            <Info label="创建时间" value={formatDate(row.module.createdAt)} />
            <Info label="版块 ID" value={`module_${String(row.module.id).padStart(4, "0")}`} />
            <Info label="标签" value={makeTags(row).join(" / ") || "-"} />
          </div>
        </div>

        <div className="mt-5 border-t border-[#eef1f5] pt-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-black text-[#111827]">版主（{row.moderators.length}）</h3>
          </div>
          <div className="grid gap-3">
            {row.moderators.map((moderator) => (
              <div key={moderator.userId} className="flex items-center gap-3 rounded-xl bg-[#fbfcfd] p-3">
                <UserAvatar username={moderator.username} avatarUrl={moderator.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-[#111827]">{moderator.username}</div>
                  <div className="text-xs text-[#8a93a3]">加入时间 {formatDate(moderator.createdAt)}</div>
                </div>
                <button type="button" disabled={saving} onClick={() => onRemoveModerator(moderator.userId)} className="text-xs font-bold text-[#ef4444] disabled:opacity-50">移除</button>
              </div>
            ))}
            {row.moderators.length === 0 && <div className="rounded-xl bg-[#fffaf0] p-3 text-sm text-[#b45309]">当前版块还没有版主</div>}
          </div>
          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
            <Select value={moderatorUserId} onChange={onModeratorChange}>
              <option value="">选择用户</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.username}</option>
              ))}
            </Select>
            <button type="button" disabled={saving || !moderatorUserId} onClick={onAssignModerator} className="h-11 rounded-xl border border-[#e6e9ef] px-4 text-sm font-bold text-[#374151] disabled:opacity-50">设置</button>
          </div>
        </div>

        <div className="mt-5 border-t border-[#eef1f5] pt-4">
          <h3 className="mb-3 text-sm font-black text-[#111827]">数据概览</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label="关注人数" value={formatNumber(row.followers)} />
            <Info label="今日新增" value={formatNumber(row.todayArticles)} />
            <Info label="待审核" value={formatNumber(row.pendingCount)} />
            <Info label="精选文章" value={formatNumber(row.featuredCount)} />
            <Info label="累计文章" value={formatNumber(row.articleCount)} />
            <Info label="总字数" value={formatNumber(row.totalWords)} />
            <Info label="阅读分钟" value={formatNumber(row.readingMinutes)} />
            <Info label="阅读量" value={formatNumber(row.totalViews)} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#e6e9ef] bg-white p-5 shadow-[0_10px_30px_rgba(17,24,39,0.035)]">
        <h3 className="mb-4 font-black text-[#111827]">近期精选文章</h3>
        <div className="grid gap-3">
          {row.recentFeatured.map((article) => (
            <Link key={article.id} href={`/articles/${article.id}`} className="grid grid-cols-[1fr_auto] gap-3 rounded-xl bg-[#fbfcfd] p-3 text-sm hover:bg-[#fffaf0]">
              <span className="min-w-0">
                <span className="block truncate font-bold text-[#111827]">{article.title}</span>
                <span className="block truncate text-xs text-[#8a93a3]">{article.authorUsername}</span>
              </span>
              <span className="text-xs text-[#8a93a3]">{formatDateShort(article.updatedAt)}</span>
            </Link>
          ))}
          {row.recentFeatured.length === 0 && <div className="text-sm text-[#8a93a3]">暂无真实文章数据</div>}
        </div>
      </section>

      <section className="rounded-2xl border border-[#e6e9ef] bg-white p-5 shadow-[0_10px_30px_rgba(17,24,39,0.035)]">
        <h3 className="mb-4 font-black text-[#111827]">操作</h3>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={onEdit} className="h-11 rounded-xl bg-[#f8c400] text-sm font-black text-[#111827]">编辑版块</button>
          <Link href={`/modules/${row.module.slug}`} className="grid h-11 place-items-center rounded-xl border border-[#e6e9ef] text-sm font-bold text-[#374151]">查看文章</Link>
          <button type="button" disabled={saving} onClick={onToggleActive} className="col-span-2 h-11 rounded-xl border border-red-200 bg-red-50 text-sm font-bold text-[#ef4444] disabled:opacity-50">
            {row.module.isActive ? "归档版块" : "恢复版块"}
          </button>
        </div>
      </section>
    </aside>
  );
}

function Select({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="h-12 min-w-0 rounded-xl border border-[#e6e9ef] bg-white px-4 text-sm font-semibold text-[#374151] outline-none focus:border-[#f8c400]">
      {children}
    </select>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-xs font-bold text-[#667085]">
      {label}
      {children}
    </label>
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

function StatusBadge({ row }: { row: ModuleRow }) {
  const label = !row.module.isActive ? "已归档" : row.pendingCount > 0 ? "审核中" : "活跃";
  const className = !row.module.isActive
    ? "border-gray-200 bg-gray-50 text-gray-500"
    : row.pendingCount > 0
      ? "border-yellow-200 bg-yellow-50 text-yellow-700"
      : "border-green-200 bg-green-50 text-green-600";
  return <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-bold ${className}`}>{label}</span>;
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

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-semibold">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-middle text-[#667085]">{children}</td>;
}

function makeTags(row: ModuleRow) {
  const source = `${row.module.name} ${row.module.description}`.toLowerCase();
  return ["Go", "后端", "架构", "微服务", "分布式", "AI", "数据", "前端"].filter((tag) => source.includes(tag.toLowerCase()));
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
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
