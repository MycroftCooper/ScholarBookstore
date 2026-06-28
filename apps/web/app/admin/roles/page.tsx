"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin/AdminShell";
import { UserAvatar } from "@/components/users/UserAvatar";
import { listAdminUsers, updateAdminUser } from "@/lib/api/adminUsers";
import type { CurrentUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  addDomainOwner,
  listDomains,
  removeDomainOwner,
  type DomainSummary,
} from "@/lib/api/domains";
import {
  addModuleModerator,
  listModules,
  removeModuleModerator,
  type ModuleSummary,
} from "@/lib/api/modules";
import { listAuditLogs, type AuditLog } from "@/lib/api/auditLogs";

type GrantKind = "admin" | "reviewer" | "domain-owner" | "module-moderator";
type TabKey = "admins" | "owners" | "moderators" | "matrix";

const roleLabel: Record<GrantKind, string> = {
  admin: "管理员",
  reviewer: "内容审核员",
  "domain-owner": "领主",
  "module-moderator": "版主",
};

const permissions = [
  { group: "内容管理", items: [
    ["内容审核", "yes", "limited", "no"],
    ["内容删除", "yes", "limited", "no"],
    ["发布公告", "yes", "limited", "no"],
  ] },
  { group: "领域管理", items: [
    ["创建/编辑领域", "yes", "no", "no"],
    ["分配领主", "yes", "limited", "no"],
  ] },
  { group: "版块管理", items: [
    ["创建/编辑版块", "yes", "limited", "no"],
    ["分配版主", "yes", "limited", "no"],
  ] },
  { group: "用户管理", items: [
    ["用户查看", "yes", "yes", "no"],
    ["用户封禁/解封", "yes", "yes", "no"],
  ] },
  { group: "系统管理", items: [
    ["角色权限管理", "yes", "no", "no"],
    ["操作日志查看", "yes", "yes", "no"],
    ["系统设置", "yes", "no", "no"],
  ] },
] as const;

export default function AdminRolesPage() {
  const [users, setUsers] = useState<CurrentUser[]>([]);
  const [domains, setDomains] = useState<DomainSummary[]>([]);
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("owners");
  const [grantKind, setGrantKind] = useState<GrantKind>("domain-owner");
  const [grantUserId, setGrantUserId] = useState("");
  const [grantDomainId, setGrantDomainId] = useState("");
  const [grantModuleId, setGrantModuleId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load(keepUserId = selectedUserId) {
    setError("");
    const [nextUsers, nextDomains, nextModules, nextLogs] = await Promise.all([
      listAdminUsers({ pageSize: 100 }),
      listDomains(true),
      listModules(true),
      listAuditLogs({}),
    ]);
    setUsers(nextUsers);
    setDomains(nextDomains);
    setModules(nextModules);
    setLogs(nextLogs);
    const nextSelected = nextUsers.find((user) => user.id === keepUserId) ?? nextUsers[0] ?? null;
    setSelectedUserId(nextSelected?.id ?? null);
    if (!grantUserId && nextSelected) {
      setGrantUserId(String(nextSelected.id));
    }
    if (!grantDomainId && nextDomains[0]) {
      setGrantDomainId(String(nextDomains[0].id));
    }
    if (!grantModuleId && nextModules[0]) {
      setGrantModuleId(String(nextModules[0].id));
    }
  }

  useEffect(() => {
    load()
      .catch((err) => {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          window.location.href = "/login";
          return;
        }
        setError("权限数据加载失败");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => derivePermissionRows(users, domains, modules), [domains, modules, users]);
  const admins = rows.filter((row) => row.user.role === "admin");
  const owners = rows.filter((row) => row.domainScopes.length > 0);
  const moderators = rows.filter((row) => row.moduleScopes.length > 0);
  const selected = rows.find((row) => row.user.id === selectedUserId) ?? rows[0] ?? null;
  const stats = {
    admins: admins.length,
    owners: owners.reduce((sum, row) => sum + row.domainScopes.length, 0),
    moderators: moderators.reduce((sum, row) => sum + row.moduleScopes.length, 0),
    unownedDomains: domains.filter((domain) => (domain.owners ?? []).length === 0).length,
    unmoderatedModules: modules.filter((module) => (module.moderators ?? []).length === 0).length,
  };

  async function grantRole() {
    if (!grantUserId) {
      setError("请选择用户");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const userId = Number(grantUserId);
      if (grantKind === "admin" || grantKind === "reviewer") {
        await updateAdminUser(userId, { role: grantKind === "admin" ? "admin" : "reviewer" });
      } else if (grantKind === "domain-owner") {
        if (!grantDomainId) throw new Error("请选择领域");
        await addDomainOwner(Number(grantDomainId), userId);
      } else {
        if (!grantModuleId) throw new Error("请选择版块");
        await addModuleModerator(Number(grantModuleId), userId);
      }
      setNote("");
      await load(userId);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "授权失败");
    } finally {
      setSaving(false);
    }
  }

  async function revokeGlobalRole(user: CurrentUser) {
    setSaving(true);
    setError("");
    try {
      await updateAdminUser(user.id, { role: "user" });
      await load(user.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "移除角色失败");
    } finally {
      setSaving(false);
    }
  }

  async function revokeDomainOwner(domainId: number, userId: number) {
    setSaving(true);
    setError("");
    try {
      await removeDomainOwner(domainId, userId);
      await load(userId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "移除领主失败");
    } finally {
      setSaving(false);
    }
  }

  async function revokeModuleModerator(moduleId: number, userId: number) {
    setSaving(true);
    setError("");
    try {
      await removeModuleModerator(moduleId, userId);
      await load(userId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "移除版主失败");
    } finally {
      setSaving(false);
    }
  }

  const currentRows = activeTab === "admins" ? admins : activeTab === "owners" ? owners : activeTab === "moderators" ? moderators : rows;

  return (
    <AdminShell active="roles" title="角色权限">
      <div className="grid gap-5">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard title="管理员数量" value={stats.admins} hint="全局 admin" />
          <MetricCard title="领主数量" value={stats.owners} hint="领域授权记录" tone="success" />
          <MetricCard title="版主数量" value={stats.moderators} hint="版块授权记录" tone="success" />
          <MetricCard title="待分配领域" value={stats.unownedDomains} hint="无领主领域" tone="danger" />
          <MetricCard title="无版主版块" value={stats.unmoderatedModules} hint="无版主版块" tone="danger" />
        </div>

        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="min-w-0 overflow-hidden rounded-2xl border border-[#e6e9ef] bg-white shadow-[0_10px_30px_rgba(17,24,39,0.035)]">
            <div className="flex h-14 gap-8 border-b border-[#eef1f5] px-5 text-sm font-bold">
              <TabButton active={activeTab === "admins"} onClick={() => setActiveTab("admins")}>管理员</TabButton>
              <TabButton active={activeTab === "owners"} onClick={() => setActiveTab("owners")}>领主</TabButton>
              <TabButton active={activeTab === "moderators"} onClick={() => setActiveTab("moderators")}>版主</TabButton>
              <TabButton active={activeTab === "matrix"} onClick={() => setActiveTab("matrix")}>权限矩阵</TabButton>
            </div>

            {activeTab === "matrix" ? (
              <PermissionMatrix />
            ) : (
              <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                <RoleTable
                  tab={activeTab}
                  rows={currentRows}
                  selectedUserId={selected?.user.id ?? null}
                  saving={saving}
                  onSelect={setSelectedUserId}
                  onRevokeGlobal={revokeGlobalRole}
                  onRevokeDomain={revokeDomainOwner}
                  onRevokeModule={revokeModuleModerator}
                />
                <PermissionMatrix compact />
              </div>
            )}
          </section>

          <aside className="grid gap-5">
            <GrantPanel
              users={users}
              domains={domains}
              modules={modules}
              selected={selected}
              grantKind={grantKind}
              grantUserId={grantUserId}
              grantDomainId={grantDomainId}
              grantModuleId={grantModuleId}
              note={note}
              saving={saving}
              onKindChange={setGrantKind}
              onUserChange={setGrantUserId}
              onDomainChange={setGrantDomainId}
              onModuleChange={setGrantModuleId}
              onNoteChange={setNote}
              onGrant={grantRole}
            />
            <AuditList logs={logs} />
          </aside>
        </div>
      </div>
    </AdminShell>
  );
}

type PermissionRow = ReturnType<typeof derivePermissionRows>[number];

function derivePermissionRows(users: CurrentUser[], domains: DomainSummary[], modules: ModuleSummary[]) {
  return users.map((user) => {
    const domainScopes = domains
      .filter((domain) => (domain.owners ?? []).some((owner) => owner.userId === user.id))
      .map((domain) => ({ id: domain.id, name: domain.name, createdAt: domain.owners?.find((owner) => owner.userId === user.id)?.createdAt ?? domain.updatedAt }));
    const moduleScopes = modules
      .filter((module) => (module.moderators ?? []).some((moderator) => moderator.userId === user.id))
      .map((module) => ({
        id: module.id,
        name: module.name,
        domainName: module.domainName,
        createdAt: module.moderators?.find((moderator) => moderator.userId === user.id)?.createdAt ?? module.updatedAt,
      }));
    return {
      user,
      domainScopes,
      moduleScopes,
      roleCount: (user.role === "admin" || user.role === "reviewer" ? 1 : 0) + domainScopes.length + moduleScopes.length,
      lastGrantedAt: latestDate([...domainScopes.map((item) => item.createdAt), ...moduleScopes.map((item) => item.createdAt), user.createdAt]),
    };
  });
}

function RoleTable({
  tab,
  rows,
  selectedUserId,
  saving,
  onSelect,
  onRevokeGlobal,
  onRevokeDomain,
  onRevokeModule,
}: {
  tab: TabKey;
  rows: PermissionRow[];
  selectedUserId: number | null;
  saving: boolean;
  onSelect: (id: number) => void;
  onRevokeGlobal: (user: CurrentUser) => void;
  onRevokeDomain: (domainId: number, userId: number) => void;
  onRevokeModule: (moduleId: number, userId: number) => void;
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-[#eef1f5]">
      <div className="flex items-center justify-between border-b border-[#eef1f5] bg-[#fbfcfd] px-4 py-3">
        <h2 className="font-black text-[#111827]">{tab === "admins" ? "管理员管理" : tab === "owners" ? "领主管理" : "版主管理"}</h2>
        <span className="text-sm text-[#8a93a3]">共 {rows.length} 位</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] table-fixed text-sm">
          <colgroup>
            <col />
            <col className="w-[190px]" />
            <col className="w-[130px]" />
            <col className="w-[120px]" />
          </colgroup>
          <thead className="bg-white text-left text-xs font-semibold text-[#8a93a3]">
            <tr>
              <Th>用户</Th>
              <Th>{tab === "owners" ? "负责领域" : tab === "moderators" ? "负责版块" : "全局角色"}</Th>
              <Th>生效时间</Th>
              <Th>操作</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Fragment key={row.user.id}>
                {(tab === "owners" ? row.domainScopes : tab === "moderators" ? row.moduleScopes : [{ id: 0, name: roleText(row.user.role), createdAt: row.user.createdAt }]).map((scope) => (
                  <tr key={`${row.user.id}-${scope.id}-${scope.name}`} className={`border-t border-[#eef1f5] ${selectedUserId === row.user.id ? "bg-[#fffaf0]" : "hover:bg-[#fbfcfd]"}`}>
                    <Td>
                      <button type="button" onClick={() => onSelect(row.user.id)} className="flex min-w-0 items-center gap-3 text-left">
                        <UserAvatar username={row.user.username} avatarUrl={row.user.avatarUrl} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate font-black text-[#111827]">{row.user.username}</span>
                          <span className="block truncate text-xs text-[#8a93a3]">@{row.user.username.toLowerCase()}</span>
                        </span>
                      </button>
                    </Td>
                    <Td>
                      <span className="rounded-md border border-[#e6e9ef] bg-[#fbfcfd] px-2 py-1 text-xs font-bold text-[#667085]">{scope.name}</span>
                    </Td>
                    <Td>{formatDate(scope.createdAt)}</Td>
                    <Td>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          tab === "owners"
                            ? onRevokeDomain(scope.id, row.user.id)
                            : tab === "moderators"
                              ? onRevokeModule(scope.id, row.user.id)
                              : onRevokeGlobal(row.user)
                        }
                        className="h-8 rounded-lg border border-[#e6e9ef] px-3 text-xs font-bold text-[#667085] hover:border-red-200 hover:text-[#ef4444] disabled:opacity-50"
                      >
                        移除
                      </button>
                    </Td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <div className="p-8 text-center text-sm text-[#8a93a3]">暂无真实授权记录</div>}
    </div>
  );
}

function PermissionMatrix({ compact = false }: { compact?: boolean }) {
  return (
    <section className={compact ? "rounded-xl border border-[#eef1f5] bg-white p-4" : "p-5"}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-black text-[#111827]">权限矩阵</h2>
        <span className="text-xs text-[#8a93a3]">基于当前系统角色</span>
      </div>
      <div className="overflow-hidden rounded-xl border border-[#eef1f5]">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col />
            <col className="w-[70px]" />
            <col className="w-[70px]" />
            <col className="w-[70px]" />
          </colgroup>
          <thead className="bg-[#fbfcfd] text-xs text-[#667085]">
            <tr>
              <Th>权限</Th>
              <Th>管理员</Th>
              <Th>领主</Th>
              <Th>版主</Th>
            </tr>
          </thead>
          <tbody>
            {permissions.map((group) => (
              <Fragment key={group.group}>
                <tr className="border-t border-[#eef1f5] bg-[#fbfcfd]">
                  <td colSpan={4} className="px-4 py-2 text-xs font-black text-[#111827]">{group.group}</td>
                </tr>
                {group.items.map(([name, admin, owner, moderator]) => (
                  <tr key={name} className="border-t border-[#eef1f5]">
                    <Td>{name}</Td>
                    <Td><PermDot value={admin} /></Td>
                    <Td><PermDot value={owner} /></Td>
                    <Td><PermDot value={moderator} /></Td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-[#667085]">
        <Legend value="yes" label="可操作" />
        <Legend value="limited" label="有限制" />
        <Legend value="no" label="不可操作" />
      </div>
    </section>
  );
}

function GrantPanel({
  users,
  domains,
  modules,
  selected,
  grantKind,
  grantUserId,
  grantDomainId,
  grantModuleId,
  note,
  saving,
  onKindChange,
  onUserChange,
  onDomainChange,
  onModuleChange,
  onNoteChange,
  onGrant,
}: {
  users: CurrentUser[];
  domains: DomainSummary[];
  modules: ModuleSummary[];
  selected: PermissionRow | null;
  grantKind: GrantKind;
  grantUserId: string;
  grantDomainId: string;
  grantModuleId: string;
  note: string;
  saving: boolean;
  onKindChange: (kind: GrantKind) => void;
  onUserChange: (value: string) => void;
  onDomainChange: (value: string) => void;
  onModuleChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onGrant: () => void;
}) {
  return (
    <section className="rounded-2xl border border-[#e6e9ef] bg-white p-5 shadow-[0_10px_30px_rgba(17,24,39,0.035)]">
      <h2 className="mb-4 font-black text-[#111827]">角色分配</h2>
      {selected && (
        <div className="mb-5 flex items-center gap-3 rounded-xl bg-[#fbfcfd] p-3">
          <UserAvatar username={selected.user.username} avatarUrl={selected.user.avatarUrl} size="lg" />
          <div className="min-w-0">
            <div className="truncate font-black text-[#111827]">{selected.user.username}</div>
            <div className="text-sm text-[#8a93a3]">@{selected.user.username.toLowerCase()}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge>{roleText(selected.user.role)}</Badge>
              {selected.domainScopes.slice(0, 1).map((item) => <Badge key={item.id}>领主：{item.name}</Badge>)}
              {selected.moduleScopes.slice(0, 1).map((item) => <Badge key={item.id}>版主：{item.name}</Badge>)}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        <Field label="授予用户">
          <Select value={grantUserId} onChange={onUserChange}>
            <option value="">选择用户</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.username}</option>)}
          </Select>
        </Field>
        <Field label="授予角色">
          <div className="grid grid-cols-2 gap-2">
            {(["domain-owner", "module-moderator", "reviewer", "admin"] as GrantKind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => onKindChange(kind)}
                className={`h-10 rounded-lg border text-sm font-bold ${grantKind === kind ? "border-[#f8c400] bg-[#fffaf0] text-[#111827]" : "border-[#e6e9ef] text-[#667085]"}`}
              >
                {roleLabel[kind]}
              </button>
            ))}
          </div>
        </Field>
        {grantKind === "domain-owner" && (
          <Field label="负责领域">
            <Select value={grantDomainId} onChange={onDomainChange}>
              <option value="">选择领域</option>
              {domains.map((domain) => <option key={domain.id} value={domain.id}>{domain.name}</option>)}
            </Select>
          </Field>
        )}
        {grantKind === "module-moderator" && (
          <Field label="负责版块">
            <Select value={grantModuleId} onChange={onModuleChange}>
              <option value="">选择版块</option>
              {modules.map((module) => <option key={module.id} value={module.id}>{module.domainName} / {module.name}</option>)}
            </Select>
          </Field>
        )}
        <Field label="备注（选填）">
          <textarea
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            maxLength={200}
            rows={3}
            className="min-h-24 rounded-xl border border-[#e6e9ef] bg-white px-4 py-3 text-sm outline-none focus:border-[#f8c400]"
            placeholder="请输入备注信息，例如分配原因、职责说明等"
          />
        </Field>
        <button type="button" disabled={saving} onClick={onGrant} className="h-12 rounded-xl bg-[#f8c400] text-sm font-black text-[#111827] disabled:opacity-50">
          授予角色
        </button>
      </div>
    </section>
  );
}

function AuditList({ logs }: { logs: AuditLog[] }) {
  const roleLogs = logs.filter((log) => log.targetType === "user" || log.targetType === "domain" || log.targetType === "module").slice(0, 5);
  return (
    <section className="rounded-2xl border border-[#e6e9ef] bg-white p-5 shadow-[0_10px_30px_rgba(17,24,39,0.035)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-black text-[#111827]">最近操作记录</h2>
        <span className="text-xs text-[#8a93a3]">真实审计日志</span>
      </div>
      <div className="grid gap-3 text-sm">
        {roleLogs.map((log) => (
          <div key={log.id} className="grid gap-1 rounded-xl bg-[#fbfcfd] p-3">
            <div className="font-semibold text-[#374151]">{formatAction(log.action)}</div>
            <div className="text-xs text-[#8a93a3]">{formatDate(log.createdAt)} 由 {log.actorName ?? "系统"} 操作</div>
          </div>
        ))}
        {roleLogs.length === 0 && <div className="text-[#8a93a3]">暂无相关操作记录</div>}
      </div>
    </section>
  );
}

function MetricCard({ title, value, hint, tone = "normal" }: { title: string; value: number; hint: string; tone?: "normal" | "success" | "danger" }) {
  const color = tone === "danger" ? "text-[#ef4444]" : tone === "success" ? "text-[#16a34a]" : "text-[#111827]";
  return (
    <section className="rounded-2xl border border-[#e6e9ef] bg-white p-5 shadow-[0_10px_30px_rgba(17,24,39,0.035)]">
      <div className="text-sm font-semibold text-[#4b5563]">{title}</div>
      <div className={`mt-3 text-3xl font-black ${color}`}>{formatNumber(value)}</div>
      <div className="mt-2 text-xs text-[#8a93a3]">{hint}</div>
    </section>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`relative h-14 ${active ? "text-[#111827]" : "text-[#667085]"}`}>
      {children}
      {active && <span className="absolute inset-x-0 bottom-0 h-1 rounded-t-full bg-[#f8c400]" />}
    </button>
  );
}

function PermDot({ value }: { value: "yes" | "limited" | "no" }) {
  const label = value === "yes" ? "✓" : value === "limited" ? "−" : "×";
  const className = value === "yes" ? "text-[#16a34a]" : value === "limited" ? "text-[#f8c400]" : "text-[#8a93a3]";
  return <span className={`text-lg font-black ${className}`}>{label}</span>;
}

function Legend({ value, label }: { value: "yes" | "limited" | "no"; label: string }) {
  return <span className="inline-flex items-center gap-2"><PermDot value={value} />{label}</span>;
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md border border-[#e6e9ef] bg-white px-2 py-1 text-xs font-bold text-[#667085]">{children}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid gap-2 text-xs font-bold text-[#667085]">{label}{children}</label>;
}

function Select({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="h-12 rounded-xl border border-[#e6e9ef] bg-white px-4 text-sm font-semibold text-[#374151] outline-none focus:border-[#f8c400]">{children}</select>;
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-semibold">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-middle text-[#667085]">{children}</td>;
}

function roleText(role: CurrentUser["role"]) {
  return role === "admin" ? "管理员" : role === "reviewer" ? "内容审核员" : "普通用户";
}

function latestDate(values: string[]) {
  const times = values.map((value) => new Date(value).getTime()).filter(Number.isFinite);
  if (times.length === 0) return new Date().toISOString();
  return new Date(Math.max(...times)).toISOString();
}

function formatAction(action: string) {
  const map: Record<string, string> = {
    domain_owner_add: "授予领域领主",
    domain_owner_remove: "移除领域领主",
    module_moderator_add: "授予版块版主",
    module_moderator_remove: "移除版块版主",
    user_update: "更新用户角色/状态",
  };
  return map[action] ?? action;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
