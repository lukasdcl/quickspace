// Package fetch downloads files over HTTPS, or reads them from file:// URLs,
// with size limits and atomic writes, and verifies their checksums.
package fetch

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

// ErrTooLarge is returned when a download exceeds its size limit.
var ErrTooLarge = errors.New("download exceeds size limit")

// Client downloads files. The zero value is not usable; use New.
type Client struct {
	HTTP *http.Client
}

// New returns a Client that only follows redirects to HTTPS URLs and honours
// the standard proxy environment variables.
func New() *Client {
	return &Client{HTTP: &http.Client{
		Timeout: 10 * time.Minute,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if req.URL.Scheme != "https" {
				return fmt.Errorf("refusing redirect to non-HTTPS URL %s", req.URL)
			}
			if len(via) >= 10 {
				return errors.New("too many redirects")
			}
			return nil
		},
	}}
}

// ToFile downloads rawURL to dest. The body is written to a temporary file in
// the same directory and renamed into place only once complete, so dest is
// never left partially written.
func (c *Client) ToFile(rawURL, dest string, limit int64) error {
	body, err := c.open(rawURL)
	if err != nil {
		return err
	}
	defer body.Close()

	tmp, err := os.CreateTemp(filepath.Dir(dest), ".download-*")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName) // no-op once renamed

	if err := copyLimited(tmp, body, limit); err != nil {
		tmp.Close()
		return fmt.Errorf("download %s: %w", rawURL, err)
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmpName, dest)
}

// Bytes downloads rawURL into memory.
func (c *Client) Bytes(rawURL string, limit int64) ([]byte, error) {
	body, err := c.open(rawURL)
	if err != nil {
		return nil, err
	}
	defer body.Close()
	var b strings.Builder
	if err := copyLimited(&b, body, limit); err != nil {
		return nil, fmt.Errorf("download %s: %w", rawURL, err)
	}
	return []byte(b.String()), nil
}

func (c *Client) open(rawURL string) (io.ReadCloser, error) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return nil, fmt.Errorf("invalid URL %q: %w", rawURL, err)
	}
	switch u.Scheme {
	case "https":
		resp, err := c.HTTP.Get(rawURL)
		if err != nil {
			return nil, fmt.Errorf("download %s: %w", rawURL, err)
		}
		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			return nil, fmt.Errorf("download %s: %s", rawURL, resp.Status)
		}
		return resp.Body, nil
	case "file":
		f, err := os.Open(FilePath(u))
		if err != nil {
			return nil, fmt.Errorf("download %s: %w", rawURL, err)
		}
		return f, nil
	default:
		return nil, fmt.Errorf("refusing %q: only https:// and file:// URLs are allowed", rawURL)
	}
}

// FilePath converts a file:// URL to a local path, including Windows drive
// paths such as file:///C:/quick/catalogue.
func FilePath(u *url.URL) string {
	p := u.Path
	if runtime.GOOS == "windows" && len(p) >= 3 && p[0] == '/' && p[2] == ':' {
		p = p[1:]
	}
	return filepath.FromSlash(p)
}

func copyLimited(w io.Writer, r io.Reader, limit int64) error {
	n, err := io.Copy(w, io.LimitReader(r, limit+1))
	if err != nil {
		return err
	}
	if n > limit {
		return ErrTooLarge
	}
	return nil
}

// SHA256File returns the hex-encoded SHA-256 of the file at path.
func SHA256File(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// MismatchError reports a file whose checksum differs from the expected one.
type MismatchError struct {
	Label, Want, Got string
}

func (e *MismatchError) Error() string {
	return fmt.Sprintf("checksum mismatch for %s (expected %s, got %s); refusing to continue", e.Label, e.Want, e.Got)
}

// Verify checks path against want. On a mismatch the file is deleted, so a
// bad download cannot be picked up by a later run.
func Verify(path, want, label string) error {
	got, err := SHA256File(path)
	if err != nil {
		return err
	}
	if got != want {
		os.Remove(path)
		return &MismatchError{Label: label, Want: want, Got: got}
	}
	return nil
}
