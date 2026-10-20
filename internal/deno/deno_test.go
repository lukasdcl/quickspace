package deno

import (
	"archive/zip"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/lukasdcl/quickspace/internal/catalogue"
	"github.com/lukasdcl/quickspace/internal/fetch"
)

func TestPlatformFor(t *testing.T) {
	cases := []struct {
		goos, goarch string
		translated   bool
		want         string
	}{
		{"darwin", "arm64", false, "aarch64-apple-darwin"},
		{"darwin", "amd64", false, "x86_64-apple-darwin"},
		{"darwin", "amd64", true, "aarch64-apple-darwin"},
		{"linux", "amd64", false, "x86_64-unknown-linux-gnu"},
		{"linux", "arm64", false, "aarch64-unknown-linux-gnu"},
		{"windows", "amd64", false, "x86_64-pc-windows-msvc"},
		{"windows", "arm64", false, "aarch64-pc-windows-msvc"},
	}
	for _, c := range cases {
		got, err := platformFor(c.goos, c.goarch, c.translated)
		if err != nil || got != c.want {
			t.Errorf("platformFor(%s, %s, %v) = %q, %v; want %q", c.goos, c.goarch, c.translated, got, err, c.want)
		}
		if !slices.Contains(catalogue.Platforms, got) {
			t.Errorf("%s is not listed in catalogue.Platforms", got)
		}
	}
	for _, c := range [][2]string{{"freebsd", "amd64"}, {"linux", "386"}} {
		if _, err := platformFor(c[0], c[1], false); err == nil {
			t.Errorf("platformFor(%s, %s) succeeded, want error", c[0], c[1])
		}
	}
}

func TestSandboxEnvDropsUserDenoSettings(t *testing.T) {
	env := SandboxEnv([]string{"PATH=/bin", "DENO_DIR=/elsewhere", "deno_cert=/x"}, "/q")
	want := []string{"PATH=/bin", "DENO_DIR=/q", "DENO_NO_UPDATE_CHECK=1", "DENO_NO_PACKAGE_JSON=1"}
	if !slices.Equal(env, want) {
		t.Errorf("SandboxEnv = %v, want %v", env, want)
	}
}

func TestSandboxArgsGrantNothing(t *testing.T) {
	for _, a := range SandboxArgs("app.ts", []string{"--allow-all"}) {
		if a == "app.ts" {
			break // everything after the script belongs to the app
		}
		if strings.HasPrefix(a, "--allow") || a == "-A" {
			t.Errorf("sandbox grants %s", a)
		}
	}
}

// release builds a fake Deno release for this platform and returns its base
// URL and checksum.
func release(t *testing.T, version string, entries map[string]string) (string, string) {
	t.Helper()
	platform, err := Platform()
	if err != nil {
		t.Skip(err)
	}
	root := t.TempDir()
	dir := filepath.Join(root, "v"+version)
	os.MkdirAll(dir, 0o755)
	path := filepath.Join(dir, "deno-"+platform+".zip")
	f, _ := os.Create(path)
	zw := zip.NewWriter(f)
	for name, body := range entries {
		w, _ := zw.Create(name)
		io.WriteString(w, body)
	}
	zw.Close()
	f.Close()

	b, _ := os.ReadFile(path)
	sum := sha256.Sum256(b)
	u := url.URL{Scheme: "file", Path: filepath.ToSlash(root)}
	if !strings.HasPrefix(u.Path, "/") {
		u.Path = "/" + u.Path
	}
	return u.String(), hex.EncodeToString(sum[:])
}

func installer(t *testing.T, base string) *Installer {
	home := t.TempDir()
	in := &Installer{Fetch: fetch.New(), BaseURL: base, Dir: filepath.Join(home, "runtime"),
		TempDir: filepath.Join(home, "tmp"), Log: io.Discard}
	os.MkdirAll(in.Dir, 0o755)
	os.MkdirAll(in.TempDir, 0o755)
	return in
}

func lockFor(version, sum string) *catalogue.Lock {
	platform, _ := Platform()
	return &catalogue.Lock{Version: version, SHA256: map[string]string{platform: sum}}
}

func TestEnsureInstallsVerifiedRuntime(t *testing.T) {
	base, sum := release(t, "1.0.0", map[string]string{BinaryName(): "fake deno", "README": "ignored"})
	in := installer(t, base)

	bin, err := in.Ensure(lockFor("1.0.0", sum))
	if err != nil {
		t.Fatal(err)
	}
	if b, _ := os.ReadFile(bin); string(b) != "fake deno" {
		t.Errorf("installed binary = %q", b)
	}
	if entries, _ := os.ReadDir(filepath.Dir(bin)); len(entries) != 1 {
		t.Errorf("extra files extracted: %v", entries)
	}
	if entries, _ := os.ReadDir(in.TempDir); len(entries) != 0 {
		t.Errorf("temporary files left behind: %v", entries)
	}
}

func TestEnsureRejectsForgedRuntime(t *testing.T) {
	base, _ := release(t, "1.0.0", map[string]string{BinaryName(): "forged"})
	in := installer(t, base)

	_, err := in.Ensure(lockFor("1.0.0", strings.Repeat("0", 64)))
	var mismatch *fetch.MismatchError
	if !errors.As(err, &mismatch) {
		t.Fatalf("Ensure = %v, want checksum mismatch", err)
	}
	if entries, _ := os.ReadDir(in.Dir); len(entries) != 0 {
		t.Errorf("runtime installed despite mismatch: %v", entries)
	}
}

func TestEnsureRejectsArchiveWithoutBinary(t *testing.T) {
	base, sum := release(t, "1.0.0", map[string]string{"bin/" + BinaryName(): "nested"})
	in := installer(t, base)
	if _, err := in.Ensure(lockFor("1.0.0", sum)); err == nil {
		t.Fatal("Ensure succeeded with no top-level binary")
	}
}
