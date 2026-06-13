package uploads

import "time"

type ArticleImage struct {
	ID               int64     `json:"id"`
	ArticleID        *int64    `json:"articleId,omitempty"`
	UploadedBy       int64     `json:"uploadedBy"`
	OriginalFilename string    `json:"originalFilename"`
	StoredFilename   string    `json:"storedFilename"`
	MimeType         string    `json:"mimeType"`
	SizeBytes        int64     `json:"sizeBytes"`
	URL              string    `json:"url"`
	CreatedAt        time.Time `json:"createdAt"`
}

type CreateArticleImageInput struct {
	ArticleID        *int64
	UploadedBy       int64
	OriginalFilename string
	StoredFilename   string
	MimeType         string
	SizeBytes        int64
	URL              string
}

type UploadResult struct {
	ID        int64  `json:"id"`
	URL       string `json:"url"`
	MimeType  string `json:"mimeType"`
	SizeBytes int64  `json:"sizeBytes"`
}
