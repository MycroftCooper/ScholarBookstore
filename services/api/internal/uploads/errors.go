package uploads

import "errors"

var (
	ErrInvalidInput         = errors.New("invalid upload input")
	ErrPayloadTooLarge      = errors.New("upload payload too large")
	ErrUnsupportedMediaType = errors.New("unsupported upload media type")
	ErrNotFound             = errors.New("upload parent not found")
)
