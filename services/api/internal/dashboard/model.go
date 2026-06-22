package dashboard

type MetricPoint struct {
	Date  string `json:"date"`
	Count int64  `json:"count"`
}

type Dashboard struct {
	TotalArticles          int64         `json:"totalArticles"`
	PublishedArticles      int64         `json:"publishedArticles"`
	ActiveUsers            int64         `json:"activeUsers"`
	TodayPublishedArticles int64         `json:"todayPublishedArticles"`
	PendingReviewArticles  int64         `json:"pendingReviewArticles"`
	PendingReports         int64         `json:"pendingReports"`
	PublishedArticlesByDay []MetricPoint `json:"publishedArticlesByDay"`
	ActiveUsersByDay       []MetricPoint `json:"activeUsersByDay"`
}
