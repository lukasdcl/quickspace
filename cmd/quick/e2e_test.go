package main

// End-to-end tests: build the real binary, serve a fixture catalogue
// (including deliberately hostile apps) from file:// URLs, and run apps
// through the pinned Deno runtime.
//
// The runtime is downloaded once into QUICK_E2E_CACHE (default: the user cache
// directory) and reused. Skipped with -short.

import (
	"crypto/sha256"
	"encoding/hex"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"testing"

	"github.com/lukasdcl/quickspace/internal/catalogue"
)

var quickBin string

func TestMain(m *testing.M) {
	dir, err := os.MkdirTemp("", "quick-bin-")
	if err != nil {
		panic(err)
	}
	quickBin = filepath.Join(dir, "quick")
	if runtime.GOOS == "windows" {
		quickBin += ".exe"
	}
	build := exec.Command("go", "build", "-o", quickBin, ".")
	build.Stdout, build.Stderr = os.Stdout, os.Stderr
	if err := build.Run(); err != nil {
		panic(err)
	}
	code := m.Run()
	os.RemoveAll(dir)
	os.Exit(code)
}

func fileURL(path string) string {
	u := url.URL{Scheme: "file", Path: filepath.ToSlash(path)}
	if !strings.HasPrefix(u.Path, "/") {
		u.Path = "/" + u.Path // Windows drive paths
	}
	return u.String()
}

func sha256Hex(b []byte) string {
	s := sha256.Sum256(b)
	return hex.EncodeToString(s[:])
}

type env struct {
	t         *testing.T
	home      string
	catalogue string
}

// newEnv creates a fixture catalogue from apps (file stem -> source) and a
// quick home that shares the cached runtime.
func newEnv(t *testing.T, apps map[string]string) *env {
	t.Helper()
	if testing.Short() {
		t.Skip("end-to-end test")
	}
	cache := os.Getenv("QUICK_E2E_CACHE")
	if cache == "" {
		dir, err := os.UserCacheDir()
		if err != nil {
			t.Fatal(err)
		}
		cache = filepath.Join(dir, "quick-e2e")
	}

	// The cache directory is the quick home for every test, so the runtime is
	// downloaded once. The cached catalogue is cleared so each test sees only
	// its own fixtures; cached apps are content-addressed and safe to share.
	e := &env{t: t, home: cache, catalogue: filepath.Join(t.TempDir(), "catalogue")}
	if err := os.RemoveAll(filepath.Join(cache, "catalogue")); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(e.catalogue, "apps"), 0o755); err != nil {
		t.Fatal(err)
	}

	lock, err := os.ReadFile(filepath.Join("..", "..", "catalogue", "runtime.lock"))
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(e.catalogue, "runtime.lock"), lock, 0o644); err != nil {
		t.Fatal(err)
	}
	e.publish(apps)
	return e
}

// publish replaces the fixture catalogue's apps (file stem -> source) and
// rewrites its index, as pushing a change to the catalogue would.
func (e *env) publish(apps map[string]string) {
	t := e.t
	t.Helper()
	dir := filepath.Join(e.catalogue, "apps")
	if err := os.RemoveAll(dir); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	var entries []catalogue.Entry
	for stem, src := range apps {
		name, aliases, err := catalogue.ParseNames(stem)
		if err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(dir, stem+".ts"), []byte(src), 0o644); err != nil {
			t.Fatal(err)
		}
		entries = append(entries, catalogue.Entry{Name: name, Aliases: aliases, SHA256: sha256Hex([]byte(src)), Summary: "fixture " + name})
	}
	if err := os.WriteFile(filepath.Join(e.catalogue, "index.tsv"), catalogue.FormatIndex(entries), 0o644); err != nil {
		t.Fatal(err)
	}
}

func (e *env) run(args ...string) (string, int) {
	e.t.Helper()
	cmd := exec.Command(quickBin, args...)
	cmd.Env = append(os.Environ(), "QUICK_HOME="+e.home, "QUICK_CATALOGUE="+fileURL(e.catalogue))
	out, err := cmd.CombinedOutput()
	if exitErr, ok := err.(*exec.ExitError); ok {
		return string(out), exitErr.ExitCode()
	}
	if err != nil {
		e.t.Fatal(err)
	}
	return string(out), 0
}

func billionaireCalculator(t *testing.T) string {
	src, err := os.ReadFile(filepath.Join("..", "..", "catalogue", "apps", "billionaire-charity-calculator.billionaire-charity.ts"))
	if err != nil {
		t.Fatal(err)
	}
	return string(src)
}

func TestRunsApp(t *testing.T) {
	e := newEnv(t, map[string]string{"billionaire-charity-calculator": billionaireCalculator(t)})

	out, code := e.run("billionaire-charity-calculator", "150m", "220bn", "300k")
	if code != 0 || !strings.Contains(out, "0.068% of a 220 billion fortune") || !strings.Contains(out, "like giving 205") {
		t.Errorf("exit %d, output:\n%s", code, out)
	}

	out, code = e.run("billionaire-charity-calculator", "150m")
	if code != 1 || !strings.Contains(out, "Usage") {
		t.Errorf("app usage error: exit %d, output:\n%s", code, out)
	}

	out, _ = e.run("list")
	if !strings.Contains(out, "billionaire-charity-calculator") {
		t.Errorf("list output:\n%s", out)
	}
	out, _ = e.run("info", "billionaire-charity-calculator")
	if !strings.Contains(out, sha256Hex([]byte(billionaireCalculator(t)))) {
		t.Errorf("info output:\n%s", out)
	}
}

// Every run reads the published catalogue, so changes reach users without
// a `quick update`, and the saved copy is only a fallback for when the
// catalogue cannot be reached.
func TestFollowsPublishedCatalogue(t *testing.T) {
	e := newEnv(t, map[string]string{"greet": `console.log("hello v1");`})
	if out, code := e.run("greet"); code != 0 || !strings.Contains(out, "hello v1") {
		t.Fatalf("first run: exit %d, output:\n%s", code, out)
	}

	e.publish(map[string]string{
		"greet":        `console.log("hello v2");`,
		"moneyconvert": `console.log("converted");`,
	})
	if out, code := e.run("greet"); code != 0 || !strings.Contains(out, "hello v2") {
		t.Errorf("changed app: exit %d, output:\n%s", code, out)
	}
	if out, code := e.run("moneyconvert"); code != 0 || !strings.Contains(out, "converted") {
		t.Errorf("new app: exit %d, output:\n%s", code, out)
	}

	e.catalogue = filepath.Join(t.TempDir(), "unreachable")
	out, code := e.run("greet")
	if code != 0 || !strings.Contains(out, "hello v2") || !strings.Contains(out, "saved by an earlier run") {
		t.Errorf("offline: exit %d, output:\n%s", code, out)
	}
}

func TestRunsAppByAlias(t *testing.T) {
	e := newEnv(t, map[string]string{"greet.hello.hi": `console.log("hi " + Deno.args.join(" "));`})
	for _, name := range []string{"greet", "hello", "hi"} {
		out, code := e.run(name, "there")
		if code != 0 || !strings.Contains(out, "hi there") {
			t.Errorf("%s: exit %d, output:\n%s", name, code, out)
		}
	}
	out, _ := e.run("list")
	if !strings.Contains(out, "greet, hello, hi") {
		t.Errorf("list output:\n%s", out)
	}
	out, _ = e.run("info", "hi")
	if !strings.Contains(out, "name:     greet") || !strings.Contains(out, "aliases:  hello, hi") {
		t.Errorf("info output:\n%s", out)
	}
}

func TestForgivesTypos(t *testing.T) {
	e := newEnv(t, map[string]string{
		"billionaire-charity-calculator": billionaireCalculator(t),
		"moon":                           `console.log("moon");`,
	})
	for _, name := range []string{"billionairecharitycalculator", "billionare-charity-calculator"} {
		out, code := e.run(name, "150m", "220bn")
		if code != 0 || !strings.Contains(out, "0.068%") {
			t.Errorf("%s: exit %d, output:\n%s", name, code, out)
		}
		if name != "billionairecharitycalculator" && !strings.Contains(out, "running billionaire-charity-calculator") {
			t.Errorf("%s: guess not reported:\n%s", name, out)
		}
	}
	out, code := e.run("moom")
	if code != 1 || !strings.Contains(out, "did you mean moon?") {
		t.Errorf("moom: exit %d, output:\n%s", code, out)
	}
}

func TestRefusesTamperedApp(t *testing.T) {
	e := newEnv(t, map[string]string{"tampered": `console.log("MARKER");`})
	// Alter the app after it was indexed, as a compromised host might.
	os.WriteFile(filepath.Join(e.catalogue, "apps", "tampered.ts"), []byte(`console.log("MARKER"); // altered`), 0o644)

	out, code := e.run("tampered")
	if code != 1 || !strings.Contains(out, "checksum mismatch") || strings.Contains(out, "MARKER") {
		t.Errorf("exit %d, output:\n%s", code, out)
	}
}

func TestRejectsBadNames(t *testing.T) {
	e := newEnv(t, nil)
	cases := map[string]string{
		"no-such-app":   "no app named",
		"../etc/passwd": "invalid app name",
		"Upper":         "invalid app name",
		`a\b`:           "invalid app name",
		"-x":            "unknown option",
	}
	for name, want := range cases {
		out, code := e.run(name)
		if code != 1 || !strings.Contains(out, want) {
			t.Errorf("%q: exit %d, output:\n%s", name, code, out)
		}
	}
}

// Each probe prints ESCAPED only if the forbidden operation succeeds.
func TestSandbox(t *testing.T) {
	secret := filepath.Join(t.TempDir(), "secret.txt")
	os.WriteFile(secret, []byte("secret"), 0o644)
	written := filepath.Join(t.TempDir(), "written.txt")

	probes := map[string]string{
		"probe-net":       `await fetch("https://example.com");`,
		"probe-read":      `Deno.readTextFileSync(` + strconv.Quote(secret) + `);`,
		"probe-read-self": `Deno.readTextFileSync(new URL(import.meta.url));`,
		"probe-write":     `Deno.writeTextFileSync(` + strconv.Quote(written) + `, "x");`,
		"probe-env":       `Deno.env.get("PATH");`,
		"probe-run":       `new Deno.Command("whoami").outputSync();`,
		"probe-sys":       `Deno.hostname();`,
		"probe-remote":    `await import("https://deno.land/std@0.224.0/fmt/colors.ts");`,
		"probe-npm":       `await import("npm:left-pad@1.3.0");`,
		"probe-jsr":       `await import("jsr:@std/fmt@1/colors");`,
		"probe-relative":  `await import("./other.ts");`,
	}
	apps := map[string]string{}
	for name, body := range probes {
		apps[name] = body + "\nconsole.log(\"ESCAPED\");\n"
	}
	e := newEnv(t, apps)

	for name := range probes {
		out, code := e.run(name)
		if code == 0 || strings.Contains(out, "ESCAPED") {
			t.Errorf("%s escaped the sandbox (exit %d):\n%s", name, code, out)
		}
	}
	if _, err := os.Stat(written); err == nil {
		t.Error("probe-write created a file")
	}
}

func TestRefusesForgedRuntime(t *testing.T) {
	e := newEnv(t, map[string]string{"hello": `console.log("hi");`})
	e.home = t.TempDir() // a fresh home with no runtime installed

	lock, _ := os.ReadFile(filepath.Join(e.catalogue, "runtime.lock"))
	parsed, err := catalogue.ParseLock(lock)
	if err != nil {
		t.Fatal(err)
	}
	forged := filepath.Join(t.TempDir(), "v"+parsed.Version)
	os.MkdirAll(forged, 0o755)
	for _, p := range catalogue.Platforms {
		os.WriteFile(filepath.Join(forged, "deno-"+p+".zip"), []byte("not deno"), 0o644)
	}

	cmd := exec.Command(quickBin, "hello")
	cmd.Env = append(os.Environ(),
		"QUICK_HOME="+e.home,
		"QUICK_CATALOGUE="+fileURL(e.catalogue),
		"QUICK_RUNTIME_BASE_URL="+fileURL(filepath.Dir(forged)))
	out, err := cmd.CombinedOutput()
	if err == nil || !strings.Contains(string(out), "checksum mismatch for Deno") {
		t.Errorf("err %v, output:\n%s", err, out)
	}
	if entries, _ := os.ReadDir(filepath.Join(e.home, "runtime")); len(entries) != 0 {
		t.Errorf("runtime installed despite mismatch: %v", entries)
	}
}
