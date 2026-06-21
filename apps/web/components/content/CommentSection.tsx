"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  createComment,
  deleteComment,
  listComments,
  replyComment,
  voteComment,
  type CommentItem,
} from "@/lib/api/comments";
import { getCurrentUser, type CurrentUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

type CommentSectionProps = {
  articleId: number;
};

export function CommentSection({ articleId }: CommentSectionProps) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [content, setContent] = useState("");
  const [replyContent, setReplyContent] = useState<Record<number, string>>({});
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [sort, setSort] = useState<"latest" | "hot">("latest");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function loadComments() {
    const items = await listComments(articleId, sort);
    setComments(items);
  }

  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        setCurrentUser(user);
        return loadComments();
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          setCurrentUser(null);
          return;
        }
        setError("评论加载失败，请稍后重试");
      })
      .finally(() => setLoading(false));
  }, [articleId, sort]);

  const topLevelComments = useMemo(
    () => comments.filter((comment) => comment.parentId === null),
    [comments],
  );

  function repliesFor(parentId: number) {
    return comments.filter((comment) => comment.parentId === parentId);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await createComment(articleId, content);
      setContent("");
      await loadComments();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("请先登录后再评论");
      } else {
        setError("评论提交失败，请稍后重试");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReply(parentId: number) {
    const value = replyContent[parentId] ?? "";
    setSubmitting(true);
    setError("");
    try {
      await replyComment(parentId, value);
      setReplyContent((current) => ({ ...current, [parentId]: "" }));
      setReplyingTo(null);
      await loadComments();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("请先登录后再回复");
      } else {
        setError("回复提交失败，请稍后重试");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId: number) {
    setSubmitting(true);
    setError("");
    try {
      await deleteComment(commentId);
      await loadComments();
    } catch {
      setError("删除评论失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVote(comment: CommentItem, value: -1 | 1) {
    setError("");
    const nextValue = comment.myVote === value ? 0 : value;
    try {
      const updated = await voteComment(comment.id, nextValue);
      setComments((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch {
      setError("赞踩失败，请稍后重试");
    }
  }

  function canDelete(comment: CommentItem) {
    return (
      currentUser &&
      (currentUser.id === comment.authorId ||
        currentUser.role === "admin" ||
        currentUser.role === "reviewer")
    );
  }

  return (
    <section className="mt-6 rounded-lg border border-stone-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-ink">评论</h2>
      {currentUser && (
        <div className="mt-3 flex gap-2 text-sm">
          <button
            type="button"
            onClick={() => setSort("latest")}
            className={`rounded-md border px-3 py-1 ${
              sort === "latest" ? "border-moss text-moss" : "border-stone-300"
            }`}
          >
            最新
          </button>
          <button
            type="button"
            onClick={() => setSort("hot")}
            className={`rounded-md border px-3 py-1 ${
              sort === "hot" ? "border-moss text-moss" : "border-stone-300"
            }`}
          >
            最热
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {currentUser ? (
        <form onSubmit={handleSubmit} className="mt-4">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            required
            rows={3}
            className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
            placeholder="写下你的评论"
          />
          <button
            type="submit"
            disabled={submitting}
            className="mt-3 rounded-md bg-moss px-4 py-2 text-sm font-medium text-white hover:bg-[#354f42] disabled:cursor-not-allowed disabled:opacity-60"
          >
            发表评论
          </button>
        </form>
      ) : (
        <p className="mt-4 rounded-md bg-stone-50 p-3 text-sm text-stone-500">
          登录后查看评论区并参与评论。
        </p>
      )}

      {currentUser && (
        <div className="mt-6 grid gap-4">
          {loading && <p className="text-sm text-stone-500">正在加载评论...</p>}
          {!loading && topLevelComments.length === 0 && (
            <p className="text-sm text-stone-500">暂无评论</p>
          )}
          {topLevelComments.map((comment) => (
          <div key={comment.id} className="rounded-md border border-stone-200 p-4">
            <div className="text-sm font-medium text-ink">
              {comment.authorUsername}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-700">
              {comment.content}
            </p>
            {currentUser && (
              <div className="mt-2 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => handleVote(comment, 1)}
                  className={`text-sm font-medium hover:underline ${
                    comment.myVote === 1 ? "text-moss" : "text-stone-600"
                  }`}
                >
                  赞 {comment.upVotes}
                </button>
                <button
                  type="button"
                  onClick={() => handleVote(comment, -1)}
                  className={`text-sm font-medium hover:underline ${
                    comment.myVote === -1 ? "text-red-600" : "text-stone-600"
                  }`}
                >
                  踩 {comment.downVotes}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setReplyingTo((current) =>
                      current === comment.id ? null : comment.id,
                    )
                  }
                  className="text-sm font-medium text-moss hover:underline"
                >
                  回复
                </button>
                {canDelete(comment) && (
                  <button
                    type="button"
                    onClick={() => handleDelete(comment.id)}
                    className="text-sm font-medium text-red-600 hover:underline"
                  >
                    删除
                  </button>
                )}
              </div>
            )}

            {replyingTo === comment.id && (
              <div className="mt-3">
                <textarea
                  value={replyContent[comment.id] ?? ""}
                  onChange={(event) =>
                    setReplyContent((current) => ({
                      ...current,
                      [comment.id]: event.target.value,
                    }))
                  }
                  required
                  rows={2}
                  className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-moss focus:ring-2 focus:ring-moss/15"
                />
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleReply(comment.id)}
                  className="mt-2 rounded-md bg-moss px-3 py-2 text-sm font-medium text-white hover:bg-[#354f42] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  提交回复
                </button>
              </div>
            )}

            <div className="mt-3 grid gap-2 border-l border-stone-200 pl-4">
              {repliesFor(comment.id).map((reply) => (
                <div key={reply.id} className="rounded-md bg-stone-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-medium text-ink">
                      {reply.authorUsername}
                      {reply.replyToUsername && (
                        <span className="font-normal text-stone-500">
                          {" "}
                          回复 {reply.replyToUsername}
                        </span>
                      )}
                    </div>
                    {canDelete(reply) && (
                      <button
                        type="button"
                        onClick={() => handleDelete(reply.id)}
                        className="text-sm font-medium text-red-600 hover:underline"
                      >
                        删除
                      </button>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-stone-700">
                    {reply.content}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => handleVote(reply, 1)}
                      className={`text-sm font-medium hover:underline ${
                        reply.myVote === 1 ? "text-moss" : "text-stone-600"
                      }`}
                    >
                      赞 {reply.upVotes}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVote(reply, -1)}
                      className={`text-sm font-medium hover:underline ${
                        reply.myVote === -1 ? "text-red-600" : "text-stone-600"
                      }`}
                    >
                      踩 {reply.downVotes}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          ))}
        </div>
      )}
    </section>
  );
}
