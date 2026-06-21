package follows

import "errors"

var (
	ErrNotFound     = errors.New("follow target not found")
	ErrInvalidInput = errors.New("invalid follow input")
	ErrForbidden    = errors.New("follow forbidden")
)
