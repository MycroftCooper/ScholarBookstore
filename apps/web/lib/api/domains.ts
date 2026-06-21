import { type ModuleSummary } from "./modules";
import { apiRequest } from "./client";

export type DomainSummary = {
  id: number;
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  modules?: ModuleSummary[];
};

export function listDomains(includeInactive = false) {
  return apiRequest<DomainSummary[]>(
    `/domains${includeInactive ? "?includeInactive=true" : ""}`,
  );
}

export function getDomain(id: number) {
  return apiRequest<DomainSummary>(`/domains/${id}`);
}

export function createDomain(input: {
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
}) {
  return apiRequest<DomainSummary>("/admin/domains", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateDomain(
  id: number,
  input: Partial<{
    name: string;
    description: string;
    sortOrder: number;
    isActive: boolean;
  }>,
) {
  return apiRequest<DomainSummary>(`/admin/domains/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
