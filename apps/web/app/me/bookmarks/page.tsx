"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import {
  createBookmarkCollection,
  deleteBookmarkCollection,
  listBookmarkCollections,
  listBookmarks,
  moveBookmark,
  updateBookmarkCollection,
  type BookmarkedArticle,
  type BookmarkCollection,
} from "@/lib/api/bookmarks";
import { ApiError } from "@/lib/api/client";

export default function MyBookmarksPage() {
  const [collections, setCollections] = useState<BookmarkCollection[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkedArticle[]>([]);
  const [collectionId, setCollectionId] = useState<number | undefined>();
  const [newCollectionName, setNewCollectionName] = useState("");
  const [collectionNames, setCollectionNames] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [actingKey, setActingKey] = useState("");
  const [error, setError] = useState("");

  async function load(nextCollectionId = collectionId) {
    const [collectionItems, bookmarkItems] = await Promise.all([
      listBookmarkCollections(),
      listBookmarks(nextCollectionId),
    ]);
    setCollections(collectionItems);
    setBookmarks(bookmarkItems);
    setCollectionNames(
      Object.fromEntries(collectionItems.map((item) => [item.id, item.name])),
    );
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

  async function handleCollectionChange(nextValue: string) {
    const nextCollectionId = nextValue ? Number(nextValue) : undefined;
    setCollectionId(nextCollectionId);
    setError("");
    try {
      await load(nextCollectionId);
    } catch {
      setError("收藏加载失败，请稍后重试");
    }
  }

  async function handleCreateCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newCollectionName.trim()) {
      return;
    }
    setActing(true);
    setError("");
    try {
      await createBookmarkCollection(newCollectionName);
      setNewCollectionName("");
      await load(collectionId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "创建收藏夹失败");
    } finally {
      setActing(false);
    }
  }

  async function handleRenameCollection(collection: BookmarkCollection) {
    const nextName = (collectionNames[collection.id] ?? "").trim();
    if (!nextName || nextName === collection.name) {
      return;
    }
    setActingKey(`rename-${collection.id}`);
    setError("");
    try {
      await updateBookmarkCollection(collection.id, nextName);
      await load(collectionId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "重命名收藏夹失败");
    } finally {
      setActingKey("");
    }
  }

  async function handleDeleteCollection(collection: BookmarkCollection) {
    if (collection.isDefault) {
      return;
    }
    setActingKey(`delete-${collection.id}`);
    setError("");
    try {
      await deleteBookmarkCollection(collection.id);
      const nextCollectionId =
        collectionId === collection.id ? undefined : collectionId;
      setCollectionId(nextCollectionId);
      await load(nextCollectionId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "删除收藏夹失败");
    } finally {
      setActingKey("");
    }
  }

  async function handleMoveBookmark(bookmarkId: number, nextCollectionId: number) {
    setActingKey(`move-${bookmarkId}`);
    setError("");
    try {
      await moveBookmark(bookmarkId, nextCollectionId);
      await load(collectionId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "移动收藏失败");
    } finally {
      setActingKey("");
    }
  }

  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto max-w-5xl px-4 py-10 md:py-14">
        <div className="mb-8">
          <p className="text-sm font-medium text-brass">个人中心</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">我的收藏</h1>
        </div>

        <div className="mb-5 grid gap-3 rounded-lg border border-stone-200 bg-white p-4">
          <label className="text-sm">
            <span className="mb-2 block text-stone-600">收藏夹</span>
            <select
              value={collectionId ?? ""}
              onChange={(event) => handleCollectionChange(event.target.value)}
              className="h-10 rounded-md border border-stone-300 bg-white px-3"
            >
              <option value="">全部收藏</option>
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name} ({collection.itemCount})
                </option>
              ))}
            </select>
          </label>

          <form onSubmit={handleCreateCollection} className="flex flex-wrap gap-2">
            <input
              value={newCollectionName}
              onChange={(event) => setNewCollectionName(event.target.value)}
              maxLength={80}
              placeholder="新收藏夹名称"
              className="h-10 rounded-md border border-stone-300 px-3 text-sm"
            />
            <button
              type="submit"
              disabled={acting}
              className="rounded-md bg-moss px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              新建收藏夹
            </button>
          </form>

          <div className="grid gap-2 border-t border-stone-100 pt-3">
            {collections.map((collection) => (
              <div
                key={collection.id}
                className="flex flex-wrap items-center gap-2 text-sm"
              >
                <input
                  value={collectionNames[collection.id] ?? collection.name}
                  onChange={(event) =>
                    setCollectionNames((current) => ({
                      ...current,
                      [collection.id]: event.target.value,
                    }))
                  }
                  disabled={collection.isDefault}
                  className="h-9 rounded-md border border-stone-300 px-2"
                />
                <span className="text-stone-500">{collection.itemCount} 条</span>
                {collection.isDefault ? (
                  <span className="text-xs text-stone-400">默认收藏夹</span>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={actingKey === `rename-${collection.id}`}
                      onClick={() => handleRenameCollection(collection)}
                      className="rounded-md border border-stone-300 px-3 py-1 text-sm"
                    >
                      重命名
                    </button>
                    <button
                      type="button"
                      disabled={actingKey === `delete-${collection.id}`}
                      onClick={() => handleDeleteCollection(collection)}
                      className="rounded-md border border-red-200 px-3 py-1 text-sm text-red-600"
                    >
                      删除
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading && (
          <div className="rounded-lg border border-stone-200 bg-white p-6 text-stone-600">
            正在加载...
          </div>
        )}

        {!loading && bookmarks.length === 0 && !error && (
          <div className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
            暂无收藏
          </div>
        )}

        <div className="grid gap-3">
          {bookmarks.map((item) => (
            <div
              key={item.bookmarkId}
              className="rounded-lg border border-stone-200 bg-white p-5"
            >
              <div className="text-xs text-stone-500">
                {item.collectionName} / {item.moduleName} / {item.authorUsername}
              </div>
              <Link
                href={`/articles/${item.articleId}`}
                className="mt-2 block font-semibold text-ink hover:text-moss"
              >
                {item.title}
              </Link>
              {item.summary && (
                <p className="mt-2 text-sm leading-6 text-stone-600">
                  {item.summary}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-stone-500">
                <span>{item.wordCount} 字</span>
                <span>{item.viewCount} 次浏览</span>
                <span>
                  收藏于 {new Date(item.bookmarkedAt).toLocaleDateString()}
                </span>
              </div>
              <label className="mt-3 block text-sm">
                <span className="mr-2 text-stone-500">移动到</span>
                <select
                  value={item.collectionId}
                  disabled={actingKey === `move-${item.bookmarkId}`}
                  onChange={(event) =>
                    handleMoveBookmark(item.bookmarkId, Number(event.target.value))
                  }
                  className="h-9 rounded-md border border-stone-300 bg-white px-2"
                >
                  {collections.map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
