// Package deno installs the pinned Deno runtime and runs apps in its sandbox.
package deno

import (
	"fmt"
	"runtime"
)

// Platform returns the Deno release target for this machine.
func Platform() (string, error) {
	return platformFor(runtime.GOOS, runtime.GOARCH, runningUnderTranslation())
}

// platformFor maps Go's OS and architecture names to Deno's. translated is
// true when an x86-64 binary is running under Rosetta on Apple silicon, in
// which case the native arm64 runtime is preferred.
func platformFor(goos, goarch string, translated bool) (string, error) {
	var arch string
	switch goarch {
	case "arm64":
		arch = "aarch64"
	case "amd64":
		arch = "x86_64"
		if goos == "darwin" && translated {
			arch = "aarch64"
		}
	default:
		return "", fmt.Errorf("unsupported architecture %s", goarch)
	}

	var os string
	switch goos {
	case "darwin":
		os = "apple-darwin"
	case "linux":
		os = "unknown-linux-gnu"
	case "windows":
		os = "pc-windows-msvc"
	default:
		return "", fmt.Errorf("unsupported operating system %s", goos)
	}
	return arch + "-" + os, nil
}

// BinaryName is the file name of the Deno executable on this platform.
func BinaryName() string {
	if runtime.GOOS == "windows" {
		return "deno.exe"
	}
	return "deno"
}
