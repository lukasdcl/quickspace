// Command quick-catalogue maintains a quick catalogue.
//
//	quick-catalogue build           lint apps and rewrite index.tsv
//	quick-catalogue check           fail if index.tsv is out of date (for CI)
//	quick-catalogue pin <version>   pin a Deno release in runtime.lock
//
// All commands take -dir to name the catalogue directory (default: catalogue).
package main

import (
	"bytes"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/lukasdcl/quickspace/internal/catalogue"
	"github.com/lukasdcl/quickspace/internal/deno"
	"github.com/lukasdcl/quickspace/internal/fetch"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintf(os.Stderr, "quick-catalogue: %v\n", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	fs := flag.NewFlagSet("quick-catalogue", flag.ContinueOnError)
	dir := fs.String("dir", "catalogue", "catalogue directory")
	fs.Usage = func() {
		fmt.Fprintln(fs.Output(), "usage: quick-catalogue [-dir catalogue] build | check | pin <version>")
	}
	if len(args) == 0 {
		fs.Usage()
		return fmt.Errorf("no command given")
	}
	cmd := args[0]
	if err := fs.Parse(args[1:]); err != nil {
		return err
	}

	switch cmd {
	case "build":
		return build(*dir)
	case "check":
		return check(*dir)
	case "pin":
		if fs.NArg() != 1 {
			return fmt.Errorf("usage: quick-catalogue pin <version>")
		}
		return pin(*dir, strings.TrimPrefix(fs.Arg(0), "v"))
	default:
		fs.Usage()
		return fmt.Errorf("unknown command %q", cmd)
	}
}

// build lints every app and rewrites index.tsv. Run it after reviewing an
// app change, and commit the app and the index together: the index is what
// binds an app's name to the exact bytes that were reviewed.
func build(dir string) error {
	index, err := catalogue.BuildIndex(filepath.Join(dir, "apps"))
	if err != nil {
		return err
	}
	path := filepath.Join(dir, "index.tsv")
	if err := os.WriteFile(path, index, 0o644); err != nil {
		return err
	}
	fmt.Printf("wrote %s\n", path)
	return nil
}

func check(dir string) error {
	want, err := catalogue.BuildIndex(filepath.Join(dir, "apps"))
	if err != nil {
		return err
	}
	got, err := os.ReadFile(filepath.Join(dir, "index.tsv"))
	if err != nil {
		return err
	}
	if !bytes.Equal(normaliseNewlines(got), want) {
		return fmt.Errorf("%s is out of date; run quick-catalogue build", filepath.Join(dir, "index.tsv"))
	}
	lock, err := os.ReadFile(filepath.Join(dir, "runtime.lock"))
	if err != nil {
		return err
	}
	if _, err := catalogue.ParseLock(lock); err != nil {
		return err
	}
	return nil
}

// pin records Deno's published checksum for each supported platform. Run the
// tests against the new version before committing runtime.lock.
func pin(dir, version string) error {
	if err := catalogue.ValidateVersion(version); err != nil {
		return err
	}
	client := fetch.New()
	lock := &catalogue.Lock{Version: version, SHA256: map[string]string{}}
	for _, p := range catalogue.Platforms {
		url := fmt.Sprintf("%s/v%s/deno-%s.zip.sha256sum", deno.DefaultBaseURL, version, p)
		body, err := client.Bytes(url, 4<<10)
		if err != nil {
			return err
		}
		sum, err := parseChecksumFile(body)
		if err != nil {
			return fmt.Errorf("%s: %w", url, err)
		}
		lock.SHA256[p] = sum
	}
	// Parse the rendered file so an unexpected checksum format fails here
	// rather than on users' machines.
	formatted := lock.Format()
	if _, err := catalogue.ParseLock(formatted); err != nil {
		return fmt.Errorf("Deno %s: %w", version, err)
	}
	path := filepath.Join(dir, "runtime.lock")
	if err := os.WriteFile(path, formatted, 0o644); err != nil {
		return err
	}
	fmt.Printf("pinned Deno %s in %s\n", version, path)
	return nil
}

var hexDigest = regexp.MustCompile(`(?i)\b[0-9a-f]{64}\b`)

// parseChecksumFile extracts the digest from a Deno .sha256sum file. Unix
// builds publish "<hash>  <file>"; Windows builds publish PowerShell's
// Get-FileHash output, with labels and an uppercase hash. Exactly one digest
// must be present.
func parseChecksumFile(body []byte) (string, error) {
	found := hexDigest.FindAllString(string(body), -1)
	if len(found) != 1 {
		return "", fmt.Errorf("expected one SHA-256 digest, found %d", len(found))
	}
	return strings.ToLower(found[0]), nil
}

// normaliseNewlines lets check pass on Windows checkouts that convert line
// endings.
func normaliseNewlines(b []byte) []byte {
	return bytes.ReplaceAll(b, []byte("\r\n"), []byte("\n"))
}
