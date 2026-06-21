"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import {
  createBookmarkCollection,
  listBookmarkCollections,
  listBookmarks,
  type BookmarkedArticle,
  type BookmarkCollection,
} from "@/lib/api/bookmarks";
import { ApiError } from "@/lib/api/client";

export default function MyBookmarksPage() {
  const [collections, setCollections] = useState<BookmarkCollection[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkedArticle[]>([]);
  const [collectionId, setCollectionId] = useState<number | undefined>();
  const [newCollectionName, setNewCollectionName] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");

  async function load(nextCollectionId = collectionId) {
    const [collectionItems, bookmarkItems] = await Promise.all([
      listBookmarkCollections(),
      listBookmarks(nextCollectionId),
    ]);
    setCollections(collectionItems);
    setBookmarks(bookmarkItems);
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
            <Link
              key={item.bookmarkId}
              href={`/articles/${item.articleId}`}
              className="rounded-lg border border-stone-200 bg-white p-5 hover:border-stone-300"
            >
              <div className="text-xs text-stone-500">
                {item.collectionName} / {item.moduleName} / {item.authorUsername}
              </div>
              <h2 className="mt-2 font-semibold text-ink">{item.title}</h2>
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
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
