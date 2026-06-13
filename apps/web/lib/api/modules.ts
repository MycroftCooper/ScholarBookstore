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

export function listModules() {
  return apiRequest<ModuleSummary[]>("/modules");
}

export function getModule(slug: string) {
  return apiRequest<ModuleSummary>(`/modules/${encodeURIComponent(slug)}`);
}
