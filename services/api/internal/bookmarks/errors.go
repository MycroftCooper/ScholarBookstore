package bookmarks

import "errors"

var (
	ErrNotFound     = errors.New("bookmark not found")
	ErrInvalidInput = errors.New("invalid bookmark input")
	ErrForbidden    = errors.New("bookmark forbidden")
	ErrConflict     = errors.New("bookmark conflict")
)
