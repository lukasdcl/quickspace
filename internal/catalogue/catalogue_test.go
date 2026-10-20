package catalogue

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const sum = "61ee015582d40d1c58724d7510bcae25e4632332685f4e2c2526d8a72ac2a0d0"

func TestValidateName(t *testing.T) {
	for _, name := range []string{"a", "billionaire-calculator", "x2"} {
		if err := ValidateName(name); err != nil {
			t.Errorf("ValidateName(%q) = %v, want nil", name, err)
		}
	}
	for _, name := range []string{"", "-x", "Upper", "a/b", "../etc/passwd", `a\b`, "a b", "a.ts"} {
		if err := ValidateName(name); err == nil {
			t.Errorf("ValidateName(%q) = nil, want error", name)
		}
	}
	if err := ValidateNewName("list"); err == nil {
		t.Error("ValidateNewName(list) = nil, want reserved-name error")
	}
}

func TestParseIndex(t *testing.T) {
	ix, err := ParseIndex([]byte("# comment\n\nfoo\t" + sum + "\tDoes foo\r\n"))
	if err != nil {
		t.Fatal(err)
	}
	e, ok := ix.Lookup("foo")
	if !ok || e.SHA256 != sum || e.Summary != "Does foo" {
		t.Errorf("Lookup(foo) = %+v, %v", e, ok)
	}
	if _, ok := ix.Lookup("bar"); ok {
		t.Error("Lookup(bar) found an entry")
	}
}

func TestParseIndexRejectsMalformed(t *testing.T) {
	cases := map[string]string{
		"too few fields": "foo\t" + sum + "\n",
		"too many":       "foo\t" + sum + "\ta\tb\n",
		"bad name":       "../foo\t" + sum + "\tx\n",
		"bad checksum":   "foo\tabc\tx\n",
		"upper checksum": "foo\t" + strings.ToUpper(sum) + "\tx\n",
		"duplicate":      "foo\t" + sum + "\tx\nfoo\t" + sum + "\ty\n",
	}
	for name, input := range cases {
		if _, err := ParseIndex([]byte(input)); err == nil {
			t.Errorf("%s: ParseIndex succeeded, want error", name)
		}
	}
}

func TestLockRoundTrip(t *testing.T) {
	in := &Lock{Version: "2.9.7", SHA256: map[string]string{
		"x86_64-pc-windows-msvc": sum,
		"aarch64-apple-darwin":   sum,
	}}
	out, err := ParseLock(in.Format())
	if err != nil {
		t.Fatal(err)
	}
	if out.Version != in.Version || len(out.SHA256) != 2 || out.SHA256["x86_64-pc-windows-msvc"] != sum {
		t.Errorf("round trip = %+v", out)
	}
}

func TestParseLockRejectsMalformed(t *testing.T) {
	cases := map[string]string{
		"no version":       "sha256 aarch64-apple-darwin " + sum + "\n",
		"bad version":      "version latest\n",
		"two versions":     "version 1.0.0\nversion 1.0.1\n",
		"unknown platform": "version 1.0.0\nsha256 riscv64-plan9 " + sum + "\n",
		"bad checksum":     "version 1.0.0\nsha256 aarch64-apple-darwin xyz\n",
		"unknown key":      "version 1.0.0\nmirror https://example.com\n",
	}
	for name, input := range cases {
		if _, err := ParseLock([]byte(input)); err == nil {
			t.Errorf("%s: ParseLock succeeded, want error", name)
		}
	}
}

func TestLint(t *testing.T) {
	rejected := map[string]string{
		"static import":      `import t from "/etc/hostname" with { type: "text" };`,
		"side-effect import": `import "/etc/hostname";`,
		"dynamic import":     `const m = await import("/etc/hostname");`,
		"re-export":          `export * from "/etc/hostname";`,
		"named re-export":    `export { a } from './a.ts';`,
		"eval":               `eval("1");`,
		"function ctor":      `new Function("return 1")();`,
		"worker":             `new Worker("file:///tmp/x.ts");`,
	}
	for name, src := range rejected {
		if len(Lint([]byte(src))) == 0 {
			t.Errorf("%s: Lint accepted %q", name, src)
		}
	}
	allowed := []string{
		`export function f() {}`,
		`if (import.meta.main) f();`,
		`const important = 1;`,
		`const reimport = 2;`,
		`myeval(1);`,
	}
	for _, src := range allowed {
		if vs := Lint([]byte(src)); len(vs) != 0 {
			t.Errorf("Lint rejected %q: %+v", src, vs)
		}
	}
}

func TestBuildIndex(t *testing.T) {
	dir := t.TempDir()
	write := func(name, src string) {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(src), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	write("b-app.ts", "// summary: Second\nconsole.log(2);\n")
	write("a-app.ts", "// summary: First\nconsole.log(1);\n")

	out, err := BuildIndex(dir)
	if err != nil {
		t.Fatal(err)
	}
	ix, err := ParseIndex(out)
	if err != nil {
		t.Fatal(err)
	}
	es := ix.Entries()
	if len(es) != 2 || es[0].Name != "a-app" || es[1].Summary != "Second" {
		t.Errorf("entries = %+v", es)
	}

	for name, src := range map[string]string{
		"no-summary.ts":  "console.log(1);\n",
		"tab-summary.ts": "// summary: a\tb\n",
		"imports.ts":     "// summary: x\nimport x from './x.ts';\n",
		"list.ts":        "// summary: reserved\n",
		"Bad_Name.ts":    "// summary: x\n",
	} {
		bad := t.TempDir()
		if err := os.WriteFile(filepath.Join(bad, name), []byte(src), 0o644); err != nil {
			t.Fatal(err)
		}
		if _, err := BuildIndex(bad); err == nil {
			t.Errorf("BuildIndex accepted %s", name)
		}
	}
}
