package users

import "time"

type User struct {
	ID           int64
	Username     string
	Email        string
	PasswordHash string
	Role         string
	Status       string
	AvatarURL    string
	Bio          string
	School       string
	Company      string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type PublicUser struct {
	ID        int64     `json:"id"`
	Username  string    `json:"username"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	Status    string    `json:"status"`
	AvatarURL string    `json:"avatarUrl"`
	Bio       string    `json:"bio"`
	School    string    `json:"school"`
	Company   string    `json:"company"`
	CreatedAt time.Time `json:"createdAt"`
}

type UpdateProfileInput struct {
	Bio     string
	School  string
	Company string
}

type AdminUserFilter struct {
	Query  string
	Role   string
	Status string
}

type UpdateAdminUserInput struct {
	Role    *string
	Status  *string
	ActorID int64
}

type AdminUserPage struct {
	Number int
	Size   int
	Total  int64
	Users  []PublicUser
}

type AuthorArticle struct {
	ID             int64      `json:"id"`
	ModuleID       int64      `json:"moduleId"`
	ModuleSlug     string     `json:"moduleSlug"`
	ModuleName     string     `json:"moduleName"`
	AuthorID       int64      `json:"authorId"`
	AuthorUsername string     `json:"authorUsername"`
	Title          string     `json:"title"`
	Summary        string     `json:"summary"`
	Status         string     `json:"status"`
	ViewCount      int64      `json:"viewCount"`
	BookmarkCount  int64      `json:"bookmarkCount"`
	PublishedAt    *time.Time `json:"publishedAt"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
}

type AuthorFollowModule struct {
	ID          int64     `json:"id"`
	DomainID    int64     `json:"domainId"`
	DomainSlug  string    `json:"domainSlug"`
	DomainName  string    `json:"domainName"`
	Slug        string    `json:"slug"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"createdAt"`
}

type AuthorFollowDomain struct {
	ID          int64     `json:"id"`
	Slug        string    `json:"slug"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"createdAt"`
}

type PublicAuthorProfile struct {
	ID                    int64                `json:"id"`
	Username              string               `json:"username"`
	AvatarURL             string               `json:"avatarUrl"`
	Bio                   string               `json:"bio"`
	School                string               `json:"school"`
	Company               string               `json:"company"`
	PublishedArticleCount int64                `json:"publishedArticleCount"`
	FollowersCount        int64                `json:"followersCount"`
	FollowingCount        int64                `json:"followingCount"`
	BookmarkCount         int64                `json:"bookmarkCount"`
	Articles              []AuthorArticle      `json:"articles"`
	FollowingModules      []AuthorFollowModule `json:"followingModules"`
	FollowingDomains      []AuthorFollowDomain `json:"followingDomains"`
}

type AuthorProfilePage struct {
	Number int
	Size   int
	Total  int64
	Author PublicAuthorProfile
}

func ToPublic(user User) PublicUser {
	return PublicUser{
		ID:        user.ID,
		Username:  user.Username,
		Email:     user.Email,
		Role:      user.Role,
		Status:    user.Status,
		AvatarURL: user.AvatarURL,
		Bio:       user.Bio,
		School:    user.School,
		Company:   user.Company,
		CreatedAt: user.CreatedAt,
	}
}
