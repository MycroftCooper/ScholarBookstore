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
	PublishedAt    *time.Time `json:"publishedAt"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
}

type PublicAuthorProfile struct {
	ID                    int64           `json:"id"`
	Username              string          `json:"username"`
	AvatarURL             string          `json:"avatarUrl"`
	Bio                   string          `json:"bio"`
	School                string          `json:"school"`
	Company               string          `json:"company"`
	PublishedArticleCount int64           `json:"publishedArticleCount"`
	FollowersCount        int64           `json:"followersCount"`
	FollowingCount        int64           `json:"followingCount"`
	Articles              []AuthorArticle `json:"articles"`
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
		AvatarURL: user.AvatarURL,
		Bio:       user.Bio,
		School:    user.School,
		Company:   user.Company,
		CreatedAt: user.CreatedAt,
	}
}
