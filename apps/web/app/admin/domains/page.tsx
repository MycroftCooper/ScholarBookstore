"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { UserAvatar } from "@/components/users/UserAvatar";
import { listAdminArticles, type ArticleSummary } from "@/lib/api/articles";
import { ApiError } from "@/lib/api/client";
import {
  addDomainOwner,
  createDomain,
  listDomains,
  removeDomainOwner,
  updateDomain,
  type DomainSummary,
} from "@/lib/api/domains";
import { listModules, type ModuleSummary } from "@/lib/api/modules";
import { listAdminUsers } from "@/lib/api/adminUsers";
import type { CurrentUser } from "@/lib/api/auth";

type DomainForm = {
  slug: string;
  name: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
};

const emptyForm: DomainForm = {
  slug: "",
  name: "",
  description: "",
  sortOrder: "0",
  isActive: true,
};

export default function AdminDomainsPage() {
  const [domains, setDomains] = useState<DomainSummary[]>([]);
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [users, setUsers] = useState<CurrentUser[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [mode, setMode] = useState<"create" | "edit" | "">("");
  const [form, setForm] = useState<DomainForm>(emptyForm);
  const [ownerUserId, setOwnerUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load(keepSelectedId = selectedId) {
    setError("");
    const [nextDomains, nextModules, nextArticles, nextUsers] = await Promise.all([
      listDomains(true),
      listModules(true),
      listAdminArticles(undefined, 100),
      listAdminUsers({ status: "active" }),
    ]);
    setDomains(nextDomains);
    setModules(nextModules);
    setArticles(nextArticles);
    setUsers(nextUsers);
    const nextSelected = nextDomains.find((item) => item.id === keepSelectedId) ?? nextDomains[0] ?? null;
    setSelectedId(nextSelected?.id ?? null);
  }

  useEffect(() => {
    load()
      .catch((err) => {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          window.location.href = "/login";
          return;
        }
        setError("领域数据加载失败");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(
    () => deriveDomains(domains, modules, articles),
    [domains, modules, articles],
  );

  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesKeyword =
        !keyword ||
        row.domain.name.toLowerCase().includes(keyword) ||
        row.domain.slug.toLowerCase().includes(keyword) ||
        row.domain.description.toLowerCase().includes(keyword);
      const matchesStatus =
        status === "all" ||
        (status === "active" && row.domain.isActive) ||
        (status === "inactive" && !row.domain.isActive);
      const matchesOwner =
        ownerFilter === "all" ||
        (ownerFilter === "owned" && row.owners.length > 0) ||
        (ownerFilter === "empty" && row.owners.length === 0);
      return matchesKeyword && matchesStatus && matchesOwner;
    });
  }, [ownerFilter, query, rows, status]);

  const selected = rows.find((row) => row.domain.id === selectedId) ?? rows[0] ?? null;
  const stats = useMemo(() => {
    const active = rows.filter((row) => row.domain.isActive);
    return {
      total: rows.length,
      active: active.length,
      noOwner: rows.filter((row) => row.owners.length === 0).length,
      weeklyArticles: articles.filter((article) => daysAgo(article.createdAt) <= 7).length,
      activeDomains: rows.filter((row) => row.articleCount > 0 || row.activeUsers > 0).length,
    };
  }, [articles, rows]);

  function startCreate() {
    setMode("create");
    setForm(emptyForm);
    setOwnerUserId("");
    setError("");
  }

  function startEdit(row = selected) {
    if (!row) return;
    setMode("edit");
    setForm({
      slug: row.domain.slug,
      name: row.domain.name,
      description: row.domain.description,
      sortOrder: String(row.domain.sortOrder),
      isActive: row.domain.isActive,
    });
    setOwnerUserId("");
    setError("");
  }

  async function saveDomain() {
    setSaving(true);
    setError("");
    try {
      const sortOrder = Number(form.sortOrder || 0);
      const saved =
        mode === "create"
          ? await createDomain({
              slug: form.slug.trim(),
              name: form.name.trim(),
              description: form.description.trim(),
              sortOrder,
              isActive: form.isActive,
            })
          : selected
            ? await updateDomain(selected.domain.id, {
                name: form.name.trim(),
                description: form.description.trim(),
                sortOrder,
                isActive: form.isActive,
              })
            : null;
      if (saved && ownerUserId) {
        await addDomainOwner(saved.id, Number(ownerUserId));
      }
      setMode("");
      await load(saved?.id ?? selectedId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "保存领域失败");
    } finally {
      setSaving(false);
    }
  }

  async function assignOwner() {
    if (!selected || !ownerUserId) return;
    setSaving(true);
    setError("");
    try {
      await addDomainOwner(selected.domain.id, Number(ownerUserId));
      setOwnerUserId("");
      await load(selected.domain.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "分配领主失败");
    } finally {
      setSaving(false);
    }
  }

  async function removeOwner(userId: number) {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      await removeDomainOwner(selected.domain.id, userId);
      await load(selected.domain.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "移除领主失败");
    } finally {
      setSaving(false);
    }
  }

  async function toggleArchive() {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      await updateDomain(selected.domain.id, { isActive: !selected.domain.isActive });
      await load(selected.domain.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "更新领域状态失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell active="domains" title="领域管理">
      <div className="grid gap-5">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard title="领域总数" value={stats.total} hint="全部可见领域" />
          <MetricCard title="正常领域" value={stats.active} hint="isActive = true" tone="success" />
          <MetricCard title="无领主领域" value={stats.noOwner} hint="需要分配负责人" tone="danger" />
          <MetricCard title="本周新增内容" value={stats.weeklyArticles} hint="来自真实文章" tone="success" />
          <MetricCard title="活跃领域数" value={stats.activeDomains} hint="有内容或作者" tone="warning" />
        </div>

        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_480px]">
          <div className="min-w-0 grid gap-5">
            <section className="grid gap-3 md:grid-cols-[minmax(0,1fr)_168px_168px_auto]">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-12 rounded-xl border border-[#e6e9ef] bg-white px-4 text-sm outline-none focus:border-[#f8c400]"
                placeholder="搜索领域名称或描述..."
              />
              <Select value={status} onChange={setStatus}>
                <option value="all">状态：全部</option>
                <option value="active">状态：正常</option>
                <option value="inactive">状态：已归档</option>
              </Select>
              <Select value={ownerFilter} onChange={setOwnerFilter}>
                <option value="all">领主：全部</option>
                <option value="owned">领主：已分配</option>
                <option value="empty">领主：未分配</option>
              </Select>
              <button
                type="button"
                onClick={startCreate}
                className="h-12 rounded-xl bg-[#f8c400] px-6 text-sm font-black text-[#111827] shadow-[0_10px_22px_rgba(248,196,0,0.22)]"
              >
                + 创建领域
              </button>
            </section>

            {mode && (
              <DomainEditor
                mode={mode}
                form={form}
                users={users}
                ownerUserId={ownerUserId}
                saving={saving}
                onChange={setForm}
                onOwnerChange={setOwnerUserId}
                onCancel={() => setMode("")}
                onSave={saveDomain}
              />
            )}

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
              {filteredRows.map((row, index) => (
                <DomainCard
                  key={row.domain.id}
                  row={row}
                  index={index}
                  selected={selected?.domain.id === row.domain.id}
                  onClick={() => setSelectedId(row.domain.id)}
                />
              ))}
              {!loading && filteredRows.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[#d8dde6] bg-white p-8 text-sm text-[#8a93a3]">
                  没有匹配的真实领域数据
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-2xl border border-[#e6e9ef] bg-white shadow-[0_10px_30px_rgba(17,24,39,0.035)]">
              <div className="border-b border-[#eef1f5] px-5 py-4">
                <h2 className="font-black text-[#111827]">领域管理列表</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] table-fixed text-sm">
                  <colgroup>
                    <col />
                    <col className="w-[140px]" />
                    <col className="w-[86px]" />
                    <col className="w-[110px]" />
                    <col className="w-[110px]" />
                    <col className="w-[92px]" />
                    <col className="w-[92px]" />
                    <col className="w-[150px]" />
                    <col className="w-[128px]" />
                  </colgroup>
                  <thead className="bg-[#fbfcfd] text-left text-xs font-semibold text-[#8a93a3]">
                    <tr>
                      <Th>领域名称</Th>
                      <Th>领主</Th>
                      <Th>版块数</Th>
                      <Th>文章数</Th>
                      <Th>活跃用户</Th>
                      <Th>精选文章</Th>
                      <Th>状态</Th>
                      <Th>更新时间</Th>
                      <Th>操作</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr key={row.domain.id} className="border-t border-[#eef1f5] hover:bg-[#fbfcfd]">
                        <Td>
                          <button type="button" onClick={() => setSelectedId(row.domain.id)} className="min-w-0 text-left">
                            <span className="block truncate font-bold text-[#111827]">{row.domain.name}</span>
                            <span className="block truncate text-xs text-[#8a93a3]">{row.domain.slug}</span>
                          </button>
                        </Td>
                        <Td>{row.owners[0]?.username ?? "未分配"}</Td>
                        <Td>{row.moduleCount}</Td>
                        <Td>{formatNumber(row.articleCount)}</Td>
                        <Td>{formatNumber(row.activeUsers)}</Td>
                        <Td>{formatNumber(row.featuredCount)}</Td>
                        <Td><StatusBadge active={row.domain.isActive} hasOwner={row.owners.length > 0} /></Td>
                        <Td>{formatDate(row.domain.updatedAt)}</Td>
                        <Td>
                          <div className="flex gap-2">
                            <SmallButton onClick={() => { setSelectedId(row.domain.id); startEdit(row); }}>编辑</SmallButton>
                            <SmallButton onClick={() => setSelectedId(row.domain.id)}>详情</SmallButton>
                          </div>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-[#eef1f5] px-5 py-4 text-sm text-[#8a93a3]">
                共 {filteredRows.length} 条
              </div>
            </section>
          </div>

          <DomainDetail
            row={selected}
            users={users}
            ownerUserId={ownerUserId}
            saving={saving}
            onOwnerChange={setOwnerUserId}
            onAssignOwner={assignOwner}
            onRemoveOwner={removeOwner}
            onEdit={startEdit}
            onToggleArchive={toggleArchive}
          />
        </div>
      </div>
    </AdminShell>
  );
}

type DomainRow = ReturnType<typeof deriveDomains>[number];

function deriveDomains(domains: DomainSummary[], modules: ModuleSummary[], articles: ArticleSummary[]) {
  const moduleById = new Map(modules.map((item) => [item.id, item]));
  return domains
    .map((domain) => {
      const domainModules = modules.filter((module) => module.domainId === domain.id);
      const moduleIds = new Set(domainModules.map((module) => module.id));
      const domainArticles = articles.filter((article) => moduleIds.has(article.moduleId));
      const authors = new Set(domainArticles.map((article) => article.authorId));
      const moduleArticleCount = new Map<number, number>();
      const moduleActiveUsers = new Map<number, Set<number>>();
      for (const article of domainArticles) {
        moduleArticleCount.set(article.moduleId, (moduleArticleCount.get(article.moduleId) ?? 0) + 1);
        const users = moduleActiveUsers.get(article.moduleId) ?? new Set<number>();
        users.add(article.authorId);
        moduleActiveUsers.set(article.moduleId, users);
      }
      const popularModules = domainModules
        .map((module) => ({
          module,
          articleCount: moduleArticleCount.get(module.id) ?? 0,
          activeUsers: moduleActiveUsers.get(module.id)?.size ?? 0,
        }))
        .sort((a, b) => b.articleCount - a.articleCount || a.module.sortOrder - b.module.sortOrder)
        .slice(0, 5);
      return {
        domain,
        owners: domain.owners ?? [],
        modules: domainModules,
        articleCount: domainArticles.length,
        activeUsers: authors.size,
        featuredCount: domainArticles.filter((article) => article.isFeatured).length,
        moduleCount: domainModules.length,
        popularModules,
        trend: buildTrend(domainArticles),
        firstModuleName: domainModules[0]?.name ?? moduleById.get(domainModules[0]?.id ?? -1)?.name ?? "",
      };
    })
    .sort((a, b) => a.domain.sortOrder - b.domain.sortOrder || a.domain.id - b.domain.id);
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

function DomainCard({ row, index, selected, onClick }: { row: DomainRow; index: number; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[222px] rounded-2xl border bg-white p-5 text-left transition hover:border-[#f8c400] ${
        selected ? "border-[#f8c400] shadow-[0_14px_30px_rgba(248,196,0,0.14)]" : "border-[#e6e9ef] shadow-[0_10px_30px_rgba(17,24,39,0.035)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid size-10 place-items-center rounded-xl bg-[#111827] text-sm font-black text-[#f8c400]">
          {String(index + 1).padStart(2, "0")}
        </div>
        {selected && <span className="grid size-7 place-items-center rounded-full bg-[#f8c400] text-xs font-black text-[#111827]">✓</span>}
      </div>
      <h3 className="mt-4 truncate text-lg font-black text-[#111827]">{row.domain.name}</h3>
      <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-[#667085]">{row.domain.description || "暂无领域描述"}</p>
      <div className="mt-4 grid gap-1 text-sm text-[#667085]">
        <StatLine label="版块数" value={row.moduleCount} />
        <StatLine label="活跃用户" value={row.activeUsers} />
        <StatLine label="文章数" value={row.articleCount} />
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-[#eef1f5] pt-3 text-xs">
        <span className="truncate text-[#667085]">领主 {row.owners[0]?.username ?? "未分配"}</span>
        <StatusBadge active={row.domain.isActive} hasOwner={row.owners.length > 0} compact />
      </div>
    </button>
  );
}

function DomainEditor({
  mode,
  form,
  users,
  ownerUserId,
  saving,
  onChange,
  onOwnerChange,
  onCancel,
  onSave,
}: {
  mode: "create" | "edit";
  form: DomainForm;
  users: CurrentUser[];
  ownerUserId: string;
  saving: boolean;
  onChange: (form: DomainForm) => void;
  onOwnerChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <section className="rounded-2xl border border-[#e6e9ef] bg-white p-5 shadow-[0_10px_30px_rgba(17,24,39,0.035)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-black text-[#111827]">{mode === "create" ? "创建领域" : "编辑领域"}</h2>
        <button type="button" onClick={onCancel} className="text-sm font-semibold text-[#8a93a3]">取消</button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Field label="Slug">
          <input disabled={mode === "edit"} value={form.slug} onChange={(event) => onChange({ ...form, slug: event.target.value })} className="h-12 rounded-xl border border-[#e6e9ef] bg-white px-4 text-sm font-semibold text-[#374151] outline-none focus:border-[#f8c400] disabled:bg-[#f3f5f8]" placeholder="ai-research" />
        </Field>
        <Field label="名称">
          <input value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} className="h-12 rounded-xl border border-[#e6e9ef] bg-white px-4 text-sm font-semibold text-[#374151] outline-none focus:border-[#f8c400]" placeholder="人工智能" />
        </Field>
        <Field label="排序">
          <input value={form.sortOrder} onChange={(event) => onChange({ ...form, sortOrder: event.target.value })} className="h-12 rounded-xl border border-[#e6e9ef] bg-white px-4 text-sm font-semibold text-[#374151] outline-none focus:border-[#f8c400]" inputMode="numeric" />
        </Field>
        <Field label="状态">
          <Select value={form.isActive ? "active" : "inactive"} onChange={(value) => onChange({ ...form, isActive: value === "active" })}>
            <option value="active">正常</option>
            <option value="inactive">归档</option>
          </Select>
        </Field>
        <Field label="领主">
          <Select value={ownerUserId} onChange={onOwnerChange}>
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
        {saving ? "保存中..." : "保存领域"}
      </button>
    </section>
  );
}

function DomainDetail({
  row,
  users,
  ownerUserId,
  saving,
  onOwnerChange,
  onAssignOwner,
  onRemoveOwner,
  onEdit,
  onToggleArchive,
}: {
  row: DomainRow | null;
  users: CurrentUser[];
  ownerUserId: string;
  saving: boolean;
  onOwnerChange: (value: string) => void;
  onAssignOwner: () => void;
  onRemoveOwner: (userId: number) => void;
  onEdit: () => void;
  onToggleArchive: () => void;
}) {
  if (!row) {
    return <aside className="rounded-2xl border border-[#e6e9ef] bg-white p-6 text-sm text-[#8a93a3]">请选择领域查看详情</aside>;
  }
  return (
    <aside className="grid gap-5">
      <section className="rounded-2xl border border-[#e6e9ef] bg-white p-5 shadow-[0_10px_30px_rgba(17,24,39,0.035)]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-xl font-black text-[#111827]">{row.domain.name}</h2>
              <StatusBadge active={row.domain.isActive} hasOwner={row.owners.length > 0} />
            </div>
            <p className="mt-2 text-sm leading-6 text-[#667085]">{row.domain.description || "暂无领域描述"}</p>
            <div className="mt-2 text-xs text-[#8a93a3]">领域 ID：domain_{String(row.domain.id).padStart(3, "0")}</div>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 border-y border-[#eef1f5] py-4 text-sm">
          <Info label="版块数" value={`${row.moduleCount} 个`} />
          <Info label="文章数" value={`${formatNumber(row.articleCount)} 篇`} />
          <Info label="活跃用户" value={formatNumber(row.activeUsers)} />
          <Info label="精选文章" value={`${formatNumber(row.featuredCount)} 篇`} />
          <Info label="创建时间" value={formatDate(row.domain.createdAt)} />
          <Info label="更新时间" value={formatDate(row.domain.updatedAt)} />
        </div>
        <div className="mt-5">
          <div className="mb-3 text-sm font-black text-[#111827]">当前领主</div>
          <div className="grid gap-3">
            {row.owners.map((owner) => (
              <div key={owner.userId} className="flex items-center gap-3 rounded-xl bg-[#fbfcfd] p-3">
                <UserAvatar username={owner.username} avatarUrl={owner.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-[#111827]">{owner.username}</div>
                  <div className="text-xs text-[#8a93a3]">加入时间 {formatDate(owner.createdAt)}</div>
                </div>
                <button type="button" disabled={saving} onClick={() => onRemoveOwner(owner.userId)} className="text-xs font-bold text-[#ef4444] disabled:opacity-50">移除</button>
              </div>
            ))}
            {row.owners.length === 0 && <div className="rounded-xl bg-[#fffaf0] p-3 text-sm text-[#b45309]">当前领域还没有领主</div>}
          </div>
          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
            <Select value={ownerUserId} onChange={onOwnerChange}>
              <option value="">选择用户</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.username}</option>
              ))}
            </Select>
            <button type="button" disabled={saving || !ownerUserId} onClick={onAssignOwner} className="h-11 rounded-xl border border-[#e6e9ef] px-4 text-sm font-bold text-[#374151] disabled:opacity-50">分配</button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#e6e9ef] bg-white p-5 shadow-[0_10px_30px_rgba(17,24,39,0.035)]">
        <h3 className="mb-4 font-black text-[#111827]">热门版块（Top 5）</h3>
        <div className="grid gap-3 text-sm">
          {row.popularModules.map((item, index) => (
            <div key={item.module.id} className="grid grid-cols-[24px_minmax(0,1fr)_80px_72px] items-center gap-3">
              <span className="font-black text-[#111827]">{index + 1}</span>
              <span className="truncate font-semibold text-[#374151]">{item.module.name}</span>
              <span className="text-right text-[#667085]">{formatNumber(item.articleCount)}</span>
              <span className="text-right text-[#667085]">{formatNumber(item.activeUsers)}</span>
            </div>
          ))}
          {row.popularModules.length === 0 && <div className="text-[#8a93a3]">暂无版块</div>}
        </div>
      </section>

      <section className="rounded-2xl border border-[#e6e9ef] bg-white p-5 shadow-[0_10px_30px_rgba(17,24,39,0.035)]">
        <h3 className="mb-4 font-black text-[#111827]">成长趋势（近 30 天）</h3>
        <div className="flex h-28 items-end gap-2 border-b border-[#e6e9ef]">
          {row.trend.map((value, index) => (
            <div key={index} className="flex flex-1 items-end">
              <div className="w-full rounded-t bg-[#f8c400]" style={{ height: `${Math.max(8, value)}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button type="button" onClick={onEdit} className="h-11 rounded-xl bg-[#f8c400] text-sm font-black text-[#111827]">编辑领域</button>
          <button type="button" disabled={saving} onClick={onToggleArchive} className="h-11 rounded-xl border border-[#e6e9ef] text-sm font-bold text-[#ef4444] disabled:opacity-50">
            {row.domain.isActive ? "归档领域" : "恢复领域"}
          </button>
        </div>
      </section>
    </aside>
  );
}

function Select({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="h-12 rounded-xl border border-[#e6e9ef] bg-white px-4 text-sm font-semibold text-[#374151] outline-none focus:border-[#f8c400]">
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
    <div>
      <div className="text-xs text-[#8a93a3]">{label}</div>
      <div className="mt-1 font-bold text-[#374151]">{value}</div>
    </div>
  );
}

function StatLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span>{label}</span>
      <span className="font-bold text-[#374151]">{formatNumber(value)}</span>
    </div>
  );
}

function StatusBadge({ active, hasOwner, compact = false }: { active: boolean; hasOwner: boolean; compact?: boolean }) {
  const label = !active ? "已归档" : hasOwner ? "正常" : "无领主";
  const className = !active
    ? "border-gray-200 bg-gray-50 text-gray-500"
    : hasOwner
      ? "border-green-200 bg-green-50 text-green-600"
      : "border-yellow-200 bg-yellow-50 text-yellow-700";
  return <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-bold ${className}`}>{compact ? label.slice(0, 3) : label}</span>;
}

function SmallButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="h-8 rounded-lg border border-[#e6e9ef] px-3 text-xs font-bold text-[#667085] hover:border-[#f8c400]">
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

function buildTrend(articles: ArticleSummary[]) {
  const buckets = [0, 0, 0, 0, 0, 0];
  for (const article of articles) {
    const day = daysAgo(article.createdAt);
    if (day >= 0 && day <= 30) {
      const bucket = Math.min(5, Math.floor((30 - day) / 5));
      buckets[bucket] += 1;
    }
  }
  const max = Math.max(...buckets, 1);
  return buckets.map((value) => Math.round((value / max) * 100));
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
