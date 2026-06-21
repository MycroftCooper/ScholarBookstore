package articles

import "time"

type Article struct {
	ID             int64
	ModuleID       int64
	ModuleSlug     string
	ModuleName     string
	AuthorID       int64
	AuthorUsername string
	Title          string
	Slug           *string
	Summary        string
	ContentMD      string
	Status         string
	ReviewNote     string
	PublishedAt    *time.Time
	RevisionOfID   *int64
	WordCount      int
	ReadingMinutes int
	ViewCount      int64
	RevisionCount  int
	Tags           []Tag
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

type PublicArticle struct {
	ID             int64      `json:"id"`
	ModuleID       int64      `json:"moduleId"`
	ModuleSlug     string     `json:"moduleSlug"`
	ModuleName     string     `json:"moduleName"`
	AuthorID       int64      `json:"authorId"`
	AuthorUsername string     `json:"authorUsername"`
	Title          string     `json:"title"`
	Summary        string     `json:"summary"`
	ContentMD      string     `json:"contentMd,omitempty"`
	Status         string     `json:"status"`
	ReviewNote     string     `json:"reviewNote,omitempty"`
	PublishedAt    *time.Time `json:"publishedAt"`
	RevisionOfID   *int64     `json:"revisionOfArticleId,omitempty"`
	WordCount      int        `json:"wordCount"`
	ReadingMinutes int        `json:"readingMinutes"`
	ViewCount      int64      `json:"viewCount"`
	RevisionCount  int        `json:"revisionCount"`
	Tags           []Tag      `json:"tags"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
}

type CreateArticleInput struct {
	ModuleID       int64
	AuthorID       int64
	Title          string
	Summary        string
	ContentMD      string
	Status         string
	RevisionOfID   *int64
	WordCount      int
	ReadingMinutes int
	Tags           []string
}

type UpdateArticleInput struct {
	Title          *string
	Summary        *string
	ContentMD      *string
	Status         *string
	WordCount      *int
	ReadingMinutes *int
	Tags           *[]string
}

type Tag struct {
	ID         int64  `json:"id"`
	Name       string `json:"name"`
	Slug       string `json:"slug"`
	UsageCount int    `json:"usageCount"`
}

type ReviewArticleInput struct {
	ReviewerID int64
	ReviewNote string
}

type PublishedArticleFilter struct {
	ModuleSlug string
	Query      string
	TagSlug    string
	Sort       string
}

type Page struct {
	Number   int
	Size     int
	Total    int64
	Articles []PublicArticle
}

func ToPublic(article Article, includeContent bool) PublicArticle {
	out := PublicArticle{
		ID:             article.ID,
		ModuleID:       article.ModuleID,
		ModuleSlug:     article.ModuleSlug,
		ModuleName:     article.ModuleName,
		AuthorID:       article.AuthorID,
		AuthorUsername: article.AuthorUsername,
		Title:          article.Title,
		Summary:        article.Summary,
		Status:         article.Status,
		ReviewNote:     article.ReviewNote,
		PublishedAt:    article.PublishedAt,
		RevisionOfID:   article.RevisionOfID,
		WordCount:      article.WordCount,
		ReadingMinutes: article.ReadingMinutes,
		ViewCount:      article.ViewCount,
		RevisionCount:  article.RevisionCount,
		Tags:           publicTagsOrEmpty(article.Tags),
		CreatedAt:      article.CreatedAt,
		UpdatedAt:      article.UpdatedAt,
	}
	if includeContent {
		out.ContentMD = article.ContentMD
	}
	return out
}

func publicTagsOrEmpty(tags []Tag) []Tag {
	if tags == nil {
		return []Tag{}
	}
	return tags
}

func ToPublicList(items []Article, includeContent bool) []PublicArticle {
	out := make([]PublicArticle, 0, len(items))
	for _, item := range items {
		out = append(out, ToPublic(item, includeContent))
	}
	return out
}
