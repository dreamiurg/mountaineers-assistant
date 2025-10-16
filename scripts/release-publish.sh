#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$REPO_ROOT"

# usage prints the required command-line usage for the script to stderr and exits with status 1.
usage() {
  echo "Usage: $0 <version>" >&2
  exit 1
}

# need verifies that each command name passed as an argument exists in PATH and prints an error and exits with status 1 if any are missing.
need() {
  for cmd in "$@"; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      echo "Missing required command: $cmd" >&2
      exit 1
    fi
  done
}

[[ $# -eq 1 ]] || usage
VERSION=$1

if [[ ! $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+([-.+][0-9A-Za-z.-]+)?$ ]]; then
  echo "Invalid version: $VERSION" >&2
  exit 1
fi

need git gh jq npm zip

if [[ $(git rev-parse --abbrev-ref HEAD) != "main" ]]; then
  echo "Publish from the main branch after the release PR merges" >&2
  exit 1
fi

if [[ -n $(git status --porcelain) ]]; then
  echo "Clean your working tree before publishing" >&2
  exit 1
fi

git fetch origin main
if ! git merge-base --is-ancestor HEAD origin/main || ! git merge-base --is-ancestor origin/main HEAD; then
  echo "Sync main with origin before publishing" >&2
  exit 1
fi

PACKAGE_VERSION=$(jq -r '.version' package.json)
if [[ $PACKAGE_VERSION != "$VERSION" ]]; then
  echo "package.json reports v$PACKAGE_VERSION, expected v$VERSION" >&2
  exit 1
fi

MANIFEST_VERSION=$(jq -r '.version' src/chrome-ext/manifest.json)
if [[ $MANIFEST_VERSION != "$VERSION" ]]; then
  echo "manifest.json reports v$MANIFEST_VERSION, expected v$VERSION" >&2
  exit 1
fi

TAG="v$VERSION"
if git rev-parse --verify --quiet "$TAG"; then
  echo "Tag $TAG already exists" >&2
  exit 1
fi
if git ls-remote --tags origin "$TAG" >/dev/null 2>&1; then
  echo "Tag $TAG already exists on origin" >&2
  exit 1
fi

npm run typecheck
npm run build

DIST=dist
if [[ ! -d $DIST ]]; then
  echo "dist/ missing after build" >&2
  exit 1
fi

ZIP="mountaineers-assistant-$VERSION.zip"
rm -f "$ZIP"
(
  cd "$DIST"
  zip -qr "../$ZIP" .
)

if [[ ! -f $ZIP ]]; then
  echo "Failed to create $ZIP" >&2
  exit 1
fi

git tag -a "$TAG" -m "Release $TAG"
git push origin "$TAG"

if ! gh release create "$TAG" --title "$TAG" --notes "Release $TAG" "$ZIP"; then
  echo "Tag pushed. Create the GitHub release manually." >&2
  exit 1
fi

echo
printf 'Published %s\n' "$TAG"
printf 'Package: %s\n' "$ZIP"
printf 'Next: upload the ZIP to the Chrome Web Store\n'