"use client";

import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import type { CurrentUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { listAdminUsers, updateAdminUser } from "@/lib/api/adminUsers";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<CurrentUser[]>([]);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<CurrentUser["role"] | "">("");
  const [status, setStatus] = useState<CurrentUser["status"] | "">("");
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState<number | null>(null);

  async function load() {
    setError("");
    setUsers(await listAdminUsers({ q, role, status }));
  }

  useEffect(() => {
    load().catch((err) => {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        window.location.href = "/login";
        return;
      }
      setError("用户列表加载失败");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function update(id: number, input: { role?: CurrentUser["role"]; status?: CurrentUser["status"] }) {
    setActingId(id);
    setError("");
    try {
      await updateAdminUser(id, input);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "操作失败");
    } finally {
      setActingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-3xl font-semibold text-ink">用户管理</h1>
        <div className="mt-5 flex flex-wrap gap-3">
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="用户名或邮箱"
            className="h-10 rounded-md border border-stone-300 bg-white px-3"
          />
          <select value={role} onChange={(event) => setRole(event.target.value as CurrentUser["role"] | "")} className="h-10 rounded-md border border-stone-300 bg-white px-3">
            <option value="">全部角色</option>
            <option value="user">user</option>
            <option value="reviewer">reviewer</option>
            <option value="admin">admin</option>
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value as CurrentUser["status"] | "")} className="h-10 rounded-md border border-stone-300 bg-white px-3">
            <option value="">全部状态</option>
            <option value="active">active</option>
            <option value="disabled">disabled</option>
          </select>
          <button type="button" onClick={load} className="rounded-md bg-moss px-4 py-2 text-sm text-white">
            查询
          </button>
        </div>
        {error && <div className="mt-4 text-red-700">{error}</div>}
        <div className="mt-5 overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-stone-50 text-stone-600">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">用户名</th>
                <th className="px-4 py-3">邮箱</th>
                <th className="px-4 py-3">角色</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-stone-100">
                  <td className="px-4 py-3">{user.id}</td>
                  <td className="px-4 py-3">{user.username}</td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={user.role}
                      disabled={actingId === user.id}
                      onChange={(event) => update(user.id, { role: event.target.value as CurrentUser["role"] })}
                      className="h-9 rounded-md border border-stone-300 bg-white px-2"
                    >
                      <option value="user">user</option>
                      <option value="reviewer">reviewer</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">{user.status}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={actingId === user.id}
                      onClick={() => update(user.id, { status: user.status === "active" ? "disabled" : "active" })}
                      className="rounded-md border border-stone-300 px-3 py-2 disabled:opacity-50"
                    >
                      {user.status === "active" ? "禁用" : "启用"}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td className="px-4 py-8 text-center text-stone-500" colSpan={6}>
                    暂无用户
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
