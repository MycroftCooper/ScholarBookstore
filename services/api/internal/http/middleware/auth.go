package middleware

import (
	"net/http"

	"scholarbookstore/services/api/internal/auth"
	"scholarbookstore/services/api/internal/config"
	"scholarbookstore/services/api/internal/http/response"
)

func RequireAuth(cfg config.Config, service *auth.Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie(cfg.CookieName)
			if err != nil || cookie.Value == "" {
				response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "请先登录", nil)
				return
			}

			user, err := service.AuthenticateToken(r.Context(), cookie.Value)
			if err != nil {
				response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "登录状态已失效", nil)
				return
			}

			next.ServeHTTP(w, r.WithContext(auth.ContextWithUser(r.Context(), user)))
		})
	}
}

func OptionalAuth(cfg config.Config, service *auth.Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie(cfg.CookieName)
			if err != nil || cookie.Value == "" {
				next.ServeHTTP(w, r)
				return
			}

			user, err := service.AuthenticateToken(r.Context(), cookie.Value)
			if err != nil {
				next.ServeHTTP(w, r)
				return
			}

			next.ServeHTTP(w, r.WithContext(auth.ContextWithUser(r.Context(), user)))
		})
	}
}

func RequireRole(roles ...string) func(http.Handler) http.Handler {
	allowed := make(map[string]struct{}, len(roles))
	for _, role := range roles {
		allowed[role] = struct{}{}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, ok := auth.UserFromContext(r.Context())
			if !ok {
				response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "请先登录", nil)
				return
			}
			if _, ok := allowed[user.Role]; !ok {
				response.Error(w, http.StatusForbidden, "FORBIDDEN", "权限不足", nil)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
