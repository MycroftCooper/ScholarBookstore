package articles

import (
	"context"
	"errors"
	"testing"
)

type fakeArticleRepo struct {
	created CreateArticleInput
	updated UpdateArticleInput
}

func (r *fakeArticleRepo) ListPublished(_ context.Context, _ string, _ int, _ int) ([]Article, int64, error) {
	return []Article{{ID: 1, Title: "已发布", Status: "published"}}, 1, nil
}

func (r *fakeArticleRepo) FindPublishedByID(_ context.Context, id int64) (Article, error) {
	if id != 1 {
		return Article{}, ErrNotFound
	}
	return Article{ID: id, Title: "已发布", ContentMD: "正文", Status: "published"}, nil
}

func (r *fakeArticleRepo) ListMine(_ context.Context, _ int64, _ string, _ int, _ int) ([]Article, int64, error) {
	return []Article{{ID: 2, Title: "我的投稿", Status: "pending_review"}}, 1, nil
}

func (r *fakeArticleRepo) Create(_ context.Context, input CreateArticleInput) (Article, error) {
	r.created = input
	return Article{
		ID:        2,
		ModuleID:  input.ModuleID,
		AuthorID:  input.AuthorID,
		Title:     input.Title,
		Summary:   input.Summary,
		ContentMD: input.ContentMD,
		Status:    "pending_review",
	}, nil
}

func (r *fakeArticleRepo) FindByIDForAuthor(_ context.Context, _ int64, _ int64) (Article, error) {
	return Article{}, nil
}

func (r *fakeArticleRepo) UpdateOwn(_ context.Context, id int64, authorID int64, input UpdateArticleInput) (Article, error) {
	r.updated = input
	title := "原标题"
	if input.Title != nil {
		title = *input.Title
	}
	return Article{
		ID:        id,
		AuthorID:  authorID,
		Title:     title,
		ContentMD: "正文",
		Status:    "pending_review",
	}, nil
}

func (r *fakeArticleRepo) ListPendingReview(_ context.Context, _ int, _ int) ([]Article, int64, error) {
	return []Article{{ID: 3, Title: "待审核", Status: "pending_review"}}, 1, nil
}

func (r *fakeArticleRepo) Approve(_ context.Context, id int64, input ReviewArticleInput) (Article, error) {
	return Article{ID: id, Title: "已发布", Status: "published", ReviewNote: input.ReviewNote}, nil
}

func (r *fakeArticleRepo) Reject(_ context.Context, id int64, input ReviewArticleInput) (Article, error) {
	return Article{ID: id, Title: "已拒绝", Status: "rejected", ReviewNote: input.ReviewNote}, nil
}

func TestCreateNormalizesInput(t *testing.T) {
	repo := &fakeArticleRepo{}
	service := NewService(repo)

	article, err := service.Create(context.Background(), CreateArticleInput{
		ModuleID:  1,
		AuthorID:  2,
		Title:     " 标题 ",
		Summary:   " 摘要 ",
		ContentMD: " 正文 ",
	})
	if err != nil {
		t.Fatalf("create article: %v", err)
	}

	if article.Status != "pending_review" {
		t.Fatalf("unexpected status: %s", article.Status)
	}
	if repo.created.Title != "标题" || repo.created.Summary != "摘要" || repo.created.ContentMD != "正文" {
		t.Fatalf("input was not normalized: %#v", repo.created)
	}
}

func TestCreateRejectsEmptyContent(t *testing.T) {
	service := NewService(&fakeArticleRepo{})

	_, err := service.Create(context.Background(), CreateArticleInput{
		ModuleID: 1,
		AuthorID: 2,
		Title:    "标题",
	})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
}

func TestListMineRejectsInvalidStatus(t *testing.T) {
	service := NewService(&fakeArticleRepo{})

	_, err := service.ListMine(context.Background(), 1, "unknown", 1, 20)
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
}

func TestUpdateOwnTrimsTitle(t *testing.T) {
	repo := &fakeArticleRepo{}
	service := NewService(repo)
	title := " 新标题 "

	article, err := service.UpdateOwn(context.Background(), 1, 2, UpdateArticleInput{Title: &title})
	if err != nil {
		t.Fatalf("update article: %v", err)
	}

	if article.Title != "新标题" || repo.updated.Title == nil || *repo.updated.Title != "新标题" {
		t.Fatalf("title was not trimmed: article=%#v updated=%#v", article, repo.updated.Title)
	}
}

func TestRejectRequiresReviewNote(t *testing.T) {
	service := NewService(&fakeArticleRepo{})

	_, err := service.Reject(context.Background(), 1, 2, " ")
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
}

func TestApprovePublishesArticle(t *testing.T) {
	service := NewService(&fakeArticleRepo{})

	article, err := service.Approve(context.Background(), 1, 2, "通过")
	if err != nil {
		t.Fatalf("approve article: %v", err)
	}
	if article.Status != "published" {
		t.Fatalf("unexpected status: %s", article.Status)
	}
}
