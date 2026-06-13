package articles

import "errors"

var (
	ErrNotFound     = errors.New("article not found")
	ErrInvalidInput = errors.New("invalid article input")
	ErrForbidden    = errors.New("article forbidden")
	ErrConflict     = errors.New("article conflict")
)
