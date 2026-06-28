import { apiRequest } from "./client";

export type AuditLog = {
  id: number;
  actorId: number | null;
  actorName: string | null;
  action: string;
  targetType: string;
  targetId: number;
  domainId: number | null;
  domainName: string | null;
  moduleId: number | null;
  moduleName: string | null;
  detail: Record<string, string>;
  ip: string;
  userAgent: string;
  createdAt: string;
};

export type AuditLogFilter = {
  action?: string;
  actorId?: string;
  targetType?: string;
  targetId?: string;
  domainId?: string;
  moduleId?: string;
  pageSize?: number;
};

export function listAuditLogs(filter: AuditLogFilter = {}) {
  const params = new URLSearchParams();
  if (filter.action) {
    params.set("action", filter.action);
  }
  if (filter.actorId) {
    params.set("actorId", filter.actorId);
  }
  if (filter.targetType) {
    params.set("targetType", filter.targetType);
  }
  if (filter.targetId) {
    params.set("targetId", filter.targetId);
  }
  if (filter.domainId) {
    params.set("domainId", filter.domainId);
  }
  if (filter.moduleId) {
    params.set("moduleId", filter.moduleId);
  }
  if (filter.pageSize) {
    params.set("pageSize", String(filter.pageSize));
  }
  const query = params.toString();
  return apiRequest<AuditLog[]>(`/admin/audit-logs${query ? `?${query}` : ""}`);
}
