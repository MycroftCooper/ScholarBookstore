import { apiRequest } from "./client";
import type { CurrentUser } from "./auth";

export type AdminUserFilter = {
  q?: string;
  role?: CurrentUser["role"] | "";
  status?: CurrentUser["status"] | "";
};

export function listAdminUsers(filter: AdminUserFilter = {}) {
  const params = new URLSearchParams();
  if (filter.q) params.set("q", filter.q);
  if (filter.role) params.set("role", filter.role);
  if (filter.status) params.set("status", filter.status);
  const query = params.toString();
  return apiRequest<CurrentUser[]>(`/admin/users${query ? `?${query}` : ""}`);
}

export function updateAdminUser(
  id: number,
  input: { role?: CurrentUser["role"]; status?: CurrentUser["status"] },
) {
  return apiRequest<CurrentUser>(`/admin/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
