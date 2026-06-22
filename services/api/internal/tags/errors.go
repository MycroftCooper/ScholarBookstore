package tags

import "errors"

var (
	ErrInvalidInput = errors.New("invalid tag input")
	ErrNotFound     = errors.New("tag not found")
	ErrConflict     = errors.New("tag conflict")
)
