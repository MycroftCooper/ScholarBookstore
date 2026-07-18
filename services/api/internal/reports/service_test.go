package reports

import (
	"context"
	"errors"
	"testing"
)

type fakeReportRepo struct {
	status         string
	archiveArticle bool
}

func (r *fakeReportRepo) Create(_ context.Context, articleID int64, reporterID int64, reason string) (Report, error) {
	return Report{ID: 1, ArticleID: articleID, ReporterID: reporterID, Reason: reason, Status: "pending"}, nil
}

func (r *fakeReportRepo) CreateUser(_ context.Context, username string, reporterID int64, reason string) (UserReport, error) {
	return UserReport{ID: 1, ReportedUsername: username, ReporterID: reporterID, Reason: reason, Status: "pending"}, nil
}

func (r *fakeReportRepo) CreateComment(_ context.Context, commentID int64, reporterID int64, reason string) (CommentReport, error) {
	return CommentReport{ID: 1, CommentID: commentID, ReporterID: reporterID, Reason: reason, Status: "pending"}, nil
}

func (r *fakeReportRepo) ListAdmin(_ context.Context, status string, _ int, _ int) ([]Report, int64, error) {
	return []Report{{ID: 1, Status: status}}, 1, nil
}

func (r *fakeReportRepo) Resolve(_ context.Context, id int64, reviewerID int64, status string, note string, archiveArticle bool) (Report, error) {
	r.status = status
	r.archiveArticle = archiveArticle
	return Report{ID: id, Status: status, HandledBy: &reviewerID, HandleNote: note}, nil
}

func (r *fakeReportRepo) ResolveUser(_ context.Context, id int64, reviewerID int64, status string, note string, disableUser bool) (UserReport, error) {
	r.status = status
	r.archiveArticle = disableUser
	return UserReport{ID: id, Status: status, HandledBy: &reviewerID, HandleNote: note}, nil
}

func (r *fakeReportRepo) ResolveComment(_ context.Context, id int64, reviewerID int64, status string, note string, hideComment bool) (CommentReport, error) {
	r.status = status
	r.archiveArticle = hideComment
	return CommentReport{ID: id, Status: status, HandledBy: &reviewerID, HandleNote: note}, nil
}

func TestResolveRejectsArchiveOnRejectedReport(t *testing.T) {
	service := NewService(&fakeReportRepo{})

	_, err := service.Resolve(context.Background(), 1, 2, "rejected", "no issue", true)
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
}

func TestResolveAllowsArchiveForResolvedReport(t *testing.T) {
	repo := &fakeReportRepo{}
	service := NewService(repo)

	report, err := service.Resolve(context.Background(), 1, 2, "resolved", "archived", true)
	if err != nil {
		t.Fatalf("resolve report: %v", err)
	}
	if report.Status != "resolved" || repo.status != "resolved" || !repo.archiveArticle {
		t.Fatalf("archive flag was not forwarded: report=%#v repo=%#v", report, repo)
	}
}

func TestResolveUserRejectsDisableOnRejectedReport(t *testing.T) {
	service := NewService(&fakeReportRepo{})

	_, err := service.ResolveUser(context.Background(), 1, 2, "rejected", "no issue", true)
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
}

func TestResolveUserAllowsDisableForResolvedReport(t *testing.T) {
	repo := &fakeReportRepo{}
	service := NewService(repo)

	report, err := service.ResolveUser(context.Background(), 1, 2, "resolved", "disable user", true)
	if err != nil {
		t.Fatalf("resolve user report: %v", err)
	}
	if report.Status != "resolved" || repo.status != "resolved" || !repo.archiveArticle {
		t.Fatalf("disable flag was not forwarded: report=%#v repo=%#v", report, repo)
	}
}
