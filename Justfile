set shell := ["bash", "-eu", "-o", "pipefail", "-c"]

default: help

help:
    @echo "Available recipes:"
    @echo "  just release-bump <version|patch|minor|major>    # Update versions, changelog, and branch"
    @echo "  just release-submit                             # Commit and open draft PR for release branch"
    @echo "  just release-publish <version>                  # Package, tag, and publish release"

release-bump version:
    ./scripts/release-bump.sh {{version}}

release-submit:
    ./scripts/release-submit.sh

release-publish version:
    ./scripts/release-publish.sh {{version}}
