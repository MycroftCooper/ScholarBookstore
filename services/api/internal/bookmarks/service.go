package bookmarks

import (
	"context"
	"strings"

	"github.com/jackc/pgx/v5"

	"scholarbookstore/services/api/internal/notifications"
)

type BookmarkRepository interface {
	Begin(ctx context.Context) (pgx.Tx, error)
	FindPublishedArticle(ctx context.Context, tx pgx.Tx, articleID int64) (BookmarkableArticle, error)
	EnsureDefaultCollection(ctx context.Context, tx pgx.Tx, userID int64) (Collection, error)
	FindCollectionForUser(ctx context.Context, tx pgx.Tx, userID int64, collectionID int64) (Collection, error)
	CreateCollection(ctx context.Context, userID int64, name string) (Collection, error)
	ListCollections(ctx context.Context, userID int64) ([]Collection, error)
	AddBookmark(ctx context.Context, tx pgx.Tx, userID int64, articleID int64, collectionID int64) (bool, error)
	RemoveBookmark(ctx context.Context, userID int64, articleID int64) (State, error)
	State(ctx context.Context, userID int64, articleID int64) (State, error)
	StateTx(ctx context.Context, tx pgx.Tx, userID int64, articleID int64) (State, error)
	ListBookmarks(ctx context.Context, userID int64, collectionID *int64, page int, pageSize int) ([]BookmarkedArticle, int64, error)
}

type NotificationRepository interface {
	CreateArticleBookmark(ctx context.Context, tx pgx.Tx, input notifications.CreateArticleBookmarkInput) error
}

type Service struct {
	bookmarks     BookmarkRepository
	notifications NotificationRepository
}

func NewService(repo BookmarkRepository, notificationRepo NotificationRepository) *Service {
	return &Service{bookmarks: repo, notifications: notificationRepo}
}

func (s *Service) ListCollections(ctx context.Context, userID int64) ([]PublicCollection, error) {
	if userID <= 0 {
		return nil, ErrForbidden
	}
	tx, err := s.bookmarks.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if _, err := s.bookmarks.EnsureDefaultCollection(ctx, tx, userID); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	items, err := s.bookmarks.ListCollections(ctx, userID)
	if err != nil {
		return nil, err
	}
	return ToPublicCollections(items), nil
}

func (s *Service) CreateCollection(ctx context.Context, userID int64, name string) (PublicCollection, error) {
	if userID <= 0 {
		return PublicCollection{}, ErrForbidden
	}
	name = NormalizeCollectionName(name)
	if name == "" || len([]rune(name)) > 80 {
		return PublicCollection{}, ErrInvalidInput
	}
	item, err := s.bookmarks.CreateCollection(ctx, userID, name)
	if err != nil {
		return PublicCollection{}, err
	}
	return ToPublicCollection(item), nil
}

func (s *Service) Add(ctx context.Context, userID int64, articleID int64, collectionID *int64) (PublicState, error) {
	if userID <= 0 {
		return PublicState{}, ErrForbidden
	}
	if articleID <= 0 {
		return PublicState{}, ErrNotFound
	}

	tx, err := s.bookmarks.Begin(ctx)
	if err != nil {
		return PublicState{}, err
	}
	defer tx.Rollback(ctx)

	article, err := s.bookmarks.FindPublishedArticle(ctx, tx, articleID)
	if err != nil {
		return PublicState{}, err
	}

	var targetCollectionID int64
	if collectionID != nil {
		targetCollectionID = *collectionID
		if targetCollectionID <= 0 {
			return PublicState{}, ErrInvalidInput
		}
		if _, err := s.bookmarks.FindCollectionForUser(ctx, tx, userID, targetCollectionID); err != nil {
			return PublicState{}, err
		}
	} else {
		collection, err := s.bookmarks.EnsureDefaultCollection(ctx, tx, userID)
		if err != nil {
			return PublicState{}, err
		}
		targetCollectionID = collection.ID
	}

	created, err := s.bookmarks.AddBookmark(ctx, tx, userID, articleID, targetCollectionID)
	if err != nil {
		return PublicState{}, err
	}

	if created && article.AuthorID != userID {
		if err := s.notifications.CreateArticleBookmark(ctx, tx, notifications.CreateArticleBookmarkInput{
			RecipientID: article.AuthorID,
			ActorID:     userID,
			ArticleID:   article.ID,
		}); err != nil {
			return PublicState{}, err
		}
	}

	state, err := s.bookmarks.StateTx(ctx, tx, userID, articleID)
	if err != nil {
		return PublicState{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return PublicState{}, err
	}
	return ToPublicState(state), nil
}

func (s *Service) Remove(ctx context.Context, userID int64, articleID int64) (PublicState, error) {
	if userID <= 0 {
		return PublicState{}, ErrForbidden
	}
	if articleID <= 0 {
		return PublicState{}, ErrNotFound
	}
	state, err := s.bookmarks.RemoveBookmark(ctx, userID, articleID)
	if err != nil {
		return PublicState{}, err
	}
	return ToPublicState(state), nil
}

func (s *Service) State(ctx context.Context, userID int64, articleID int64) (PublicState, error) {
	if userID <= 0 {
		return PublicState{}, ErrForbidden
	}
	if articleID <= 0 {
		return PublicState{}, ErrNotFound
	}
	state, err := s.bookmarks.State(ctx, userID, articleID)
	if err != nil {
		return PublicState{}, err
	}
	return ToPublicState(state), nil
}

func (s *Service) ListBookmarks(ctx context.Context, userID int64, collectionID *int64, page int, pageSize int) (Page, error) {
	if userID <= 0 {
		return Page{}, ErrForbidden
	}
	if collectionID != nil && *collectionID <= 0 {
		return Page{}, ErrInvalidInput
	}
	page, pageSize = normalizePage(page, pageSize)
	items, total, err := s.bookmarks.ListBookmarks(ctx, userID, collectionID, page, pageSize)
	if err != nil {
		return Page{}, err
	}
	return Page{Number: page, Size: pageSize, Total: total, Bookmarks: ToPublicBookmarks(items)}, nil
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

func NormalizeCollectionName(name string) string {
	return strings.TrimSpace(name)
}
