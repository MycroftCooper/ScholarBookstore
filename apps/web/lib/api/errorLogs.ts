import { apiRequest } from "./client";

export type ErrorLog = {
  id: number;
  source: "client" | "server";
  level: "error" | "warning" | "info";
  fingerprint: string;
  message: string;
  stack: string;
  userId: number | null;
  username: string | null;
  requestId: string;
  method: string;
  path: string;
  ip: string;
  userAgent: string;
  metadata: Record<string, string>;
  occurrenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
};

export type ErrorLogFilter = {
  source?: string;
  userId?: string;
  pageSize?: number;
};

export function listErrorLogs(filter: ErrorLogFilter = {}) {
  const params = new URLSearchParams();
  if (filter.source) {
    params.set("source", filter.source);
  }
  if (filter.userId) {
    params.set("userId", filter.userId);
  }
  if (filter.pageSize) {
    params.set("pageSize", String(filter.pageSize));
  }
  const query = params.toString();
  return apiRequest<ErrorLog[]>(`/admin/error-logs${query ? `?${query}` : ""}`);
}

export function deleteErrorLog(id: number) {
  return apiRequest<{ deleted: number }>(`/admin/error-logs/${id}`, {
    method: "DELETE",
  });
}

export function deleteAllErrorLogs() {
  return apiRequest<{ deleted: number }>("/admin/error-logs", {
    method: "DELETE",
  });
}
