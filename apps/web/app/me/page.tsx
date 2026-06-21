"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { UserAvatar } from "@/components/users/UserAvatar";
import { getCurrentUser, type CurrentUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

export default function MePage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          window.location.href = "/login";
          return;
        }
        setError("个人中心加载失败，请稍后重试");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto max-w-5xl px-4 py-10 md:py-14">
        <div className="mb-8">
          <p className="text-sm font-medium text-brass">个人中心</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">账户概览</h1>
        </div>

        {loading && (
          <div className="rounded-lg border border-stone-200 bg-white p-6 text-stone-600">
            正在加载...
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
            {error}
          </div>
        )}

        {user && (
          <div className="grid gap-5 md:grid-cols-[0.9fr_1.1fr]">
            <section className="rounded-lg border border-stone-200 bg-white p-6 shadow-soft">
              <div className="flex items-start gap-4">
                <UserAvatar
                  username={user.username}
                  avatarUrl={user.avatarUrl}
                  size="lg"
                />
                <div>
                  <h2 className="text-lg font-semibold text-ink">基础信息</h2>
                  {user.bio && (
                    <p className="mt-2 text-sm leading-6 text-stone-600">
                      {user.bio}
                    </p>
                  )}
                </div>
              </div>
              <dl className="mt-5 grid gap-4 text-sm">
                <div>
                  <dt className="text-stone-500">用户名</dt>
                  <dd className="mt-1 font-medium text-stone-900">
                    {user.username}
                  </dd>
                </div>
                <div>
                  <dt className="text-stone-500">邮箱</dt>
                  <dd className="mt-1 font-medium text-stone-900">
                    {user.email}
                  </dd>
                </div>
                <div>
                  <dt className="text-stone-500">角色</dt>
                  <dd className="mt-1 font-medium text-stone-900">
                    {user.role}
                  </dd>
                </div>
                {user.school && (
                  <div>
                    <dt className="text-stone-500">学校</dt>
                    <dd className="mt-1 font-medium text-stone-900">
                      {user.school}
                    </dd>
                  </div>
                )}
                {user.company && (
                  <div>
                    <dt className="text-stone-500">公司</dt>
                    <dd className="mt-1 font-medium text-stone-900">
                      {user.company}
                    </dd>
                  </div>
                )}
              </dl>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={`/authors/${user.username}`}
                  className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:border-moss hover:text-moss"
                >
                  预览主页
                </Link>
                <Link
                  href="/me/profile"
                  className="rounded-md bg-moss px-4 py-2 text-sm font-medium text-white hover:bg-[#354f42]"
                >
                  编辑资料
                </Link>
              </div>
            </section>

            <section className="rounded-lg border border-stone-200 bg-white p-6">
              <h2 className="text-lg font-semibold text-ink">常用入口</h2>
              <div className="mt-5 grid gap-3">
                {(user.role === "admin" || user.role === "reviewer") && (
                  <Link
                    href="/admin"
                    className="rounded-md border border-stone-200 px-4 py-3 text-sm text-stone-700 hover:border-stone-300 hover:bg-stone-50"
                  >
                    管理后台
                  </Link>
                )}
                <Link
                  href="/me/submit"
                  className="rounded-md border border-stone-200 px-4 py-3 text-sm text-stone-700 hover:border-stone-300 hover:bg-stone-50"
                >
                  投稿
                </Link>
                <Link
                  href="/me/drafts"
                  className="rounded-md border border-stone-200 px-4 py-3 text-sm text-stone-700 hover:border-stone-300 hover:bg-stone-50"
                >
                  我的草稿
                </Link>
                <Link
                  href="/me/articles"
                  className="rounded-md border border-stone-200 px-4 py-3 text-sm text-stone-700 hover:border-stone-300 hover:bg-stone-50"
                >
                  我的投稿
                </Link>
                <Link
                  href="/me/comments"
                  className="rounded-md border border-stone-200 px-4 py-3 text-sm text-stone-700 hover:border-stone-300 hover:bg-stone-50"
                >
                  我的评论
                </Link>
                <Link
                  href="/me/bookmarks"
                  className="rounded-md border border-stone-200 px-4 py-3 text-sm text-stone-700 hover:border-stone-300 hover:bg-stone-50"
                >
                  我的收藏
                </Link>
                <Link
                  href="/me/following"
                  className="rounded-md border border-stone-200 px-4 py-3 text-sm text-stone-700 hover:border-stone-300 hover:bg-stone-50"
                >
                  我关注的
                </Link>
                <Link
                  href="/me/followers"
                  className="rounded-md border border-stone-200 px-4 py-3 text-sm text-stone-700 hover:border-stone-300 hover:bg-stone-50"
                >
                  关注我的
                </Link>
                <Link
                  href="/me/notifications"
                  className="rounded-md border border-stone-200 px-4 py-3 text-sm text-stone-700 hover:border-stone-300 hover:bg-stone-50"
                >
                  我的通知
                </Link>
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}
