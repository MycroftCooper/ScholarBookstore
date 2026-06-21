package notifications

import "time"

type CreateCommentReplyInput struct {
	RecipientID int64
	ActorID     int64
	ArticleID   int64
	CommentID   int64
}

type CreateArticleCommentInput struct {
	RecipientID int64
	ActorID     int64
	ArticleID   int64
	CommentID   int64
}

type CreateArticleBookmarkInput struct {
	RecipientID int64
	ActorID     int64
	ArticleID   int64
}

type Notification struct {
	ID            int64
	RecipientID   int64
	ActorID       int64
	ActorUsername string
	Type          string
	ArticleID     *int64
	ArticleTitle  *string
	CommentID     *int64
	ReadAt        *time.Time
	CreatedAt     time.Time
}

type PublicNotification struct {
	ID            int64      `json:"id"`
	RecipientID   int64      `json:"recipientId"`
	ActorID       int64      `json:"actorId"`
	ActorUsername string     `json:"actorUsername"`
	Type          string     `json:"type"`
	ArticleID     *int64     `json:"articleId"`
	ArticleTitle  *string    `json:"articleTitle"`
	CommentID     *int64     `json:"commentId"`
	ReadAt        *time.Time `json:"readAt"`
	CreatedAt     time.Time  `json:"createdAt"`
}

func ToPublic(notification Notification) PublicNotification {
	return PublicNotification{
		ID:            notification.ID,
		RecipientID:   notification.RecipientID,
		ActorID:       notification.ActorID,
		ActorUsername: notification.ActorUsername,
		Type:          notification.Type,
		ArticleID:     notification.ArticleID,
		ArticleTitle:  notification.ArticleTitle,
		CommentID:     notification.CommentID,
		ReadAt:        notification.ReadAt,
		CreatedAt:     notification.CreatedAt,
	}
}

func ToPublicList(items []Notification) []PublicNotification {
	out := make([]PublicNotification, 0, len(items))
	for _, item := range items {
		out = append(out, ToPublic(item))
	}
	return out
}
