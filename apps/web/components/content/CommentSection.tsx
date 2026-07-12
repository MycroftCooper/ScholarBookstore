"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { UserAvatar } from "@/components/users/UserAvatar";
import { getCurrentUser, type CurrentUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  createComment,
  deleteComment,
  listComments,
  replyComment,
  voteComment,
  type CommentItem,
} from "@/lib/api/comments";

type CommentSectionProps = {
  articleId: number;
  initialCount?: number;
};

const pageSize = 10;
const commentAnchorPrefix = "comment-";

function commentDomId(commentId: number) {
  return `${commentAnchorPrefix}${commentId}`;
}

function parseCommentHash() {
  if (typeof window === "undefined") {
    return null;
  }
  const match = window.location.hash.match(/^#comment-(\d+)$/);
  if (!match) {
    return null;
  }
  const id = Number(match[1]);
  return Number.isFinite(id) ? id : null;
}

function hasComment(items: CommentItem[], commentId: number) {
  return items.some((item) => item.id === commentId);
}

export function CommentSection({ articleId, initialCount = 0 }: CommentSectionProps) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [content, setContent] = useState("");
  const [replyContent, setReplyContent] = useState<Record<number, string>>({});
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [sort, setSort] = useState<"hot" | "latest">("hot");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loginRequired, setLoginRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [targetCommentId, setTargetCommentId] = useState<number | null>(null);
  const [highlightedCommentId, setHighlightedCommentId] = useState<number | null>(null);
  const anchorSearchRef = useRef<number | null>(null);

  async function loadComments(nextPage = 1, append = false) {
    try {
      const items = await listComments(articleId, sort, nextPage, pageSize);
      setLoginRequired(false);
      setComments((current) => (append ? [...current, ...items] : items));
      setPage(nextPage);
      setHasMore(items.filter((item) => item.parentId === null).length >= pageSize);
      return items;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setLoginRequired(true);
        setComments([]);
        setHasMore(false);
        return [];
      }
      throw err;
    }
  }

  useEffect(() => {
    setLoading(true);
    setError("");
    setComments([]);
    setPage(1);
    setHasMore(false);
    setLoginRequired(false);
    setHighlightedCommentId(null);
    setTargetCommentId(parseCommentHash());

    Promise.all([
      loadComments(1, false),
      getCurrentUser()
        .then(setCurrentUser)
        .catch((err) => {
          if (err instanceof ApiError && err.status === 401) {
            setCurrentUser(null);
            return;
          }
          throw err;
        }),
    ])
      .catch(() => setError("评论加载失败，请稍后重试"))
      .finally(() => setLoading(false));
  }, [articleId, sort]);

  useEffect(() => {
    function syncHashTarget() {
      setTargetCommentId(parseCommentHash());
      setHighlightedCommentId(null);
      anchorSearchRef.current = null;
    }

    syncHashTarget();
    window.addEventListener("hashchange", syncHashTarget);
    return () => window.removeEventListener("hashchange", syncHashTarget);
  }, [articleId]);

  useEffect(() => {
    if (!targetCommentId || loading || loginRequired) {
      return;
    }

    if (hasComment(comments, targetCommentId)) {
      setHighlightedCommentId(targetCommentId);
      window.requestAnimationFrame(() => {
        document.getElementById(commentDomId(targetCommentId))?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
      return;
    }

    if (!hasMore || anchorSearchRef.current === targetCommentId) {
      return;
    }

    const searchedCommentId = targetCommentId;
    anchorSearchRef.current = searchedCommentId;
    let cancelled = false;

    async function searchRemainingPages() {
      let nextPage = page + 1;
      let currentItems = comments;
      let more = hasMore;

      try {
        while (!cancelled && more && !hasComment(currentItems, searchedCommentId)) {
          const items = await listComments(articleId, sort, nextPage, pageSize);
          currentItems = [...currentItems, ...items];
          more = items.filter((item) => item.parentId === null).length >= pageSize;

          setComments(currentItems);
          setPage(nextPage);
          setHasMore(more);
          nextPage += 1;
        }

        if (!cancelled && !hasComment(currentItems, searchedCommentId)) {
          setError("没有找到对应评论，可能已被删除或暂不可见。");
        }
      } catch (err) {
        if (!cancelled) {
          if (err instanceof ApiError && err.status === 401) {
            setLoginRequired(true);
            return;
          }
          setError("定位评论失败，请稍后重试。");
        }
      } finally {
        if (!cancelled) {
          anchorSearchRef.current = null;
        }
      }
    }

    searchRemainingPages();

    return () => {
      cancelled = true;
    };
  }, [articleId, comments, hasMore, loading, loginRequired, page, sort, targetCommentId]);

  const topLevelComments = useMemo(
    () => comments.filter((comment) => comment.parentId === null),
    [comments],
  );

  function repliesFor(parentId: number) {
    return comments.filter((comment) => comment.parentId === parentId);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content.trim()) {
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await createComment(articleId, content.trim());
      setContent("");
      await loadComments(1, false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        window.location.href = "/login";
        return;
      }
      setError("评论提交失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReply(parentId: number) {
    const value = (replyContent[parentId] ?? "").trim();
    if (!value) {
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await replyComment(parentId, value);
      setReplyContent((current) => ({ ...current, [parentId]: "" }));
      setReplyingTo(null);
      await loadComments(1, false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        window.location.href = "/login";
        return;
      }
      setError("回复提交失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId: number) {
    setSubmitting(true);
    setError("");
    try {
      await deleteComment(commentId);
      await loadComments(1, false);
    } catch {
      setError("删除评论失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVote(comment: CommentItem, value: -1 | 1) {
    if (comment.deleted || comment.visibility === "hidden") {
      return;
    }
    if (!currentUser) {
      window.location.href = "/login";
      return;
    }
    const nextValue = comment.myVote === value ? 0 : value;
    try {
      const updated = await voteComment(comment.id, nextValue);
      setComments((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch {
      setError("点赞操作失败，请稍后重试");
    }
  }

  async function handleLoadMore() {
    setLoadingMore(true);
    setError("");
    try {
      await loadComments(page + 1, true);
    } catch {
      setError("加载更多评论失败，请稍后重试");
    } finally {
      setLoadingMore(false);
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

  if (loginRequired) {
    return (
      <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] px-5 py-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">评论</h2>
            <span className="rounded border border-[var(--color-accent)] px-2 py-0.5 text-xs font-semibold text-[var(--color-accent-strong)]">
              {initialCount}
            </span>
          </div>
        </div>
        <div className="p-5">
          <div className="rounded-md border border-dashed border-[var(--color-line)] bg-[var(--color-surface-solid)] px-4 py-5 text-sm text-[var(--color-muted)]">
            评论仅登录用户可见。请先
            <a href="/login" className="mx-1 font-semibold text-[var(--color-ink)] underline-offset-4 hover:underline">
              登录
            </a>
            后查看评论。
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-line)] px-5 py-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">评论</h2>
          <span className="rounded border border-[var(--color-accent)] px-2 py-0.5 text-xs font-semibold text-[var(--color-accent-strong)]">
            {Math.max(initialCount, topLevelComments.length)}
          </span>
        </div>
        <div className="flex rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] p-1 text-xs font-semibold">
          {(["hot", "latest"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setSort(item)}
              className={`rounded px-3 py-1.5 ${
                sort === item
                  ? "bg-[var(--color-accent)] text-[#171717]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              {item === "hot" ? "最热" : "最新"}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5">
        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {currentUser ? (
          <form onSubmit={handleSubmit} className="mb-5 flex gap-3">
            <UserAvatar username={currentUser.username} avatarUrl={currentUser.avatarUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                required
                rows={2}
                className="w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-4 py-2 text-sm outline-none transition focus:border-[var(--color-accent-strong)]"
                placeholder="写下你的评论..."
              />
              <button
                type="submit"
                disabled={submitting}
                className="mt-2 rounded-md bg-[var(--color-ink)] px-4 py-2 text-sm font-semibold text-[var(--color-page)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                发表评论
              </button>
            </div>
          </form>
        ) : (
          <div className="mb-5 rounded-md border border-dashed border-[var(--color-line)] bg-[var(--color-surface-solid)] px-4 py-3 text-sm text-[var(--color-muted)]">
            登录后可以参与评论、回复和点赞。
          </div>
        )}

        <div className="grid gap-4">
          {loading && <p className="text-sm text-[var(--color-muted)]">正在加载评论...</p>}
          {!loading && topLevelComments.length === 0 && (
            <p className="text-sm text-[var(--color-muted)]">暂无评论，来写下第一条吧。</p>
          )}
          {topLevelComments.map((comment) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              replies={repliesFor(comment.id)}
              replying={replyingTo === comment.id}
              replyValue={replyContent[comment.id] ?? ""}
              submitting={submitting}
              canDelete={Boolean(canDelete(comment))}
              canDeleteReply={(reply) => Boolean(canDelete(reply))}
              onVote={handleVote}
              onDelete={handleDelete}
              onReplyToggle={() =>
                setReplyingTo((current) => (current === comment.id ? null : comment.id))
              }
              onReplyChange={(value) =>
                setReplyContent((current) => ({ ...current, [comment.id]: value }))
              }
              onReplySubmit={() => handleReply(comment.id)}
              highlightedCommentId={highlightedCommentId}
            />
          ))}
        </div>

        {hasMore && (
          <button
            type="button"
            disabled={loadingMore}
            onClick={handleLoadMore}
            className="mt-5 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-4 py-2 text-sm font-semibold text-[var(--color-muted)] hover:border-[var(--color-accent-strong)] hover:text-[var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMore ? "加载中..." : "加载更多评论"}
          </button>
        )}
      </div>
    </section>
  );
}

function CommentCard({
  comment,
  replies,
  replying,
  replyValue,
  submitting,
  canDelete,
  canDeleteReply,
  onVote,
  onDelete,
  onReplyToggle,
  onReplyChange,
  onReplySubmit,
  highlightedCommentId,
}: {
  comment: CommentItem;
  replies: CommentItem[];
  replying: boolean;
  replyValue: string;
  submitting: boolean;
  canDelete: boolean;
  canDeleteReply: (reply: CommentItem) => boolean;
  onVote: (comment: CommentItem, value: -1 | 1) => void;
  onDelete: (id: number) => void;
  onReplyToggle: () => void;
  onReplyChange: (value: string) => void;
  onReplySubmit: () => void;
  highlightedCommentId: number | null;
}) {
  const unavailable = comment.deleted || comment.visibility === "hidden";
  const commentHighlighted = highlightedCommentId === comment.id;

  return (
    <article
      id={commentDomId(comment.id)}
      className={`scroll-mt-24 rounded-md border-b border-[var(--color-line)] pb-4 transition ${
        commentHighlighted
          ? "bg-[rgba(242,194,0,0.12)] px-3 pt-3 ring-2 ring-[var(--color-accent)]"
          : ""
      } last:border-b-0`}
    >
      <div className="flex gap-3">
        <UserAvatar username={comment.authorUsername} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-muted)]">
            <span className="font-semibold text-[var(--color-ink)]">{comment.authorUsername}</span>
            <span>{formatDate(comment.createdAt)}</span>
          </div>
          <p className={`mt-2 whitespace-pre-wrap text-sm leading-7 ${unavailable ? "text-[var(--color-muted)]" : ""}`}>
            {comment.content}
          </p>
          {!unavailable && (
            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs font-semibold text-[var(--color-muted)]">
              <button type="button" onClick={() => onVote(comment, 1)} className="hover:text-[var(--color-ink)]">
                赞 {comment.upVotes}
              </button>
              <button type="button" onClick={() => onReplyToggle()} className="hover:text-[var(--color-ink)]">
                回复
              </button>
              {canDelete && (
                <button type="button" onClick={() => onDelete(comment.id)} className="text-red-600 hover:underline">
                  删除
                </button>
              )}
            </div>
          )}

          {replying && !unavailable && (
            <div className="mt-3">
              <textarea
                value={replyValue}
                onChange={(event) => onReplyChange(event.target.value)}
                rows={2}
                className="w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent-strong)]"
                placeholder={`回复 ${comment.authorUsername}`}
              />
              <button
                type="button"
                disabled={submitting}
                onClick={onReplySubmit}
                className="mt-2 rounded-md bg-[var(--color-ink)] px-3 py-1.5 text-xs font-semibold text-[var(--color-page)] disabled:opacity-60"
              >
                提交回复
              </button>
            </div>
          )}

          {replies.length > 0 && (
            <div className="mt-3 grid gap-2 border-l border-[var(--color-line)] pl-4">
              {replies.map((reply) => {
                const replyHighlighted = highlightedCommentId === reply.id;
                return (
                  <div
                    key={reply.id}
                    id={commentDomId(reply.id)}
                    className={`scroll-mt-24 rounded-md bg-[var(--color-surface-solid)] p-3 transition ${
                      replyHighlighted ? "ring-2 ring-[var(--color-accent)]" : ""
                    }`}
                  >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted)]">
                    <span className="font-semibold text-[var(--color-ink)]">{reply.authorUsername}</span>
                    {reply.replyToUsername && <span>回复 {reply.replyToUsername}</span>}
                    <span>{formatDate(reply.createdAt)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{reply.content}</p>
                  <div className="mt-2 flex gap-4 text-xs font-semibold text-[var(--color-muted)]">
                    <button type="button" onClick={() => onVote(reply, 1)} className="hover:text-[var(--color-ink)]">
                      赞 {reply.upVotes}
                    </button>
                    {canDeleteReply(reply) && (
                      <button type="button" onClick={() => onDelete(reply.id)} className="text-red-600 hover:underline">
                        删除
                      </button>
                    )}
                  </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
