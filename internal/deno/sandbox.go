package deno

import "strings"

// SandboxArgs returns the deno arguments that run app with args under the
// sandbox. Every permission is denied explicitly rather than merely not
// granted, prompting is disabled so an app cannot ask the user for access,
// and remote, npm and JSR imports are disabled.
func SandboxArgs(app string, args []string) []string {
	return append([]string{
		"run",
		"--quiet",
		"--no-prompt",
		"--no-config",
		"--no-lock",
		"--no-remote",
		"--no-npm",
		"--deny-read",
		"--deny-write",
		"--deny-net",
		"--deny-env",
		"--deny-run",
		"--deny-sys",
		"--deny-ffi",
		"--deny-import",
		app,
	}, args...)
}

// SandboxEnv returns a copy of environ with any DENO_* variables removed and
// replaced by ones that isolate Deno's cache in denoDir and stop it
// contacting the network for update checks. Removing the user's own DENO_*
// settings ensures none of them can loosen the sandbox.
func SandboxEnv(environ []string, denoDir string) []string {
	out := make([]string, 0, len(environ)+3)
	for _, kv := range environ {
		if !strings.HasPrefix(strings.ToUpper(kv), "DENO_") {
			out = append(out, kv)
		}
	}
	return append(out,
		"DENO_DIR="+denoDir,
		"DENO_NO_UPDATE_CHECK=1",
		"DENO_NO_PACKAGE_JSON=1",
	)
}
