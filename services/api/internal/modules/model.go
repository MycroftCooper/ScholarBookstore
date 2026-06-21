package modules

import "time"

type Module struct {
	ID          int64
	DomainID    int64
	DomainSlug  string
	DomainName  string
	Slug        string
	Name        string
	Description string
	SortOrder   int
	IsActive    bool
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type PublicModule struct {
	ID          int64     `json:"id"`
	DomainID    int64     `json:"domainId"`
	DomainSlug  string    `json:"domainSlug"`
	DomainName  string    `json:"domainName"`
	Slug        string    `json:"slug"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	SortOrder   int       `json:"sortOrder"`
	IsActive    bool      `json:"isActive"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type CreateModuleInput struct {
	DomainID    int64
	Slug        string
	Name        string
	Description string
	SortOrder   int
	IsActive    bool
}

type UpdateModuleInput struct {
	DomainID    *int64
	Name        *string
	Description *string
	SortOrder   *int
	IsActive    *bool
}

func ToPublic(module Module) PublicModule {
	return PublicModule{
		ID:          module.ID,
		DomainID:    module.DomainID,
		DomainSlug:  module.DomainSlug,
		DomainName:  module.DomainName,
		Slug:        module.Slug,
		Name:        module.Name,
		Description: module.Description,
		SortOrder:   module.SortOrder,
		IsActive:    module.IsActive,
		CreatedAt:   module.CreatedAt,
		UpdatedAt:   module.UpdatedAt,
	}
}

func ToPublicList(items []Module) []PublicModule {
	out := make([]PublicModule, 0, len(items))
	for _, item := range items {
		out = append(out, ToPublic(item))
	}
	return out
}
