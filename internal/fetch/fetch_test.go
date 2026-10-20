package fetch

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func testClient(srv *httptest.Server) *Client {
	c := New()
	c.HTTP.Transport = srv.Client().Transport
	return c
}

func TestToFile(t *testing.T) {
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/ok":
			w.Write([]byte("hello"))
		case "/big":
			w.Write([]byte(strings.Repeat("x", 100)))
		case "/missing":
			http.NotFound(w, r)
		case "/to-http":
			http.Redirect(w, r, "http://example.com/", http.StatusFound)
		}
	}))
	defer srv.Close()
	c := testClient(srv)
	dir := t.TempDir()

	dest := filepath.Join(dir, "ok")
	if err := c.ToFile(srv.URL+"/ok", dest, 1024); err != nil {
		t.Fatal(err)
	}
	if b, _ := os.ReadFile(dest); string(b) != "hello" {
		t.Errorf("content = %q", b)
	}

	for path, wantErr := range map[string]error{"/big": ErrTooLarge, "/missing": nil, "/to-http": nil} {
		dest := filepath.Join(dir, strings.TrimPrefix(path, "/"))
		err := c.ToFile(srv.URL+path, dest, 10)
		if err == nil {
			t.Errorf("%s: ToFile succeeded, want error", path)
		}
		if wantErr != nil && !errors.Is(err, wantErr) {
			t.Errorf("%s: err = %v, want %v", path, err, wantErr)
		}
		if _, statErr := os.Stat(dest); statErr == nil {
			t.Errorf("%s: destination written despite error", path)
		}
	}

	entries, _ := os.ReadDir(dir)
	if len(entries) != 1 {
		t.Errorf("temporary files left behind: %v", entries)
	}
}

func TestToFileRejectsPlainHTTP(t *testing.T) {
	err := New().ToFile("http://example.com/x", filepath.Join(t.TempDir(), "x"), 10)
	if err == nil || !strings.Contains(err.Error(), "only https://") {
		t.Errorf("err = %v, want scheme refusal", err)
	}
}

func TestFileURL(t *testing.T) {
	dir := t.TempDir()
	src := filepath.Join(dir, "src.txt")
	os.WriteFile(src, []byte("local"), 0o644)
	u := url.URL{Scheme: "file", Path: filepath.ToSlash(src)}
	if !strings.HasPrefix(u.Path, "/") {
		u.Path = "/" + u.Path // Windows: file:///C:/...
	}
	b, err := New().Bytes(u.String(), 100)
	if err != nil || string(b) != "local" {
		t.Errorf("Bytes(file) = %q, %v", b, err)
	}
}

func TestVerify(t *testing.T) {
	path := filepath.Join(t.TempDir(), "f")
	os.WriteFile(path, []byte("abc"), 0o644)
	const abc = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"

	if err := Verify(path, abc, "f"); err != nil {
		t.Fatalf("Verify(correct) = %v", err)
	}
	var mismatch *MismatchError
	if err := Verify(path, strings.Repeat("0", 64), "f"); !errors.As(err, &mismatch) {
		t.Fatalf("Verify(wrong) = %v, want MismatchError", err)
	}
	if _, err := os.Stat(path); !os.IsNotExist(err) {
		t.Error("mismatched file was not removed")
	}
}
