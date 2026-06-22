import { apiRequest } from "./client";

export type MetricPoint = {
  date: string;
  count: number;
};

export type DashboardSnapshot = {
  totalArticles: number;
  publishedArticles: number;
  activeUsers: number;
  todayPublishedArticles: number;
  pendingReviewArticles: number;
  pendingReports: number;
  publishedArticlesByDay: MetricPoint[];
  activeUsersByDay: MetricPoint[];
};

export function getAdminDashboard() {
  return apiRequest<DashboardSnapshot>("/admin/dashboard");
}
