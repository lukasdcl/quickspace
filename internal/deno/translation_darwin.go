package deno

import "syscall"

// runningUnderTranslation reports whether this process is an x86-64 binary
// running under Rosetta 2.
func runningUnderTranslation() bool {
	v, err := syscall.SysctlUint32("sysctl.proc_translated")
	return err == nil && v == 1
}
