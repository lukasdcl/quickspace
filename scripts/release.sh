#!/bin/sh
# Build quick for every supported platform into dist/.
#
#   scripts/release.sh <version> [catalogue-url]
#
# The version must be a git tag pushed to GitHub (for example v0.1.0). Each
# build has the catalogue at that tag compiled in as its default, so a release
# only ever runs the apps that were reviewed for it.

set -eu

REPO="lukasdcl/quickspace"

case "$#" in
    1 | 2) ;;
    *) echo "usage: release.sh <version> [catalogue-url]" >&2; exit 2 ;;
esac
version="$1"
catalogue="${2:-https://raw.githubusercontent.com/$REPO/$version/catalogue}"

cd "$(dirname "$0")/.."
rm -rf dist
mkdir dist

for target in darwin/arm64 darwin/amd64 linux/arm64 linux/amd64 windows/arm64 windows/amd64; do
    os="${target%/*}"
    arch="${target#*/}"
    out="dist/quick-$version-$os-$arch"
    [ "$os" = windows ] && out="$out.exe"
    CGO_ENABLED=0 GOOS="$os" GOARCH="$arch" go build -trimpath \
        -ldflags "-s -w -X main.version=$version -X main.defaultCatalogue=$catalogue" \
        -o "$out" ./cmd/quick
done

(cd dist && if command -v shasum >/dev/null 2>&1; then shasum -a 256 quick-*; else sha256sum quick-*; fi) >dist/SHA256SUMS
printf 'catalogue: %s\n' "$catalogue"
ls -l dist
