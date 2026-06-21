package auth

import "errors"

var (
	ErrInvalidInput       = errors.New("invalid input")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrUserDisabled       = errors.New("user disabled")
	ErrUserConflict       = errors.New("user conflict")
	ErrUnauthorized       = errors.New("unauthorized")
	ErrPayloadTooLarge    = errors.New("payload too large")
	ErrUnsupportedMedia   = errors.New("unsupported media type")
)
