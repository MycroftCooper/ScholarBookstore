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
  technicalTags: string[];
  publishedArticleCount: number;
  followersCount: number;
  followingCount: number;
  bookmarkCount: number;
  articles: AuthorArticle[];
  followingModules: FollowModule[];
  followingDomains: FollowDomain[];
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
  publishedArticleCount: number;
  followersCount: number;
  createdAt: string;
};

export type FollowModule = {
  id: number;
  domainId: number;
  domainSlug: string;
  domainName: string;
  slug: string;
  name: string;
  description: string;
  createdAt: string;
};

export type FollowDomain = {
  id: number;
  slug: string;
  name: string;
  description: string;
  createdAt: string;
};

export type FollowingPage = {
  users: FollowUser[];
  modules: FollowModule[];
  domains: FollowDomain[];
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
  return apiRequest<FollowingPage>("/me/following");
}

export function listFollowers() {
  return apiRequest<FollowUser[]>("/me/followers");
}

export function listRecommendedUsers(limit = 6) {
  return apiRequest<FollowUser[]>(`/me/follow-recommendations?limit=${limit}`);
}
