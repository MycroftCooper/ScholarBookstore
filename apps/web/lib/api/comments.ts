import { apiRequest } from "./client";

export type CommentItem = {
  id: number;
  articleId: number;
  articleTitle: string;
  authorId: number;
  authorUsername: string;
  parentId: number | null;
  replyToUserId: number | null;
  replyToUsername: string | null;
  content: string;
  visibility: "visible" | "hidden";
  deleted: boolean;
  upVotes: number;
  downVotes: number;
  score: number;
  myVote: -1 | 0 | 1;
  createdAt: string;
  updatedAt: string;
};

export function listComments(
  articleId: number,
  sort: "latest" | "hot" = "latest",
  page = 1,
  pageSize = 10,
) {
  const params = new URLSearchParams();
  params.set("sort", sort);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  return apiRequest<CommentItem[]>(`/articles/${articleId}/comments?${params.toString()}`);
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

export function voteComment(commentId: number, value: -1 | 0 | 1) {
  return apiRequest<CommentItem>(`/comments/${commentId}/vote`, {
    method: "PUT",
    body: JSON.stringify({ value }),
  });
}

export function listMyComments(page = 1, pageSize = 20) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  return apiRequest<CommentItem[]>(`/me/comments?${params.toString()}`);
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
