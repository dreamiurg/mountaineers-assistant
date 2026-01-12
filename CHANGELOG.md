# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0](https://github.com/dreamiurg/mountaineers-assistant/compare/v0.2.3...v0.3.0) (2026-01-12)


### Features

* add error diagnostics and reporting system ([#31](https://github.com/dreamiurg/mountaineers-assistant/issues/31)) ([0fad68c](https://github.com/dreamiurg/mountaineers-assistant/commit/0fad68c925ebe55e8a72ef6e93382f9798a89854))


### Bug Fixes

* timeout on large activity lists & feat: extract activity ratings ([#42](https://github.com/dreamiurg/mountaineers-assistant/issues/42)) ([7da9409](https://github.com/dreamiurg/mountaineers-assistant/commit/7da940904045132184548c4254d583ac6e80a2de))

## [0.2.3] - 2025-10-14

### Added

- Display version number in Footer component (#22)

## [0.2.2] - 2025-10-14

### Fixed

- Resolve fetch button state and cache persistence issues (#20)
- Various small fixes (#19)

### Other

- Updated test screenshots (#18)

## [0.2.1] - 2025-10-14

### Changed

- Added footer with links to Insights and Preferences pages (#16)

## [0.2.0] - 2025-10-13

### Changed

- Extension popup have been removed in favor of Insights dashboard with refresh button

## [0.1.8] - 2025-10-12

### Added

- Show fetch limit in popup button label (#8)

### Fixed

- Prevent SyntaxError on content script re-injection (#7)

### Other

- Refactor release workflow for improved control and automation (#10)
- Preserve changelog history when bumping version (#11)

## [0.1.7] - 2025-10-12

### Added

- Added partner filter to insights dashboard (#3)

### Other

- Pre-commit hooks prevent accidental commits to main (#1)
- Automated changelog generation (#4)
- Refactor release workflow for branch protection compatibility (#5)
