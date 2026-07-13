"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { UserAvatar } from "@/components/users/UserAvatar";
import { getAdminTaskStats, type AdminTaskStats } from "@/lib/api/adminTasks";
import { getCurrentUser, type CurrentUser } from "@/lib/api/auth";
import { unreadNotificationCount } from "@/lib/api/notifications";

type AdminShellProps = {
  active: "dashboard" | "tasks" | "domains" | "modules" | "users" | "roles" | "audit" | "errors";
  title: string;
  eyebrow?: string;
  children: ReactNode;
};

const navItems = [
  { key: "dashboard", href: "/admin/dashboard", label: "数据看板", icon: "▥" },
  { key: "tasks", href: "/admin/tasks", label: "待办事项", icon: "▤" },
  { key: "domains", href: "/admin/domains", label: "领域管理", icon: "✧", adminOnly: true },
  { key: "modules", href: "/admin/modules", label: "版块管理", icon: "□", adminOnly: true },
  { key: "users", href: "/admin/users", label: "用户管理", icon: "♙", adminOnly: true },
  { key: "roles", href: "/admin/roles", label: "角色权限", icon: "♢", adminOnly: true },
  { key: "audit", href: "/admin/audit-logs", label: "操作日志", icon: "☷", adminOnly: true },
  { key: "errors", href: "/admin/error-logs", label: "错误日志", icon: "!", adminOnly: true },
] as const;

export function AdminShell({ active, title, eyebrow = "后台", children }: AdminShellProps) {
  const pathname = usePathname();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [unread, setUnread] = useState(0);
  const [stats, setStats] = useState<AdminTaskStats | null>(null);

  useEffect(() => {
    getCurrentUser().then(setUser).catch(() => setUser(null));
    unreadNotificationCount().then((item) => setUnread(item.count)).catch(() => setUnread(0));
    getAdminTaskStats().then(setStats).catch(() => setStats(null));
  }, []);

  const badges = useMemo(
    () => ({
      tasks: stats?.myPending ?? 0,
      audit: 0,
    }),
    [stats],
  );

  return (
    <main className="min-h-screen bg-[#f7f8fa] text-[#111827]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[256px] border-r border-[#e6e9ef] bg-white lg:flex lg:flex-col">
        <div className="flex h-[74px] items-center gap-3 px-7">
          <div className="grid size-10 place-items-center rounded-lg bg-[#111827] text-xl font-black text-[#f8c400] shadow-[0_14px_30px_rgba(17,24,39,0.16)]">
            游
          </div>
          <div className="text-2xl font-black tracking-normal text-[#111827]">游学书屋</div>
        </div>

        <nav className="mt-4 grid gap-2 px-4">
          {navItems.filter((item) => !("adminOnly" in item) || user?.role === "admin").map((item) => {
            const selected = item.key === active || pathname === item.href;
            const badge = badges[item.key as keyof typeof badges] ?? 0;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`group flex h-12 items-center gap-3 rounded-lg border px-4 text-sm font-semibold transition ${
                  selected
                    ? "border-[#f8c400] bg-[#fffaf0] text-[#f2b900]"
                    : "border-transparent text-[#4b5563] hover:border-[#eceff4] hover:bg-[#fafafa] hover:text-[#111827]"
                }`}
              >
                <span className="grid size-5 place-items-center text-lg leading-none">{item.icon}</span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {badge > 0 && (
                  <span className="rounded-md bg-[#eef1f5] px-2 py-0.5 text-xs font-semibold text-[#6b7280]">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto p-4">
          <div className="flex items-center gap-3 rounded-xl border border-[#e6e9ef] bg-white p-3 shadow-[0_12px_34px_rgba(17,24,39,0.05)]">
            <div className="grid size-9 place-items-center rounded-lg bg-[#111827] text-[#f8c400]">游</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">游学书屋</div>
              <div className="truncate text-xs text-[#8a93a3]">管理后台 v2.0.0</div>
            </div>
            <span className="text-[#9aa3b2]">›</span>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[256px]">
        <header className="sticky top-0 z-20 flex h-[74px] items-center justify-between border-b border-[#e6e9ef] bg-white/92 px-4 backdrop-blur md:px-8">
          <div className="min-w-0">
            <div className="text-sm text-[#8a93a3]">
              {eyebrow} <span className="mx-2 text-[#c3c8d1]">/</span>
              <span className="font-semibold text-[#111827]">{title}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="hidden h-11 w-[360px] items-center gap-3 rounded-lg border border-[#e6e9ef] bg-[#fbfcfd] px-4 text-sm text-[#8a93a3] xl:flex">
              <span className="text-lg">⌕</span>
              <input
                className="min-w-0 flex-1 bg-transparent text-[#111827] outline-none placeholder:text-[#9aa3b2]"
                placeholder="搜索文章、用户、版块、内容..."
              />
              <span className="rounded-md bg-[#eef1f5] px-2 py-1 text-xs font-semibold text-[#6b7280]">⌘ K</span>
            </label>
            <Link href="/me/notifications" className="relative grid size-10 place-items-center rounded-lg hover:bg-[#f3f5f8]">
              <span className="text-xl">♧</span>
              {unread > 0 && (
                <span className="absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-full bg-[#f8c400] text-[10px] font-bold text-[#111827]">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <div className="flex items-center gap-3">
              <UserAvatar username={user?.username ?? "admin"} avatarUrl={user?.avatarUrl ?? ""} size="sm" />
              <div className="hidden text-sm md:block">
                <div className="font-bold text-[#111827]">{user?.username ?? "admin"}</div>
                <div className="text-xs text-[#8a93a3]">{user?.role === "admin" ? "管理员" : "管理成员"}</div>
              </div>
              <span className="text-[#8a93a3]">⌄</span>
            </div>
          </div>
        </header>

        <section className="px-4 py-7 md:px-8">{children}</section>
      </div>
    </main>
  );
}
