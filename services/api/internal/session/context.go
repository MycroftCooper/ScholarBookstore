package session

import (
	"context"
)

type contextKey string

const currentUserKey contextKey = "currentUser"

type User struct {
	ID       int64
	Username string
	Email    string
	Role     string
	Status   string
}

func ContextWithUser(ctx context.Context, user User) context.Context {
	return context.WithValue(ctx, currentUserKey, user)
}

func UserFromContext(ctx context.Context) (User, bool) {
	user, ok := ctx.Value(currentUserKey).(User)
	return user, ok
}
