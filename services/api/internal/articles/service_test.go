package articles

import (
	"context"
	"errors"
	"testing"
)

type fakeArticleRepo struct {
	created  CreateArticleInput
	revision UpdateArticleInput
	updated  UpdateArticleInput
	current  Article
	views    int
}

func (r *fakeArticleRepo) ListPublished(_ context.Context, _ PublishedArticleFilter, _ int, _ int) ([]Article, int64, error) {
	return []Article{{ID: 1, Title: "published", Status: "published"}}, 1, nil
}

func (r *fakeArticleRepo) ListAdmin(_ context.Context, _ AdminArticleFilter, _ int, _ int) ([]Article, int64, error) {
	return []Article{{ID: 1, Title: "published", Status: "published"}}, 1, nil
}

func (r *fakeArticleRepo) FindPublishedByID(_ context.Context, id int64) (Article, error) {
	if id != 1 {
		return Article{}, ErrNotFound
	}
	return Article{ID: id, Title: "published", ContentMD: "body", Status: "published", ViewCount: int64(r.views)}, nil
}

func (r *fakeArticleRepo) IncrementViewCount(_ context.Context, id int64) error {
	if id != 1 {
		return ErrNotFound
	}
	r.views++
	return nil
}

func (r *fakeArticleRepo) ListMine(_ context.Context, _ int64, _ string, _ int, _ int) ([]Article, int64, error) {
	return []Article{{ID: 2, Title: "mine", Status: "pending_review"}}, 1, nil
}

func (r *fakeArticleRepo) Create(_ context.Context, input CreateArticleInput) (Article, error) {
	r.created = input
	return Article{
		ID:             2,
		ModuleID:       input.ModuleID,
		AuthorID:       input.AuthorID,
		Title:          input.Title,
		Summary:        input.Summary,
		ContentMD:      input.ContentMD,
		SourceType:     input.SourceType,
		Status:         input.Status,
		WordCount:      input.WordCount,
		ReadingMinutes: input.ReadingMinutes,
	}, nil
}

func (r *fakeArticleRepo) CreateRevision(_ context.Context, originalID int64, authorID int64, input UpdateArticleInput) (Article, error) {
	r.revision = input
	revisionOfID := originalID
	title := *input.Title
	summary := *input.Summary
	content := *input.ContentMD
	sourceType := *input.SourceType
	return Article{
		ID:           22,
		AuthorID:     authorID,
		Title:        title,
		Summary:      summary,
		ContentMD:    content,
		SourceType:   sourceType,
		Status:       "pending_review",
		RevisionOfID: &revisionOfID,
	}, nil
}

func (r *fakeArticleRepo) FindByIDForAuthor(_ context.Context, _ int64, _ int64) (Article, error) {
	if r.current.ID != 0 {
		return r.current, nil
	}
	return Article{ID: 2, Title: "mine", ContentMD: "body", Status: "rejected", ReviewNote: "fix it"}, nil
}

func (r *fakeArticleRepo) UpdateOwn(_ context.Context, id int64, authorID int64, input UpdateArticleInput) (Article, error) {
	r.updated = input
	title := "old title"
	if input.Title != nil {
		title = *input.Title
	}
	status := "pending_review"
	if input.Status != nil {
		status = *input.Status
	}
	return Article{
		ID:        id,
		AuthorID:  authorID,
		Title:     title,
		ContentMD: "body",
		Status:    status,
	}, nil
}

func (r *fakeArticleRepo) ListPendingReview(_ context.Context, _ AdminArticleFilter, _ int, _ int) ([]Article, int64, error) {
	return []Article{{ID: 3, Title: "pending", Status: "pending_review"}}, 1, nil
}

func (r *fakeArticleRepo) CanModerateArticle(_ context.Context, _ int64, _ string, _ int64) (bool, error) {
	return true, nil
}

func (r *fakeArticleRepo) Approve(_ context.Context, id int64, input ReviewArticleInput) (Article, error) {
	return Article{ID: id, Title: "published", Status: "published", ReviewNote: input.ReviewNote}, nil
}

func (r *fakeArticleRepo) Reject(_ context.Context, id int64, input ReviewArticleInput) (Article, error) {
	return Article{ID: id, Title: "rejected", Status: "rejected", ReviewNote: input.ReviewNote}, nil
}

func (r *fakeArticleRepo) Archive(_ context.Context, id int64) (Article, error) {
	return Article{ID: id, Title: "archived", Status: "archived"}, nil
}

func (r *fakeArticleRepo) RestoreArchived(_ context.Context, id int64) (Article, error) {
	return Article{ID: id, Title: "restored", Status: "published"}, nil
}

func (r *fakeArticleRepo) UpdateAdmin(_ context.Context, id int64, input AdminUpdateArticleInput) (Article, error) {
	isFeatured := false
	if input.IsFeatured != nil {
		isFeatured = *input.IsFeatured
	}
	return Article{ID: id, Title: "admin updated", Status: "published", IsFeatured: isFeatured}, nil
}

func TestCreateNormalizesInput(t *testing.T) {
	repo := &fakeArticleRepo{}
	service := NewService(repo)

	article, err := service.Create(context.Background(), CreateArticleInput{
		ModuleID:  1,
		AuthorID:  2,
		Title:     " Title ",
		Summary:   " Summary ",
		ContentMD: " Body text ",
	})
	if err != nil {
		t.Fatalf("create article: %v", err)
	}

	if article.Status != "pending_review" {
		t.Fatalf("unexpected status: %s", article.Status)
	}
	if repo.created.Title != "Title" || repo.created.Summary != "Summary" || repo.created.ContentMD != "Body text" {
		t.Fatalf("input was not normalized: %#v", repo.created)
	}
	if repo.created.SourceType != "original" || article.SourceType != "original" {
		t.Fatalf("source type should default to original: input=%s article=%s", repo.created.SourceType, article.SourceType)
	}
	if repo.created.WordCount != 8 || repo.created.ReadingMinutes != 1 {
		t.Fatalf("unexpected metrics: %#v", repo.created)
	}
}

func TestCreateAllowsEmptyDraftContent(t *testing.T) {
	repo := &fakeArticleRepo{}
	service := NewService(repo)

	article, err := service.Create(context.Background(), CreateArticleInput{
		ModuleID: 1,
		AuthorID: 2,
		Title:    "Draft",
		Status:   "draft",
	})
	if err != nil {
		t.Fatalf("create draft: %v", err)
	}
	if article.Status != "draft" || repo.created.Status != "draft" {
		t.Fatalf("unexpected draft status: article=%s input=%s", article.Status, repo.created.Status)
	}
}

func TestCreateRejectsEmptyPendingContent(t *testing.T) {
	service := NewService(&fakeArticleRepo{})

	_, err := service.Create(context.Background(), CreateArticleInput{
		ModuleID: 1,
		AuthorID: 2,
		Title:    "Title",
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

func TestFindPublishedByIDIncrementsViews(t *testing.T) {
	repo := &fakeArticleRepo{}
	service := NewService(repo)

	article, err := service.FindPublishedByID(context.Background(), 1)
	if err != nil {
		t.Fatalf("find published article: %v", err)
	}
	if repo.views != 1 || article.ViewCount != 1 {
		t.Fatalf("view count was not incremented: repo=%d article=%d", repo.views, article.ViewCount)
	}
}

func TestFindMineByIDReturnsOwnArticleContent(t *testing.T) {
	service := NewService(&fakeArticleRepo{})

	article, err := service.FindMineByID(context.Background(), 2, 9)
	if err != nil {
		t.Fatalf("find my article: %v", err)
	}
	if article.ID != 2 || article.ContentMD != "body" || article.ReviewNote != "fix it" {
		t.Fatalf("unexpected article: %#v", article)
	}
}

func TestUpdateOwnTrimsTitle(t *testing.T) {
	repo := &fakeArticleRepo{}
	service := NewService(repo)
	title := " New title "

	article, err := service.UpdateOwn(context.Background(), 1, 2, UpdateArticleInput{Title: &title})
	if err != nil {
		t.Fatalf("update article: %v", err)
	}

	if article.Title != "New title" || repo.updated.Title == nil || *repo.updated.Title != "New title" {
		t.Fatalf("title was not trimmed: article=%#v updated=%#v", article, repo.updated.Title)
	}
}

func TestUpdateOwnComputesMetrics(t *testing.T) {
	repo := &fakeArticleRepo{}
	service := NewService(repo)
	content := "Hello world"
	status := "pending_review"

	_, err := service.UpdateOwn(context.Background(), 1, 2, UpdateArticleInput{
		ContentMD: &content,
		Status:    &status,
	})
	if err != nil {
		t.Fatalf("update article: %v", err)
	}
	if repo.updated.WordCount == nil || *repo.updated.WordCount != 10 {
		t.Fatalf("unexpected word count: %#v", repo.updated.WordCount)
	}
}

func TestUpdatePublishedCreatesRevision(t *testing.T) {
	repo := &fakeArticleRepo{
		current: Article{ID: 7, Title: "published", Summary: "old", ContentMD: "old body", SourceType: "original", Status: "published"},
	}
	service := NewService(repo)
	title := " Revised title "
	summary := " Revised summary "
	content := "Revised body"
	status := "pending_review"

	article, err := service.UpdateOwn(context.Background(), 7, 2, UpdateArticleInput{
		Title:     &title,
		Summary:   &summary,
		ContentMD: &content,
		Status:    &status,
	})
	if err != nil {
		t.Fatalf("create revision: %v", err)
	}

	if article.Status != "pending_review" || article.RevisionOfID == nil || *article.RevisionOfID != 7 {
		t.Fatalf("unexpected revision article: %#v", article)
	}
	if repo.revision.Title == nil || *repo.revision.Title != "Revised title" {
		t.Fatalf("revision input was not normalized: %#v", repo.revision.Title)
	}
	if repo.updated.Title != nil {
		t.Fatalf("published article should not be updated directly: %#v", repo.updated)
	}
}

func TestRejectRequiresReviewNote(t *testing.T) {
	service := NewService(&fakeArticleRepo{})

	_, err := service.Reject(context.Background(), 1, 2, "admin", " ")
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
}

func TestApprovePublishesArticle(t *testing.T) {
	service := NewService(&fakeArticleRepo{})

	article, err := service.Approve(context.Background(), 1, 2, "admin", "ok")
	if err != nil {
		t.Fatalf("approve article: %v", err)
	}
	if article.Status != "published" {
		t.Fatalf("unexpected status: %s", article.Status)
	}
}
