package moderation

import "time"

const (
	PenaltyAccountDisabled     = "account_disabled"
	PenaltyFollowRestricted    = "follow_restricted"
	PenaltyArticleCreateBanned = "article_create_banned"
	PenaltyCommentCreateBanned = "comment_create_banned"
)

type PenaltyInput struct {
	UserID     int64
	Type       string
	TargetType string
	TargetID   *int64
	Reason     string
	ExpiresAt  *time.Time
	CreatedBy  int64
	SourceType string
	SourceID   int64
}

type ActionInput struct {
	Type     string `json:"type"`
	Duration int    `json:"durationDays"`
}
