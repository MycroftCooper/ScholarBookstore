package auth

import (
	"context"

	"scholarbookstore/services/api/internal/session"
	"scholarbookstore/services/api/internal/users"
)

func ContextWithUser(ctx context.Context, user users.PublicUser) context.Context {
	return session.ContextWithUser(ctx, session.User{
		ID:       user.ID,
		Username: user.Username,
		Email:    user.Email,
		Role:     user.Role,
		Status:   user.Status,
	})
}

func UserFromContext(ctx context.Context) (users.PublicUser, bool) {
	user, ok := session.UserFromContext(ctx)
	if !ok {
		return users.PublicUser{}, false
	}
	return users.PublicUser{
		ID:       user.ID,
		Username: user.Username,
		Email:    user.Email,
		Role:     user.Role,
		Status:   user.Status,
	}, true
}
