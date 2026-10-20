// Command quick fetches and runs tiny, sandboxed programs from a curated
// catalogue. See README.md for usage and SECURITY.md for the trust model.
package main

import (
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/lukasdcl/quickspace/internal/catalogue"
	"github.com/lukasdcl/quickspace/internal/deno"
	"github.com/lukasdcl/quickspace/internal/fetch"
)

// Overridden at build time with -ldflags "-X main.version=... -X main.defaultCatalogue=...".
// Release builds pin defaultCatalogue to their own tag; builds from source
// (including go install) follow the main branch. See SECURITY.md.
var (
	version          = "dev"
	defaultCatalogue = "https://raw.githubusercontent.com/lukasdcl/quickspace/main/catalogue"
)

const (
	maxIndexSize = 1 << 20
	maxLockSize  = 64 << 10
	maxAppSize   = 1 << 20
)

const usage = `Usage:
  quick <app> [args...]   Run an app from the catalogue
  quick list              List available apps
  quick info <app>        Show an app's description and checksum
  quick update            Refresh the catalogue index and runtime pin
  quick clean             Remove cached apps (the runtime is kept)
  quick version           Show quick's version and the pinned runtime
  quick help              Show this message

Environment:
  QUICK_HOME        Cache and config directory (default: ~/.quick)
  QUICK_CATALOGUE   Catalogue base URL (overrides QUICK_HOME/catalogue-url)
`

// errUsage marks errors caused by how quick was invoked.
var errUsage = errors.New("usage")

func main() {
	q, err := newQuick(os.Stdout, os.Stderr)
	if err == nil {
		err = q.dispatch(os.Args[1:])
	}
	switch {
	case err == nil:
	case errors.Is(err, errUsage):
		fmt.Fprint(os.Stderr, usage)
		os.Exit(2)
	default:
		fmt.Fprintf(os.Stderr, "quick: %v\n", err)
		os.Exit(1)
	}
}

type quick struct {
	home   string
	fetch  *fetch.Client
	stdout io.Writer
	stderr io.Writer
}

func newQuick(stdout, stderr io.Writer) (*quick, error) {
	home := os.Getenv("QUICK_HOME")
	if home == "" {
		userHome, err := os.UserHomeDir()
		if err != nil {
			return nil, fmt.Errorf("cannot locate home directory: %w", err)
		}
		home = filepath.Join(userHome, ".quick")
	}
	q := &quick{home: home, fetch: fetch.New(), stdout: stdout, stderr: stderr}
	for _, dir := range []string{q.path("tmp"), q.path("catalogue"), q.path("apps"), q.path("runtime"), q.path("deno-dir")} {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, err
		}
	}
	return q, nil
}

func (q *quick) path(elem ...string) string {
	return filepath.Join(append([]string{q.home}, elem...)...)
}

func (q *quick) dispatch(args []string) error {
	if len(args) == 0 {
		return errUsage
	}
	cmd, rest := args[0], args[1:]
	switch cmd {
	case "help", "-h", "--help":
		fmt.Fprint(q.stdout, usage)
		return nil
	case "version", "--version":
		return q.cmdVersion()
	case "list":
		return q.cmdList()
	case "info":
		if len(rest) != 1 {
			return errUsage
		}
		return q.cmdInfo(rest[0])
	case "update":
		return q.cmdUpdate()
	case "clean":
		return q.cmdClean()
	}
	if strings.HasPrefix(cmd, "-") {
		return fmt.Errorf("unknown option %q (try: quick help)", cmd)
	}
	return q.cmdRun(cmd, rest)
}

// ---------------------------------------------------------------------------
// Commands

func (q *quick) cmdRun(name string, args []string) error {
	if err := catalogue.ValidateName(name); err != nil {
		return err
	}
	entry, err := q.lookup(name)
	if err != nil {
		return err
	}
	app, err := q.ensureApp(entry)
	if err != nil {
		return err
	}
	lock, err := q.lock()
	if err != nil {
		return err
	}
	installer := &deno.Installer{
		Fetch:   q.fetch,
		BaseURL: runtimeBaseURL(),
		Dir:     q.path("runtime"),
		TempDir: q.path("tmp"),
		Log:     q.stderr,
	}
	bin, err := installer.Ensure(lock)
	if err != nil {
		return err
	}
	return execDeno(bin, deno.SandboxArgs(app, args), deno.SandboxEnv(os.Environ(), q.path("deno-dir")))
}

func (q *quick) cmdList() error {
	ix, err := q.index()
	if err != nil {
		return err
	}
	for _, e := range ix.Entries() {
		fmt.Fprintf(q.stdout, "%-28s %s\n", e.Name, e.Summary)
	}
	return nil
}

func (q *quick) cmdInfo(name string) error {
	if err := catalogue.ValidateName(name); err != nil {
		return err
	}
	e, err := q.lookup(name)
	if err != nil {
		return err
	}
	base, err := q.catalogueURL()
	if err != nil {
		return err
	}
	fmt.Fprintf(q.stdout, "name:     %s\nsummary:  %s\nsha256:   %s\nsource:   %s\n",
		e.Name, e.Summary, e.SHA256, appURL(base, e.Name))
	return nil
}

func (q *quick) cmdUpdate() error {
	if err := q.refresh(); err != nil {
		return err
	}
	base, _ := q.catalogueURL()
	fmt.Fprintf(q.stderr, "quick: catalogue updated from %s\n", base)
	return nil
}

func (q *quick) cmdClean() error {
	for _, dir := range []string{q.path("apps"), q.path("tmp")} {
		if err := os.RemoveAll(dir); err != nil {
			return err
		}
	}
	fmt.Fprintln(q.stderr, "quick: removed cached apps")
	return nil
}

func (q *quick) cmdVersion() error {
	fmt.Fprintf(q.stdout, "quick %s\n", version)
	if lock, err := q.cachedLock(); err == nil {
		fmt.Fprintf(q.stdout, "runtime: Deno %s (pinned)\n", lock.Version)
	}
	return nil
}

// ---------------------------------------------------------------------------
// Catalogue

func (q *quick) catalogueURL() (string, error) {
	if u := os.Getenv("QUICK_CATALOGUE"); u != "" {
		return strings.TrimRight(u, "/"), nil
	}
	if data, err := os.ReadFile(q.path("catalogue-url")); err == nil {
		for _, line := range strings.Split(string(data), "\n") {
			if line = strings.TrimSpace(line); line != "" && !strings.HasPrefix(line, "#") {
				return strings.TrimRight(line, "/"), nil
			}
		}
	}
	if defaultCatalogue != "" {
		return strings.TrimRight(defaultCatalogue, "/"), nil
	}
	return "", fmt.Errorf("no catalogue configured; set QUICK_CATALOGUE or write a URL to %s", q.path("catalogue-url"))
}

func runtimeBaseURL() string {
	if u := os.Getenv("QUICK_RUNTIME_BASE_URL"); u != "" {
		return strings.TrimRight(u, "/")
	}
	return deno.DefaultBaseURL
}

func appURL(base, name string) string {
	return base + "/apps/" + name + ".ts"
}

// refresh downloads index.tsv and runtime.lock. Both are parsed before either
// replaces the cached copy, so a bad download never displaces a good one.
func (q *quick) refresh() error {
	base, err := q.catalogueURL()
	if err != nil {
		return err
	}
	files := []struct {
		name  string
		limit int64
		parse func([]byte) error
	}{
		{"index.tsv", maxIndexSize, func(b []byte) error { _, err := catalogue.ParseIndex(b); return err }},
		{"runtime.lock", maxLockSize, func(b []byte) error { _, err := catalogue.ParseLock(b); return err }},
	}
	for _, f := range files {
		staged := q.path("catalogue", f.name+".new")
		if err := q.fetch.ToFile(base+"/"+f.name, staged, f.limit); err != nil {
			return err
		}
		data, err := os.ReadFile(staged)
		if err == nil {
			err = f.parse(data)
		}
		if err != nil {
			os.Remove(staged)
			return fmt.Errorf("catalogue at %s is invalid: %w", base, err)
		}
	}
	for _, f := range files {
		if err := os.Rename(q.path("catalogue", f.name+".new"), q.path("catalogue", f.name)); err != nil {
			return err
		}
	}
	return nil
}

func (q *quick) ensureCatalogue() error {
	for _, name := range []string{"index.tsv", "runtime.lock"} {
		if _, err := os.Stat(q.path("catalogue", name)); err != nil {
			return q.refresh()
		}
	}
	return nil
}

func (q *quick) index() (*catalogue.Index, error) {
	if err := q.ensureCatalogue(); err != nil {
		return nil, err
	}
	data, err := os.ReadFile(q.path("catalogue", "index.tsv"))
	if err != nil {
		return nil, err
	}
	return catalogue.ParseIndex(data)
}

func (q *quick) lock() (*catalogue.Lock, error) {
	if err := q.ensureCatalogue(); err != nil {
		return nil, err
	}
	return q.cachedLock()
}

func (q *quick) cachedLock() (*catalogue.Lock, error) {
	data, err := os.ReadFile(q.path("catalogue", "runtime.lock"))
	if err != nil {
		return nil, err
	}
	return catalogue.ParseLock(data)
}

// lookup resolves an app, refreshing the index once if the name is unknown
// so that newly published apps work without an explicit `quick update`.
func (q *quick) lookup(name string) (catalogue.Entry, error) {
	ix, err := q.index()
	if err != nil {
		return catalogue.Entry{}, err
	}
	if e, ok := ix.Lookup(name); ok {
		return e, nil
	}
	if err := q.refresh(); err != nil {
		return catalogue.Entry{}, err
	}
	if ix, err = q.index(); err != nil {
		return catalogue.Entry{}, err
	}
	if e, ok := ix.Lookup(name); ok {
		return e, nil
	}
	return catalogue.Entry{}, fmt.Errorf("no app named %q (try: quick list)", name)
}

// ensureApp returns the path of a verified local copy of the app. Copies are
// cached under their checksum and re-verified on every run; for files this
// small the cost is negligible and it guards against local tampering.
func (q *quick) ensureApp(e catalogue.Entry) (string, error) {
	path := q.path("apps", e.SHA256+".ts")
	if _, err := os.Stat(path); err != nil {
		base, err := q.catalogueURL()
		if err != nil {
			return "", err
		}
		if err := q.fetch.ToFile(appURL(base, e.Name), path, maxAppSize); err != nil {
			return "", err
		}
	}
	if err := fetch.Verify(path, e.SHA256, fmt.Sprintf("app %q", e.Name)); err != nil {
		return "", err
	}
	return path, nil
}
