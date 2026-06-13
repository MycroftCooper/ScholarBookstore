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
	"scholarbookstore/services/api/internal/comments"
	"scholarbookstore/services/api/internal/config"
	authmiddleware "scholarbookstore/services/api/internal/http/middleware"
	"scholarbookstore/services/api/internal/http/response"
	"scholarbookstore/services/api/internal/modules"
	"scholarbookstore/services/api/internal/notifications"
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
		AllowedMethods:   []string{http.MethodGet, http.MethodPost, http.MethodPatch, http.MethodDelete, http.MethodOptions},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Get("/healthz", handleHealthz(deps.DB))

	userRepo := users.NewRepository(deps.DB)
	authService := auth.NewService(deps.Config, userRepo)
	authHandler := auth.NewHandler(deps.Config, authService)
	moduleRepo := modules.NewRepository(deps.DB)
	moduleService := modules.NewService(moduleRepo)
	moduleHandler := modules.NewHandler(moduleService)
	articleRepo := articles.NewRepository(deps.DB)
	articleService := articles.NewService(articleRepo)
	articleHandler := articles.NewHandler(articleService)
	notificationRepo := notifications.NewRepository(deps.DB)
	notificationService := notifications.NewService(notificationRepo)
	notificationHandler := notifications.NewHandler(notificationService)
	commentRepo := comments.NewRepository(deps.DB)
	commentService := comments.NewService(commentRepo, notificationRepo)
	commentHandler := comments.NewHandler(commentService)
	uploadRepo := apiuploads.NewRepository(deps.DB)
	uploadService := apiuploads.NewService(deps.Config, uploadRepo)
	uploadHandler := apiuploads.NewHandler(uploadService)

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
		r.Get("/modules/{slug}", moduleHandler.Detail)
		r.Get("/articles", articleHandler.ListPublished)
		r.Get("/articles/{id}", articleHandler.DetailPublished)
		r.Get("/articles/{id}/comments", commentHandler.ListByArticle)

		r.Group(func(r chi.Router) {
			r.Use(authmiddleware.RequireAuth(deps.Config, authService))
			r.Post("/articles", articleHandler.Create)
			r.Post("/articles/{id}/comments", commentHandler.CreateTopLevel)
			r.Post("/comments/{id}/replies", commentHandler.Reply)
			r.Delete("/comments/{id}", commentHandler.Delete)
			r.Get("/me/articles", articleHandler.ListMine)
			r.Get("/me/articles/{id}", articleHandler.DetailMine)
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
			r.Post("/admin/modules", moduleHandler.Create)
			r.Patch("/admin/modules/{id}", moduleHandler.Update)
		})

		r.Group(func(r chi.Router) {
			r.Use(authmiddleware.RequireAuth(deps.Config, authService))
			r.Use(authmiddleware.RequireRole("reviewer", "admin"))
			r.Get("/admin/articles", articleHandler.ListAdmin)
			r.Get("/admin/articles/reviews", articleHandler.ListPendingReview)
			r.Post("/admin/articles/{id}/approve", articleHandler.Approve)
			r.Post("/admin/articles/{id}/reject", articleHandler.Reject)
			r.Post("/admin/articles/{id}/archive", articleHandler.Archive)
			r.Post("/admin/articles/{id}/restore", articleHandler.RestoreArchived)
			r.Get("/admin/comments", commentHandler.ListAdmin)
			r.Post("/admin/comments/{id}/hide", commentHandler.Hide)
			r.Post("/admin/comments/{id}/show", commentHandler.Show)
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
