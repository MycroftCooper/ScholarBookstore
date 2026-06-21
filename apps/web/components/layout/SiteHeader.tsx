"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { UserAvatar } from "@/components/users/UserAvatar";
import { getCurrentUser, logout, type CurrentUser } from "@/lib/api/auth";
import { unreadNotificationCount } from "@/lib/api/notifications";

export function SiteHeader() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
    setMenuOpen(false);
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
          <Link
            href="/domain"
            className="rounded-md px-3 py-2 text-stone-700 hover:bg-white"
          >
            领域
          </Link>
          <Link
            href="/discover"
            className="rounded-md px-3 py-2 text-stone-700 hover:bg-white"
          >
            发现
          </Link>
          {loaded && user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="relative rounded-full"
                aria-label="打开用户菜单"
                aria-expanded={menuOpen}
              >
                <UserAvatar
                  username={user.username}
                  avatarUrl={user.avatarUrl}
                  size="sm"
                />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-medium text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-11 z-20 w-44 rounded-md border border-stone-200 bg-white py-2 shadow-soft">
                  <Link
                    href="/me"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
                  >
                    个人中心
                  </Link>
                  <Link
                    href="/me/bookmarks"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
                  >
                    我的收藏
                  </Link>
                  <Link
                    href="/me/notifications"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
                  >
                    通知{unreadCount > 0 ? ` ${unreadCount}` : ""}
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="block w-full px-4 py-2 text-left text-sm text-stone-700 hover:bg-stone-50"
                  >
                    退出登录
                  </button>
                </div>
              )}
            </div>
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
