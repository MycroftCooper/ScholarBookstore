import Link from "next/link";

type MeSideNavCounts = {
  following?: number;
  bookmarks?: number;
  comments?: number;
  notifications?: number;
};

type MeSideNavProps = {
  activeHref: string;
  counts?: MeSideNavCounts;
};

const navItems = [
  { label: "总览", href: "/me", badge: "" },
  { label: "关注", href: "/me/following", badge: "following" },
  { label: "收藏", href: "/me/bookmarks", badge: "bookmarks" },
  { label: "评论", href: "/me/comments", badge: "comments" },
  { label: "消息", href: "/me/notifications", badge: "notifications" },
  { label: "文章", href: "/me/articles", badge: "" },
  { label: "设置", href: "/me/profile", badge: "" },
] as const;

export function MeSideNav({ activeHref, counts = {} }: MeSideNavProps) {
  return (
    <nav className="overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]">
      {navItems.map((item) => {
        const badgeValue = item.badge ? counts[item.badge] ?? 0 : 0;
        const isActive = item.href === activeHref;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center justify-between border-b border-[var(--color-line)] px-5 py-4 text-sm font-semibold last:border-b-0 hover:bg-[var(--color-surface-solid)] ${
              isActive
                ? "border-r-2 border-r-[var(--color-accent)] text-[var(--color-ink)]"
                : "text-[var(--color-muted)]"
            }`}
          >
            <span>{item.label}</span>
            {badgeValue > 0 && (
              <span className="rounded-full bg-[var(--color-surface-solid)] px-2 py-0.5 text-xs text-[var(--color-muted)]">
                {badgeValue}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
