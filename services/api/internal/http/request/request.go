package request

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
)

const (
	defaultPage     = 1
	defaultPageSize = 20
	maxPageSize     = 100
)

func DecodeJSON(r *http.Request, dst interface{}) error {
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	return decoder.Decode(dst)
}

func DecodeJSONAllowEmpty(r *http.Request, dst interface{}) error {
	if r.ContentLength == 0 {
		return nil
	}
	return DecodeJSON(r, dst)
}

func Pagination(r *http.Request) (int, int, bool) {
	page := defaultPage
	pageSize := defaultPageSize
	var err error
	if raw := r.URL.Query().Get("page"); raw != "" {
		page, err = strconv.Atoi(raw)
		if err != nil {
			return 0, 0, false
		}
	}
	if raw := r.URL.Query().Get("pageSize"); raw != "" {
		pageSize, err = strconv.Atoi(raw)
		if err != nil {
			return 0, 0, false
		}
	}
	if page < 1 || pageSize < 1 || pageSize > maxPageSize {
		return 0, 0, false
	}
	return page, pageSize, true
}

func IDParam(r *http.Request, name string) (int64, bool) {
	id, err := strconv.ParseInt(chi.URLParam(r, name), 10, 64)
	return id, err == nil && id > 0
}
