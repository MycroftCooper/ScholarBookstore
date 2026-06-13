import { apiRequest } from "./client";

export type NotificationItem = {
  id: number;
  recipientId: number;
  actorId: number;
  actorUsername: string;
  type: "comment_reply" | "article_comment";
  articleId: number | null;
  articleTitle: string | null;
  commentId: number | null;
  readAt: string | null;
  createdAt: string;
};

export function listNotifications(unreadOnly = false) {
  const params = new URLSearchParams();
  if (unreadOnly) {
    params.set("unreadOnly", "true");
  }
  const query = params.toString();
  return apiRequest<NotificationItem[]>(`/me/notifications${query ? `?${query}` : ""}`);
}

export function unreadNotificationCount() {
  return apiRequest<{ count: number }>("/me/notifications/unread-count");
}

export function markNotificationRead(id: number) {
  return apiRequest<{ ok: boolean }>(`/me/notifications/${id}/read`, {
    method: "POST",
  });
}

export function markAllNotificationsRead() {
  return apiRequest<{ count: number }>("/me/notifications/read-all", {
    method: "POST",
  });
}
