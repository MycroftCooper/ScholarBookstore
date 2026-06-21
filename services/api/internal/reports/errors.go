package reports

import "errors"

var (
	ErrNotFound     = errors.New("report not found")
	ErrInvalidInput = errors.New("invalid report input")
	ErrConflict     = errors.New("report conflict")
)
