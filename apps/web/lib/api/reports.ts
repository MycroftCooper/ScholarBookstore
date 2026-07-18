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

export type UserReport = {
  id: number;
  reportedUserId: number;
  reportedUsername: string;
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

export function createUserReport(username: string, reason: string) {
  return apiRequest<UserReport>(`/users/${encodeURIComponent(username)}/reports`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export type CommentReport = {
  id: number;
  commentId: number;
  commentContent: string;
  commentAuthorId: number;
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

export function createCommentReport(commentId: number, reason: string) {
  return apiRequest<CommentReport>(`/comments/${commentId}/reports`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}
