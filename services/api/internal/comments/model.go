package comments

import "time"

type Comment struct {
	ID              int64
	ArticleID       int64
	AuthorID        int64
	AuthorUsername  string
	ParentID        *int64
	ReplyToUserID   *int64
	ReplyToUsername *string
	Content         string
	Visibility      string
	UpVotes         int64
	DownVotes       int64
	MyVote          int
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

type PublicComment struct {
	ID              int64     `json:"id"`
	ArticleID       int64     `json:"articleId"`
	AuthorID        int64     `json:"authorId"`
	AuthorUsername  string    `json:"authorUsername"`
	ParentID        *int64    `json:"parentId"`
	ReplyToUserID   *int64    `json:"replyToUserId"`
	ReplyToUsername *string   `json:"replyToUsername"`
	Content         string    `json:"content"`
	Visibility      string    `json:"visibility"`
	UpVotes         int64     `json:"upVotes"`
	DownVotes       int64     `json:"downVotes"`
	Score           int64     `json:"score"`
	MyVote          int       `json:"myVote"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

type ParentComment struct {
	ID        int64
	ArticleID int64
	AuthorID  int64
}

type CommentableArticle struct {
	ID       int64
	AuthorID int64
}

func ToPublic(comment Comment) PublicComment {
	return PublicComment{
		ID:              comment.ID,
		ArticleID:       comment.ArticleID,
		AuthorID:        comment.AuthorID,
		AuthorUsername:  comment.AuthorUsername,
		ParentID:        comment.ParentID,
		ReplyToUserID:   comment.ReplyToUserID,
		ReplyToUsername: comment.ReplyToUsername,
		Content:         comment.Content,
		Visibility:      comment.Visibility,
		UpVotes:         comment.UpVotes,
		DownVotes:       comment.DownVotes,
		Score:           comment.UpVotes - comment.DownVotes,
		MyVote:          comment.MyVote,
		CreatedAt:       comment.CreatedAt,
		UpdatedAt:       comment.UpdatedAt,
	}
}

func ToPublicList(items []Comment) []PublicComment {
	out := make([]PublicComment, 0, len(items))
	for _, item := range items {
		out = append(out, ToPublic(item))
	}
	return out
}
