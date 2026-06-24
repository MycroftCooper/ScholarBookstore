package domains

import "time"

type Domain struct {
	ID          int64
	Slug        string
	Name        string
	Description string
	SortOrder   int
	IsActive    bool
	CreatedAt   time.Time
	UpdatedAt   time.Time
	Modules     []DomainModule
}

type DomainModule struct {
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

type PublicDomain struct {
	ID          int64          `json:"id"`
	Slug        string         `json:"slug"`
	Name        string         `json:"name"`
	Description string         `json:"description"`
	SortOrder   int            `json:"sortOrder"`
	IsActive    bool           `json:"isActive"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
	Modules     []DomainModule `json:"modules,omitempty"`
}

type DomainOwner struct {
	DomainID  int64     `json:"domainId"`
	UserID    int64     `json:"userId"`
	CreatedAt time.Time `json:"createdAt"`
}

type CreateDomainInput struct {
	Slug        string
	Name        string
	Description string
	SortOrder   int
	IsActive    bool
}

type UpdateDomainInput struct {
	Name        *string
	Description *string
	SortOrder   *int
	IsActive    *bool
}

func ToPublic(domain Domain, includeModules bool) PublicDomain {
	out := PublicDomain{
		ID:          domain.ID,
		Slug:        domain.Slug,
		Name:        domain.Name,
		Description: domain.Description,
		SortOrder:   domain.SortOrder,
		IsActive:    domain.IsActive,
		CreatedAt:   domain.CreatedAt,
		UpdatedAt:   domain.UpdatedAt,
	}
	if includeModules {
		out.Modules = domain.Modules
	}
	return out
}

func ToPublicList(items []Domain) []PublicDomain {
	out := make([]PublicDomain, 0, len(items))
	for _, item := range items {
		out = append(out, ToPublic(item, false))
	}
	return out
}
