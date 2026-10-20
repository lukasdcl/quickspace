#!/bin/sh
# Build quick from this checkout, put it on your PATH and point it at this
# checkout's catalogue, so local apps can be tried before they are pushed.
#
#   scripts/dev-install.sh             install, or reinstall after a change
#   scripts/dev-install.sh --github    go back to the catalogue on GitHub
#
# Installs to ~/.local/bin, or to QUICK_BIN_DIR if set. Run it again after
# changing an app or the Go code; it rebuilds the index and the binary.

set -eu

bin_dir="${QUICK_BIN_DIR:-$HOME/.local/bin}"
quick_home="${QUICK_HOME:-$HOME/.quick}"

case "${1:-}" in
    "") mode=local ;;
    --github) mode=github ;;
    *) echo "usage: dev-install.sh [--github]" >&2; exit 2 ;;
esac

if ! command -v go >/dev/null 2>&1; then
    echo "Go is needed to build quick. On a Mac: brew install go" >&2
    exit 1
fi

cd "$(dirname "$0")/.."
root="$(pwd)"

if [ "$mode" = local ]; then
    # Rehash the apps first, or quick refuses any app edited since the last
    # build with a checksum mismatch.
    go run ./cmd/quick-catalogue build
fi

mkdir -p "$bin_dir"
version="dev-$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
go build -trimpath -ldflags "-X main.version=$version" -o "$bin_dir/quick" ./cmd/quick
echo "built $bin_dir/quick ($version)"

mkdir -p "$quick_home"
if [ "$mode" = local ]; then
    echo "file://$root/catalogue" >"$quick_home/catalogue-url"
    echo "using the catalogue in $root/catalogue"
else
    rm -f "$quick_home/catalogue-url"
    echo "using the catalogue on GitHub"
fi

case ":$PATH:" in
    *":$bin_dir:"*) on_path=yes ;;
    *) on_path=no ;;
esac
if [ "$on_path" = no ]; then
    case "$(basename "${SHELL:-}")" in
        zsh) rc="$HOME/.zshrc" ;;
        bash) rc="$HOME/.bashrc" ;;
        *) rc="" ;;
    esac
    line="export PATH=\"$bin_dir:\$PATH\""
    if [ -n "$rc" ]; then
        if ! grep -qsF "$line" "$rc"; then
            printf '\n# Added by quickspace scripts/dev-install.sh\n%s\n' "$line" >>"$rc"
            echo "added $bin_dir to PATH in $rc"
        fi
        echo "open a new terminal, or run: source $rc"
    else
        echo "add $bin_dir to your PATH to run quick by name"
    fi
fi

"$bin_dir/quick" update
