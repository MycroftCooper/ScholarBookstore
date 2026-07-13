package testutil

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"scholarbookstore/services/api/internal/config"
	"scholarbookstore/services/api/internal/db"
	apiroutes "scholarbookstore/services/api/internal/http/routes"
)

type SmokeEnv struct {
	T       *testing.T
	Ctx     context.Context
	DB      *pgxpool.Pool
	Config  config.Config
	Handler http.Handler
}

type Response struct {
	Status int
	Header http.Header
	Body   []byte
}

func NewSmokeEnv(t *testing.T) *SmokeEnv {
	t.Helper()

	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL is not set; skipping database smoke test")
	}

	ctx := context.Background()
	pool, err := db.NewPool(ctx, databaseURL)
	if err != nil {
		t.Fatalf("connect test database: %v", err)
	}
	t.Cleanup(pool.Close)

	env := &SmokeEnv{
		T:   t,
		Ctx: ctx,
		DB:  pool,
		Config: config.Config{
			AppEnv:              "test",
			APIAddr:             ":0",
			DatabaseURL:         databaseURL,
			JWTSecret:           "smoke-test-secret",
			JWTExpiresIn:        time.Hour,
			CookieName:          "sb_session",
			CookieSecure:        false,
			UploadDir:           filepath.Join(t.TempDir(), "uploads"),
			PublicUploadBaseURL: "http://example.test/uploads",
			CORSAllowedOrigins:  []string{"http://localhost:3000"},
		},
	}
	env.Handler = apiroutes.New(apiroutes.Dependencies{Config: env.Config, DB: pool})
	env.Reset()
	return env
}

func (e *SmokeEnv) Reset() {
	e.T.Helper()
	_, err := e.DB.Exec(e.Ctx, `
truncate table
  error_logs,
  audit_logs,
  moderation_tasks,
  article_images,
  article_reports,
  article_bookmarks,
  bookmark_collections,
  comment_votes,
  notifications,
  comments,
  article_tags,
  tags,
  user_follows,
  articles,
  modules,
  domains,
  users
restart identity cascade`)
	if err != nil {
		e.T.Fatalf("reset test database: %v", err)
	}
}

func (e *SmokeEnv) SeedUser(username, email, role, status, password string) int64 {
	e.T.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.MinCost)
	if err != nil {
		e.T.Fatalf("hash password: %v", err)
	}

	var id int64
	err = e.DB.QueryRow(e.Ctx, `
insert into users (username, email, password_hash, role, status)
values ($1, $2, $3, $4, $5)
returning id`, username, email, string(hash), role, status).Scan(&id)
	if err != nil {
		e.T.Fatalf("seed user %s: %v", username, err)
	}
	return id
}

func (e *SmokeEnv) SeedDomain(slug, name string) int64 {
	e.T.Helper()
	var id int64
	err := e.DB.QueryRow(e.Ctx, `
insert into domains (slug, name, description, sort_order, is_active)
values ($1, $2, '', 0, true)
returning id`, slug, name).Scan(&id)
	if err != nil {
		e.T.Fatalf("seed domain %s: %v", slug, err)
	}
	return id
}

func (e *SmokeEnv) SeedModule(domainID int64, slug, name string) int64 {
	e.T.Helper()
	var id int64
	err := e.DB.QueryRow(e.Ctx, `
insert into modules (domain_id, slug, name, description, sort_order, is_active)
values ($1, $2, $3, '', 0, true)
returning id`, domainID, slug, name).Scan(&id)
	if err != nil {
		e.T.Fatalf("seed module %s: %v", slug, err)
	}
	return id
}

func (e *SmokeEnv) SeedDomainOwner(domainID int64, userID int64) {
	e.T.Helper()
	_, err := e.DB.Exec(e.Ctx, `
insert into domain_owners (domain_id, user_id)
values ($1, $2)
on conflict do nothing`, domainID, userID)
	if err != nil {
		e.T.Fatalf("seed domain owner: %v", err)
	}
}

func (e *SmokeEnv) SeedModuleModerator(moduleID int64, userID int64) {
	e.T.Helper()
	_, err := e.DB.Exec(e.Ctx, `
insert into module_moderators (module_id, user_id)
values ($1, $2)
on conflict do nothing`, moduleID, userID)
	if err != nil {
		e.T.Fatalf("seed module moderator: %v", err)
	}
}

func (e *SmokeEnv) Request(method, path string, body interface{}, cookies ...*http.Cookie) Response {
	e.T.Helper()

	var reader io.Reader
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			e.T.Fatalf("marshal request body: %v", err)
		}
		reader = bytes.NewReader(payload)
	}

	req := httptest.NewRequest(method, path, reader)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	for _, cookie := range cookies {
		req.AddCookie(cookie)
	}

	rec := httptest.NewRecorder()
	e.Handler.ServeHTTP(rec, req)
	return Response{
		Status: rec.Code,
		Header: rec.Header(),
		Body:   rec.Body.Bytes(),
	}
}

func (e *SmokeEnv) Login(email, password string) *http.Cookie {
	e.T.Helper()
	res := e.Request(http.MethodPost, "/api/v1/auth/login", map[string]string{
		"email":    email,
		"password": password,
	})
	AssertStatus(e.T, res, http.StatusOK)
	for _, cookie := range res.Header.Values("Set-Cookie") {
		parsed := (&http.Response{Header: http.Header{"Set-Cookie": []string{cookie}}}).Cookies()
		for _, item := range parsed {
			if item.Name == e.Config.CookieName {
				return item
			}
		}
	}
	e.T.Fatalf("login response did not set %s cookie", e.Config.CookieName)
	return nil
}

func (r Response) DecodeData(t *testing.T, dst interface{}) {
	t.Helper()
	var envelope struct {
		Data json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(r.Body, &envelope); err != nil {
		t.Fatalf("decode response envelope: %v\nbody: %s", err, string(r.Body))
	}
	if err := json.Unmarshal(envelope.Data, dst); err != nil {
		t.Fatalf("decode response data: %v\nbody: %s", err, string(r.Body))
	}
}

func AssertStatus(t *testing.T, res Response, want int) {
	t.Helper()
	if res.Status != want {
		t.Fatalf("status = %d, want %d\nbody: %s", res.Status, want, string(res.Body))
	}
}

func AssertErrorCode(t *testing.T, res Response, wantStatus int, wantCode string) {
	t.Helper()
	AssertStatus(t, res, wantStatus)
	var envelope struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if err := json.Unmarshal(res.Body, &envelope); err != nil {
		t.Fatalf("decode error envelope: %v\nbody: %s", err, string(res.Body))
	}
	if envelope.Error.Code != wantCode {
		t.Fatalf("error code = %q, want %q\nbody: %s", envelope.Error.Code, wantCode, string(res.Body))
	}
}

func (e *SmokeEnv) ArticleStatus(id int64) string {
	e.T.Helper()
	var status string
	if err := e.DB.QueryRow(e.Ctx, `select status from articles where id = $1`, id).Scan(&status); err != nil {
		e.T.Fatalf("query article status: %v", err)
	}
	return status
}

func (e *SmokeEnv) Count(table string) int {
	e.T.Helper()
	var count int
	query := fmt.Sprintf("select count(*) from %s", table)
	if err := e.DB.QueryRow(e.Ctx, query).Scan(&count); err != nil {
		e.T.Fatalf("count %s: %v", table, err)
	}
	return count
}
