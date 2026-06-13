package config

import (
	"bufio"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"
)

type Config struct {
	AppEnv              string
	APIAddr             string
	DatabaseURL         string
	JWTSecret           string
	JWTExpiresIn        time.Duration
	CookieName          string
	CookieDomain        string
	CookieSecure        bool
	UploadDir           string
	PublicUploadBaseURL string
	CORSAllowedOrigins  []string
}

func Load() (Config, error) {
	_ = loadDotEnv(".env")

	var missing []string
	required := []string{
		"APP_ENV",
		"API_ADDR",
		"DATABASE_URL",
		"JWT_SECRET",
		"JWT_EXPIRES_IN",
		"COOKIE_NAME",
		"COOKIE_SECURE",
		"UPLOAD_DIR",
		"PUBLIC_UPLOAD_BASE_URL",
		"CORS_ALLOWED_ORIGINS",
	}
	for _, key := range required {
		if strings.TrimSpace(os.Getenv(key)) == "" {
			missing = append(missing, key)
		}
	}
	if len(missing) > 0 {
		return Config{}, fmt.Errorf("missing required env vars: %s", strings.Join(missing, ", "))
	}

	expiresIn, err := time.ParseDuration(os.Getenv("JWT_EXPIRES_IN"))
	if err != nil {
		return Config{}, fmt.Errorf("invalid JWT_EXPIRES_IN: %w", err)
	}

	cookieSecure, err := parseBool(os.Getenv("COOKIE_SECURE"))
	if err != nil {
		return Config{}, fmt.Errorf("invalid COOKIE_SECURE: %w", err)
	}

	appEnv := os.Getenv("APP_ENV")
	if appEnv != "development" && appEnv != "test" && appEnv != "production" {
		return Config{}, errors.New("APP_ENV must be development, test, or production")
	}

	return Config{
		AppEnv:              appEnv,
		APIAddr:             os.Getenv("API_ADDR"),
		DatabaseURL:         os.Getenv("DATABASE_URL"),
		JWTSecret:           os.Getenv("JWT_SECRET"),
		JWTExpiresIn:        expiresIn,
		CookieName:          os.Getenv("COOKIE_NAME"),
		CookieDomain:        os.Getenv("COOKIE_DOMAIN"),
		CookieSecure:        cookieSecure,
		UploadDir:           os.Getenv("UPLOAD_DIR"),
		PublicUploadBaseURL: strings.TrimRight(os.Getenv("PUBLIC_UPLOAD_BASE_URL"), "/"),
		CORSAllowedOrigins:  splitCSV(os.Getenv("CORS_ALLOWED_ORIGINS")),
	}, nil
}

func splitCSV(value string) []string {
	parts := strings.Split(value, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			out = append(out, part)
		}
	}
	return out
}

func parseBool(value string) (bool, error) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "true", "1", "yes":
		return true, nil
	case "false", "0", "no":
		return false, nil
	default:
		return false, fmt.Errorf("expected boolean, got %q", value)
	}
}

func loadDotEnv(path string) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.Trim(strings.TrimSpace(value), `"'`)
		if key != "" {
			_ = os.Setenv(key, value)
		}
	}
	return scanner.Err()
}
