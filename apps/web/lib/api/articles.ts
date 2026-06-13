import { apiRequest } from "./client";

export type ArticleSummary = {
  id: number;
  moduleId: number;
  moduleSlug: string;
  moduleName: string;
  authorId: number;
  authorUsername: string;
  title: string;
  summary: string;
  contentMd?: string;
  status: "draft" | "pending_review" | "published" | "rejected" | "archived";
  reviewNote?: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ArticlePageMeta = {
  page: number;
  pageSize: number;
  total: number;
};

export async function listArticles(moduleSlug?: string) {
  const params = new URLSearchParams();
  if (moduleSlug) {
    params.set("moduleSlug", moduleSlug);
  }
  const query = params.toString();
  return apiRequest<ArticleSummary[]>(`/articles${query ? `?${query}` : ""}`);
}

export function getArticle(id: number) {
  return apiRequest<ArticleSummary>(`/articles/${id}`);
}

export function createArticle(input: {
  moduleId: number;
  title: string;
  summary: string;
  contentMd: string;
}) {
  return apiRequest<{ id: number; status: ArticleSummary["status"] }>("/articles", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listMyArticles(status?: ArticleSummary["status"]) {
  const params = new URLSearchParams();
  if (status) {
    params.set("status", status);
  }
  const query = params.toString();
  return apiRequest<ArticleSummary[]>(`/me/articles${query ? `?${query}` : ""}`);
}

export function listPendingReviews() {
  return apiRequest<ArticleSummary[]>("/admin/articles/reviews");
}

export function approveArticle(id: number, reviewNote: string) {
  return apiRequest<ArticleSummary>(`/admin/articles/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({ reviewNote }),
  });
}

export function rejectArticle(id: number, reviewNote: string) {
  return apiRequest<ArticleSummary>(`/admin/articles/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reviewNote }),
  });
}
