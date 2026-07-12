package follows

import "time"

type UserSummary struct {
	ID                    int64
	Username              string
	AvatarURL             string
	Bio                   string
	PublishedArticleCount int64
	FollowersCount        int64
	CreatedAt             time.Time
}

type ModuleSummary struct {
	ID          int64
	DomainID    int64
	DomainSlug  string
	DomainName  string
	Slug        string
	Name        string
	Description string
	CreatedAt   time.Time
}

type DomainSummary struct {
	ID          int64
	Slug        string
	Name        string
	Description string
	CreatedAt   time.Time
}

type PublicUserSummary struct {
	ID                    int64     `json:"id"`
	Username              string    `json:"username"`
	AvatarURL             string    `json:"avatarUrl"`
	Bio                   string    `json:"bio"`
	PublishedArticleCount int64     `json:"publishedArticleCount"`
	FollowersCount        int64     `json:"followersCount"`
	CreatedAt             time.Time `json:"createdAt"`
}

type PublicModuleSummary struct {
	ID          int64     `json:"id"`
	DomainID    int64     `json:"domainId"`
	DomainSlug  string    `json:"domainSlug"`
	DomainName  string    `json:"domainName"`
	Slug        string    `json:"slug"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"createdAt"`
}

type PublicDomainSummary struct {
	ID          int64     `json:"id"`
	Slug        string    `json:"slug"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"createdAt"`
}

type FollowingPage struct {
	Users   []PublicUserSummary   `json:"users"`
	Modules []PublicModuleSummary `json:"modules"`
	Domains []PublicDomainSummary `json:"domains"`
}

type State struct {
	UserID         int64
	Username       string
	Following      bool
	FollowersCount int64
	FollowingCount int64
}

type PublicState struct {
	UserID         int64  `json:"userId"`
	Username       string `json:"username"`
	Following      bool   `json:"following"`
	FollowersCount int64  `json:"followersCount"`
	FollowingCount int64  `json:"followingCount"`
}

type TargetState struct {
	ID             int64
	Slug           string
	Name           string
	Following      bool
	FollowersCount int64
}

type PublicTargetState struct {
	ID             int64  `json:"id"`
	Slug           string `json:"slug"`
	Name           string `json:"name"`
	Following      bool   `json:"following"`
	FollowersCount int64  `json:"followersCount"`
}

func ToPublicUserSummary(item UserSummary) PublicUserSummary {
	return PublicUserSummary{
		ID:                    item.ID,
		Username:              item.Username,
		AvatarURL:             item.AvatarURL,
		Bio:                   item.Bio,
		PublishedArticleCount: item.PublishedArticleCount,
		FollowersCount:        item.FollowersCount,
		CreatedAt:             item.CreatedAt,
	}
}

func ToPublicUserSummaries(items []UserSummary) []PublicUserSummary {
	out := make([]PublicUserSummary, 0, len(items))
	for _, item := range items {
		out = append(out, ToPublicUserSummary(item))
	}
	return out
}

func ToPublicModuleSummary(item ModuleSummary) PublicModuleSummary {
	return PublicModuleSummary{
		ID:          item.ID,
		DomainID:    item.DomainID,
		DomainSlug:  item.DomainSlug,
		DomainName:  item.DomainName,
		Slug:        item.Slug,
		Name:        item.Name,
		Description: item.Description,
		CreatedAt:   item.CreatedAt,
	}
}

func ToPublicModuleSummaries(items []ModuleSummary) []PublicModuleSummary {
	out := make([]PublicModuleSummary, 0, len(items))
	for _, item := range items {
		out = append(out, ToPublicModuleSummary(item))
	}
	return out
}

func ToPublicDomainSummary(item DomainSummary) PublicDomainSummary {
	return PublicDomainSummary{
		ID:          item.ID,
		Slug:        item.Slug,
		Name:        item.Name,
		Description: item.Description,
		CreatedAt:   item.CreatedAt,
	}
}

func ToPublicDomainSummaries(items []DomainSummary) []PublicDomainSummary {
	out := make([]PublicDomainSummary, 0, len(items))
	for _, item := range items {
		out = append(out, ToPublicDomainSummary(item))
	}
	return out
}

func ToPublicState(item State) PublicState {
	return PublicState{
		UserID:         item.UserID,
		Username:       item.Username,
		Following:      item.Following,
		FollowersCount: item.FollowersCount,
		FollowingCount: item.FollowingCount,
	}
}

func ToPublicTargetState(item TargetState) PublicTargetState {
	return PublicTargetState{
		ID:             item.ID,
		Slug:           item.Slug,
		Name:           item.Name,
		Following:      item.Following,
		FollowersCount: item.FollowersCount,
	}
}
