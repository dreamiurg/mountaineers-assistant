#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$REPO_ROOT"

# usage prints the usage message showing the accepted version argument and exits with status 1.
usage() {
  echo "Usage: $0 <version|patch|minor|major>" >&2
  exit 1
}

# need checks that each provided command is available in PATH and exits with code 1 if any are missing.
need() {
  for cmd in "$@"; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      echo "Missing required command: $cmd" >&2
      exit 1
    fi
  done
}

[[ $# -eq 1 ]] || usage
ARG=$1

need git jq npm npx

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ $CURRENT_BRANCH != "main" ]]; then
  echo "Run release-bump from the main branch" >&2
  exit 1
fi

if [[ -n $(git status --porcelain) ]]; then
  echo "Clean your working tree before bumping a release" >&2
  exit 1
fi

CURRENT_VERSION=$(jq -r '.version' package.json)
if [[ -z $CURRENT_VERSION || $CURRENT_VERSION == null ]]; then
  echo "Could not read version from package.json" >&2
  exit 1
fi

base=${CURRENT_VERSION%%[-+]*}
IFS='.' read -r major minor patch <<<"$base"
major=${major:-0}
minor=${minor:-0}
patch=${patch:-0}

case "$ARG" in
  patch)
    patch=$((patch + 1))
    VERSION="$major.$minor.$patch"
    ;;
  minor)
    minor=$((minor + 1))
    patch=0
    VERSION="$major.$minor.$patch"
    ;;
  major)
    major=$((major + 1))
    minor=0
    patch=0
    VERSION="$major.$minor.$patch"
    ;;
  *)
    if [[ ! $ARG =~ ^[0-9]+\.[0-9]+\.[0-9]+([-.+][0-9A-Za-z.-]+)?$ ]]; then
      echo "Invalid version: $ARG" >&2
      exit 1
    fi
    VERSION=$ARG
    ;;
esac

LATEST=$(printf '%s\n%s\n' "$CURRENT_VERSION" "$VERSION" | sort -V | tail -n1)
if [[ $LATEST != "$VERSION" || $CURRENT_VERSION == "$VERSION" ]]; then
  echo "Version $VERSION must be newer than $CURRENT_VERSION" >&2
  exit 1
fi

BRANCH="release/v$VERSION"
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git checkout "$BRANCH"
else
  git checkout -b "$BRANCH"
fi

npm run typecheck

tmp=$(mktemp)
jq --arg version "$VERSION" '.version = $version' package.json >"$tmp"
mv "$tmp" package.json

tmp=$(mktemp)
jq --arg version "$VERSION" '
  .version = $version
  | (if (.packages? and (.packages | has("")) and (.packages[""] | has("version")))
       then (.packages[""].version = $version)
       else . end)
' package-lock.json >"$tmp"
mv "$tmp" package-lock.json

MANIFEST=src/chrome-ext/manifest.json
tmp=$(mktemp)
jq --arg version "$VERSION" '(.version = $version) | (if has("version_name") then .version_name = $version else . end)' \
  "$MANIFEST" >"$tmp"
mv "$tmp" "$MANIFEST"

DATE=$(date +%Y-%m-%d)
"$REPO_ROOT/scripts/changelog.sh" update --version "$VERSION" --date "$DATE"

npx prettier --write package.json package-lock.json "$MANIFEST" CHANGELOG.md >/dev/null

echo
echo "Release branch: $BRANCH"
echo "Updated to v$VERSION"
echo "Next: just release-submit"