import { apiRequest } from "./client";

export type NotificationItem = {
  id: number;
  recipientId: number;
  actorId: number;
  actorUsername: string;
  type: "comment_reply" | "article_comment" | "article_bookmark" | "followee_article";
  articleId: number | null;
  articleTitle: string | null;
  commentId: number | null;
  readAt: string | null;
  createdAt: string;
};

type ListNotificationsOptions = {
  unreadOnly?: boolean;
  page?: number;
  pageSize?: number;
};

export function listNotifications(options: boolean | ListNotificationsOptions = false) {
  const normalized =
    typeof options === "boolean" ? { unreadOnly: options } : options;
  const params = new URLSearchParams();
  if (normalized.unreadOnly) {
    params.set("unreadOnly", "true");
  }
  if (normalized.page) {
    params.set("page", String(normalized.page));
  }
  if (normalized.pageSize) {
    params.set("pageSize", String(normalized.pageSize));
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
