package notifications

import "context"

type NotificationRepository interface {
	ListMineWithPool(ctx context.Context, recipientID int64, unreadOnly bool, page int, pageSize int) ([]Notification, int64, error)
	UnreadCountWithPool(ctx context.Context, recipientID int64) (int64, error)
	MarkReadWithPool(ctx context.Context, recipientID int64, id int64) error
	MarkAllReadWithPool(ctx context.Context, recipientID int64) (int64, error)
}

type Service struct {
	repo NotificationRepository
}

type Page struct {
	Number        int
	Size          int
	Total         int64
	Notifications []PublicNotification
}

func NewService(repo NotificationRepository) *Service {
	return &Service{repo: repo}
}

func (s *Service) ListMine(ctx context.Context, recipientID int64, unreadOnly bool, page int, pageSize int) (Page, error) {
	if recipientID <= 0 {
		return Page{}, ErrNotFound
	}
	page, pageSize = normalizePage(page, pageSize)
	items, total, err := s.repo.ListMineWithPool(ctx, recipientID, unreadOnly, page, pageSize)
	if err != nil {
		return Page{}, err
	}
	return Page{Number: page, Size: pageSize, Total: total, Notifications: ToPublicList(items)}, nil
}

func (s *Service) UnreadCount(ctx context.Context, recipientID int64) (int64, error) {
	if recipientID <= 0 {
		return 0, ErrNotFound
	}
	return s.repo.UnreadCountWithPool(ctx, recipientID)
}

func (s *Service) MarkRead(ctx context.Context, recipientID int64, id int64) error {
	if recipientID <= 0 || id <= 0 {
		return ErrNotFound
	}
	return s.repo.MarkReadWithPool(ctx, recipientID, id)
}

func (s *Service) MarkAllRead(ctx context.Context, recipientID int64) (int64, error) {
	if recipientID <= 0 {
		return 0, ErrNotFound
	}
	return s.repo.MarkAllReadWithPool(ctx, recipientID)
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
