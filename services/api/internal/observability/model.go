package observability

import "time"

type ErrorLogInput struct {
	Source      string
	Level       string
	Fingerprint string
	Message     string
	Stack       string
	UserID      *int64
	RequestID   string
	Method      string
	Path        string
	IP          string
	UserAgent   string
	Metadata    map[string]string
}

type ErrorLog struct {
	ID              int64             `json:"id"`
	Source          string            `json:"source"`
	Level           string            `json:"level"`
	Fingerprint     string            `json:"fingerprint"`
	Message         string            `json:"message"`
	Stack           string            `json:"stack"`
	UserID          *int64            `json:"userId"`
	Username        *string           `json:"username"`
	RequestID       string            `json:"requestId"`
	Method          string            `json:"method"`
	Path            string            `json:"path"`
	IP              string            `json:"ip"`
	UserAgent       string            `json:"userAgent"`
	Metadata        map[string]string `json:"metadata"`
	OccurrenceCount int64             `json:"occurrenceCount"`
	FirstSeenAt     time.Time         `json:"firstSeenAt"`
	LastSeenAt      time.Time         `json:"lastSeenAt"`
	CreatedAt       time.Time         `json:"createdAt"`
}

type ErrorLogFilter struct {
	Source string
	UserID *int64
}

type ErrorLogPage struct {
	Number int        `json:"number"`
	Size   int        `json:"size"`
	Total  int64      `json:"total"`
	Logs   []ErrorLog `json:"logs"`
}
