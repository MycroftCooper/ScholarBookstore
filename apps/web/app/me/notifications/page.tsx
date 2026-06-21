"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ApiError } from "@/lib/api/client";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "@/lib/api/notifications";

function notificationText(notification: NotificationItem) {
  if (notification.type === "article_comment") {
    return `${notification.actorUsername} 评论了你的文章`;
  }
  if (notification.type === "article_bookmark") {
    return `${notification.actorUsername} 收藏了你的文章`;
  }
  if (notification.type === "followee_article") {
    return `你关注的 ${notification.actorUsername} 发布了新文章`;
  }
  return `${notification.actorUsername} 回复了你的评论`;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const items = await listNotifications();
    setNotifications(items);
  }

  useEffect(() => {
    load()
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          window.location.href = "/login";
          return;
        }
        setError("通知加载失败，请稍后重试");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleRead(id: number) {
    setActingId(id);
    setError("");
    try {
      await markNotificationRead(id);
      await load();
    } catch {
      setError("标记已读失败，请稍后重试");
    } finally {
      setActingId(null);
    }
  }

  async function handleReadAll() {
    setActingId(-1);
    setError("");
    try {
      await markAllNotificationsRead();
      await load();
    } catch {
      setError("全部标记已读失败，请稍后重试");
    } finally {
      setActingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto max-w-5xl px-4 py-10 md:py-14">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-brass">个人中心</p>
            <h1 className="mt-2 text-3xl font-semibold text-ink">我的通知</h1>
          </div>
          <button
            type="button"
            onClick={handleReadAll}
            disabled={actingId === -1 || notifications.length === 0}
            className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 hover:border-stone-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            全部已读
          </button>
        </div>

        {loading && (
          <div className="rounded-lg border border-stone-200 bg-white p-6 text-stone-600">
            正在加载...
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {!loading && notifications.length === 0 && !error && (
          <div className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
            暂无通知
          </div>
        )}

        <div className="grid gap-3">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className="rounded-lg border border-stone-200 bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-ink">
                    {notificationText(notification)}
                  </div>
                  <p className="mt-2 text-sm text-stone-600">
                    {notification.articleTitle ?? "关联文章"}
                  </p>
                </div>
                <span className="rounded-md bg-stone-100 px-2 py-1 text-xs text-stone-700">
                  {notification.readAt ? "已读" : "未读"}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                {notification.articleId && (
                  <Link
                    href={`/articles/${notification.articleId}`}
                    className="text-sm font-medium text-moss hover:underline"
                  >
                    查看文章
                  </Link>
                )}
                {!notification.readAt && (
                  <button
                    type="button"
                    disabled={actingId === notification.id}
                    onClick={() => handleRead(notification.id)}
                    className="text-sm font-medium text-stone-700 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    标记已读
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
