"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import { SiteFrame } from "@/components/layout/SiteFrame";
import { MeSideNav } from "@/components/me/MeSideNav";
import { UserAvatar } from "@/components/users/UserAvatar";
import { listMyArticles, type ArticleSummary } from "@/lib/api/articles";
import { getCurrentUser, type CurrentUser } from "@/lib/api/auth";
import {
  createBookmarkCollection,
  deleteBookmarkCollection,
  listBookmarkCollections,
  listBookmarks,
  moveBookmark,
  removeBookmark,
  updateBookmarkCollection,
  type BookmarkedArticle,
  type BookmarkCollection,
} from "@/lib/api/bookmarks";
import { ApiError } from "@/lib/api/client";
import { listMyComments, type CommentItem } from "@/lib/api/comments";
import { getPublicAuthorProfile, listFollowers, listFollowing, type FollowUser, type PublicAuthorProfile } from "@/lib/api/users";

type PageData = {
  user: CurrentUser;
  profile: PublicAuthorProfile | null;
  articles: ArticleSummary[];
  bookmarks: BookmarkedArticle[];
  collections: BookmarkCollection[];
  comments: CommentItem[];
  following: FollowUser[];
  followers: FollowUser[];
};

type Metrics = {
  published: ArticleSummary[];
  drafts: ArticleSummary[];
  receivedLikes: number;
  followersCount: number;
};

export default function MyBookmarksPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [collectionId, setCollectionId] = useState<number | undefined>();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"latest" | "title" | "views">("latest");
  const [newCollectionName, setNewCollectionName] = useState("");
  const [collectionNames, setCollectionNames] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState("");
  const [error, setError] = useState("");

  async function load(nextCollectionId = collectionId) {
    const user = await getCurrentUser();
    const [profile, articles, bookmarks, collections, comments, following, followers] = await Promise.all([
      getPublicAuthorProfile(user.username).catch(() => null),
      listMyArticles().catch(() => []),
      listBookmarks(nextCollectionId),
      listBookmarkCollections(),
      listMyComments().catch(() => []),
      listFollowing().then((page) => page.users).catch(() => []),
      listFollowers().catch(() => []),
    ]);
    setData({ user, profile, articles, bookmarks, collections, comments, following, followers });
    setCollectionNames(Object.fromEntries(collections.map((item) => [item.id, item.name])));
  }

  useEffect(() => {
    load()
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          window.location.href = "/login";
          return;
        }
        setError("收藏加载失败，请稍后重试");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const metrics = useMemo<Metrics>(() => {
    const articles = data?.articles ?? [];
    return {
      published: articles.filter((item) => item.status === "published"),
      drafts: articles.filter((item) => item.status === "draft"),
      receivedLikes: data?.comments.reduce((sum, item) => sum + item.upVotes, 0) ?? 0,
      followersCount: data?.profile?.followersCount ?? data?.followers.length ?? 0,
    };
  }, [data]);

  const filteredBookmarks = useMemo(() => {
    let items = [...(data?.bookmarks ?? [])];
    const keyword = query.trim().toLowerCase();
    if (keyword) {
      items = items.filter((item) =>
        `${item.title} ${item.summary} ${item.moduleName} ${item.authorUsername}`.toLowerCase().includes(keyword),
      );
    }
    if (sort === "title") {
      items.sort((a, b) => a.title.localeCompare(b.title, "zh-CN"));
    } else if (sort === "views") {
      items.sort((a, b) => b.viewCount - a.viewCount);
    } else {
      items.sort((a, b) => new Date(b.bookmarkedAt).getTime() - new Date(a.bookmarkedAt).getTime());
    }
    return items;
  }, [data?.bookmarks, query, sort]);

  const recentBookmarks = (data?.bookmarks ?? []).slice(0, 5);

  async function reload(nextCollectionId = collectionId) {
    setError("");
    try {
      await load(nextCollectionId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "收藏加载失败，请稍后重试");
    }
  }

  async function handleCollectionChange(value: string) {
    const nextCollectionId = value ? Number(value) : undefined;
    setCollectionId(nextCollectionId);
    await reload(nextCollectionId);
  }

  async function handleRemoveBookmark(item: BookmarkedArticle) {
    setActing(`remove-${item.bookmarkId}`);
    try {
      await removeBookmark(item.articleId);
      await reload(collectionId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "取消收藏失败");
    } finally {
      setActing("");
    }
  }

  async function handleMoveBookmark(bookmarkId: number, nextCollectionId: number) {
    setActing(`move-${bookmarkId}`);
    try {
      await moveBookmark(bookmarkId, nextCollectionId);
      await reload(collectionId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "移动收藏失败");
    } finally {
      setActing("");
    }
  }

  async function handleCreateCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newCollectionName.trim()) {
      return;
    }
    setActing("create");
    try {
      await createBookmarkCollection(newCollectionName.trim());
      setNewCollectionName("");
      await reload(collectionId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "创建收藏夹失败");
    } finally {
      setActing("");
    }
  }

  async function handleRenameCollection(collection: BookmarkCollection) {
    const nextName = (collectionNames[collection.id] ?? "").trim();
    if (!nextName || nextName === collection.name) {
      return;
    }
    setActing(`rename-${collection.id}`);
    try {
      await updateBookmarkCollection(collection.id, nextName);
      await reload(collectionId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "重命名收藏夹失败");
    } finally {
      setActing("");
    }
  }

  async function handleDeleteCollection(collection: BookmarkCollection) {
    if (collection.isDefault) {
      return;
    }
    setActing(`delete-${collection.id}`);
    try {
      await deleteBookmarkCollection(collection.id);
      const nextCollectionId = collectionId === collection.id ? undefined : collectionId;
      setCollectionId(nextCollectionId);
      await reload(nextCollectionId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "删除收藏夹失败");
    } finally {
      setActing("");
    }
  }

  return (
    <SiteFrame>
      <section className="mx-auto max-w-7xl px-4 py-6 md:px-6 lg:px-8">
        {loading && <StateCard>正在加载我的收藏...</StateCard>}
        {error && <StateCard tone="error">{error}</StateCard>}

        {data && (
          <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
            <aside className="space-y-5">
              <ProfileCard data={data} metrics={metrics} />
              <MeSideNav
                activeHref="/me/bookmarks"
                counts={{
                  following: data.following.length,
                  bookmarks: data.bookmarks.length,
                  comments: data.comments.length,
                }}
              />
            </aside>

            <main className="min-w-0 space-y-5">
              <HeroCard />
              <StatsGrid total={data.bookmarks.length} collections={data.collections.length} />
              <BookmarkTools
                query={query}
                sort={sort}
                collectionId={collectionId}
                collections={data.collections}
                onQuery={setQuery}
                onSort={setSort}
                onCollection={handleCollectionChange}
              />
              <BookmarkTable
                bookmarks={filteredBookmarks}
                collections={data.collections}
                acting={acting}
                onMove={handleMoveBookmark}
                onRemove={handleRemoveBookmark}
              />
            </main>

            <aside className="space-y-5">
              <RecentPanel items={recentBookmarks} />
              <CollectionManager
                collections={data.collections}
                collectionNames={collectionNames}
                newCollectionName={newCollectionName}
                acting={acting}
                onNameChange={setNewCollectionName}
                onCollectionNameChange={setCollectionNames}
                onCreate={handleCreateCollection}
                onRename={handleRenameCollection}
                onDelete={handleDeleteCollection}
              />
              <TipsPanel />
            </aside>
          </div>
        )}
      </section>
    </SiteFrame>
  );
}

function ProfileCard({ data, metrics }: { data: PageData; metrics: Metrics }) {
  return (
    <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-6 text-center shadow-[var(--shadow-soft)]">
      <div className="mx-auto w-fit rounded-full border border-[var(--color-line)] bg-[var(--color-surface-solid)] p-2">
        <UserAvatar username={data.user.username} avatarUrl={data.user.avatarUrl} size="lg" />
      </div>
      <h1 className="mt-4 text-2xl font-semibold text-[var(--color-ink)]">{data.user.username}</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">@{data.user.username}</p>
      <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
        {data.user.bio || "热爱技术，热爱分享与思考"}
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Badge>{roleLabel(data.user.role)}</Badge>
        {data.user.company && <Badge>{data.user.company}</Badge>}
        {data.user.school && <Badge>{data.user.school}</Badge>}
      </div>
      <div className="mt-6 grid grid-cols-5 gap-2 border-t border-[var(--color-line)] pt-5 text-center">
        <MiniStat label="文章" value={String(metrics.published.length)} />
        <MiniStat label="草稿" value={String(metrics.drafts.length)} />
        <MiniStat label="获赞" value={formatCompact(metrics.receivedLikes)} />
        <MiniStat label="收藏" value={formatCompact(data.bookmarks.length)} />
        <MiniStat label="粉丝" value={formatCompact(metrics.followersCount)} />
      </div>
    </section>
  );
}

function HeroCard() {
  return (
    <section className="relative overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-7 shadow-[var(--shadow-soft)]">
      <ContourLayer />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-muted)]">// Bookmarks</p>
        <h2 className="mt-3 text-3xl font-semibold text-[var(--color-ink)]">我的收藏</h2>
        <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">
          管理你保存的优质内容，快速回顾与二次学习。
        </p>
      </div>
    </section>
  );
}

function StatsGrid({ total, collections }: { total: number; collections: number }) {
  const items: Array<[string, number, string]> = [
    ["全部收藏", total, "条"],
    ["文章收藏", total, "条"],
    ["收藏夹", collections, "个"],
    ["最近收藏", Math.min(total, 5), "条"],
  ];
  return (
    <section className="grid gap-4 md:grid-cols-4">
      {items.map(([label, value, hint]) => (
        <div key={label} className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)]">
          <div className="text-sm text-[var(--color-muted)]">{label}</div>
          <div className="mt-2 text-3xl font-semibold text-[var(--color-ink)]">{formatCompact(value)}</div>
          <div className="mt-2 text-xs text-[var(--color-muted)]">{hint}{label === "全部收藏" ? ` · ${collections} 个收藏夹` : ""}</div>
        </div>
      ))}
    </section>
  );
}

function BookmarkTools({
  query,
  sort,
  collectionId,
  collections,
  onQuery,
  onSort,
  onCollection,
}: {
  query: string;
  sort: "latest" | "title" | "views";
  collectionId: number | undefined;
  collections: BookmarkCollection[];
  onQuery: (value: string) => void;
  onSort: (value: "latest" | "title" | "views") => void;
  onCollection: (value: string) => void;
}) {
  return (
    <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)]">
      <div>
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="搜索收藏内容..."
          className="h-11 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-4 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-accent-strong)]"
        />
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <select value={collectionId ?? ""} onChange={(event) => onCollection(event.target.value)} className={selectClass}>
          <option value="">收藏夹：全部收藏</option>
          {collections.map((collection) => (
            <option key={collection.id} value={collection.id}>
              {collection.name}（{collection.itemCount}）
            </option>
          ))}
        </select>
        <select value={sort} onChange={(event) => onSort(event.target.value as "latest" | "title" | "views")} className={selectClass}>
          <option value="latest">排序：最近收藏</option>
          <option value="title">排序：标题</option>
          <option value="views">排序：阅读量</option>
        </select>
      </div>
    </section>
  );
}

function BookmarkTable({
  bookmarks,
  collections,
  acting,
  onMove,
  onRemove,
}: {
  bookmarks: BookmarkedArticle[];
  collections: BookmarkCollection[];
  acting: string;
  onMove: (bookmarkId: number, collectionId: number) => void;
  onRemove: (item: BookmarkedArticle) => void;
}) {
  return (
    <Panel title="收藏内容">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] table-fixed text-left text-sm">
          <thead className="text-xs text-[var(--color-muted)]">
            <tr className="border-b border-[var(--color-line)]">
              <th className="w-[34%] px-1 py-3 font-semibold">收藏内容</th>
              <th className="w-[10%] px-1 py-3 font-semibold">类型</th>
              <th className="w-[18%] px-1 py-3 font-semibold">所属版块 / 作者</th>
              <th className="w-[15%] px-1 py-3 font-semibold">收藏时间</th>
              <th className="w-[12%] px-1 py-3 font-semibold">收藏夹</th>
              <th className="w-[16%] px-1 py-3 text-right font-semibold">操作</th>
            </tr>
          </thead>
          <tbody>
            {bookmarks.map((item) => (
              <tr key={item.bookmarkId} className="border-b border-[var(--color-line)] last:border-b-0">
                <td className="px-1 py-3">
                  <Link href={`/articles/${item.articleId}`} className="font-semibold leading-6 text-[var(--color-ink)] hover:text-[var(--color-accent-strong)]">
                    {item.title}
                  </Link>
                  <div className="mt-1 line-clamp-1 text-xs text-[var(--color-muted)]">{item.summary}</div>
                </td>
                <td className="px-1 py-3"><Badge>文章</Badge></td>
                <td className="px-1 py-3 text-[var(--color-muted)]">
                  <div>{item.moduleName}</div>
                  <div className="mt-1 text-xs">作者：{item.authorUsername}</div>
                </td>
                <td className="px-1 py-3 text-[var(--color-muted)]">{formatDateTime(item.bookmarkedAt)}</td>
                <td className="px-1 py-3">
                  <select
                    value={item.collectionId}
                    disabled={acting === `move-${item.bookmarkId}`}
                    onChange={(event) => onMove(item.bookmarkId, Number(event.target.value))}
                    className="h-8 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-2 text-xs text-[var(--color-muted)]"
                  >
                    {collections.map((collection) => (
                      <option key={collection.id} value={collection.id}>{collection.name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-1 py-3 text-right">
                  <div className="inline-flex gap-2">
                    <Link href={`/articles/${item.articleId}`} className={tableActionClass}>查看</Link>
                    <button
                      type="button"
                      disabled={acting === `remove-${item.bookmarkId}`}
                      onClick={() => onRemove(item)}
                      className="inline-flex h-8 items-center justify-center rounded-md border border-red-200 px-3 text-xs font-semibold text-red-600 disabled:opacity-50"
                    >
                      取消收藏
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {bookmarks.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-[var(--color-muted)]">暂无收藏</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function RecentPanel({ items }: { items: BookmarkedArticle[] }) {
  return (
    <Panel title="最近收藏" actionHref="/me/bookmarks" actionText="查看全部">
      <div className="grid gap-3">
        {items.map((item, index) => (
          <Link key={item.bookmarkId} href={`/articles/${item.articleId}`} className="grid grid-cols-[22px_1fr] gap-3 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] p-3">
            <span className="font-semibold text-[var(--color-accent-strong)]">{index + 1}</span>
            <span>
              <span className="block line-clamp-2 font-semibold text-[var(--color-ink)]">{item.title}</span>
              <span className="mt-1 block text-xs text-[var(--color-muted)]">{item.moduleName} · {formatDate(item.bookmarkedAt)}</span>
            </span>
          </Link>
        ))}
        {items.length === 0 && <EmptyLine text="暂无收藏" />}
      </div>
    </Panel>
  );
}

function CollectionManager({
  collections,
  collectionNames,
  newCollectionName,
  acting,
  onNameChange,
  onCollectionNameChange,
  onCreate,
  onRename,
  onDelete,
}: {
  collections: BookmarkCollection[];
  collectionNames: Record<number, string>;
  newCollectionName: string;
  acting: string;
  onNameChange: (value: string) => void;
  onCollectionNameChange: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onRename: (collection: BookmarkCollection) => void;
  onDelete: (collection: BookmarkCollection) => void;
}) {
  return (
    <Panel title="收藏夹管理">
      <form onSubmit={onCreate} className="grid gap-2">
        <input
          value={newCollectionName}
          onChange={(event) => onNameChange(event.target.value)}
          maxLength={80}
          placeholder="新收藏夹名称"
          className="h-10 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-3 text-sm text-[var(--color-ink)]"
        />
        <button type="submit" disabled={acting === "create"} className="h-10 rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-[#171717] disabled:opacity-60">
          新建收藏夹
        </button>
      </form>
      <div className="mt-4 grid gap-3">
        {collections.map((collection) => (
          <div key={collection.id} className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] p-3">
            <input
              value={collectionNames[collection.id] ?? collection.name}
              disabled={collection.isDefault}
              onChange={(event) =>
                onCollectionNameChange((current) => ({
                  ...current,
                  [collection.id]: event.target.value,
                }))
              }
              className="h-9 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-2 text-sm text-[var(--color-ink)] disabled:text-[var(--color-muted)]"
            />
            <div className="mt-2 flex items-center justify-between gap-2 text-xs text-[var(--color-muted)]">
              <span>{collection.itemCount} 条{collection.isDefault ? " · 默认" : ""}</span>
              {!collection.isDefault && (
                <span className="inline-flex gap-2">
                  <button type="button" disabled={acting === `rename-${collection.id}`} onClick={() => onRename(collection)} className="font-semibold text-[var(--color-ink)] disabled:opacity-50">
                    保存
                  </button>
                  <button type="button" disabled={acting === `delete-${collection.id}`} onClick={() => onDelete(collection)} className="font-semibold text-red-600 disabled:opacity-50">
                    删除
                  </button>
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function TipsPanel() {
  return (
    <Panel title="收藏夹提示">
      <div className="grid gap-3 text-sm text-[var(--color-muted)]">
        <Tip title="分类管理更高效" text="通过收藏夹整理文章，回看时更容易定位。" />
        <Tip title="定期回顾与整理" text="删除过时内容，保持收藏夹清爽。" />
        <Tip title="只收藏文章" text="收藏页只管理文章收藏；版块和作者不作为收藏对象。" />
      </div>
    </Panel>
  );
}

function Tip({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] p-3">
      <div className="font-semibold text-[var(--color-ink)]">{title}</div>
      <p className="mt-1 leading-6">{text}</p>
    </div>
  );
}

function Panel({ title, actionHref, actionText, children }: { title: string; actionHref?: string; actionText?: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">{title}</h2>
        {actionHref && (
          <Link href={actionHref} className="text-sm font-semibold text-[var(--color-muted)] hover:text-[var(--color-ink)]">
            {actionText ?? "查看全部"} →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-semibold text-[var(--color-ink)]">{value}</div>
      <div className="mt-1 text-xs text-[var(--color-muted)]">{label}</div>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-3 py-1.5 text-xs font-semibold text-[var(--color-muted)]">
      {children}
    </span>
  );
}

function StateCard({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "error" }) {
  return (
    <div className={`rounded-md border p-6 text-sm ${tone === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]"}`}>
      {children}
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-[var(--color-line)] px-4 py-5 text-center text-sm text-[var(--color-muted)]">{text}</div>;
}

function ContourLayer() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-[0.16]"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at 80% 0%, transparent 0 18%, var(--color-line) 18.5% 19%, transparent 19.5% 25%, var(--color-line) 25.5% 26%, transparent 26.5%), radial-gradient(ellipse at 10% 100%, transparent 0 16%, var(--color-line) 16.5% 17%, transparent 17.5% 24%, var(--color-line) 24.5% 25%, transparent 25.5%)",
      }}
    />
  );
}

const selectClass =
  "h-10 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-3 text-sm text-[var(--color-muted)] outline-none focus:border-[var(--color-accent-strong)]";

const tableActionClass =
  "inline-flex h-8 min-w-14 items-center justify-center rounded-md border border-[var(--color-accent-strong)] px-3 text-xs font-semibold text-[var(--color-ink)]";

function roleLabel(role: CurrentUser["role"]) {
  return {
    user: "写作者",
    reviewer: "审核员",
    admin: "管理员",
  }[role];
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
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
