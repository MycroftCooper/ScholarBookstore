package comments

import (
	"context"
	"strings"

	"github.com/jackc/pgx/v5"

	"scholarbookstore/services/api/internal/moderation"
	"scholarbookstore/services/api/internal/notifications"
)

type CommentRepository interface {
	Begin(ctx context.Context) (pgx.Tx, error)
	ListByArticle(ctx context.Context, articleID int64, viewerID int64, sort string, page int, pageSize int) ([]Comment, int64, error)
	ListMine(ctx context.Context, authorID int64, page int, pageSize int) ([]Comment, int64, error)
	ListAdmin(ctx context.Context, page int, pageSize int) ([]Comment, int64, error)
	CreateTopLevel(ctx context.Context, authorID int64, articleID int64, content string) (Comment, error)
	FindPublishedArticleForComment(ctx context.Context, tx pgx.Tx, articleID int64) (CommentableArticle, error)
	CreateTopLevelTx(ctx context.Context, tx pgx.Tx, authorID int64, articleID int64, content string) (Comment, error)
	FindParentForReply(ctx context.Context, tx pgx.Tx, id int64) (ParentComment, error)
	CreateReply(ctx context.Context, tx pgx.Tx, authorID int64, parent ParentComment, content string) (Comment, error)
	Delete(ctx context.Context, id int64, userID int64, canDeleteAny bool) error
	SetVisibility(ctx context.Context, id int64, visibility string) (Comment, error)
	SetVote(ctx context.Context, commentID int64, userID int64, value int) (Comment, error)
	ClearVote(ctx context.Context, commentID int64, userID int64) (Comment, error)
}

type NotificationRepository interface {
	CreateCommentReply(ctx context.Context, tx pgx.Tx, input notifications.CreateCommentReplyInput) error
	CreateArticleComment(ctx context.Context, tx pgx.Tx, input notifications.CreateArticleCommentInput) error
}

type Service struct {
	comments      CommentRepository
	notifications NotificationRepository
	penalties     PenaltyChecker
}

type Page struct {
	Number   int
	Size     int
	Total    int64
	Comments []PublicComment
}

type PenaltyChecker interface {
	HasActivePenalty(ctx context.Context, userID int64, penaltyType string) (bool, error)
}

func NewService(commentRepo CommentRepository, notificationRepo NotificationRepository, penaltyChecker ...PenaltyChecker) *Service {
	var checker PenaltyChecker
	if len(penaltyChecker) > 0 {
		checker = penaltyChecker[0]
	}
	return &Service{
		comments:      commentRepo,
		notifications: notificationRepo,
		penalties:     checker,
	}
}

func (s *Service) ListByArticle(ctx context.Context, articleID int64, viewerID int64, sort string, page int, pageSize int) (Page, error) {
	if articleID <= 0 {
		return Page{}, ErrNotFound
	}
	if viewerID <= 0 {
		return Page{}, ErrForbidden
	}
	sort = strings.TrimSpace(sort)
	if sort == "" {
		sort = "latest"
	}
	if sort != "latest" && sort != "hot" {
		return Page{}, ErrInvalidInput
	}
	page, pageSize = normalizePage(page, pageSize)
	items, total, err := s.comments.ListByArticle(ctx, articleID, viewerID, sort, page, pageSize)
	if err != nil {
		return Page{}, err
	}
	return Page{Number: page, Size: pageSize, Total: total, Comments: ToPublicList(items)}, nil
}

func (s *Service) Vote(ctx context.Context, commentID int64, userID int64, value int) (PublicComment, error) {
	if commentID <= 0 || userID <= 0 {
		return PublicComment{}, ErrNotFound
	}
	if value != -1 && value != 0 && value != 1 {
		return PublicComment{}, ErrInvalidInput
	}

	var (
		item Comment
		err  error
	)
	if value == 0 {
		item, err = s.comments.ClearVote(ctx, commentID, userID)
	} else {
		item, err = s.comments.SetVote(ctx, commentID, userID, value)
	}
	if err != nil {
		return PublicComment{}, err
	}
	return ToPublic(item), nil
}

func (s *Service) CreateTopLevel(ctx context.Context, authorID int64, articleID int64, content string) (PublicComment, error) {
	content = strings.TrimSpace(content)
	if authorID <= 0 || articleID <= 0 || !validContent(content) {
		return PublicComment{}, ErrInvalidInput
	}
	banned, err := s.hasPenalty(ctx, authorID, moderation.PenaltyCommentCreateBanned)
	if err != nil {
		return PublicComment{}, err
	}
	if banned {
		return PublicComment{}, ErrForbidden
	}

	tx, err := s.comments.Begin(ctx)
	if err != nil {
		return PublicComment{}, err
	}
	defer tx.Rollback(ctx)

	article, err := s.comments.FindPublishedArticleForComment(ctx, tx, articleID)
	if err != nil {
		return PublicComment{}, err
	}

	comment, err := s.comments.CreateTopLevelTx(ctx, tx, authorID, articleID, content)
	if err != nil {
		return PublicComment{}, err
	}

	if article.AuthorID != authorID {
		if err := s.notifications.CreateArticleComment(ctx, tx, notifications.CreateArticleCommentInput{
			RecipientID: article.AuthorID,
			ActorID:     authorID,
			ArticleID:   article.ID,
			CommentID:   comment.ID,
		}); err != nil {
			return PublicComment{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return PublicComment{}, err
	}

	return ToPublic(comment), nil
}

func (s *Service) ListMine(ctx context.Context, authorID int64, page int, pageSize int) (Page, error) {
	if authorID <= 0 {
		return Page{}, ErrForbidden
	}
	page, pageSize = normalizePage(page, pageSize)
	items, total, err := s.comments.ListMine(ctx, authorID, page, pageSize)
	if err != nil {
		return Page{}, err
	}
	return Page{Number: page, Size: pageSize, Total: total, Comments: ToPublicList(items)}, nil
}

func (s *Service) ListAdmin(ctx context.Context, page int, pageSize int) (Page, error) {
	page, pageSize = normalizePage(page, pageSize)
	items, total, err := s.comments.ListAdmin(ctx, page, pageSize)
	if err != nil {
		return Page{}, err
	}
	return Page{Number: page, Size: pageSize, Total: total, Comments: ToPublicList(items)}, nil
}

func (s *Service) Reply(ctx context.Context, authorID int64, parentID int64, content string) (PublicComment, error) {
	content = strings.TrimSpace(content)
	if authorID <= 0 || parentID <= 0 || !validContent(content) {
		return PublicComment{}, ErrInvalidInput
	}
	banned, err := s.hasPenalty(ctx, authorID, moderation.PenaltyCommentCreateBanned)
	if err != nil {
		return PublicComment{}, err
	}
	if banned {
		return PublicComment{}, ErrForbidden
	}

	tx, err := s.comments.Begin(ctx)
	if err != nil {
		return PublicComment{}, err
	}
	defer tx.Rollback(ctx)

	parent, err := s.comments.FindParentForReply(ctx, tx, parentID)
	if err != nil {
		return PublicComment{}, err
	}

	reply, err := s.comments.CreateReply(ctx, tx, authorID, parent, content)
	if err != nil {
		return PublicComment{}, err
	}

	if parent.AuthorID != authorID {
		if err := s.notifications.CreateCommentReply(ctx, tx, notifications.CreateCommentReplyInput{
			RecipientID: parent.AuthorID,
			ActorID:     authorID,
			ArticleID:   parent.ArticleID,
			CommentID:   reply.ID,
		}); err != nil {
			return PublicComment{}, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return PublicComment{}, err
	}

	return ToPublic(reply), nil
}

func (s *Service) hasPenalty(ctx context.Context, userID int64, penaltyType string) (bool, error) {
	if s.penalties == nil {
		return false, nil
	}
	return s.penalties.HasActivePenalty(ctx, userID, penaltyType)
}

func (s *Service) Delete(ctx context.Context, id int64, userID int64, role string) error {
	if id <= 0 || userID <= 0 {
		return ErrNotFound
	}
	canDeleteAny := role == "reviewer" || role == "admin"
	return s.comments.Delete(ctx, id, userID, canDeleteAny)
}

func (s *Service) Hide(ctx context.Context, id int64) (PublicComment, error) {
	if id <= 0 {
		return PublicComment{}, ErrNotFound
	}
	item, err := s.comments.SetVisibility(ctx, id, "hidden")
	if err != nil {
		return PublicComment{}, err
	}
	return ToPublic(item), nil
}

func (s *Service) Show(ctx context.Context, id int64) (PublicComment, error) {
	if id <= 0 {
		return PublicComment{}, ErrNotFound
	}
	item, err := s.comments.SetVisibility(ctx, id, "visible")
	if err != nil {
		return PublicComment{}, err
	}
	return ToPublic(item), nil
}

func validContent(content string) bool {
	return content != "" && len(content) <= 2000
}

func normalizePage(page int, pageSize int) (int, int) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	return page, pageSize
}
