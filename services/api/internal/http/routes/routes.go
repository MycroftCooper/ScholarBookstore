package routes

import (
	"context"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"

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
			r.Post("/articles", articleHandler.Create)
			r.Post("/articles/{id}/comments", commentHandler.CreateTopLevel)
			r.Post("/articles/{id}/bookmark", bookmarkHandler.Add)
			r.Post("/articles/{id}/reports", reportHandler.Create)
			r.Delete("/articles/{id}/bookmark", bookmarkHandler.Remove)
			r.Post("/comments/{id}/replies", commentHandler.Reply)
			r.Put("/comments/{id}/vote", commentHandler.Vote)
			r.Delete("/comments/{id}", commentHandler.Delete)
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
			r.Get("/users/{username}/follow", followHandler.State)
			r.Post("/users/{username}/follow", followHandler.Follow)
			r.Delete("/users/{username}/follow", followHandler.Unfollow)
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
			r.Post("/admin/domains", domainHandler.Create)
			r.Patch("/admin/domains/{id}", domainHandler.Update)
			r.Post("/admin/domains/{id}/owners", domainHandler.AddOwner)
			r.Delete("/admin/domains/{id}/owners/{userId}", domainHandler.RemoveOwner)
			r.Get("/admin/users", userHandler.ListAdmin)
			r.Patch("/admin/users/{id}", userHandler.UpdateAdmin)
			r.Get("/admin/tags", tagHandler.List)
			r.Patch("/admin/tags/{id}", tagHandler.Update)
			r.Delete("/admin/tags/{id}", tagHandler.Delete)
			r.Post("/admin/tags/merge", tagHandler.Merge)
		})

		r.Group(func(r chi.Router) {
			r.Use(authmiddleware.RequireAuth(deps.Config, authService))
			r.Get("/admin/articles", articleHandler.ListAdmin)
			r.Patch("/admin/articles/{id}", articleHandler.UpdateAdmin)
			r.Get("/admin/articles/reviews", articleHandler.ListPendingReview)
			r.Post("/admin/articles/{id}/approve", articleHandler.Approve)
			r.Post("/admin/articles/{id}/reject", articleHandler.Reject)
			r.Post("/admin/modules", moduleHandler.Create)
			r.Patch("/admin/modules/{id}", moduleHandler.Update)
			r.Delete("/admin/modules/{id}", moduleHandler.Delete)
			r.Post("/admin/modules/{id}/moderators", moduleHandler.AddModerator)
			r.Delete("/admin/modules/{id}/moderators/{userId}", moduleHandler.RemoveModerator)
		})

		r.Group(func(r chi.Router) {
			r.Use(authmiddleware.RequireAuth(deps.Config, authService))
			r.Use(authmiddleware.RequireRole("reviewer", "admin"))
			r.Post("/admin/articles/{id}/archive", articleHandler.Archive)
			r.Post("/admin/articles/{id}/restore", articleHandler.RestoreArchived)
			r.Get("/admin/comments", commentHandler.ListAdmin)
			r.Post("/admin/comments/{id}/hide", commentHandler.Hide)
			r.Post("/admin/comments/{id}/show", commentHandler.Show)
			r.Get("/admin/reports", reportHandler.ListAdmin)
			r.Post("/admin/reports/{id}/resolve", reportHandler.Resolve)
			r.Get("/admin/dashboard", dashboardHandler.Snapshot)
		})
	})

	return r
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
