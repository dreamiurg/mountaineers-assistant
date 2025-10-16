#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$REPO_ROOT"

# need verifies that each provided command is available on PATH and exits with status 1 while printing an error for the first missing command.
need() {
  for cmd in "$@"; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      echo "Missing required command: $cmd" >&2
      exit 1
    fi
  done
}

need git gh jq

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ ! $BRANCH =~ ^release/v(.+)$ ]]; then
  echo "Checkout a release branch before running release-submit" >&2
  exit 1
fi
VERSION="${BASH_REMATCH[1]}"

PACKAGE_VERSION=$(jq -r '.version' package.json)
if [[ $PACKAGE_VERSION != "$VERSION" ]]; then
  echo "Branch version v$VERSION does not match package.json v$PACKAGE_VERSION" >&2
  exit 1
fi

if [[ -z $(git status --porcelain package.json package-lock.json src/chrome-ext/manifest.json CHANGELOG.md) ]]; then
  echo "No release files were changed. Run just release-bump first." >&2
  exit 1
fi

git add package.json package-lock.json src/chrome-ext/manifest.json CHANGELOG.md

git commit -m "release: prepared v$VERSION" >/dev/null

if ! git push --set-upstream origin "$BRANCH"; then
  git push
fi

BODY=$(mktemp)
PR_TMP=$(mktemp)
trap 'rm -f "$BODY" "$PR_TMP"' EXIT
if ! "$REPO_ROOT/scripts/changelog.sh" extract --version "$VERSION" >"$BODY" 2>/dev/null; then
  printf 'Release v%s\n' "$VERSION" >"$BODY"
fi

if ! gh pr create --base main --head "$BRANCH" --title "Release v$VERSION" --body-file "$BODY" --draft >"$PR_TMP" 2>&1; then
  if PR_URL=$(gh pr view "$BRANCH" --json url --jq .url 2>/dev/null); then
    echo "Draft PR already exists: $PR_URL"
  else
    cat "$PR_TMP" >&2
    exit 1
  fi
else
  cat "$PR_TMP"
fi

echo
printf 'Branch ready: %s\n' "$BRANCH"
printf 'Next: review the draft PR\n'