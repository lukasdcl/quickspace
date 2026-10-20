//go:build unix

package main

import "syscall"

// execDeno replaces the quick process with Deno, so signals, the terminal
// and the exit status belong to the app directly. It returns only on error.
func execDeno(bin string, args, env []string) error {
	return syscall.Exec(bin, append([]string{bin}, args...), env)
}
