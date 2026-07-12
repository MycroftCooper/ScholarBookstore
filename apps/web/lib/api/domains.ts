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
  owners?: DomainOwnerUser[];
  modules?: ModuleSummary[];
};

export type DomainOwner = {
  domainId: number;
  userId: number;
  createdAt: string;
};

export type DomainOwnerUser = DomainOwner & {
  username: string;
  avatarUrl: string;
};

export function listDomains(includeInactive = false) {
  return apiRequest<DomainSummary[]>(
    `/domains${includeInactive ? "?includeInactive=true" : ""}`,
  );
}

export function getDomain(id: number) {
  return apiRequest<DomainSummary>(`/domains/${id}`);
}

export type DomainFollowState = {
  id: number;
  slug: string;
  name: string;
  following: boolean;
  followersCount: number;
};

export function getDomainFollowState(id: number) {
  return apiRequest<DomainFollowState>(`/domains/${id}/follow`);
}

export function followDomain(id: number) {
  return apiRequest<DomainFollowState>(`/domains/${id}/follow`, {
    method: "POST",
  });
}

export function unfollowDomain(id: number) {
  return apiRequest<DomainFollowState>(`/domains/${id}/follow`, {
    method: "DELETE",
  });
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

export function addDomainOwner(domainId: number, userId: number) {
  return apiRequest<DomainOwner>(`/admin/domains/${domainId}/owners`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export function removeDomainOwner(domainId: number, userId: number) {
  return apiRequest<{ ok: boolean }>(`/admin/domains/${domainId}/owners/${userId}`, {
    method: "DELETE",
  });
}
