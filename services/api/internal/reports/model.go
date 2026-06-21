package reports

import "time"

type Report struct {
	ID            int64
	ArticleID     int64
	ArticleTitle  string
	ReporterID    int64
	ReporterName  string
	Reason        string
	Status        string
	HandledBy     *int64
	HandledByName *string
	HandledAt     *time.Time
	HandleNote    string
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

type PublicReport struct {
	ID            int64      `json:"id"`
	ArticleID     int64      `json:"articleId"`
	ArticleTitle  string     `json:"articleTitle"`
	ReporterID    int64      `json:"reporterId"`
	ReporterName  string     `json:"reporterName"`
	Reason        string     `json:"reason"`
	Status        string     `json:"status"`
	HandledBy     *int64     `json:"handledBy"`
	HandledByName *string    `json:"handledByName"`
	HandledAt     *time.Time `json:"handledAt"`
	HandleNote    string     `json:"handleNote"`
	CreatedAt     time.Time  `json:"createdAt"`
	UpdatedAt     time.Time  `json:"updatedAt"`
}

type Page struct {
	Number  int
	Size    int
	Total   int64
	Reports []PublicReport
}

func ToPublic(item Report) PublicReport {
	return PublicReport{
		ID:            item.ID,
		ArticleID:     item.ArticleID,
		ArticleTitle:  item.ArticleTitle,
		ReporterID:    item.ReporterID,
		ReporterName:  item.ReporterName,
		Reason:        item.Reason,
		Status:        item.Status,
		HandledBy:     item.HandledBy,
		HandledByName: item.HandledByName,
		HandledAt:     item.HandledAt,
		HandleNote:    item.HandleNote,
		CreatedAt:     item.CreatedAt,
		UpdatedAt:     item.UpdatedAt,
	}
}

func ToPublicList(items []Report) []PublicReport {
	out := make([]PublicReport, 0, len(items))
	for _, item := range items {
		out = append(out, ToPublic(item))
	}
	return out
}
