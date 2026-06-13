import { apiRequest } from "./client";

export type CommentItem = {
  id: number;
  articleId: number;
  authorId: number;
  authorUsername: string;
  parentId: number | null;
  replyToUserId: number | null;
  replyToUsername: string | null;
  content: string;
  visibility: "visible" | "hidden";
  createdAt: string;
  updatedAt: string;
};

export function listComments(articleId: number) {
  return apiRequest<CommentItem[]>(`/articles/${articleId}/comments`);
}

export function createComment(articleId: number, content: string) {
  return apiRequest<CommentItem>(`/articles/${articleId}/comments`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export function replyComment(commentId: number, content: string) {
  return apiRequest<CommentItem>(`/comments/${commentId}/replies`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export function deleteComment(commentId: number) {
  return apiRequest<{ ok: boolean }>(`/comments/${commentId}`, {
    method: "DELETE",
  });
}

export function listMyComments() {
  return apiRequest<CommentItem[]>("/me/comments");
}

export function listAdminComments() {
  return apiRequest<CommentItem[]>("/admin/comments");
}

export function hideComment(commentId: number) {
  return apiRequest<CommentItem>(`/admin/comments/${commentId}/hide`, {
    method: "POST",
  });
}

export function showComment(commentId: number) {
  return apiRequest<CommentItem>(`/admin/comments/${commentId}/show`, {
    method: "POST",
  });
}
