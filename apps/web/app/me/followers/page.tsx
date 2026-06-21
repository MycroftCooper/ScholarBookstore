"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { UserAvatar } from "@/components/users/UserAvatar";
import { ApiError } from "@/lib/api/client";
import { listFollowers, type FollowUser } from "@/lib/api/users";

export default function FollowersPage() {
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listFollowers()
      .then(setUsers)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          window.location.href = "/login";
          return;
        }
        setError("粉丝列表加载失败");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto max-w-5xl px-4 py-10 md:py-14">
        <h1 className="text-3xl font-semibold text-ink">关注我的用户</h1>
        {error && <div className="mt-5 text-red-700">{error}</div>}
        {loading && <div className="mt-5 text-stone-600">正在加载...</div>}
        {!loading && users.length === 0 && !error && (
          <div className="mt-5 rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
            暂无用户
          </div>
        )}
        <div className="mt-5 grid gap-3">
          {users.map((user) => (
            <Link
              key={user.id}
              href={`/authors/${user.username}`}
              className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white p-4"
            >
              <UserAvatar username={user.username} avatarUrl={user.avatarUrl} />
              <div>
                <div className="font-medium text-ink">{user.username}</div>
                {user.bio && <div className="text-sm text-stone-600">{user.bio}</div>}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
