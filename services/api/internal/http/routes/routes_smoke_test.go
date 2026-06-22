package routes_test

import (
	"fmt"
	"net/http"
	"testing"

	"scholarbookstore/services/api/internal/testutil"
)

func TestSmokeHealthAuthAndAdminPermissions(t *testing.T) {
	env := testutil.NewSmokeEnv(t)
	adminID := env.SeedUser("admin", "admin@example.test", "admin", "active", "password123")
	env.SeedUser("disabled", "disabled@example.test", "user", "disabled", "password123")

	testutil.AssertStatus(t, env.Request(http.MethodGet, "/healthz", nil), http.StatusOK)
	testutil.AssertErrorCode(t, env.Request(http.MethodGet, "/api/v1/admin/users", nil), http.StatusUnauthorized, "UNAUTHORIZED")

	res := env.Request(http.MethodPost, "/api/v1/auth/register", map[string]string{
		"username": "reader",
		"email":    "reader@example.test",
		"password": "password123",
	})
	testutil.AssertStatus(t, res, http.StatusCreated)
	var reader struct {
		ID int64 `json:"id"`
	}
	res.DecodeData(t, &reader)

	readerCookie := env.Login("reader@example.test", "password123")
	testutil.AssertErrorCode(t, env.Request(http.MethodGet, "/api/v1/admin/users", nil, readerCookie), http.StatusForbidden, "FORBIDDEN")

	adminCookie := env.Login("admin@example.test", "password123")
	testutil.AssertStatus(t, env.Request(http.MethodGet, "/api/v1/admin/users?q=reader", nil, adminCookie), http.StatusOK)
	testutil.AssertStatus(t, env.Request(http.MethodPatch, fmt.Sprintf("/api/v1/admin/users/%d", reader.ID), map[string]string{
		"status": "disabled",
	}, adminCookie), http.StatusOK)
	testutil.AssertErrorCode(t, env.Request(http.MethodPost, "/api/v1/auth/login", map[string]string{
		"email":    "reader@example.test",
		"password": "password123",
	}), http.StatusForbidden, "FORBIDDEN")
	testutil.AssertErrorCode(t, env.Request(http.MethodPatch, fmt.Sprintf("/api/v1/admin/users/%d", adminID), map[string]string{
		"status": "disabled",
	}, adminCookie), http.StatusForbidden, "FORBIDDEN")
}

func TestSmokePublishingSearchTagsReportsAndSocialFlow(t *testing.T) {
	env := testutil.NewSmokeEnv(t)
	env.SeedUser("admin", "admin@example.test", "admin", "active", "password123")
	env.SeedUser("reviewer", "reviewer@example.test", "reviewer", "active", "password123")
	env.SeedUser("author", "author@example.test", "user", "active", "password123")
	env.SeedUser("reader", "reader@example.test", "user", "active", "password123")
	domainID := env.SeedDomain("science", "Science")
	moduleID := env.SeedModule(domainID, "physics", "Physics")

	authorCookie := env.Login("author@example.test", "password123")
	reviewerCookie := env.Login("reviewer@example.test", "password123")
	adminCookie := env.Login("admin@example.test", "password123")
	readerCookie := env.Login("reader@example.test", "password123")

	createArticle := env.Request(http.MethodPost, "/api/v1/articles", map[string]interface{}{
		"moduleId":  moduleID,
		"title":     "Quantum Notes",
		"summary":   "Searchable field theory summary",
		"contentMd": "This article mentions spectral calculus and quantum operators.",
		"status":    "pending_review",
		"tags":      []string{"Quantum", "Math"},
	}, authorCookie)
	testutil.AssertStatus(t, createArticle, http.StatusCreated)
	var article struct {
		ID     int64  `json:"id"`
		Status string `json:"status"`
	}
	createArticle.DecodeData(t, &article)
	if article.Status != "pending_review" {
		t.Fatalf("created article status = %q, want pending_review", article.Status)
	}

	testutil.AssertStatus(t, env.Request(http.MethodGet, "/api/v1/admin/articles/reviews", nil, reviewerCookie), http.StatusOK)
	testutil.AssertStatus(t, env.Request(http.MethodPost, fmt.Sprintf("/api/v1/admin/articles/%d/approve", article.ID), map[string]string{
		"reviewNote": "ok",
	}, reviewerCookie), http.StatusOK)
	if got := env.ArticleStatus(article.ID); got != "published" {
		t.Fatalf("article status after approve = %q, want published", got)
	}

	testutil.AssertStatus(t, env.Request(http.MethodGet, "/api/v1/articles?q=spectral&tag=quantum", nil), http.StatusOK)
	testutil.AssertStatus(t, env.Request(http.MethodGet, fmt.Sprintf("/api/v1/articles/%d", article.ID), nil), http.StatusOK)
	testutil.AssertStatus(t, env.Request(http.MethodGet, "/api/v1/tags?q=quan", nil), http.StatusOK)
	testutil.AssertStatus(t, env.Request(http.MethodGet, "/api/v1/admin/tags", nil, adminCookie), http.StatusOK)
	testutil.AssertStatus(t, env.Request(http.MethodGet, "/api/v1/admin/dashboard", nil, adminCookie), http.StatusOK)

	comment := env.Request(http.MethodPost, fmt.Sprintf("/api/v1/articles/%d/comments", article.ID), map[string]string{
		"content": "A useful public comment.",
	}, readerCookie)
	testutil.AssertStatus(t, comment, http.StatusCreated)
	var createdComment struct {
		ID int64 `json:"id"`
	}
	comment.DecodeData(t, &createdComment)
	testutil.AssertStatus(t, env.Request(http.MethodPut, fmt.Sprintf("/api/v1/comments/%d/vote", createdComment.ID), map[string]int{
		"value": 1,
	}, authorCookie), http.StatusOK)
	testutil.AssertStatus(t, env.Request(http.MethodPost, fmt.Sprintf("/api/v1/articles/%d/bookmark", article.ID), map[string]interface{}{}, readerCookie), http.StatusOK)
	collections := env.Request(http.MethodGet, "/api/v1/me/bookmark-collections", nil, readerCookie)
	testutil.AssertStatus(t, collections, http.StatusOK)
	var initialCollections []struct {
		ID        int64 `json:"id"`
		IsDefault bool  `json:"isDefault"`
	}
	collections.DecodeData(t, &initialCollections)
	var defaultCollectionID int64
	for _, collection := range initialCollections {
		if collection.IsDefault {
			defaultCollectionID = collection.ID
		}
	}
	if defaultCollectionID == 0 {
		t.Fatal("default bookmark collection was not created")
	}
	customCollection := env.Request(http.MethodPost, "/api/v1/me/bookmark-collections", map[string]string{
		"name": "Reading queue",
	}, readerCookie)
	testutil.AssertStatus(t, customCollection, http.StatusCreated)
	var createdCollection struct {
		ID int64 `json:"id"`
	}
	customCollection.DecodeData(t, &createdCollection)
	testutil.AssertStatus(t, env.Request(http.MethodPatch, fmt.Sprintf("/api/v1/me/bookmark-collections/%d", createdCollection.ID), map[string]string{
		"name": "Archive queue",
	}, readerCookie), http.StatusOK)
	bookmarks := env.Request(http.MethodGet, "/api/v1/me/bookmarks", nil, readerCookie)
	testutil.AssertStatus(t, bookmarks, http.StatusOK)
	var bookmarkItems []struct {
		BookmarkID   int64 `json:"bookmarkId"`
		CollectionID int64 `json:"collectionId"`
	}
	bookmarks.DecodeData(t, &bookmarkItems)
	if len(bookmarkItems) != 1 {
		t.Fatalf("bookmarks length = %d, want 1", len(bookmarkItems))
	}
	testutil.AssertStatus(t, env.Request(http.MethodPatch, fmt.Sprintf("/api/v1/me/bookmarks/%d", bookmarkItems[0].BookmarkID), map[string]int64{
		"collectionId": createdCollection.ID,
	}, readerCookie), http.StatusOK)
	testutil.AssertStatus(t, env.Request(http.MethodDelete, fmt.Sprintf("/api/v1/me/bookmark-collections/%d", createdCollection.ID), nil, readerCookie), http.StatusOK)
	bookmarksAfterDelete := env.Request(http.MethodGet, "/api/v1/me/bookmarks", nil, readerCookie)
	testutil.AssertStatus(t, bookmarksAfterDelete, http.StatusOK)
	var bookmarkItemsAfterDelete []struct {
		CollectionID int64 `json:"collectionId"`
	}
	bookmarksAfterDelete.DecodeData(t, &bookmarkItemsAfterDelete)
	if len(bookmarkItemsAfterDelete) != 1 || bookmarkItemsAfterDelete[0].CollectionID != defaultCollectionID {
		t.Fatalf("deleted collection did not transfer bookmark to default: %#v default=%d", bookmarkItemsAfterDelete, defaultCollectionID)
	}
	testutil.AssertStatus(t, env.Request(http.MethodPost, "/api/v1/users/author/follow", nil, readerCookie), http.StatusOK)
	testutil.AssertStatus(t, env.Request(http.MethodGet, "/api/v1/me/notifications", nil, authorCookie), http.StatusOK)

	report := env.Request(http.MethodPost, fmt.Sprintf("/api/v1/articles/%d/reports", article.ID), map[string]string{
		"reason": "Contains a moderation issue that should be reviewed.",
	}, readerCookie)
	testutil.AssertStatus(t, report, http.StatusCreated)
	var createdReport struct {
		ID int64 `json:"id"`
	}
	report.DecodeData(t, &createdReport)
	testutil.AssertStatus(t, env.Request(http.MethodGet, "/api/v1/admin/reports?status=pending", nil, reviewerCookie), http.StatusOK)
	testutil.AssertStatus(t, env.Request(http.MethodPost, fmt.Sprintf("/api/v1/admin/reports/%d/resolve", createdReport.ID), map[string]interface{}{
		"status":         "resolved",
		"note":           "archive from smoke test",
		"archiveArticle": true,
	}, reviewerCookie), http.StatusOK)
	if got := env.ArticleStatus(article.ID); got != "archived" {
		t.Fatalf("article status after report resolution = %q, want archived", got)
	}
	testutil.AssertErrorCode(t, env.Request(http.MethodPost, fmt.Sprintf("/api/v1/admin/reports/%d/resolve", createdReport.ID), map[string]interface{}{
		"status":         "resolved",
		"archiveArticle": true,
	}, reviewerCookie), http.StatusConflict, "CONFLICT")
}
