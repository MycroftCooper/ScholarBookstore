package response

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

type ErrorBody struct {
	Error ErrorPayload `json:"error"`
}

type ErrorPayload struct {
	Code    string      `json:"code"`
	Message string      `json:"message"`
	Details interface{} `json:"details,omitempty"`
}

type SuccessBody struct {
	Data interface{} `json:"data"`
	Meta interface{} `json:"meta"`
}

func JSON(w http.ResponseWriter, status int, data interface{}, meta interface{}) {
	write(w, status, SuccessBody{
		Data: data,
		Meta: normalizeMeta(meta),
	})
}

func Error(w http.ResponseWriter, status int, code string, message string, details interface{}) {
	write(w, status, ErrorBody{
		Error: ErrorPayload{
			Code:    code,
			Message: message,
			Details: details,
		},
	})
}

func write(w http.ResponseWriter, status int, body interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		slog.Error("write response", "error", err)
	}
}

func normalizeMeta(meta interface{}) interface{} {
	if meta == nil {
		return map[string]interface{}{}
	}
	return meta
}
