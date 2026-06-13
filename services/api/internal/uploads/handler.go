package uploads

import (
	"errors"
	"net/http"
	"strconv"

	"scholarbookstore/services/api/internal/auth"
	"scholarbookstore/services/api/internal/http/response"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) UploadArticleImage(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "请先登录", nil)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, MaxArticleImageBytes+1024*1024)
	if err := r.ParseMultipartForm(MaxArticleImageBytes + 1024); err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			response.Error(w, http.StatusRequestEntityTooLarge, "PAYLOAD_TOO_LARGE", "图片不能超过 5MB", nil)
			return
		}
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "上传参数不合法", nil)
		return
	}

	var articleID *int64
	if raw := r.FormValue("articleId"); raw != "" {
		id, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || id <= 0 {
			response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "文章 ID 不合法", nil)
			return
		}
		articleID = &id
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "请选择图片文件", nil)
		return
	}
	_ = file.Close()
	if r.MultipartForm != nil {
		defer r.MultipartForm.RemoveAll()
	}

	result, err := h.service.UploadArticleImage(r.Context(), user.ID, articleID, header)
	if errors.Is(err, ErrInvalidInput) || errors.Is(err, ErrNotFound) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "上传参数不合法", nil)
		return
	}
	if errors.Is(err, ErrPayloadTooLarge) {
		response.Error(w, http.StatusRequestEntityTooLarge, "PAYLOAD_TOO_LARGE", "图片不能超过 5MB", nil)
		return
	}
	if errors.Is(err, ErrUnsupportedMediaType) {
		response.Error(w, http.StatusUnsupportedMediaType, "UNSUPPORTED_MEDIA_TYPE", "仅支持 JPG、PNG、WebP、GIF 图片", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "上传失败，请稍后重试", nil)
		return
	}

	response.JSON(w, http.StatusCreated, result, nil)
}
