package auth

import (
	"context"

	"scholarbookstore/services/api/internal/users"
)

type contextKey string

const currentUserKey contextKey = "currentUser"

func ContextWithUser(ctx context.Context, user users.PublicUser) context.Context {
	return context.WithValue(ctx, currentUserKey, user)
}

func UserFromContext(ctx context.Context) (users.PublicUser, bool) {
	user, ok := ctx.Value(currentUserKey).(users.PublicUser)
	return user, ok
}
