package routes

import (
	"context"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"

	"scholarbookstore/services/api/internal/admin"
	"scholarbookstore/services/api/internal/articles"
	"scholarbookstore/services/api/internal/auth"
	"scholarbookstore/services/api/internal/bookmarks"
	"scholarbookstore/services/api/internal/comments"
	"scholarbookstore/services/api/internal/config"
	"scholarbookstore/services/api/internal/dashboard"
	"scholarbookstore/services/api/internal/domains"
	"scholarbookstore/services/api/internal/follows"
	authmiddleware "scholarbookstore/services/api/internal/http/middleware"
	"scholarbookstore/services/api/internal/http/response"
	"scholarbookstore/services/api/internal/modules"
	"scholarbookstore/services/api/internal/notifications"
	"scholarbookstore/services/api/internal/reports"
	"scholarbookstore/services/api/internal/tags"
	apiuploads "scholarbookstore/services/api/internal/uploads"
	"scholarbookstore/services/api/internal/users"
)

type Dependencies struct {
	Config config.Config
	DB     *pgxpool.Pool
}

func New(deps Dependencies) http.Handler {
	r := chi.NewRouter()
	r.Use(chimiddleware.RequestID)
	r.Use(chimiddleware.RealIP)
	r.Use(chimiddleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   deps.Config.CORSAllowedOrigins,
		AllowedMethods:   []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete, http.MethodOptions},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Get("/healthz", handleHealthz(deps.DB))

	userRepo := users.NewRepository(deps.DB)
	userService := users.NewService(userRepo)
	userHandler := users.NewHandler(userService)
	authService := auth.NewService(deps.Config, userRepo)
	authHandler := auth.NewHandler(deps.Config, authService)
	domainRepo := domains.NewRepository(deps.DB)
	domainService := domains.NewService(domainRepo)
	domainHandler := domains.NewHandler(domainService)
	moduleRepo := modules.NewRepository(deps.DB)
	moduleService := modules.NewService(moduleRepo)
	moduleHandler := modules.NewHandler(moduleService)
	articleRepo := articles.NewRepository(deps.DB)
	articleService := articles.NewService(articleRepo)
	articleHandler := articles.NewHandler(articleService)
	notificationRepo := notifications.NewRepository(deps.DB)
	notificationService := notifications.NewService(notificationRepo)
	notificationHandler := notifications.NewHandler(notificationService)
	bookmarkRepo := bookmarks.NewRepository(deps.DB)
	bookmarkService := bookmarks.NewService(bookmarkRepo, notificationRepo)
	bookmarkHandler := bookmarks.NewHandler(bookmarkService)
	followRepo := follows.NewRepository(deps.DB)
	followService := follows.NewService(followRepo)
	followHandler := follows.NewHandler(followService)
	reportRepo := reports.NewRepository(deps.DB)
	reportService := reports.NewService(reportRepo)
	reportHandler := reports.NewHandler(reportService)
	commentRepo := comments.NewRepository(deps.DB)
	commentService := comments.NewService(commentRepo, notificationRepo)
	commentHandler := comments.NewHandler(commentService)
	uploadRepo := apiuploads.NewRepository(deps.DB)
	uploadService := apiuploads.NewService(deps.Config, uploadRepo)
	uploadHandler := apiuploads.NewHandler(uploadService)
	tagRepo := tags.NewRepository(deps.DB)
	tagService := tags.NewService(tagRepo)
	tagHandler := tags.NewHandler(tagService)
	dashboardRepo := dashboard.NewRepository(deps.DB)
	dashboardService := dashboard.NewService(dashboardRepo)
	dashboardHandler := dashboard.NewHandler(dashboardService)
	adminRepo := admin.NewRepository(deps.DB)
	adminService := admin.NewService(adminRepo)
	adminHandler := admin.NewHandler(adminService, articleService, reportService)
	audit := func(action string, targetType string, targetParam string, detail map[string]string, next http.HandlerFunc) http.HandlerFunc {
		return audited(adminService, action, targetType, targetParam, detail, next)
	}

	r.Handle("/uploads/*", http.StripPrefix("/uploads/", http.FileServer(http.Dir(deps.Config.UploadDir))))

	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/healthz", handleHealthz(deps.DB))

		r.Route("/auth", func(r chi.Router) {
			r.Post("/register", authHandler.Register)
			r.Post("/login", authHandler.Login)

			r.Group(func(r chi.Router) {
				r.Use(authmiddleware.RequireAuth(deps.Config, authService))
				r.Post("/logout", authHandler.Logout)
				r.Get("/me", authHandler.Me)
			})
		})

		r.With(authmiddleware.OptionalAuth(deps.Config, authService)).Get("/modules", moduleHandler.List)
		r.With(authmiddleware.OptionalAuth(deps.Config, authService)).Get("/domains", domainHandler.List)
		r.Get("/domains/{id}", domainHandler.Detail)
		r.Get("/modules/{slug}", moduleHandler.Detail)
		r.Get("/articles", articleHandler.ListPublished)
		r.Get("/articles/{id}", articleHandler.DetailPublished)
		r.Get("/tags", tagHandler.List)
		r.Get("/users/{username}", userHandler.PublicAuthorProfile)

		r.Group(func(r chi.Router) {
			r.Use(authmiddleware.RequireAuth(deps.Config, authService))
			r.Patch("/me/profile", authHandler.UpdateProfile)
			r.Post("/me/avatar", authHandler.UploadAvatar)
			r.Get("/articles/{id}/comments", commentHandler.ListByArticle)
			r.Get("/articles/{id}/bookmark", bookmarkHandler.State)
			r.Post("/articles/preview", articleHandler.Preview)
			r.Post("/articles", articleHandler.Create)
			r.Post("/articles/{id}/comments", commentHandler.CreateTopLevel)
			r.Post("/articles/{id}/bookmark", bookmarkHandler.Add)
			r.Post("/articles/{id}/reports", reportHandler.Create)
			r.Delete("/articles/{id}/bookmark", bookmarkHandler.Remove)
			r.Get("/modules/{slug}/follow", followHandler.ModuleState)
			r.Post("/modules/{slug}/follow", followHandler.FollowModule)
			r.Delete("/modules/{slug}/follow", followHandler.UnfollowModule)
			r.Get("/domains/{id}/follow", followHandler.DomainState)
			r.Post("/domains/{id}/follow", followHandler.FollowDomain)
			r.Delete("/domains/{id}/follow", followHandler.UnfollowDomain)
			r.Post("/comments/{id}/replies", commentHandler.Reply)
			r.Put("/comments/{id}/vote", commentHandler.Vote)
			r.Delete("/comments/{id}", audit("comment_deleted", "comment", "id", nil, commentHandler.Delete))
			r.Get("/me/articles", articleHandler.ListMine)
			r.Get("/me/articles/{id}", articleHandler.DetailMine)
			r.Get("/me/bookmark-collections", bookmarkHandler.ListCollections)
			r.Post("/me/bookmark-collections", bookmarkHandler.CreateCollection)
			r.Patch("/me/bookmark-collections/{id}", bookmarkHandler.UpdateCollection)
			r.Delete("/me/bookmark-collections/{id}", bookmarkHandler.DeleteCollection)
			r.Get("/me/bookmarks", bookmarkHandler.ListBookmarks)
			r.Patch("/me/bookmarks/{id}", bookmarkHandler.MoveBookmark)
			r.Get("/me/following", followHandler.ListFollowing)
			r.Get("/me/followers", followHandler.ListFollowers)
			r.Get("/me/follow-recommendations", followHandler.ListRecommendedUsers)
			r.Get("/users/{username}/follow", followHandler.State)
			r.Post("/users/{username}/follow", followHandler.Follow)
			r.Delete("/users/{username}/follow", followHandler.Unfollow)
			r.Post("/users/{username}/reports", reportHandler.CreateUser)
			r.Get("/me/comments", commentHandler.ListMine)
			r.Get("/me/notifications", notificationHandler.ListMine)
			r.Get("/me/notifications/unread-count", notificationHandler.UnreadCount)
			r.Post("/me/notifications/{id}/read", notificationHandler.MarkRead)
			r.Post("/me/notifications/read-all", notificationHandler.MarkAllRead)
			r.Patch("/articles/{id}", articleHandler.UpdateOwn)
			r.Post("/uploads/article-images", uploadHandler.UploadArticleImage)
		})

		r.Group(func(r chi.Router) {
			r.Use(authmiddleware.RequireAuth(deps.Config, authService))
			r.Use(authmiddleware.RequireRole("admin"))
			r.Get("/admin/audit-logs", adminHandler.ListAuditLogs)
			r.Post("/admin/domains", audit("domain_create", "domain", "", nil, domainHandler.Create))
			r.Patch("/admin/domains/{id}", audit("domain_update", "domain", "id", nil, domainHandler.Update))
			r.Post("/admin/domains/{id}/owners", audit("domain_owner_add", "domain", "id", nil, domainHandler.AddOwner))
			r.Delete("/admin/domains/{id}/owners/{userId}", audit("domain_owner_remove", "domain", "id", nil, domainHandler.RemoveOwner))
			r.Get("/admin/users", userHandler.ListAdmin)
			r.Patch("/admin/users/{id}", audit("user_update", "user", "id", nil, userHandler.UpdateAdmin))
			r.Get("/admin/tags", tagHandler.List)
			r.Patch("/admin/tags/{id}", audit("tag_update", "tag", "id", nil, tagHandler.Update))
			r.Delete("/admin/tags/{id}", audit("tag_delete", "tag", "id", nil, tagHandler.Delete))
			r.Post("/admin/tags/merge", audit("tag_merge", "tag", "", nil, tagHandler.Merge))
		})

		r.Group(func(r chi.Router) {
			r.Use(authmiddleware.RequireAuth(deps.Config, authService))
			r.Get("/admin/tasks", adminHandler.ListTasks)
			r.Get("/admin/tasks/stats", adminHandler.TaskStats)
			r.Get("/admin/tasks/{id}", adminHandler.TaskDetail)
			r.Post("/admin/tasks/{id}/approve", adminHandler.ApproveTask)
			r.Post("/admin/tasks/{id}/reject", adminHandler.RejectTask)
			r.Post("/admin/tasks/{id}/take-down", adminHandler.TakeDownTask)
			r.Post("/admin/tasks/{id}/ignore", adminHandler.IgnoreTask)
			r.Get("/admin/articles", articleHandler.ListAdmin)
			r.Patch("/admin/articles/{id}", audit("article_featured_update", "article", "id", nil, articleHandler.UpdateAdmin))
			r.Get("/admin/articles/reviews", articleHandler.ListPendingReview)
			r.Post("/admin/articles/{id}/approve", audit("article_review_approved", "article", "id", nil, articleHandler.Approve))
			r.Post("/admin/articles/{id}/reject", audit("article_review_rejected", "article", "id", nil, articleHandler.Reject))
			r.Post("/admin/modules", audit("module_create", "module", "", nil, moduleHandler.Create))
			r.Patch("/admin/modules/{id}", audit("module_update", "module", "id", nil, moduleHandler.Update))
			r.Delete("/admin/modules/{id}", audit("module_archive", "module", "id", nil, moduleHandler.Delete))
			r.Post("/admin/modules/{id}/moderators", audit("module_moderator_add", "module", "id", nil, moduleHandler.AddModerator))
			r.Delete("/admin/modules/{id}/moderators/{userId}", audit("module_moderator_remove", "module", "id", nil, moduleHandler.RemoveModerator))
		})

		r.Group(func(r chi.Router) {
			r.Use(authmiddleware.RequireAuth(deps.Config, authService))
			r.Use(authmiddleware.RequireRole("reviewer", "admin"))
			r.Post("/admin/articles/{id}/archive", audit("article_archived", "article", "id", nil, articleHandler.Archive))
			r.Post("/admin/articles/{id}/restore", audit("article_restored", "article", "id", nil, articleHandler.RestoreArchived))
			r.Get("/admin/comments", commentHandler.ListAdmin)
			r.Post("/admin/comments/{id}/hide", audit("comment_hidden", "comment", "id", nil, commentHandler.Hide))
			r.Post("/admin/comments/{id}/show", audit("comment_shown", "comment", "id", nil, commentHandler.Show))
			r.Get("/admin/reports", reportHandler.ListAdmin)
			r.Post("/admin/reports/{id}/resolve", audit("report_resolved", "article_report", "id", nil, reportHandler.Resolve))
			r.Get("/admin/dashboard", dashboardHandler.Snapshot)
		})
	})

	return r
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

func audited(adminService *admin.Service, action string, targetType string, targetParam string, detail map[string]string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next(recorder, r)
		if recorder.status < 200 || recorder.status >= 400 {
			return
		}
		user, ok := auth.UserFromContext(r.Context())
		if !ok {
			return
		}
		targetID := int64(0)
		if targetParam != "" {
			parsed, err := strconv.ParseInt(chi.URLParam(r, targetParam), 10, 64)
			if err == nil && parsed > 0 {
				targetID = parsed
			}
		}
		if targetID == 0 {
			targetID = 1
		}
		logDetail := map[string]string{
			"method": r.Method,
			"path":   r.URL.Path,
		}
		for key, value := range detail {
			logDetail[key] = value
		}
		if userID := chi.URLParam(r, "userId"); strings.TrimSpace(userID) != "" {
			logDetail["userId"] = userID
		}
		_ = adminService.Audit(r.Context(), admin.AuditLogInput{
			ActorID:    user.ID,
			Action:     action,
			TargetType: targetType,
			TargetID:   targetID,
			Detail:     logDetail,
			IP:         r.RemoteAddr,
			UserAgent:  r.UserAgent(),
		})
	}
}

func handleHealthz(pool *pgxpool.Pool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()

		if err := pool.Ping(ctx); err != nil {
			response.Error(w, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "服务暂不可用", nil)
			return
		}

		response.JSON(w, http.StatusOK, map[string]interface{}{
			"ok": true,
		}, nil)
	}
}
