# Quickspace

Run tiny apps by name, never installed. Type `quick`, a space, and the app.

```
$ quick billionaire-calculator 150m 220bn 300k

A donation of 150 million is 0.068% of a 220 billion fortune.
For someone worth 300,000, that's like giving 205.
```

`quick` fetches an app from a curated catalogue, checks it against the
catalogue's checksum, and runs it in a sandbox with no access to the network,
the file system, environment variables or other programs. Apps are single
TypeScript files of a few kilobytes, so after the first run they start in
well under a tenth of a second.

Runs on macOS, Linux and Windows, on both x86-64 and ARM.

## Install

`quick` is a single self-contained executable of about 6 MB with no
dependencies. Download the build for your platform from the
[releases page](https://github.com/lukasdcl/quickspace/releases) and put it on
your `PATH`, or install it with Go 1.24 or later:

```sh
go install github.com/lukasdcl/quickspace/cmd/quick@latest
```

On first use it downloads the pinned Deno runtime (about 40 MB, 95 MB
unpacked) into `~/.quick/runtime`, verifying it against `runtime.lock`.

Release builds use the catalogue from their own release tag, so what runs is
exactly what was reviewed for that release. Builds from source use the
catalogue on the `main` branch. To use a different catalogue, write its URL
to `~/.quick/catalogue-url`, or set `QUICK_CATALOGUE` for a single
invocation. `file://` URLs work for local catalogues.

## Usage

```
quick <app> [args...]   Run an app from the catalogue
quick list              List available apps
quick info <app>        Show an app's description and checksum
quick update            Refresh the catalogue index and runtime pin
quick clean             Remove cached apps (the runtime is kept)
quick version           Show quick's version and the pinned runtime
```

Names are matched without their hyphens, so `quick billionairecalculator`
works. A small typo in a longer name runs the app it was clearly meant for
and says so; when the intent is less clear, quick suggests names instead of
guessing.

## How it fits together

`quick` itself never runs app code. It is the launcher: it resolves a name
in the catalogue index, downloads and verifies the app and the runtime, and
starts Deno with every permission denied. Deno runs the app.

```
cmd/quick/                 The CLI
cmd/quick-catalogue/       Maintenance tool: lint apps, build the index, pin Deno
internal/catalogue/        Index and lock formats, name rules, app lint
internal/fetch/            HTTPS-only downloads with size limits and atomic writes
internal/deno/             Platform detection, runtime install, sandbox flags
catalogue/
  apps/<names>.ts          One self-contained file per app
  index.tsv                Names, SHA-256 and summary of every app (generated)
  runtime.lock             Pinned Deno version and per-platform SHA-256 (generated)
scripts/release.sh         Cross-compile release builds into dist/
```

## Adding an app

1. Add `catalogue/apps/<name>.ts`. The name may contain lowercase letters,
   digits and hyphens, and must not be one of quick's subcommands. To give
   an app more than one name, list them all in the file name separated by
   dots: `pomo.pomodoro.ts` runs as either `quick pomo` or `quick pomodoro`,
   with the first as its main name.
2. The first line must be `// summary: <one line>`; `quick list` shows it.
3. The file must be self-contained: no imports, `eval`, `Function` or
   workers. Read input from `Deno.args` or `prompt()`; write with
   `console.log`.
4. Run `go run ./cmd/quick-catalogue build`, review the diff, and commit the
   app and the index together.

## Upgrading the runtime

```sh
go run ./cmd/quick-catalogue pin 2.9.8
go test ./...
```

Commit `catalogue/runtime.lock` once the tests pass. Clients pick up the new
version on their next `quick update`.

## Development

Requires Go 1.24 or later. To try local changes as the real `quick`
command, run `scripts/dev-install.sh`: it builds `quick` into
`~/.local/bin`, adds that to your `PATH` if needed and points it at this
checkout's catalogue. Run it again after each change, and run it with
`--github` to switch back to the published catalogue.

```sh
go test ./...                          # unit and end-to-end tests
go test -short ./...                   # unit tests only, no Deno download
go run ./cmd/quick-catalogue check     # index is current and runtime.lock is valid
scripts/release.sh v0.1.0                # cross-compile release builds into dist/
```

The end-to-end tests build the binary, run the sample app, and attempt each
class of sandbox escape. They download Deno once into the user cache
directory, or into `QUICK_E2E_CACHE` if set. CI runs everything on macOS,
Linux and Windows.

See [SECURITY.md](SECURITY.md) for the trust model and its limits.
