package modules

import "errors"

var (
	ErrNotFound     = errors.New("module not found")
	ErrConflict     = errors.New("module conflict")
	ErrInvalidInput = errors.New("invalid module input")
)
