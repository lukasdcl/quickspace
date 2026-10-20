# Quickspace

Run tiny command-line apps by name, without installing them. Type `quick`,
a space, and the app.

```
$ quick billionaire-charity 150m 220bn 300k

A donation of 150 million is 0.068% of a 220 billion fortune.
For someone worth 300,000, that's like giving 205.
```

Other apps answer things like `quick days until christmas`,
`quick moon when full` or `quick pw`. Run `quick list` to see them all.

`quick` downloads the app from a curated catalogue, checks it against the
checksum in the catalogue's index, and runs it in a sandbox with no access to
the network, your files, environment variables or other programs. Apps are
single TypeScript files of a few kilobytes. `quick` keeps a copy of each one
and downloads it again only when it changes, but it reads the index on every
run, so a new or updated app works as soon as it is published. If the
catalogue can't be reached, `quick` says so and uses the index from its last
run.

It runs on macOS, Linux and Windows, on both x86-64 and ARM.

## Install

With Go 1.24 or later:

```sh
go install github.com/lukasdcl/quickspace/cmd/quick@latest
```

`quick` is one executable of a few megabytes and needs nothing else
installed. The first time it runs an app, it downloads its own copy of the
Deno runtime, which is what runs apps inside the sandbox (about 40 MB, 95 MB
unpacked). It keeps Deno in `~/.quick/runtime`, checked against the
checksums in `catalogue/runtime.lock`, and uses it for nothing else.

A copy built from source, including with `go install`, uses the catalogue on
the `main` branch. Release builds made with `scripts/release.sh` use the
catalogue from their own release tag instead, so they only ever run the apps
that were reviewed for that release. To use a different catalogue, write its
URL to `~/.quick/catalogue-url`, or set `QUICK_CATALOGUE` for a single run.
`file://` URLs work for local catalogues.

## Usage

```
quick <app> [args...]   Run an app from the catalogue
quick list              List available apps
quick info <app>        Show an app's description and checksum
quick update            Fetch the catalogue without running anything
quick clean             Remove cached apps (the runtime is kept)
quick version           Show quick's version and the pinned runtime
```

Some apps have more than one name: `quick pw` and `quick password` are the
same app. Hyphens are optional, so `quick billionairecharity` works too. If
a longer name has a small typo and only one app is close to it, `quick` runs
that app and says which one it ran. Otherwise it suggests the nearest names.

## How it works

`quick` never runs app code itself. It looks the name up in the catalogue
index, downloads and verifies the app and the runtime, and starts Deno with
every permission denied. Deno runs the app.

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
scripts/dev-install.sh     Install a local build that uses this checkout's catalogue
scripts/release.sh         Cross-compile release builds into dist/
```

## Adding an app

1. Add `catalogue/apps/<name>.ts`. Names may contain lowercase letters,
   digits and hyphens, and can't be one of quick's own commands. To give an
   app more than one name, put them all in the file name separated by dots.
   `pomo.pomodoro.ts` runs as `quick pomo` or `quick pomodoro`, and the
   first is its main name.
2. Make the first line `// summary: <one line>`. `quick list` shows it.
3. Keep the file self-contained: no imports, `eval`, `Function` or workers.
   Read input from `Deno.args` or `prompt()` and write with `console.log`.
4. Run `go run ./cmd/quick-catalogue build`, review the diff, and commit the
   app and the index together.

## Upgrading the runtime

```sh
go run ./cmd/quick-catalogue pin 2.9.8
go test ./...
```

Commit `catalogue/runtime.lock` once the tests pass. Everyone picks up the
new version on their next run.

## Development

Requires Go 1.24 or later. To try local changes as the real `quick`
command, run `scripts/dev-install.sh`. It builds `quick` into
`~/.local/bin`, adds that to your `PATH` if needed, and points it at this
checkout's catalogue. Run it again after each change, and run it with
`--github` to go back to the published catalogue.

```sh
go test ./...                          # unit and end-to-end tests
go test -short ./...                   # unit tests only, no Deno download
go run ./cmd/quick-catalogue check     # index is current and runtime.lock is valid
scripts/release.sh v0.1.0              # cross-compile release builds into dist/
```

The end-to-end tests build `quick`, run a real app, and try each way out of
the sandbox to check that every one fails. They download Deno once into the
user cache directory, or into `QUICK_E2E_CACHE` if it is set. CI runs them
on macOS, Linux and Windows.

See [SECURITY.md](SECURITY.md) for the trust model and its limits.
