"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CommentSection } from "@/components/content/CommentSection";
import { SiteHeader } from "@/components/layout/SiteHeader";
import {
  buildMarkdownToc,
  MarkdownContent,
} from "@/components/markdown/MarkdownContent";
import { getArticle, type ArticleSummary } from "@/lib/api/articles";
import {
  addBookmark,
  getBookmarkState,
  removeBookmark,
  type BookmarkState,
} from "@/lib/api/bookmarks";
import { ApiError } from "@/lib/api/client";
import { createArticleReport } from "@/lib/api/reports";

export default function ArticleDetailPage() {
  const params = useParams<{ id: string }>();
  const [article, setArticle] = useState<ArticleSummary | null>(null);
  const [bookmarkState, setBookmarkState] = useState<BookmarkState | null>(null);
  const [bookmarking, setBookmarking] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSent, setReportSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const toc = useMemo(
    () => buildMarkdownToc(article?.contentMd ?? ""),
    [article?.contentMd],
  );
  const tags = article?.tags ?? [];

  useEffect(() => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
      setError("文章不存在");
      setLoading(false);
      return;
    }

    getArticle(id)
      .then((item) => {
        setArticle(item);
        return getBookmarkState(item.id)
          .then(setBookmarkState)
          .catch((err) => {
            if (err instanceof ApiError && err.status === 401) {
              setBookmarkState(null);
              return;
            }
            throw err;
          });
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("文章不存在或尚未发布");
          return;
        }
        setError("文章加载失败，请稍后重试");
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  async function handleBookmarkToggle() {
    if (!article || bookmarking) {
      return;
    }
    setBookmarking(true);
    setError("");
    try {
      const next = bookmarkState?.bookmarked
        ? await removeBookmark(article.id)
        : await addBookmark(article.id);
      setBookmarkState(next);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        window.location.href = "/login";
        return;
      }
      setError("收藏操作失败，请稍后重试");
    } finally {
      setBookmarking(false);
    }
  }

  async function handleReport() {
    if (!article || !reportReason.trim()) {
      return;
    }
    setError("");
    try {
      await createArticleReport(article.id, reportReason);
      setReportReason("");
      setReportSent(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        window.location.href = "/login";
        return;
      }
      setError(err instanceof ApiError ? err.message : "举报失败，请稍后重试");
    }
  }

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <article className="mx-auto max-w-6xl px-4 py-10 md:py-14">
        <Link
          href="/"
          className="text-sm font-medium text-moss underline-offset-4 hover:underline"
        >
          返回主页
        </Link>

        {loading && (
          <div className="mt-6 rounded-lg border border-stone-200 bg-white p-6 text-stone-600">
            正在加载文章...
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
            {error}
          </div>
        )}

        {article && (
          <>
            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px]">
              <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-soft">
                <div className="flex flex-wrap items-center gap-2 text-sm text-stone-500">
                  <span>{article.moduleName}</span>
                  <span>/</span>
                  <Link
                    href={`/authors/${article.authorUsername}`}
                    className="font-medium text-moss underline-offset-4 hover:underline"
                  >
                    {article.authorUsername}
                  </Link>
                </div>
                <h1 className="mt-3 text-3xl font-semibold leading-tight text-ink">
                  {article.title}
                </h1>
                {article.summary && (
                  <p className="mt-4 text-base leading-7 text-stone-600">
                    {article.summary}
                  </p>
                )}
                {tags.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <Link
                        key={tag.id}
                        href={`/discover?tag=${encodeURIComponent(tag.slug)}`}
                        className="rounded-md bg-stone-100 px-2 py-1 text-xs font-medium text-stone-700"
                      >
                        {tag.name} · {tag.usageCount}
                      </Link>
                    ))}
                  </div>
                )}
                <div className="mt-5 flex flex-wrap gap-3 text-xs text-stone-500">
                  <span>{article.wordCount} 字</span>
                  <span>约 {article.readingMinutes} 分钟</span>
                  <span>{article.viewCount} 次浏览</span>
                  <span>{article.revisionCount} 次修订</span>
                  {bookmarkState && <span>{bookmarkState.bookmarkCount} 次收藏</span>}
                </div>
                <div className="mt-5">
                  {bookmarkState ? (
                    <button
                      type="button"
                      disabled={bookmarking}
                      onClick={handleBookmarkToggle}
                      className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:border-moss hover:text-moss disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {bookmarkState.bookmarked ? "取消收藏" : "收藏"}
                    </button>
                  ) : (
                    <Link
                      href="/login"
                      className="inline-flex rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:border-moss hover:text-moss"
                    >
                      登录后收藏
                    </Link>
                  )}
                </div>
                <div className="mt-5 rounded-md border border-stone-200 bg-stone-50 p-3">
                  <p className="text-sm font-medium text-stone-700">举报文章</p>
                  <textarea
                    value={reportReason}
                    onChange={(event) => setReportReason(event.target.value)}
                    rows={2}
                    maxLength={1000}
                    className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
                    placeholder="举报原因"
                  />
                  <button
                    type="button"
                    onClick={handleReport}
                    className="mt-2 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
                  >
                    提交举报
                  </button>
                  {reportSent && (
                    <span className="ml-3 text-sm text-green-700">已提交</span>
                  )}
                </div>
                <div className="mt-8 border-t border-stone-200 pt-6">
                  <MarkdownContent content={article.contentMd ?? ""} />
                </div>
              </div>

              {toc.length > 0 && (
                <aside className="hidden lg:block">
                  <div className="sticky top-24 rounded-lg border border-stone-200 bg-white p-4">
                    <p className="text-sm font-semibold text-ink">目录</p>
                    <nav className="mt-3 grid gap-2 text-sm">
                      {toc.map((item) => (
                        <a
                          key={item.id}
                          href={`#${item.id}`}
                          className="text-stone-600 underline-offset-4 hover:text-moss hover:underline"
                          style={{ paddingLeft: `${(item.level - 1) * 12}px` }}
                        >
                          {item.text}
                        </a>
                      ))}
                    </nav>
                  </div>
                </aside>
              )}
            </div>
            <div className="max-w-4xl">
              <CommentSection articleId={article.id} />
            </div>
          </>
        )}
      </article>
    </main>
  );
}
