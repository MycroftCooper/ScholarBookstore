"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import {
  deleteComment,
  listMyComments,
  type CommentItem,
} from "@/lib/api/comments";
import { ApiError } from "@/lib/api/client";

export default function MyCommentsPage() {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const items = await listMyComments();
    setComments(items);
  }

  useEffect(() => {
    load()
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          window.location.href = "/login";
          return;
        }
        setError("我的评论加载失败，请稍后重试");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(commentId: number) {
    setActingId(commentId);
    setError("");
    try {
      await deleteComment(commentId);
      await load();
    } catch {
      setError("删除评论失败，请稍后重试");
    } finally {
      setActingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto max-w-5xl px-4 py-10 md:py-14">
        <div className="mb-8">
          <p className="text-sm font-medium text-brass">个人中心</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">我的评论</h1>
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

        {!loading && comments.length === 0 && !error && (
          <div className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
            暂无评论
          </div>
        )}

        <div className="grid gap-3">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="rounded-lg border border-stone-200 bg-white p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-stone-500">
                  {comment.parentId ? "回复" : "评论"} / 文章 #{comment.articleId}
                </div>
                <Link
                  href={`/articles/${comment.articleId}`}
                  className="text-sm font-medium text-moss hover:underline"
                >
                  查看文章
                </Link>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-700">
                {comment.content}
              </p>
              <button
                type="button"
                disabled={actingId === comment.id}
                onClick={() => handleDelete(comment.id)}
                className="mt-3 text-sm font-medium text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
              >
                删除
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
