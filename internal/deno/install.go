package deno

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/lukasdcl/quickspace/internal/catalogue"
	"github.com/lukasdcl/quickspace/internal/fetch"
)

const (
	// DefaultBaseURL is where Deno publishes release archives.
	DefaultBaseURL = "https://github.com/denoland/deno/releases/download"

	maxArchiveSize = 256 << 20 // compressed; releases are about 40 MiB
	maxBinarySize  = 512 << 20 // uncompressed; releases are about 95 MiB
)

// Installer installs pinned Deno runtimes under Dir, one directory per
// version.
type Installer struct {
	Fetch   *fetch.Client
	BaseURL string
	Dir     string
	TempDir string    // must be on the same file system as Dir
	Log     io.Writer // receives a one-line notice before a download
}

// Ensure returns the path of the runtime pinned by lock, installing it if
// necessary. An installed runtime is trusted without re-hashing; see
// SECURITY.md.
func (in *Installer) Ensure(lock *catalogue.Lock) (string, error) {
	dest := filepath.Join(in.Dir, "deno-"+lock.Version)
	bin := filepath.Join(dest, BinaryName())
	if _, err := os.Stat(bin); err == nil {
		return bin, nil
	}

	platform, err := Platform()
	if err != nil {
		return "", err
	}
	want, ok := lock.SHA256[platform]
	if !ok {
		return "", fmt.Errorf("runtime.lock has no checksum for platform %s", platform)
	}
	if err := in.install(lock.Version, platform, want, dest); err != nil {
		return "", err
	}
	return bin, nil
}

func (in *Installer) install(version, platform, want, dest string) error {
	fmt.Fprintf(in.Log, "quick: installing Deno %s for %s (one-time download, about 40 MB)\n", version, platform)

	work, err := os.MkdirTemp(in.TempDir, "runtime-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(work)

	archive := filepath.Join(work, "deno.zip")
	url := fmt.Sprintf("%s/v%s/deno-%s.zip", in.BaseURL, version, platform)
	if err := in.Fetch.ToFile(url, archive, maxArchiveSize); err != nil {
		return err
	}
	if err := fetch.Verify(archive, want, fmt.Sprintf("Deno %s (%s)", version, platform)); err != nil {
		return err
	}

	unpacked := filepath.Join(work, "unpacked")
	if err := os.Mkdir(unpacked, 0o755); err != nil {
		return err
	}
	if err := extractBinary(archive, filepath.Join(unpacked, BinaryName())); err != nil {
		return err
	}

	// Move into place only once complete, so an interrupted install is never
	// mistaken for a working runtime.
	if err := os.RemoveAll(dest); err != nil {
		return err
	}
	return os.Rename(unpacked, dest)
}

// extractBinary copies the Deno executable out of a release archive. Only
// the top-level entry with the expected name is read; nothing else in the
// archive is written to disk.
func extractBinary(archive, dest string) error {
	zr, err := zip.OpenReader(archive)
	if err != nil {
		return fmt.Errorf("could not open the Deno archive: %w", err)
	}
	defer zr.Close()

	for _, f := range zr.File {
		if f.Name != BinaryName() {
			continue
		}
		src, err := f.Open()
		if err != nil {
			return err
		}
		defer src.Close()
		out, err := os.OpenFile(dest, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o755)
		if err != nil {
			return err
		}
		n, err := io.Copy(out, io.LimitReader(src, maxBinarySize+1))
		if cerr := out.Close(); err == nil {
			err = cerr
		}
		if err != nil {
			return err
		}
		if n > maxBinarySize {
			return fmt.Errorf("the Deno binary in the archive is unexpectedly large")
		}
		return nil
	}
	return fmt.Errorf("the Deno archive does not contain %s", BinaryName())
}
