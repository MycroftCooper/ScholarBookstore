"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { UserAvatar } from "@/components/users/UserAvatar";
import { getCurrentUser, logout, type CurrentUser } from "@/lib/api/auth";
import { unreadNotificationCount } from "@/lib/api/notifications";

const navItems = [
  { href: "/", label: "\u9996\u9875" },
  { href: "/domain", label: "\u9886\u57df" },
  { href: "/discover", label: "\u53d1\u73b0" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("theme");
    const preferredTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    const nextTheme =
      savedTheme === "dark" || savedTheme === "light" ? savedTheme : preferredTheme;
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;

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

  const authLinks = useMemo(() => {
    if (!loaded) {
      return null;
    }

    if (!user) {
      return (
        <>
          <Link
            href="/login"
            className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)] hover:bg-[var(--color-surface-solid)]"
          >
            {"\u767b\u5f55"}
          </Link>
          <Link
            href="/register"
            className="rounded-md bg-[var(--color-accent)] px-3 py-2 font-semibold text-[#171717] hover:bg-[var(--color-accent-strong)]"
          >
            {"\u6ce8\u518c"}
          </Link>
        </>
      );
    }

    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="relative rounded-full"
          aria-label="\u6253\u5f00\u7528\u6237\u83dc\u5355"
          aria-expanded={menuOpen}
        >
          <UserAvatar username={user.username} avatarUrl={user.avatarUrl} size="sm" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-11 z-50 w-48 border border-[var(--color-line)] bg-[var(--color-surface-solid)] py-2 shadow-[var(--shadow-soft)]">
            <HeaderMenuLink href="/me" onClick={() => setMenuOpen(false)}>
              {"\u4e2a\u4eba\u4e2d\u5fc3"}
            </HeaderMenuLink>
            <HeaderMenuLink href="/me/bookmarks" onClick={() => setMenuOpen(false)}>
              {"\u6211\u7684\u6536\u85cf"}
            </HeaderMenuLink>
            <HeaderMenuLink href="/me/notifications" onClick={() => setMenuOpen(false)}>
              {"\u901a\u77e5"}
              {unreadCount > 0 ? ` ${unreadCount}` : ""}
            </HeaderMenuLink>
            <button
              type="button"
              onClick={handleLogout}
              className="block w-full px-4 py-2 text-left text-sm text-[var(--color-muted)] hover:bg-[var(--color-faint)] hover:text-[var(--color-ink)]"
            >
              {"\u9000\u51fa\u767b\u5f55"}
            </button>
          </div>
        )}
      </div>
    );
  }, [loaded, menuOpen, unreadCount, user]);

  async function handleLogout() {
    await logout();
    setUser(null);
    setMenuOpen(false);
    window.location.href = "/";
  }

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("theme", nextTheme);
  }

  function isActive(href: string) {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname?.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-[var(--color-page)]/90 backdrop-blur">
      <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-4 md:px-6 lg:px-8">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-3 text-lg font-black text-[var(--color-ink)]"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#15191f] text-base font-black text-[var(--color-accent)] shadow-[0_10px_26px_rgba(15,23,42,0.16)]">
            游
          </span>
          <span className="truncate">游学书屋</span>
        </Link>

        <nav className="hidden items-center gap-10 text-sm font-semibold md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="relative px-1 py-2 text-[var(--color-ink)]"
            >
              {item.label}
              {isActive(item.href) && (
                <span className="absolute inset-x-0 -bottom-[17px] h-1 bg-[var(--color-accent)]" />
              )}
            </Link>
          ))}
        </nav>

        <div className="flex min-w-0 items-center justify-end gap-2 text-sm">
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-[var(--color-ink)]"
            aria-label={theme === "light" ? "\u5207\u6362\u5230\u6df1\u8272" : "\u5207\u6362\u5230\u6d45\u8272"}
          >
            {theme === "light" ? "\u263e" : "\u2600"}
          </button>
          <div className="hidden items-center gap-2 lg:flex">{authLinks}</div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto] items-center gap-3 border-t border-[var(--color-line)] px-4 py-2 md:hidden">
        <nav className="flex min-w-0 gap-6 overflow-x-auto text-sm font-semibold">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="relative shrink-0 py-1 text-[var(--color-ink)]">
              {item.label}
              {isActive(item.href) && (
                <span className="absolute inset-x-0 -bottom-2 h-1 bg-[var(--color-accent)]" />
              )}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 lg:hidden">{authLinks}</div>
      </div>
    </header>
  );
}

function HeaderMenuLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block px-4 py-2 text-sm text-[var(--color-muted)] hover:bg-[var(--color-faint)] hover:text-[var(--color-ink)]"
    >
      {children}
    </Link>
  );
}
