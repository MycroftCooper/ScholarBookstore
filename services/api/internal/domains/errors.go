package domains

import "errors"

var (
	ErrNotFound     = errors.New("domain not found")
	ErrConflict     = errors.New("domain conflict")
	ErrInvalidInput = errors.New("invalid domain input")
)
