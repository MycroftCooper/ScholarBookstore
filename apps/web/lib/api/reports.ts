import { apiRequest } from "./client";

export type ArticleReport = {
  id: number;
  articleId: number;
  articleTitle: string;
  reporterId: number;
  reporterName: string;
  reason: string;
  status: "pending" | "resolved" | "rejected";
  handledBy: number | null;
  handledByName: string | null;
  handledAt: string | null;
  handleNote: string;
  createdAt: string;
  updatedAt: string;
};

export function createArticleReport(articleId: number, reason: string) {
  return apiRequest<ArticleReport>(`/articles/${articleId}/reports`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}
