import { apiRequest } from "./client";

export type TagItem = {
  id: number;
  name: string;
  slug: string;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
};

export function listTags(q?: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  const query = params.toString();
  return apiRequest<TagItem[]>(`/tags${query ? `?${query}` : ""}`);
}

export function listAdminTags(q?: string) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  const query = params.toString();
  return apiRequest<TagItem[]>(`/admin/tags${query ? `?${query}` : ""}`);
}

export function updateTag(id: number, name: string) {
  return apiRequest<TagItem>(`/admin/tags/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export function deleteTag(id: number) {
  return apiRequest<{ ok: boolean }>(`/admin/tags/${id}`, {
    method: "DELETE",
  });
}

export function mergeTags(targetId: number, sourceIds: number[]) {
  return apiRequest<TagItem>("/admin/tags/merge", {
    method: "POST",
    body: JSON.stringify({ targetId, sourceIds }),
  });
}
