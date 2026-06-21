import { apiRequest } from "./client";

export type BookmarkCollection = {
  id: number;
  userId: number;
  name: string;
  isDefault: boolean;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};

export type BookmarkState = {
  articleId: number;
  bookmarked: boolean;
  collectionId: number | null;
  bookmarkCount: number;
};

export type BookmarkedArticle = {
  bookmarkId: number;
  collectionId: number;
  collectionName: string;
  articleId: number;
  moduleId: number;
  moduleSlug: string;
  moduleName: string;
  authorId: number;
  authorUsername: string;
  title: string;
  summary: string;
  publishedAt: string | null;
  wordCount: number;
  readingMinutes: number;
  viewCount: number;
  revisionCount: number;
  bookmarkedAt: string;
};

export function listBookmarkCollections() {
  return apiRequest<BookmarkCollection[]>("/me/bookmark-collections");
}

export function createBookmarkCollection(name: string) {
  return apiRequest<BookmarkCollection>("/me/bookmark-collections", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function listBookmarks(collectionId?: number) {
  const params = new URLSearchParams();
  if (collectionId) {
    params.set("collectionId", String(collectionId));
  }
  const query = params.toString();
  return apiRequest<BookmarkedArticle[]>(`/me/bookmarks${query ? `?${query}` : ""}`);
}

export function getBookmarkState(articleId: number) {
  return apiRequest<BookmarkState>(`/articles/${articleId}/bookmark`);
}

export function addBookmark(articleId: number, collectionId?: number) {
  return apiRequest<BookmarkState>(`/articles/${articleId}/bookmark`, {
    method: "POST",
    body: JSON.stringify({ collectionId }),
  });
}

export function removeBookmark(articleId: number) {
  return apiRequest<BookmarkState>(`/articles/${articleId}/bookmark`, {
    method: "DELETE",
  });
}
