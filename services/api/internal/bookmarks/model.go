package bookmarks

import "time"

type Collection struct {
	ID        int64
	UserID    int64
	Name      string
	IsDefault bool
	ItemCount int64
	CreatedAt time.Time
	UpdatedAt time.Time
}

type PublicCollection struct {
	ID        int64     `json:"id"`
	UserID    int64     `json:"userId"`
	Name      string    `json:"name"`
	IsDefault bool      `json:"isDefault"`
	ItemCount int64     `json:"itemCount"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type BookmarkedArticle struct {
	BookmarkID     int64
	CollectionID   int64
	CollectionName string
	ArticleID      int64
	ModuleID       int64
	ModuleSlug     string
	ModuleName     string
	AuthorID       int64
	AuthorUsername string
	Title          string
	Summary        string
	PublishedAt    *time.Time
	WordCount      int
	ReadingMinutes int
	ViewCount      int64
	RevisionCount  int
	BookmarkedAt   time.Time
}

type PublicBookmarkedArticle struct {
	BookmarkID     int64      `json:"bookmarkId"`
	CollectionID   int64      `json:"collectionId"`
	CollectionName string     `json:"collectionName"`
	ArticleID      int64      `json:"articleId"`
	ModuleID       int64      `json:"moduleId"`
	ModuleSlug     string     `json:"moduleSlug"`
	ModuleName     string     `json:"moduleName"`
	AuthorID       int64      `json:"authorId"`
	AuthorUsername string     `json:"authorUsername"`
	Title          string     `json:"title"`
	Summary        string     `json:"summary"`
	PublishedAt    *time.Time `json:"publishedAt"`
	WordCount      int        `json:"wordCount"`
	ReadingMinutes int        `json:"readingMinutes"`
	ViewCount      int64      `json:"viewCount"`
	RevisionCount  int        `json:"revisionCount"`
	BookmarkedAt   time.Time  `json:"bookmarkedAt"`
}

type State struct {
	ArticleID     int64
	Bookmarked    bool
	CollectionID  *int64
	BookmarkCount int64
}

type PublicState struct {
	ArticleID     int64  `json:"articleId"`
	Bookmarked    bool   `json:"bookmarked"`
	CollectionID  *int64 `json:"collectionId"`
	BookmarkCount int64  `json:"bookmarkCount"`
}

type Page struct {
	Number    int
	Size      int
	Total     int64
	Bookmarks []PublicBookmarkedArticle
}

func ToPublicCollection(item Collection) PublicCollection {
	return PublicCollection{
		ID:        item.ID,
		UserID:    item.UserID,
		Name:      item.Name,
		IsDefault: item.IsDefault,
		ItemCount: item.ItemCount,
		CreatedAt: item.CreatedAt,
		UpdatedAt: item.UpdatedAt,
	}
}

func ToPublicCollections(items []Collection) []PublicCollection {
	out := make([]PublicCollection, 0, len(items))
	for _, item := range items {
		out = append(out, ToPublicCollection(item))
	}
	return out
}

func ToPublicBookmark(item BookmarkedArticle) PublicBookmarkedArticle {
	return PublicBookmarkedArticle{
		BookmarkID:     item.BookmarkID,
		CollectionID:   item.CollectionID,
		CollectionName: item.CollectionName,
		ArticleID:      item.ArticleID,
		ModuleID:       item.ModuleID,
		ModuleSlug:     item.ModuleSlug,
		ModuleName:     item.ModuleName,
		AuthorID:       item.AuthorID,
		AuthorUsername: item.AuthorUsername,
		Title:          item.Title,
		Summary:        item.Summary,
		PublishedAt:    item.PublishedAt,
		WordCount:      item.WordCount,
		ReadingMinutes: item.ReadingMinutes,
		ViewCount:      item.ViewCount,
		RevisionCount:  item.RevisionCount,
		BookmarkedAt:   item.BookmarkedAt,
	}
}

func ToPublicBookmarks(items []BookmarkedArticle) []PublicBookmarkedArticle {
	out := make([]PublicBookmarkedArticle, 0, len(items))
	for _, item := range items {
		out = append(out, ToPublicBookmark(item))
	}
	return out
}

func ToPublicState(item State) PublicState {
	return PublicState{
		ArticleID:     item.ArticleID,
		Bookmarked:    item.Bookmarked,
		CollectionID:  item.CollectionID,
		BookmarkCount: item.BookmarkCount,
	}
}
