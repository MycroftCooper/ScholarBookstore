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

export function listAdminReports(status?: ArticleReport["status"]) {
  const params = new URLSearchParams();
  if (status) {
    params.set("status", status);
  }
  const query = params.toString();
  return apiRequest<ArticleReport[]>(`/admin/reports${query ? `?${query}` : ""}`);
}

export function resolveReport(
  id: number,
  status: "resolved" | "rejected",
  note: string,
) {
  return apiRequest<ArticleReport>(`/admin/reports/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify({ status, note }),
  });
}
