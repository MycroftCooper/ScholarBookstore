import { apiRequest } from "./client";

export type CurrentUser = {
  id: number;
  username: string;
  email: string;
  role: "user" | "reviewer" | "admin";
  avatarUrl: string;
  bio: string;
  school: string;
  company: string;
  createdAt: string;
};

export function login(email: string, password: string) {
  return apiRequest<CurrentUser>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function register(username: string, email: string, password: string) {
  return apiRequest<CurrentUser>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
  });
}

export function getCurrentUser() {
  return apiRequest<CurrentUser>("/auth/me");
}

export function updateProfile(input: {
  bio: string;
  school: string;
  company: string;
}) {
  return apiRequest<CurrentUser>("/me/profile", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function uploadAvatar(file: File) {
  const form = new FormData();
  form.append("file", file);
  return apiRequest<CurrentUser>("/me/avatar", {
    method: "POST",
    body: form,
  });
}

export function logout() {
  return apiRequest<{ ok: boolean }>("/auth/logout", {
    method: "POST",
  });
}
