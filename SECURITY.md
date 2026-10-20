# Security model

`quick` runs code that its users have not read. The design aims to make that
safe by limiting both what can be run and what it can do.

## What is trusted

1. **The catalogue URL.** `index.tsv` and `runtime.lock` are fetched over
   HTTPS from the configured catalogue. Everything else is verified against
   them, so they are the root of trust. Release builds pin the URL to their
   own tag, so a later change to the repository cannot alter what they run.
   Builds from source follow the `main` branch and so trust whatever is
   merged there.
2. **Deno's official release checksums**, recorded in `runtime.lock` by
   `quick-catalogue pin`.
3. **Review.** Every app is read by a maintainer before it is indexed.

## What is enforced

| Control | Where |
| --- | --- |
| An app runs only if its SHA-256 matches `index.tsv`; cached copies are re-checked on every run | `cmd/quick` |
| The runtime installs only if its archive's SHA-256 matches `runtime.lock`, and only the Deno executable is extracted | `internal/deno` |
| Downloads use HTTPS only, including redirects, with size limits; files are written atomically | `internal/fetch` |
| `index.tsv` and `runtime.lock` are parsed strictly before replacing cached copies | `cmd/quick`, `internal/catalogue` |
| App names are restricted to `[a-z0-9-]`, preventing path traversal and option injection | `internal/catalogue` |
| All Deno permissions are denied explicitly, and permission prompts are disabled | `internal/deno` |
| Remote, npm and JSR imports are disabled; Deno config and lock files are ignored | `internal/deno` |
| The user's own `DENO_*` environment variables are removed before Deno starts | `internal/deno` |
| Apps are cached under their checksums, so a relative import can reach nothing but other verified apps | `cmd/quick` |
| Apps may not contain imports, `eval`, `Function` or `Worker` | `internal/catalogue` (`quick-catalogue build`) |

The end-to-end tests in `cmd/quick` attempt each class of escape (network,
file read and write, environment, subprocesses, system information, remote,
npm, JSR and relative imports, a tampered app and a forged runtime) on every
supported operating system, and check that all fail.

## Known limits

- **Local module imports bypass `--deny-read`.** Deno does not apply read
  permissions to module loading, so `import t from "/etc/hostname" with
  { type: "text" }` succeeds under the sandbox. Because the network, file
  writes and subprocesses are all denied, such an app could only display the
  file to the user who ran it. `quick-catalogue build` rejects any app
  containing an import, but that is a pattern check rather than a guarantee;
  review remains the control.
- **The index is not signed.** Anyone who can serve content from the
  catalogue URL can change what runs. Pinning to a tag or commit narrows this
  to the hosting provider. Signing the index is planned.
- **An installed runtime is not re-verified.** Hashing 95 MB on every run
  would cost more than the apps themselves; the runtime is verified once when
  installed. Anyone able to modify `~/.quick` can already run code as you.
- **Resource use is not limited.** An app can loop forever or allocate
  memory until stopped with Ctrl-C.
- **Linux builds need glibc.** Deno publishes no builds for musl-based
  distributions such as Alpine.

## Reporting a problem

For a security problem, use **Report a vulnerability** on the repository's
Security tab, which sends a private report. Anything else can go in an
ordinary issue.
