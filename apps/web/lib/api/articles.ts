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
  sourceType: "original" | "reprint";
  status: "draft" | "pending_review" | "published" | "rejected" | "archived";
  reviewNote?: string;
  publishedAt: string | null;
  revisionOfArticleId?: number;
  wordCount: number;
  readingMinutes: number;
  viewCount: number;
  revisionCount: number;
  isFeatured: boolean;
  tags: ArticleTag[] | null;
  createdAt: string;
  updatedAt: string;
};

export type ArticleTag = {
  id: number;
  name: string;
  slug: string;
  usageCount: number;
};

export type ArticlePageMeta = {
  page: number;
  pageSize: number;
  total: number;
};

export type ArticleListParams = {
  moduleSlug?: string;
  q?: string;
  tag?: string;
  sort?: "latest" | "hot" | "random";
  pageSize?: number;
  featured?: boolean;
};

export async function listArticles(input: ArticleListParams = {}) {
  const params = new URLSearchParams();
  if (input.moduleSlug) {
    params.set("moduleSlug", input.moduleSlug);
  }
  if (input.q) {
    params.set("q", input.q);
  }
  if (input.tag) {
    params.set("tag", input.tag);
  }
  if (input.sort) {
    params.set("sort", input.sort);
  }
  if (input.pageSize) {
    params.set("pageSize", String(input.pageSize));
  }
  if (input.featured) {
    params.set("featured", "true");
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
  sourceType?: ArticleSummary["sourceType"];
  status?: "draft" | "pending_review";
  tags?: string[];
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

export function getMyArticle(id: number) {
  return apiRequest<ArticleSummary>(`/me/articles/${id}`);
}

export function updateMyArticle(
  id: number,
  input: {
    title: string;
    summary: string;
    contentMd: string;
    sourceType?: ArticleSummary["sourceType"];
    status?: "draft" | "pending_review";
    tags?: string[];
  },
) {
  return apiRequest<ArticleSummary>(`/articles/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function listPendingReviews() {
  return apiRequest<ArticleSummary[]>("/admin/articles/reviews");
}

export function listAdminArticles(status?: ArticleSummary["status"]) {
  const params = new URLSearchParams();
  if (status) {
    params.set("status", status);
  }
  const query = params.toString();
  return apiRequest<ArticleSummary[]>(
    `/admin/articles${query ? `?${query}` : ""}`,
  );
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

export function archiveArticle(id: number) {
  return apiRequest<ArticleSummary>(`/admin/articles/${id}/archive`, {
    method: "POST",
  });
}

export function restoreArticle(id: number) {
  return apiRequest<ArticleSummary>(`/admin/articles/${id}/restore`, {
    method: "POST",
  });
}

export function updateAdminArticle(
  id: number,
  input: {
    isFeatured?: boolean;
  },
) {
  return apiRequest<ArticleSummary>(`/admin/articles/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
