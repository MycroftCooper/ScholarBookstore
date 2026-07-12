"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SiteFrame } from "@/components/layout/SiteFrame";
import { MeSideNav } from "@/components/me/MeSideNav";
import { UserAvatar } from "@/components/users/UserAvatar";
import { listBookmarks } from "@/lib/api/bookmarks";
import { getCurrentUser, type CurrentUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { unfollowDomain } from "@/lib/api/domains";
import { unfollowModule } from "@/lib/api/modules";
import {
  followUser,
  listFollowers,
  listFollowing,
  listRecommendedUsers,
  unfollowUser,
  type FollowDomain,
  type FollowModule,
  type FollowUser,
  type FollowingPage,
} from "@/lib/api/users";

type PageData = {
  user: CurrentUser;
  following: FollowingPage;
  followers: FollowUser[];
  recommendations: FollowUser[];
  bookmarkCount: number;
};

type Tab = "all" | "authors" | "modules" | "domains";

const tabs: Array<{ value: Tab; label: string }> = [
  { value: "all", label: "全部" },
  { value: "authors", label: "作者" },
  { value: "modules", label: "版块" },
  { value: "domains", label: "领域" },
];

export default function FollowingPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const user = await getCurrentUser();
        const [following, followers, bookmarks] = await Promise.all([
          listFollowing(),
          listFollowers().catch(() => []),
          listBookmarks().catch(() => []),
        ]);
        const recommendations = await listRecommendedUsers(6).catch(() => []);
        setData({ user, following, followers, recommendations, bookmarkCount: bookmarks.length });
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          window.location.href = "/login";
          return;
        }
        setError(err instanceof ApiError ? err.message : "关注列表加载失败，请稍后重试");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const keyword = query.trim().toLowerCase();
  const users = useMemo(
    () =>
      (data?.following.users ?? []).filter((item) =>
        `${item.username} ${item.bio}`.toLowerCase().includes(keyword),
      ),
    [data?.following.users, keyword],
  );
  const modules = useMemo(
    () =>
      (data?.following.modules ?? []).filter((item) =>
        `${item.name} ${item.slug} ${item.domainName} ${item.description}`.toLowerCase().includes(keyword),
      ),
    [data?.following.modules, keyword],
  );
  const domains = useMemo(
    () =>
      (data?.following.domains ?? []).filter((item) =>
        `${item.name} ${item.slug} ${item.description}`.toLowerCase().includes(keyword),
      ),
    [data?.following.domains, keyword],
  );

  async function removeAuthor(username: string) {
    setBusyKey(`user:${username}`);
    try {
      await unfollowUser(username);
      setData((current) =>
        current
          ? {
              ...current,
              following: {
                ...current.following,
                users: current.following.users.filter((item) => item.username !== username),
              },
            }
          : current,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "取消关注失败");
    } finally {
      setBusyKey("");
    }
  }

  async function addRecommendedAuthor(user: FollowUser) {
    setBusyKey(`recommend:${user.username}`);
    try {
      await followUser(user.username);
      setData((current) =>
        current
          ? {
              ...current,
              following: {
                ...current.following,
                users: [user, ...current.following.users],
              },
              recommendations: current.recommendations.filter((item) => item.username !== user.username),
            }
          : current,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "关注失败");
    } finally {
      setBusyKey("");
    }
  }

  async function removeModule(slug: string) {
    setBusyKey(`module:${slug}`);
    try {
      await unfollowModule(slug);
      setData((current) =>
        current
          ? {
              ...current,
              following: {
                ...current.following,
                modules: current.following.modules.filter((item) => item.slug !== slug),
              },
            }
          : current,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "取消关注失败");
    } finally {
      setBusyKey("");
    }
  }

  async function removeDomain(id: number) {
    setBusyKey(`domain:${id}`);
    try {
      await unfollowDomain(id);
      setData((current) =>
        current
          ? {
              ...current,
              following: {
                ...current.following,
                domains: current.following.domains.filter((item) => item.id !== id),
              },
            }
          : current,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "取消关注失败");
    } finally {
      setBusyKey("");
    }
  }

  return (
    <SiteFrame>
      <section className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
        {loading && <StateCard>正在加载关注列表...</StateCard>}
        {error && <StateCard tone="error">{error}</StateCard>}

        {data && (
          <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="space-y-5">
              <ProfileCard data={data} />
              <MeSideNav
                activeHref="/me/following"
                counts={{
                  following: data.following.users.length,
                  bookmarks: data.bookmarkCount,
                }}
              />
            </aside>

            <main className="min-w-0 space-y-5">
              <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-soft)]">
                <h1 className="text-2xl font-semibold text-[var(--color-ink)]">我的关注</h1>
                <p className="mt-2 text-sm text-[var(--color-muted)]">
                  统一管理你关注的作者、版块和领域。
                </p>
                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <Stat label="作者" value={data.following.users.length} />
                  <Stat label="版块" value={data.following.modules.length} />
                  <Stat label="领域" value={data.following.domains.length} />
                  <Stat label="粉丝" value={data.followers.length} />
                </div>
              </section>

              <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)]">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="搜索关注对象"
                    className="h-11 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-4 text-sm outline-none focus:border-[var(--color-accent-strong)]"
                  />
                  <div className="flex flex-wrap gap-2">
                    {tabs.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setTab(item.value)}
                        className={`h-11 rounded-md border px-4 text-sm font-semibold ${
                          tab === item.value
                            ? "border-[var(--color-accent-strong)] bg-[var(--color-accent)] text-[#171717]"
                            : "border-[var(--color-line)] bg-[var(--color-surface-solid)] text-[var(--color-muted)]"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {(tab === "all" || tab === "authors") && (
                <AuthorList users={users} busyKey={busyKey} onRemove={removeAuthor} />
              )}
              {(tab === "all" || tab === "authors") && data.recommendations.length > 0 && (
                <RecommendationList users={data.recommendations} busyKey={busyKey} onFollow={addRecommendedAuthor} />
              )}
              {(tab === "all" || tab === "modules") && (
                <ModuleList modules={modules} busyKey={busyKey} onRemove={removeModule} />
              )}
              {(tab === "all" || tab === "domains") && (
                <DomainList domains={domains} busyKey={busyKey} onRemove={removeDomain} />
              )}
            </main>
          </div>
        )}
      </section>
    </SiteFrame>
  );
}

function RecommendationList({
  users,
  busyKey,
  onFollow,
}: {
  users: FollowUser[];
  busyKey: string;
  onFollow: (user: FollowUser) => void;
}) {
  return (
    <Panel title="推荐作者">
      {users.map((user) => (
        <Row key={user.id}>
          <Link href={`/authors/${user.username}`} className="flex min-w-0 items-center gap-3">
            <UserAvatar username={user.username} avatarUrl={user.avatarUrl} />
            <span className="min-w-0">
              <span className="block truncate font-semibold text-[var(--color-ink)]">{user.username}</span>
              <span className="mt-1 block truncate text-sm text-[var(--color-muted)]">
                {user.bio || `${user.publishedArticleCount} 篇文章 · ${user.followersCount} 位粉丝`}
              </span>
            </span>
          </Link>
          <button
            type="button"
            disabled={busyKey === `recommend:${user.username}`}
            onClick={() => onFollow(user)}
            className="inline-flex h-9 items-center justify-center rounded-md bg-[var(--color-accent)] px-3 text-sm font-semibold text-[#171717] disabled:opacity-50"
          >
            {busyKey === `recommend:${user.username}` ? "关注中..." : "关注"}
          </button>
        </Row>
      ))}
    </Panel>
  );
}

function ProfileCard({ data }: { data: PageData }) {
  return (
    <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-6 text-center shadow-[var(--shadow-soft)]">
      <UserAvatar username={data.user.username} avatarUrl={data.user.avatarUrl} size="lg" />
      <h2 className="mt-4 text-xl font-semibold text-[var(--color-ink)]">{data.user.username}</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">
        {data.user.bio || "还没有填写个人简介。"}
      </p>
    </section>
  );
}

function AuthorList({
  users,
  busyKey,
  onRemove,
}: {
  users: FollowUser[];
  busyKey: string;
  onRemove: (username: string) => void;
}) {
  return (
    <Panel title="关注作者">
      {users.map((user) => (
        <Row key={user.id}>
          <Link href={`/authors/${user.username}`} className="flex min-w-0 items-center gap-3">
            <UserAvatar username={user.username} avatarUrl={user.avatarUrl} />
            <span className="min-w-0">
              <span className="block truncate font-semibold text-[var(--color-ink)]">{user.username}</span>
              <span className="mt-1 block truncate text-sm text-[var(--color-muted)]">
                {user.bio || "暂无简介"}
              </span>
            </span>
          </Link>
          <RemoveButton busy={busyKey === `user:${user.username}`} onClick={() => onRemove(user.username)} />
        </Row>
      ))}
      {users.length === 0 && <EmptyLine text="暂无关注作者" />}
    </Panel>
  );
}

function ModuleList({
  modules,
  busyKey,
  onRemove,
}: {
  modules: FollowModule[];
  busyKey: string;
  onRemove: (slug: string) => void;
}) {
  return (
    <Panel title="关注版块">
      {modules.map((item) => (
        <Row key={item.id}>
          <Link href={`/modules/${item.slug}`} className="min-w-0">
            <span className="block truncate font-semibold text-[var(--color-ink)]">{item.name}</span>
            <span className="mt-1 block truncate text-sm text-[var(--color-muted)]">
              {item.domainName} / {item.description || item.slug}
            </span>
          </Link>
          <RemoveButton busy={busyKey === `module:${item.slug}`} onClick={() => onRemove(item.slug)} />
        </Row>
      ))}
      {modules.length === 0 && <EmptyLine text="暂无关注版块" />}
    </Panel>
  );
}

function DomainList({
  domains,
  busyKey,
  onRemove,
}: {
  domains: FollowDomain[];
  busyKey: string;
  onRemove: (id: number) => void;
}) {
  return (
    <Panel title="关注领域">
      {domains.map((item) => (
        <Row key={item.id}>
          <Link href={`/domain/${item.id}`} className="min-w-0">
            <span className="block truncate font-semibold text-[var(--color-ink)]">{item.name}</span>
            <span className="mt-1 block truncate text-sm text-[var(--color-muted)]">
              {item.description || item.slug}
            </span>
          </Link>
          <RemoveButton busy={busyKey === `domain:${item.id}`} onClick={() => onRemove(item.id)} />
        </Row>
      ))}
      {domains.length === 0 && <EmptyLine text="暂无关注领域" />}
    </Panel>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)]">
      <h2 className="mb-3 text-lg font-semibold text-[var(--color-ink)]">{title}</h2>
      <div className="divide-y divide-[var(--color-line)]">{children}</div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">{children}</div>;
}

function RemoveButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="inline-flex h-9 items-center justify-center rounded-md border border-red-200 px-3 text-sm font-semibold text-red-600 disabled:opacity-50"
    >
      {busy ? "取消中..." : "取消关注"}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] p-4">
      <div className="text-2xl font-semibold text-[var(--color-ink)]">{value}</div>
      <div className="mt-1 text-sm text-[var(--color-muted)]">{label}</div>
    </div>
  );
}

function StateCard({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "error";
}) {
  return (
    <div
      className={`rounded-md border p-5 text-sm ${
        tone === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]"
      }`}
    >
      {children}
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-[var(--color-line)] px-4 py-6 text-center text-sm text-[var(--color-muted)]">
      {text}
    </div>
  );
}
