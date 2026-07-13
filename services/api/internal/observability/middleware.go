package observability

import (
	"fmt"
	"log/slog"
	"net/http"
	"runtime/debug"

	"github.com/go-chi/chi/v5/middleware"

	"scholarbookstore/services/api/internal/auth"
	"scholarbookstore/services/api/internal/http/response"
)

func Recoverer(service *Service) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if recovered := recover(); recovered != nil {
					message := fmt.Sprintf("panic: %v", recovered)
					stack := string(debug.Stack())
					var userID *int64
					if user, ok := auth.UserFromContext(r.Context()); ok {
						userID = &user.ID
					}
					input := ErrorLogInput{
						Source:    "server",
						Level:     "error",
						Message:   message,
						Stack:     stack,
						UserID:    userID,
						RequestID: middleware.GetReqID(r.Context()),
						Method:    r.Method,
						Path:      r.URL.Path,
						IP:        r.RemoteAddr,
						UserAgent: r.UserAgent(),
						Metadata: map[string]string{
							"query": r.URL.RawQuery,
						},
					}
					if err := service.CreateErrorLog(r.Context(), input); err != nil {
						slog.Error("write panic error log", "error", err, "panic", recovered)
					}
					slog.Error("request panic", "panic", recovered, "path", r.URL.Path, "requestId", middleware.GetReqID(r.Context()))
					response.Error(w, http.StatusInternalServerError, "SERVER_ERROR", "Internal server error", nil)
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}
