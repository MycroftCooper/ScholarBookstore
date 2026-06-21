package follows

import "time"

type UserSummary struct {
	ID        int64
	Username  string
	AvatarURL string
	Bio       string
	CreatedAt time.Time
}

type PublicUserSummary struct {
	ID        int64     `json:"id"`
	Username  string    `json:"username"`
	AvatarURL string    `json:"avatarUrl"`
	Bio       string    `json:"bio"`
	CreatedAt time.Time `json:"createdAt"`
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

func ToPublicUserSummary(item UserSummary) PublicUserSummary {
	return PublicUserSummary{
		ID:        item.ID,
		Username:  item.Username,
		AvatarURL: item.AvatarURL,
		Bio:       item.Bio,
		CreatedAt: item.CreatedAt,
	}
}

func ToPublicUserSummaries(items []UserSummary) []PublicUserSummary {
	out := make([]PublicUserSummary, 0, len(items))
	for _, item := range items {
		out = append(out, ToPublicUserSummary(item))
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
