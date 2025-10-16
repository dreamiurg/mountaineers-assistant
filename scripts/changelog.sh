#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$REPO_ROOT"

usage() {
  cat <<'USAGE' >&2
Usage: changelog.sh <update|extract> [options]

update  --version <semver> --date <YYYY-MM-DD> [--file path]
extract --version <semver> [--file path]
USAGE
  exit 1
}

[[ $# -ge 1 ]] || usage
COMMAND=$1
shift

FILE="$REPO_ROOT/CHANGELOG.md"
VERSION=""
DATE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --file)
      FILE=$2
      shift 2
      ;;
    --version)
      VERSION=$2
      shift 2
      ;;
    --date)
      DATE=$2
      shift 2
      ;;
    *)
      usage
      ;;
  esac
done

case "$COMMAND" in
  update)
    [[ -n $VERSION && -n $DATE ]] || usage

    if ! LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null); then
      COMMITS=$(git log --pretty=format:%s --no-merges)
    else
      COMMITS=$(git log "$LAST_TAG"..HEAD --pretty=format:%s --no-merges)
    fi
    COMMITS=$(printf '%s\n' "$COMMITS" | grep -vi '^release:' || true)

    HEADER='# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
'

    ENTRY="## [$VERSION] - $DATE
"
    if [[ -n $COMMITS ]]; then
      while IFS= read -r line; do
        [[ -n $line ]] && ENTRY+="- $line
"
      done <<<"$COMMITS"
      ENTRY+=$'\n'
    else
      ENTRY+=$'No changes recorded.\n\n'
    fi

    EXISTING=""
    if [[ -f $FILE ]]; then
      EXISTING=$(awk 'BEGIN{copy=0} /^## \[/ {copy=1} copy {print}' "$FILE")
    fi

    TMP=$(mktemp)
    {
      printf '%s' "$HEADER"
      printf '%s' "$ENTRY"
      [[ -n $EXISTING ]] && printf '%s\n' "$EXISTING"
    } >"$TMP"
    mv "$TMP" "$FILE"
    ;;
  extract)
    [[ -n $VERSION ]] || usage
    [[ -f $FILE ]] || { echo "$FILE not found" >&2; exit 1; }

    awk -v version="$VERSION" '
      BEGIN { in_section = 0 }
      /^## \[/ {
        if (in_section) exit
        if ($0 ~ "^## \\[(" version ")\\]") { in_section = 1; next }
      }
      in_section { if ($0 !~ /^[[:space:]]*$/) print }
    ' "$FILE"
    ;;
  *)
    usage
    ;;
esac
