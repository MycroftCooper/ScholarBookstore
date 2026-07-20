package comments

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5"

	"scholarbookstore/services/api/internal/notifications"
)

type fakeCommentRepo struct {
	deletedCanDeleteAny bool
	voted               bool
	clearedVote         bool
	visibility          string
}

func (r *fakeCommentRepo) Begin(context.Context) (pgx.Tx, error) { return nil, errors.New("unused") }
func (r *fakeCommentRepo) ListByArticle(context.Context, int64, int64, string, int, int) ([]Comment, int64, error) {
	return nil, 0, nil
}
func (r *fakeCommentRepo) ListMine(context.Context, int64, int, int) ([]Comment, int64, error) {
	return nil, 0, nil
}
func (r *fakeCommentRepo) ListAdmin(context.Context, int, int) ([]Comment, int64, error) {
	return nil, 0, nil
}
func (r *fakeCommentRepo) CreateTopLevel(context.Context, int64, int64, string) (Comment, error) {
	return Comment{}, nil
}
func (r *fakeCommentRepo) FindPublishedArticleForComment(context.Context, pgx.Tx, int64) (CommentableArticle, error) {
	return CommentableArticle{}, nil
}
func (r *fakeCommentRepo) CreateTopLevelTx(context.Context, pgx.Tx, int64, int64, string) (Comment, error) {
	return Comment{}, nil
}
func (r *fakeCommentRepo) FindParentForReply(context.Context, pgx.Tx, int64) (ParentComment, error) {
	return ParentComment{}, nil
}
func (r *fakeCommentRepo) CreateReply(context.Context, pgx.Tx, int64, ParentComment, string) (Comment, error) {
	return Comment{}, nil
}
func (r *fakeCommentRepo) Delete(_ context.Context, _ int64, _ int64, canDeleteAny bool) error {
	r.deletedCanDeleteAny = canDeleteAny
	return nil
}
func (r *fakeCommentRepo) SetVisibility(_ context.Context, id int64, visibility string) (Comment, error) {
	r.visibility = visibility
	return Comment{ID: id, Visibility: visibility}, nil
}
func (r *fakeCommentRepo) SetVote(_ context.Context, commentID int64, userID int64) (Comment, error) {
	r.voted = true
	return Comment{ID: commentID, AuthorID: userID + 1, MyVote: 1}, nil
}
func (r *fakeCommentRepo) ClearVote(_ context.Context, commentID int64, userID int64) (Comment, error) {
	r.clearedVote = true
	return Comment{ID: commentID, AuthorID: userID + 1, MyVote: 0}, nil
}

type fakeCommentNotificationRepo struct{}

func (r *fakeCommentNotificationRepo) CreateCommentReply(context.Context, pgx.Tx, notifications.CreateCommentReplyInput) error {
	return nil
}
func (r *fakeCommentNotificationRepo) CreateArticleComment(context.Context, pgx.Tx, notifications.CreateArticleCommentInput) error {
	return nil
}

func TestVoteRejectsInvalidValue(t *testing.T) {
	service := NewService(&fakeCommentRepo{}, &fakeCommentNotificationRepo{})

	_, err := service.Vote(context.Background(), 1, 2, 2)
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
}

func TestVoteRejectsDownvote(t *testing.T) {
	service := NewService(&fakeCommentRepo{}, &fakeCommentNotificationRepo{})

	_, err := service.Vote(context.Background(), 1, 2, -1)
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
}

func TestVoteCanClearExistingVote(t *testing.T) {
	repo := &fakeCommentRepo{}
	service := NewService(repo, &fakeCommentNotificationRepo{})

	comment, err := service.Vote(context.Background(), 1, 2, 0)
	if err != nil {
		t.Fatalf("clear vote: %v", err)
	}
	if !repo.clearedVote || comment.MyVote != 0 {
		t.Fatalf("vote was not cleared: repo=%#v comment=%#v", repo, comment)
	}
}

func TestDeleteAllowsReviewerAndAdminToDeleteAnyComment(t *testing.T) {
	repo := &fakeCommentRepo{}
	service := NewService(repo, &fakeCommentNotificationRepo{})

	if err := service.Delete(context.Background(), 1, 2, "reviewer"); err != nil {
		t.Fatalf("delete as reviewer: %v", err)
	}
	if !repo.deletedCanDeleteAny {
		t.Fatal("reviewer delete did not set canDeleteAny")
	}
}

func TestHideAndShowSetExpectedVisibility(t *testing.T) {
	repo := &fakeCommentRepo{}
	service := NewService(repo, &fakeCommentNotificationRepo{})

	hidden, err := service.Hide(context.Background(), 1)
	if err != nil {
		t.Fatalf("hide: %v", err)
	}
	if repo.visibility != "hidden" || hidden.Visibility != "hidden" {
		t.Fatalf("hide visibility mismatch: repo=%#v comment=%#v", repo, hidden)
	}

	visible, err := service.Show(context.Background(), 1)
	if err != nil {
		t.Fatalf("show: %v", err)
	}
	if repo.visibility != "visible" || visible.Visibility != "visible" {
		t.Fatalf("show visibility mismatch: repo=%#v comment=%#v", repo, visible)
	}
}
