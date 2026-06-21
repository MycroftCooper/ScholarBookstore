package auth

import (
	"encoding/json"
	"errors"
	"net/http"

	"scholarbookstore/services/api/internal/config"
	"scholarbookstore/services/api/internal/http/response"
	"scholarbookstore/services/api/internal/users"
)

type Handler struct {
	cfg     config.Config
	service *Service
}

type registerRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type updateProfileRequest struct {
	Bio     string `json:"bio"`
	School  string `json:"school"`
	Company string `json:"company"`
}

func NewHandler(cfg config.Config, service *Service) *Handler {
	return &Handler{
		cfg:     cfg,
		service: service,
	}
}

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := decodeJSON(r, &req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "请求参数不合法", nil)
		return
	}

	user, err := h.service.Register(r.Context(), req.Username, req.Email, req.Password)
	if errors.Is(err, ErrInvalidInput) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "用户名、邮箱或密码不合法", nil)
		return
	}
	if errors.Is(err, ErrUserConflict) {
		response.Error(w, http.StatusConflict, "CONFLICT", "用户名或邮箱已存在", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}

	response.JSON(w, http.StatusCreated, user, nil)
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := decodeJSON(r, &req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "请求参数不合法", nil)
		return
	}

	result, err := h.service.Login(r.Context(), req.Email, req.Password)
	if errors.Is(err, ErrInvalidInput) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "请求参数不合法", nil)
		return
	}
	if errors.Is(err, ErrInvalidCredentials) {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "邮箱或密码错误", nil)
		return
	}
	if errors.Is(err, ErrUserDisabled) {
		response.Error(w, http.StatusForbidden, "FORBIDDEN", "用户已被禁用", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}

	http.SetCookie(w, h.authCookie(result.Token, result.ExpiresAt))
	response.JSON(w, http.StatusOK, result.User, nil)
}

func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, h.clearCookie())
	response.JSON(w, http.StatusOK, map[string]bool{"ok": true}, nil)
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "请先登录", nil)
		return
	}
	response.JSON(w, http.StatusOK, user, nil)
}

func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "请先登录", nil)
		return
	}

	var req updateProfileRequest
	if err := decodeJSON(r, &req); err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "请求参数不合法", nil)
		return
	}

	updated, err := h.service.UpdateProfile(r.Context(), user.ID, users.UpdateProfileInput{
		Bio:     req.Bio,
		School:  req.School,
		Company: req.Company,
	})
	if errors.Is(err, ErrInvalidInput) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "个人资料不合法", nil)
		return
	}
	if errors.Is(err, ErrUnauthorized) {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "请先登录", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "服务暂时不可用", nil)
		return
	}

	response.JSON(w, http.StatusOK, updated, nil)
}

func (h *Handler) UploadAvatar(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "请先登录", nil)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxAvatarBytes+1024*1024)
	if err := r.ParseMultipartForm(maxAvatarBytes + 1024); err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			response.Error(w, http.StatusRequestEntityTooLarge, "PAYLOAD_TOO_LARGE", "头像不能超过 2MB", nil)
			return
		}
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "上传参数不合法", nil)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "请选择头像图片", nil)
		return
	}
	_ = file.Close()
	if r.MultipartForm != nil {
		defer r.MultipartForm.RemoveAll()
	}

	updated, err := h.service.UploadAvatar(r.Context(), user.ID, header)
	if errors.Is(err, ErrInvalidInput) {
		response.Error(w, http.StatusBadRequest, "VALIDATION_ERROR", "上传参数不合法", nil)
		return
	}
	if errors.Is(err, ErrPayloadTooLarge) {
		response.Error(w, http.StatusRequestEntityTooLarge, "PAYLOAD_TOO_LARGE", "头像不能超过 2MB", nil)
		return
	}
	if errors.Is(err, ErrUnsupportedMedia) {
		response.Error(w, http.StatusUnsupportedMediaType, "UNSUPPORTED_MEDIA_TYPE", "仅支持 JPG、PNG、WebP 图片", nil)
		return
	}
	if errors.Is(err, ErrUnauthorized) {
		response.Error(w, http.StatusUnauthorized, "UNAUTHORIZED", "请先登录", nil)
		return
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "INTERNAL_ERROR", "上传失败，请稍后重试", nil)
		return
	}

	response.JSON(w, http.StatusCreated, updated, nil)
}

func decodeJSON(r *http.Request, dst interface{}) error {
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	return decoder.Decode(dst)
}
