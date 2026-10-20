package catalogue

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

// forbidden matches constructs an app must not use.
//
// Deno does not apply --deny-read to module loading, so an import of an
// absolute path would let an app read local files (though, with no network
// or write access, it could only print them). Apps are single self-contained
// files, so no import is ever legitimate. This is a pattern check that
// catches mistakes and obvious attempts; review remains the control.
var forbidden = regexp.MustCompile(
	`(^|[^A-Za-z0-9_$.])import([^A-Za-z0-9_$.]|$)` + // import x from, import(...); not import.meta
		`|(^|[^A-Za-z0-9_$.])export[^;]*\sfrom\s*["']` + // export ... from "..."
		`|(^|[^A-Za-z0-9_$.])eval\s*\(` +
		`|(^|[^A-Za-z0-9_$.])Function\s*\(` +
		`|new\s+Worker`)

const summaryPrefix = "// summary:"

// Violation is a line of app source that breaks the catalogue rules.
type Violation struct {
	Line int
	Text string
}

// Lint returns the lines of src that use forbidden constructs.
func Lint(src []byte) []Violation {
	var out []Violation
	for i, line := range strings.Split(string(src), "\n") {
		if forbidden.MatchString(line) {
			out = append(out, Violation{Line: i + 1, Text: strings.TrimSpace(line)})
		}
	}
	return out
}

// Summary extracts the one-line description from an app's first line.
func Summary(src []byte) (string, error) {
	first, _, _ := strings.Cut(string(src), "\n")
	first = strings.TrimSuffix(first, "\r")
	if !strings.HasPrefix(first, summaryPrefix) {
		return "", errors.New("first line must be '// summary: <description>'")
	}
	s := strings.TrimSpace(strings.TrimPrefix(first, summaryPrefix))
	if s == "" {
		return "", errors.New("summary is empty")
	}
	if strings.ContainsAny(s, "\t") {
		return "", errors.New("summary must not contain tabs")
	}
	return s, nil
}

// BuildIndex validates every app in appsDir and returns the index that binds
// each name to its source's checksum.
func BuildIndex(appsDir string) ([]byte, error) {
	paths, err := filepath.Glob(filepath.Join(appsDir, "*.ts"))
	if err != nil {
		return nil, err
	}
	sort.Strings(paths)

	var entries []Entry
	var problems []string
	owner := map[string]string{} // normalised name or alias -> file that claims it
	for _, path := range paths {
		file := filepath.Base(path)
		e, err := buildEntry(strings.TrimSuffix(file, ".ts"), path)
		if err != nil {
			problems = append(problems, fmt.Sprintf("%s: %v", file, err))
			continue
		}
		for _, n := range e.Names() {
			if other, taken := owner[Normalize(n)]; taken {
				problems = append(problems, fmt.Sprintf("%s: name %q is already used by %s", file, n, other))
			}
			owner[Normalize(n)] = file
		}
		entries = append(entries, e)
	}
	if len(problems) > 0 {
		return nil, errors.New(strings.Join(problems, "\n"))
	}
	return FormatIndex(entries), nil
}

func buildEntry(stem, path string) (Entry, error) {
	name, aliases, err := ParseNames(stem)
	if err != nil {
		return Entry{}, err
	}
	for _, n := range append([]string{name}, aliases...) {
		if err := ValidateNewName(n); err != nil {
			return Entry{}, err
		}
	}
	src, err := os.ReadFile(path)
	if err != nil {
		return Entry{}, err
	}
	if vs := Lint(src); len(vs) > 0 {
		var b bytes.Buffer
		b.WriteString("uses imports, eval, Function or Worker, which apps may not:")
		for _, v := range vs {
			fmt.Fprintf(&b, "\n  line %d: %s", v.Line, v.Text)
		}
		return Entry{}, errors.New(b.String())
	}
	summary, err := Summary(src)
	if err != nil {
		return Entry{}, err
	}
	sum := sha256.Sum256(src)
	return Entry{Name: name, Aliases: aliases, SHA256: hex.EncodeToString(sum[:]), Summary: summary}, nil
}
