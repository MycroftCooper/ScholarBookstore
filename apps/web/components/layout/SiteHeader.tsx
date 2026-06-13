"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCurrentUser, logout, type CurrentUser } from "@/lib/api/auth";
import { unreadNotificationCount } from "@/lib/api/notifications";

export function SiteHeader() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getCurrentUser()
      .then((currentUser) => {
        setUser(currentUser);
        return unreadNotificationCount();
      })
      .then((result) => setUnreadCount(result.count))
      .catch(() => {
        setUser(null);
        setUnreadCount(0);
      })
      .finally(() => setLoaded(true));
  }, []);

  async function handleLogout() {
    await logout();
    setUser(null);
    window.location.href = "/";
  }

  return (
    <header className="border-b border-stone-200 bg-paper/95">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="text-lg font-semibold tracking-normal text-ink">
          ScholarBookstore
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link
            href="/"
            className="rounded-md px-3 py-2 text-stone-700 hover:bg-white"
          >
            主页
          </Link>
          {loaded && user ? (
            <>
              <Link
                href="/me"
                className="rounded-md px-3 py-2 text-stone-700 hover:bg-white"
              >
                个人中心
              </Link>
              <Link
                href="/me/notifications"
                className="rounded-md px-3 py-2 text-stone-700 hover:bg-white"
              >
                通知{unreadCount > 0 ? ` ${unreadCount}` : ""}
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-800 hover:border-stone-400"
              >
                退出
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-md px-3 py-2 text-stone-700 hover:bg-white"
              >
                登录
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-moss px-3 py-2 font-medium text-white hover:bg-[#354f42]"
              >
                注册
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
