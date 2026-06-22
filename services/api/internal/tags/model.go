package tags

import "time"

type Tag struct {
	ID         int64
	Name       string
	Slug       string
	UsageCount int
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

type PublicTag struct {
	ID         int64     `json:"id"`
	Name       string    `json:"name"`
	Slug       string    `json:"slug"`
	UsageCount int       `json:"usageCount"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

type Filter struct {
	Query string
}

type Page struct {
	Number int
	Size   int
	Total  int64
	Tags   []PublicTag
}

type UpdateInput struct {
	Name string
}

type MergeInput struct {
	SourceIDs []int64
	TargetID  int64
}

func ToPublic(item Tag) PublicTag {
	return PublicTag{
		ID:         item.ID,
		Name:       item.Name,
		Slug:       item.Slug,
		UsageCount: item.UsageCount,
		CreatedAt:  item.CreatedAt,
		UpdatedAt:  item.UpdatedAt,
	}
}

func ToPublicList(items []Tag) []PublicTag {
	out := make([]PublicTag, 0, len(items))
	for _, item := range items {
		out = append(out, ToPublic(item))
	}
	return out
}
