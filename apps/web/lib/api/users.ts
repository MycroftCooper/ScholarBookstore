import { apiRequest } from "./client";

export type AuthorArticle = {
  id: number;
  moduleId: number;
  moduleSlug: string;
  moduleName: string;
  authorId: number;
  authorUsername: string;
  title: string;
  summary: string;
  status: string;
  viewCount: number;
  bookmarkCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicAuthorProfile = {
  id: number;
  username: string;
  avatarUrl: string;
  bio: string;
  school: string;
  company: string;
  publishedArticleCount: number;
  followersCount: number;
  followingCount: number;
  bookmarkCount: number;
  articles: AuthorArticle[];
};

export function getPublicAuthorProfile(username: string) {
  return apiRequest<PublicAuthorProfile>(
    `/users/${encodeURIComponent(username)}`,
  );
}

export type FollowState = {
  userId: number;
  username: string;
  following: boolean;
  followersCount: number;
  followingCount: number;
};

export type FollowUser = {
  id: number;
  username: string;
  avatarUrl: string;
  bio: string;
  createdAt: string;
};

export function getFollowState(username: string) {
  return apiRequest<FollowState>(`/users/${encodeURIComponent(username)}/follow`);
}

export function followUser(username: string) {
  return apiRequest<FollowState>(`/users/${encodeURIComponent(username)}/follow`, {
    method: "POST",
  });
}

export function unfollowUser(username: string) {
  return apiRequest<FollowState>(`/users/${encodeURIComponent(username)}/follow`, {
    method: "DELETE",
  });
}

export function listFollowing() {
  return apiRequest<FollowUser[]>("/me/following");
}

export function listFollowers() {
  return apiRequest<FollowUser[]>("/me/followers");
}
