package comments

import "errors"

var (
	ErrNotFound     = errors.New("comment not found")
	ErrInvalidInput = errors.New("invalid comment input")
	ErrForbidden    = errors.New("comment forbidden")
	ErrConflict     = errors.New("comment conflict")
)
