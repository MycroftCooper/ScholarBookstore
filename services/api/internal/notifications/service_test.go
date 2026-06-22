package notifications

import (
	"context"
	"errors"
	"testing"
)

type fakeNotificationRepo struct {
	recipientID int64
	unreadOnly  bool
	page        int
	pageSize    int
	markReadID  int64
}

func (r *fakeNotificationRepo) ListMineWithPool(_ context.Context, recipientID int64, unreadOnly bool, page int, pageSize int) ([]Notification, int64, error) {
	r.recipientID = recipientID
	r.unreadOnly = unreadOnly
	r.page = page
	r.pageSize = pageSize
	return []Notification{{ID: 1, RecipientID: recipientID, Type: "article_comment"}}, 1, nil
}

func (r *fakeNotificationRepo) UnreadCountWithPool(_ context.Context, recipientID int64) (int64, error) {
	r.recipientID = recipientID
	return 3, nil
}

func (r *fakeNotificationRepo) MarkReadWithPool(_ context.Context, recipientID int64, id int64) error {
	r.recipientID = recipientID
	r.markReadID = id
	return nil
}

func (r *fakeNotificationRepo) MarkAllReadWithPool(_ context.Context, recipientID int64) (int64, error) {
	r.recipientID = recipientID
	return 4, nil
}

func TestListMineNormalizesPaginationAndUsesRecipient(t *testing.T) {
	repo := &fakeNotificationRepo{}
	service := NewService(repo)

	page, err := service.ListMine(context.Background(), 7, true, -1, 1000)
	if err != nil {
		t.Fatalf("list notifications: %v", err)
	}
	if repo.recipientID != 7 || !repo.unreadOnly || repo.page != 1 || repo.pageSize != 100 {
		t.Fatalf("unexpected repo args: %#v", repo)
	}
	if page.Total != 1 || len(page.Notifications) != 1 || page.Notifications[0].RecipientID != 7 {
		t.Fatalf("unexpected page: %#v", page)
	}
}

func TestNotificationOperationsRejectInvalidRecipient(t *testing.T) {
	service := NewService(&fakeNotificationRepo{})

	if _, err := service.ListMine(context.Background(), 0, false, 1, 20); !errors.Is(err, ErrNotFound) {
		t.Fatalf("ListMine error = %v, want ErrNotFound", err)
	}
	if _, err := service.UnreadCount(context.Background(), 0); !errors.Is(err, ErrNotFound) {
		t.Fatalf("UnreadCount error = %v, want ErrNotFound", err)
	}
	if err := service.MarkRead(context.Background(), 1, 0); !errors.Is(err, ErrNotFound) {
		t.Fatalf("MarkRead error = %v, want ErrNotFound", err)
	}
	if _, err := service.MarkAllRead(context.Background(), 0); !errors.Is(err, ErrNotFound) {
		t.Fatalf("MarkAllRead error = %v, want ErrNotFound", err)
	}
}

func TestMarkReadAndMarkAllReadUseRecipientScope(t *testing.T) {
	repo := &fakeNotificationRepo{}
	service := NewService(repo)

	if err := service.MarkRead(context.Background(), 7, 9); err != nil {
		t.Fatalf("mark read: %v", err)
	}
	if repo.recipientID != 7 || repo.markReadID != 9 {
		t.Fatalf("MarkRead args = %#v", repo)
	}

	count, err := service.MarkAllRead(context.Background(), 8)
	if err != nil {
		t.Fatalf("mark all read: %v", err)
	}
	if count != 4 || repo.recipientID != 8 {
		t.Fatalf("MarkAllRead count=%d repo=%#v", count, repo)
	}
}
