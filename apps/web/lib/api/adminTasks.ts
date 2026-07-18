import { apiRequest } from "./client";

export type AdminTask = {
  id: number;
  taskType: "article_review" | "content_report" | "comment_report" | "user_report" | string;
  objectType: string;
  objectId: number;
  domainId: number | null;
  domainName: string | null;
  moduleId: number | null;
  moduleName: string | null;
  title: string;
  summary: string;
  status: "pending" | "processing" | "approved" | "rejected" | "resolved" | "ignored" | "cancelled";
  priority: number;
  submitterId: number | null;
  submitterName: string | null;
  assigneeId: number | null;
  assigneeName: string | null;
  dueAt: string | null;
  resolvedAt: string | null;
  resolution: string;
  resolutionNote: string;
  objectTitle?: string;
  objectStatus?: string;
  objectContentMd?: string;
  targetUserId?: number;
  createdAt: string;
  updatedAt: string;
};

export type ModerationAction = {
  type: "hide_content" | "disable_account" | "restrict_follow" | "ban_article_create" | "ban_comment_create";
  durationDays?: number;
};

export type AdminTaskStats = {
  myPending: number;
  pendingReviews: number;
  pendingReports: number;
  overdueTasks: number;
  resolvedToday: number;
};

export function getAdminTaskStats() {
  return apiRequest<AdminTaskStats>("/admin/tasks/stats");
}

export type AdminTaskFilter = {
  taskType?: string;
  status?: string;
  priority?: string;
  domainId?: string;
  moduleId?: string;
  assigneeId?: string;
};

export function listAdminTasks(input: string | AdminTaskFilter = "pending") {
  const params = new URLSearchParams();
  if (typeof input === "string") {
    if (input) {
      params.set("status", input);
    }
  } else {
    if (input.taskType) {
      params.set("taskType", input.taskType);
    }
    if (input.status) {
      params.set("status", input.status);
    }
    if (input.priority) {
      params.set("priority", input.priority);
    }
    if (input.domainId) {
      params.set("domainId", input.domainId);
    }
    if (input.moduleId) {
      params.set("moduleId", input.moduleId);
    }
    if (input.assigneeId) {
      params.set("assigneeId", input.assigneeId);
    }
  }
  const query = params.toString();
  return apiRequest<AdminTask[]>(`/admin/tasks${query ? `?${query}` : ""}`);
}

export function getAdminTask(id: number) {
  return apiRequest<AdminTask>(`/admin/tasks/${id}`);
}

export function approveAdminTask(id: number, note: string) {
  return apiRequest<AdminTask>(`/admin/tasks/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export function rejectAdminTask(id: number, note: string) {
  return apiRequest<AdminTask>(`/admin/tasks/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

export function takeDownAdminTask(id: number, note: string, actions?: ModerationAction[]) {
  return apiRequest<AdminTask>(`/admin/tasks/${id}/take-down`, {
    method: "POST",
    body: JSON.stringify({ note, actions }),
  });
}

export function ignoreAdminTask(id: number, note: string) {
  return apiRequest<AdminTask>(`/admin/tasks/${id}/ignore`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}
