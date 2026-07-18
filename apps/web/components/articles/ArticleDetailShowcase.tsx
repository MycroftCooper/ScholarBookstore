"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CommentSection } from "@/components/content/CommentSection";
import { UserAvatar } from "@/components/users/UserAvatar";
import {
  buildMarkdownToc,
  MarkdownContent,
  type TocItem,
} from "@/components/markdown/MarkdownContent";
import { useFloatingTip } from "@/components/feedback/FloatingTipProvider";
import { ReportDialog } from "@/components/reports/ReportDialog";
import { getCurrentUser, type CurrentUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import {
  getArticle,
  listArticles,
  type ArticleSummary,
  type ArticleTag,
  voteArticle,
} from "@/lib/api/articles";
import {
  addBookmark,
  getBookmarkState,
  listBookmarkCollections,
  removeBookmark,
  type BookmarkCollection,
  type BookmarkState,
} from "@/lib/api/bookmarks";
import { createArticleReport } from "@/lib/api/reports";
import {
  followUser,
  getFollowState,
  getPublicAuthorProfile,
  type PublicAuthorProfile,
  unfollowUser,
  type FollowState,
} from "@/lib/api/users";

type ArticleDetailShowcaseProps = {
  id: string;
};

type ArticlePreviewShowcaseProps = {
  article: ArticleSummary;
  onClose: () => void;
};

export function ArticleDetailShowcase({ id }: ArticleDetailShowcaseProps) {
  const showTip = useFloatingTip();
  const articleId = Number(id);
  const [article, setArticle] = useState<ArticleSummary | null>(null);
  const [related, setRelated] = useState<ArticleSummary[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authorProfile, setAuthorProfile] = useState<PublicAuthorProfile | null>(null);
  const [bookmarkState, setBookmarkState] = useState<BookmarkState | null>(null);
  const [bookmarkCollections, setBookmarkCollections] = useState<BookmarkCollection[]>([]);
  const [bookmarkCollectionId, setBookmarkCollectionId] = useState<number | "">("");
  const [bookmarkPickerOpen, setBookmarkPickerOpen] = useState(false);
  const [followState, setFollowState] = useState<FollowState | null>(null);
  const [bookmarking, setBookmarking] = useState(false);
  const [voting, setVoting] = useState(false);
  const [following, setFollowing] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportError, setReportError] = useState("");
  const [reporting, setReporting] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const toc = useMemo(() => buildMarkdownToc(article?.contentMd ?? ""), [article?.contentMd]);

  const tags = article?.tags ?? [];
  useEffect(() => {
    if (!Number.isInteger(articleId) || articleId <= 0) {
      setError("文章不存在");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    getArticle(articleId)
      .then((item) => {
        setArticle(item);
        setCommentCount(item.commentCount);
        return Promise.all([
          getCurrentUser()
            .then(setCurrentUser)
            .catch((err) => {
              if (err instanceof ApiError && err.status === 401) {
                setCurrentUser(null);
                return;
              }
              throw err;
            }),
          getBookmarkState(item.id)
            .then(setBookmarkState)
            .catch((err) => {
              if (err instanceof ApiError && err.status === 401) {
                setBookmarkState(null);
                return;
              }
              throw err;
            }),
          listBookmarkCollections()
            .then((items) => {
              setBookmarkCollections(items);
              setBookmarkCollectionId((current) => current || items.find((collection) => collection.isDefault)?.id || items[0]?.id || "");
            })
            .catch((err) => {
              if (err instanceof ApiError && err.status === 401) {
                setBookmarkCollections([]);
                setBookmarkCollectionId("");
                return;
              }
              throw err;
            }),
          getFollowState(item.authorUsername)
            .then(setFollowState)
            .catch((err) => {
              if (err instanceof ApiError && err.status === 401) {
                setFollowState(null);
                return;
              }
              throw err;
            }),
          getPublicAuthorProfile(item.authorUsername)
            .then(setAuthorProfile)
            .catch(() => setAuthorProfile(null)),
          listArticles({ moduleSlug: item.moduleSlug, sort: "hot", pageSize: 6 })
            .then((items) => setRelated(items.filter((relatedItem) => relatedItem.id !== item.id).slice(0, 5)))
            .catch(() => setRelated([])),
        ]);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setError("文章不存在或尚未发布");
          return;
        }
        setError("文章加载失败，请稍后重试");
      })
      .finally(() => setLoading(false));
  }, [articleId]);

  async function handleBookmarkToggle() {
    if (!article || bookmarking) {
      return;
    }
    if (!bookmarkState?.bookmarked) {
      if (!bookmarkState) {
        window.location.href = "/login";
        return;
      }
      setBookmarkPickerOpen(true);
      return;
    }
    setBookmarking(true);
    setError("");
    try {
      const next = await removeBookmark(article.id);
      setBookmarkState(next);
      showTip("已取消收藏");
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

  async function handleBookmarkConfirm() {
    if (!article || bookmarking) {
      return;
    }
    setBookmarking(true);
    setError("");
    try {
      const next = await addBookmark(
        article.id,
        typeof bookmarkCollectionId === "number" ? bookmarkCollectionId : undefined,
      );
      setBookmarkState(next);
      setBookmarkPickerOpen(false);
      showTip("收藏成功");
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

  async function handleFollowToggle() {
    if (!article || following) {
      return;
    }
    setFollowing(true);
    setError("");
    try {
      const next = followState?.following
        ? await unfollowUser(article.authorUsername)
        : await followUser(article.authorUsername);
      setFollowState(next);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        window.location.href = "/login";
        return;
      }
      setError(err instanceof ApiError ? err.message : "关注操作失败，请稍后重试");
    } finally {
      setFollowing(false);
    }
  }

  async function handleArticleVote() {
    if (!article || voting) {
      return;
    }
    if (!currentUser) {
      window.location.href = "/login";
      return;
    }
    setVoting(true);
    setError("");
    const nextValue = article.myVote === 1 ? 0 : 1;
    try {
      const next = await voteArticle(article.id, nextValue);
      setArticle(next);
      showTip(nextValue === 1 ? "点赞成功" : "已取消点赞");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        window.location.href = "/login";
        return;
      }
      setError(err instanceof ApiError ? err.message : "点赞失败，请稍后重试");
    } finally {
      setVoting(false);
    }
  }

  function openReportDialog() {
    if (!article || reporting || reportSent) {
      return;
    }
    if (!currentUser) {
      window.location.href = "/login";
      return;
    }
    setReportReason("");
    setReportError("");
    setReportOpen(true);
  }

  async function handleReport() {
    if (!article || reporting || reportSent) {
      return;
    }
    if (!currentUser) {
      window.location.href = "/login";
      return;
    }
    const reason = reportReason.trim();
    if (!reason) {
      setReportError("请填写举报原因");
      return;
    }
    setReporting(true);
    setReportError("");
    try {
      await createArticleReport(article.id, reason);
      setReportReason("");
      setReportSent(true);
      setReportOpen(false);
      showTip("举报已提交");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        window.location.href = "/login";
        return;
      }
      setReportError(err instanceof ApiError ? err.message : "举报失败，请稍后重试");
    } finally {
      setReporting(false);
    }
  }

  return (
    <div className="relative mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
      <div className="pointer-events-none fixed left-0 top-20 hidden h-[calc(100vh-5rem)] w-14 border-r border-[var(--color-line)] text-[10px] uppercase tracking-[0.28em] text-[var(--color-muted)] xl:block">
        <div className="absolute left-5 top-16 [writing-mode:vertical-rl]">Technical Article</div>
        <div className="absolute bottom-16 left-4 size-6 rounded-full border border-[var(--color-line)]" />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
        <Link href="/domain" className="hover:text-[var(--color-ink)]">Domain</Link>
        <span>//</span>
        {article ? (
          <Link href={`/modules/${article.moduleSlug}`} className="hover:text-[var(--color-ink)]">
            {article.moduleName}
          </Link>
        ) : (
          <span>Module</span>
        )}
        <span>//</span>
        <span>文章</span>
      </div>

      {loading && <StateCard>正在加载文章...</StateCard>}
      {error && <StateCard tone="error">{error}</StateCard>}

      {article && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <main className="min-w-0 space-y-5">
            <ArticleHero
              article={article}
              bookmarkState={bookmarkState}
              bookmarking={bookmarking}
              voting={voting}
              bookmarkCount={article.bookmarkCount}
              commentCount={commentCount}
              onBookmarkToggle={handleBookmarkToggle}
              onVote={handleArticleVote}
            />

            {bookmarkPickerOpen && (
              <BookmarkPicker
                collections={bookmarkCollections}
                value={bookmarkCollectionId}
                bookmarking={bookmarking}
                onChange={setBookmarkCollectionId}
                onCancel={() => setBookmarkPickerOpen(false)}
                onConfirm={handleBookmarkConfirm}
              />
            )}

            {article.summary && <SummaryBox summary={article.summary} />}

            <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)] md:p-7">
              <MarkdownContent content={article.contentMd ?? ""} />
            </section>

            <ArticleActionBar
              article={article}
              bookmarkState={bookmarkState}
              bookmarking={bookmarking}
              voting={voting}
              bookmarkCount={article.bookmarkCount}
              commentCount={commentCount}
              onBookmarkToggle={handleBookmarkToggle}
              onVote={handleArticleVote}
              reporting={reporting}
              reportSent={reportSent}
              onReportOpen={openReportDialog}
            />

            <ReportDialog
              open={reportOpen}
              title="举报文章"
              description={`请说明举报《${article.title}》的原因。`}
              reason={reportReason}
              error={reportError}
              submitting={reporting}
              placeholder="请描述文章中的违规问题"
              onChange={(value) => {
                setReportReason(value);
                if (reportError) {
                  setReportError("");
                }
              }}
              onCancel={() => {
                if (reporting) {
                  return;
                }
                setReportOpen(false);
                setReportReason("");
                setReportError("");
              }}
              onConfirm={handleReport}
            />

            <CommentSection
              articleId={article.id}
              initialCount={commentCount}
              onCountChange={setCommentCount}
            />
          </main>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <TocPanel toc={toc} />
            <AuthorPanel
              article={article}
              profile={authorProfile}
              currentUser={currentUser}
              followState={followState}
              following={following}
              onFollowToggle={handleFollowToggle}
            />
            <RelatedPanel related={related} />
            <TagPanel tags={tags} />
            <InfoPanel article={article} />
          </aside>
        </div>
      )}
    </div>
  );
}

export function ArticlePreviewShowcase({ article, onClose }: ArticlePreviewShowcaseProps) {
  const toc = useMemo(() => buildMarkdownToc(article.contentMd ?? ""), [article.contentMd]);
  const tags = article.tags ?? [];

  return (
    <div className="relative mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">
        <button type="button" onClick={onClose} className="hover:text-[var(--color-ink)]">
          返回编辑
        </button>
        <span>//</span>
        <span>{article.moduleName}</span>
        <span>//</span>
        <span>预览</span>
      </div>

      <section className="mb-5 rounded-md border border-amber-300 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-900 shadow-[var(--shadow-soft)]">
        文章未发布，当前为预览中。这里展示的是读者打开文章详情页时看到的排版效果，预览不会保存草稿或提交审核。
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <main className="min-w-0 space-y-5">
          <ArticleHero
            article={article}
            bookmarkState={null}
            bookmarking={false}
            voting={false}
            bookmarkCount={article.bookmarkCount}
            commentCount={0}
            onBookmarkToggle={() => undefined}
            onVote={() => undefined}
            preview
          />

          {article.summary && <SummaryBox summary={article.summary} />}

          <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)] md:p-7">
            <MarkdownContent content={article.contentMd || "暂无正文内容。"} />
          </section>
        </main>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <TocPanel toc={toc} />
          <TagPanel tags={tags} />
          <InfoPanel article={article} />
        </aside>
      </div>
    </div>
  );
}

function ArticleHero({
  article,
  bookmarkState,
  bookmarking,
  voting,
  bookmarkCount,
  commentCount,
  onBookmarkToggle,
  onVote,
  preview = false,
}: {
  article: ArticleSummary;
  bookmarkState: BookmarkState | null;
  bookmarking: boolean;
  voting: boolean;
  bookmarkCount: number;
  commentCount: number;
  onBookmarkToggle: () => void;
  onVote: () => void;
  preview?: boolean;
}) {
  return (
    <section className="relative overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-soft)] md:p-8">
      <ContourLines />
      <div className="relative">
        <h1 className="max-w-3xl text-3xl font-semibold leading-tight text-[var(--color-ink)] md:text-4xl">
          {article.title}
        </h1>
        {article.summary && (
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-muted)] md:text-base">
            {article.summary}
          </p>
        )}

        <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-4 text-sm text-[var(--color-muted)]">
          <Link href={`/authors/${article.authorUsername}`} className="flex items-center gap-3 font-semibold text-[var(--color-ink)]">
            <UserAvatar username={article.authorUsername} size="sm" />
            {article.authorUsername}
          </Link>
          <span>{formatDate(article.publishedAt ?? article.createdAt)}</span>
          <span>{formatCompact(article.viewCount)} 阅读</span>
          <span>{commentCount} 评论</span>
          <span>{formatCompact(article.upVotes)} 赞</span>
          <span>{formatCompact(bookmarkState?.bookmarkCount ?? article.bookmarkCount)} 收藏</span>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <TagList tags={article.tags ?? []} moduleName={article.moduleName} />
          {!preview && <div className="flex gap-3 text-sm font-semibold">
            <button
              type="button"
              disabled={voting}
              onClick={onVote}
              className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-4 py-2 text-[var(--color-muted)] hover:border-[var(--color-accent-strong)] hover:text-[var(--color-ink)] disabled:opacity-60"
            >
              {article.myVote === 1 ? "已点赞" : "点赞"}
            </button>
            {bookmarkState ? (
              <button
                type="button"
                disabled={bookmarking}
                onClick={onBookmarkToggle}
                className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-4 py-2 text-[var(--color-muted)] hover:border-[var(--color-accent-strong)] hover:text-[var(--color-ink)] disabled:opacity-60"
              >
                {bookmarkState.bookmarked ? "取消收藏" : "收藏"}
              </button>
            ) : (
              <Link
                href="/login"
                className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-4 py-2 text-[var(--color-muted)] hover:border-[var(--color-accent-strong)] hover:text-[var(--color-ink)]"
              >
                登录后收藏
              </Link>
            )}
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(window.location.href)}
              className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-4 py-2 text-[var(--color-muted)] hover:border-[var(--color-accent-strong)] hover:text-[var(--color-ink)]"
            >
              分享
            </button>
          </div>}
        </div>
      </div>
    </section>
  );
}

function BookmarkPicker({
  collections,
  value,
  bookmarking,
  onChange,
  onCancel,
  onConfirm,
}: {
  collections: BookmarkCollection[];
  value: number | "";
  bookmarking: boolean;
  onChange: (value: number | "") => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[var(--color-ink)]">选择收藏夹</div>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            选择要保存到的收藏夹，方便之后整理和回看。
          </p>
          <select
            value={value}
            onChange={(event) => onChange(event.target.value ? Number(event.target.value) : "")}
            className="mt-4 h-11 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-3 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-accent-strong)]"
          >
            {collections.length === 0 && <option value="">默认收藏夹</option>}
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name}{collection.isDefault ? "（默认）" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-md border border-[var(--color-line)] px-4 text-sm font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            取消
          </button>
          <button
            type="button"
            disabled={bookmarking}
            onClick={onConfirm}
            className="h-10 rounded-md bg-[var(--color-accent)] px-5 text-sm font-semibold text-[#171717] disabled:opacity-60"
          >
            {bookmarking ? "收藏中..." : "确认收藏"}
          </button>
        </div>
      </div>
    </section>
  );
}

function SummaryBox({ summary }: { summary: string }) {
  return (
    <section className="relative overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
      <ContourLines />
      <div className="relative">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <span className="grid size-5 place-items-center rounded-full bg-[var(--color-accent)] text-[10px] text-[#171717]">i</span>
          摘要
        </div>
        <p className="text-sm leading-7 text-[var(--color-muted)]">{summary}</p>
      </div>
    </section>
  );
}

function ArticleActionBar({
  article,
  bookmarkState,
  bookmarking,
  voting,
  bookmarkCount,
  commentCount,
  onBookmarkToggle,
  onVote,
  reporting,
  reportSent,
  onReportOpen,
}: {
  article: ArticleSummary;
  bookmarkState: BookmarkState | null;
  bookmarking: boolean;
  voting: boolean;
  bookmarkCount: number;
  commentCount: number;
  onBookmarkToggle: () => void;
  onVote: () => void;
  reporting: boolean;
  reportSent: boolean;
  onReportOpen: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-4 shadow-[var(--shadow-soft)] text-sm font-semibold text-[var(--color-muted)]">
      <button
        type="button"
        disabled={voting}
        onClick={onVote}
        className="rounded-md px-3 py-2 hover:bg-[var(--color-surface-solid)] hover:text-[var(--color-ink)] disabled:opacity-60"
      >
        {voting ? "提交中..." : article.myVote === 1 ? "已点赞" : "点赞"} {formatCompact(article.upVotes)}
      </button>
      <button
        type="button"
        disabled={bookmarking || !bookmarkState}
        onClick={onBookmarkToggle}
        className="rounded-md px-3 py-2 hover:bg-[var(--color-surface-solid)] hover:text-[var(--color-ink)] disabled:opacity-60"
      >
        收藏 {bookmarkState?.bookmarkCount ?? bookmarkCount}
      </button>
      <button type="button" className="rounded-md px-3 py-2 hover:bg-[var(--color-surface-solid)] hover:text-[var(--color-ink)]">
        评论 {commentCount}
      </button>
      <button
        type="button"
        onClick={() => navigator.clipboard?.writeText(window.location.href)}
        className="rounded-md px-3 py-2 hover:bg-[var(--color-surface-solid)] hover:text-[var(--color-ink)]"
      >
        分享
      </button>
      <button
        type="button"
        disabled={reporting || reportSent}
        onClick={onReportOpen}
        className="ml-auto rounded-md px-3 py-2 hover:bg-[var(--color-surface-solid)] hover:text-[var(--color-ink)] disabled:opacity-60"
      >
        {reportSent ? "已举报" : reporting ? "提交中..." : "举报"}
      </button>
    </div>
  );
}

function TocPanel({ toc }: { toc: TocItem[] }) {
  return (
    <SideCard title="目录" action="×">
      <nav className="relative grid gap-3 text-sm">
        <span className="absolute bottom-2 left-1.5 top-2 w-px bg-[var(--color-line)]" />
        {toc.map((item, index) => (
          <a
            key={`${item.id}-${index}`}
            href={`#${item.id}`}
            className="relative flex gap-3 text-[var(--color-muted)] hover:text-[var(--color-ink)]"
            style={{ paddingLeft: `${Math.max(0, item.level - 1) * 12}px` }}
          >
            <span className={`mt-1.5 size-3 rounded-full border ${
              index === 0 ? "border-[var(--color-accent)] bg-[var(--color-accent)]" : "border-[var(--color-line)] bg-[var(--color-surface-solid)]"
            }`} />
            <span>{index + 1}. {item.text}</span>
          </a>
        ))}
      </nav>
    </SideCard>
  );
}

function AuthorPanel({
  article,
  profile,
  currentUser,
  followState,
  following,
  onFollowToggle,
}: {
  article: ArticleSummary;
  profile: PublicAuthorProfile | null;
  currentUser: CurrentUser | null;
  followState: FollowState | null;
  following: boolean;
  onFollowToggle: () => void;
}) {
  const canFollow = currentUser?.username !== article.authorUsername;

  return (
    <SideCard title="作者" action="→">
      <div className="flex gap-4">
        <UserAvatar username={article.authorUsername} size="lg" />
        <div className="min-w-0">
          <Link href={`/authors/${article.authorUsername}`} className="font-semibold hover:text-[var(--color-accent-strong)]">
            {article.authorUsername}
          </Link>
          <p className="mt-1 text-sm leading-6 text-[var(--color-muted)]">
            专注于 {article.moduleName}，分享实践经验和系统设计思考。
          </p>
        </div>
      </div>
      {canFollow && (
        followState ? (
          <button
            type="button"
            disabled={following}
            onClick={onFollowToggle}
            className="mt-5 h-10 w-full rounded-md bg-[var(--color-ink)] text-sm font-semibold text-[var(--color-page)] disabled:opacity-60"
          >
            {followState.following ? "已关注" : "关注"}
          </button>
        ) : (
          <Link
            href="/login"
            className="mt-5 grid h-10 w-full place-items-center rounded-md bg-[var(--color-ink)] text-sm font-semibold text-[var(--color-page)]"
          >
            登录后关注
          </Link>
        )
      )}
      <div className="mt-5 grid grid-cols-3 divide-x divide-[var(--color-line)] text-center text-xs text-[var(--color-muted)]">
        <Stat label="文章" value={formatCompact(profile?.publishedArticleCount ?? 0)} />
        <Stat label="粉丝" value={formatCompact(profile?.followersCount ?? followState?.followersCount ?? 0)} />
        <Stat label="收藏" value={formatCompact(profile?.bookmarkCount ?? 0)} />
      </div>
    </SideCard>
  );
}

function RelatedPanel({ related }: { related: ArticleSummary[] }) {
  return (
    <SideCard title="相关文章">
      <div className="grid gap-3">
        {related.length > 0 ? (
          related.map((item) => (
            <Link
              key={item.id}
              href={`/articles/${item.id}`}
              className="grid grid-cols-[48px_1fr] gap-3 rounded-md p-1 transition hover:bg-[var(--color-surface-solid)]"
            >
              <span className="grid size-12 place-items-center rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] text-xs font-semibold uppercase">
                {item.moduleName.slice(0, 2)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{item.title}</span>
                <span className="mt-1 block text-xs text-[var(--color-muted)]">
                  {item.authorUsername} · {formatCompact(item.viewCount)} 阅读
                </span>
              </span>
            </Link>
          ))
        ) : (
          <p className="text-sm text-[var(--color-muted)]">暂无相关文章</p>
        )}
      </div>
    </SideCard>
  );
}

function TagPanel({ tags }: { tags: ArticleTag[] }) {
  return (
    <SideCard title="文章标签">
      <TagList tags={tags} />
    </SideCard>
  );
}

function InfoPanel({ article }: { article: ArticleSummary }) {
  return (
    <SideCard title="文章信息">
      <dl className="grid gap-3 text-sm text-[var(--color-muted)]">
        <InfoRow label="发布于" value={formatDateTime(article.publishedAt ?? article.createdAt)} />
        <InfoRow label="更新于" value={formatDateTime(article.updatedAt)} />
        <InfoRow label="字数" value={`${article.wordCount.toLocaleString("zh-CN")} 字`} />
        <InfoRow label="阅读时间" value={`约 ${article.readingMinutes} 分钟`} />
        <InfoRow label="来源" value={sourceTypeLabel(article.sourceType)} />
      </dl>
    </SideCard>
  );
}

function SideCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        {action && <span className="text-[var(--color-muted)]">{action}</span>}
      </div>
      {children}
    </section>
  );
}

function TagList({
  tags,
  moduleName,
}: {
  tags: ArticleTag[];
  moduleName?: string;
}) {
  const items = tags.length > 0 ? tags : moduleName ? [{ id: 0, name: moduleName, slug: moduleName, usageCount: 0 }] : [];

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((tag, index) => (
        <Link
          key={`${tag.slug}-${index}`}
          href={`/discover?tag=${encodeURIComponent(tag.slug)}`}
          className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-3 py-1.5 text-xs font-semibold text-[var(--color-muted)] hover:border-[var(--color-accent-strong)] hover:text-[var(--color-ink)]"
        >
          {tag.name}
        </Link>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-semibold text-[var(--color-ink)]">{value}</div>
      <div className="mt-1">{label}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-1 size-3 rounded-sm border border-[var(--color-line)]" />
      <dt className="w-16 shrink-0">{label}</dt>
      <dd className="min-w-0 text-[var(--color-ink)]">{value}</dd>
    </div>
  );
}

function StateCard({
  tone = "default",
  children,
}: {
  tone?: "default" | "error";
  children: React.ReactNode;
}) {
  const className =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]";
  return <div className={`rounded-md border p-6 text-sm ${className}`}>{children}</div>;
}

function ContourLines() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 opacity-[0.18]"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at 75% 10%, transparent 0 18%, var(--color-line) 18.5% 19%, transparent 19.5% 25%, var(--color-line) 25.5% 26%, transparent 26.5%), radial-gradient(ellipse at 8% 90%, transparent 0 16%, var(--color-line) 16.5% 17%, transparent 17.5% 24%, var(--color-line) 24.5% 25%, transparent 25.5%)",
      }}
    />
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCompact(value: number) {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}w`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return String(value);
}

function sourceTypeLabel(sourceType: ArticleSummary["sourceType"]) {
  return sourceType === "reprint" ? "转载" : "原创";
}
