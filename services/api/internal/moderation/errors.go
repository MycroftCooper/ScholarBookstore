package moderation

import "errors"

var (
	ErrInvalidInput = errors.New("invalid moderation input")
	ErrForbidden    = errors.New("moderation forbidden")
)
