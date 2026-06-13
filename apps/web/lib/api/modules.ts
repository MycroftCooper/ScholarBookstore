import { apiRequest } from "./client";

export type ModuleSummary = {
  id: number;
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export function listModules(includeInactive = false) {
  return apiRequest<ModuleSummary[]>(
    `/modules${includeInactive ? "?includeInactive=true" : ""}`,
  );
}

export function getModule(slug: string) {
  return apiRequest<ModuleSummary>(`/modules/${encodeURIComponent(slug)}`);
}

export function createModule(input: {
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
}) {
  return apiRequest<ModuleSummary>("/admin/modules", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateModule(
  id: number,
  input: Partial<{
    name: string;
    description: string;
    sortOrder: number;
    isActive: boolean;
  }>,
) {
  return apiRequest<ModuleSummary>(`/admin/modules/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
