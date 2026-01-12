# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.6](https://github.com/dreamiurg/mountaineers-assistant/compare/mountaineers-assistant-v0.4.5...mountaineers-assistant-v0.4.6) (2026-01-12)


### Features

* 'npm run publish' is now a thing ([4a3d6e8](https://github.com/dreamiurg/mountaineers-assistant/commit/4a3d6e809250a32056d581e532507e6278e7a29d))
* add error diagnostics and reporting system ([#31](https://github.com/dreamiurg/mountaineers-assistant/issues/31)) ([0fad68c](https://github.com/dreamiurg/mountaineers-assistant/commit/0fad68c925ebe55e8a72ef6e93382f9798a89854))
* added clipboard copy on preferences ([e512f78](https://github.com/dreamiurg/mountaineers-assistant/commit/e512f78e89da288b6fd5615b68e6771779bd9cfc))
* added partner filter to insights dashboard ([#3](https://github.com/dreamiurg/mountaineers-assistant/issues/3)) ([ebd6961](https://github.com/dreamiurg/mountaineers-assistant/commit/ebd6961bc35262526dce19fc4912ee7c18ca400b))
* display shared activities on member profile pages ([#43](https://github.com/dreamiurg/mountaineers-assistant/issues/43)) ([1b63ae0](https://github.com/dreamiurg/mountaineers-assistant/commit/1b63ae0032771d52ca3bddeff79088e986dd601e))
* display version number in Footer component ([#22](https://github.com/dreamiurg/mountaineers-assistant/issues/22)) ([259ada9](https://github.com/dreamiurg/mountaineers-assistant/commit/259ada90910197242d5b9e04a9d59883fc511813))
* first stab at packaging script ([db83553](https://github.com/dreamiurg/mountaineers-assistant/commit/db83553a6f90f35c4ef82dca96e8ebdc863be799))
* improved popup refresh progress messaging ([8acf1f8](https://github.com/dreamiurg/mountaineers-assistant/commit/8acf1f8200e208e4bf8ac69ecf8c5e08b46e7975))
* prototype of automation for releases support ([8d0185e](https://github.com/dreamiurg/mountaineers-assistant/commit/8d0185e998eb5f108fea71495f65c739f6573707))
* show fetch limit in popup button label ([#8](https://github.com/dreamiurg/mountaineers-assistant/issues/8)) ([2f18e98](https://github.com/dreamiurg/mountaineers-assistant/commit/2f18e98e86d6af00386fc7f4c35e3510e1d9693f))


### Bug Fixes

* add --clobber flag to release upload for idempotency ([#52](https://github.com/dreamiurg/mountaineers-assistant/issues/52)) ([0d56908](https://github.com/dreamiurg/mountaineers-assistant/commit/0d569085a73e8c51c623b8ac5c3d9ca97ae7612d))
* create draft releases to allow asset uploads ([#45](https://github.com/dreamiurg/mountaineers-assistant/issues/45)) ([1daa515](https://github.com/dreamiurg/mountaineers-assistant/commit/1daa5158b3907bed6b05fe367d96f6ac8d777df4))
* fixed release script ([cb7ee8b](https://github.com/dreamiurg/mountaineers-assistant/commit/cb7ee8be73f3bfe69ef512531920129ecc4133ab))
* preserve changelog history when bumping version ([#11](https://github.com/dreamiurg/mountaineers-assistant/issues/11)) ([8a7f603](https://github.com/dreamiurg/mountaineers-assistant/commit/8a7f603924d7d54b11ea0d5fc6249a493629bc73))
* prevent SyntaxError on content script re-injection ([#7](https://github.com/dreamiurg/mountaineers-assistant/issues/7)) ([826aeb6](https://github.com/dreamiurg/mountaineers-assistant/commit/826aeb662ca6ae98527de26b37c89a4333f720f9))
* resolve fetch button state and cache persistence issues ([#20](https://github.com/dreamiurg/mountaineers-assistant/issues/20)) ([183401e](https://github.com/dreamiurg/mountaineers-assistant/commit/183401ef579d3c9eda9ed2c4e25b111c5c004028))
* set draft option in release-please action, not config ([#47](https://github.com/dreamiurg/mountaineers-assistant/issues/47)) ([9fe395a](https://github.com/dreamiurg/mountaineers-assistant/commit/9fe395ac5e98ca2e5e61405d5421088a98777902))
* skip release-please release creation, create manually ([#49](https://github.com/dreamiurg/mountaineers-assistant/issues/49)) ([caa1744](https://github.com/dreamiurg/mountaineers-assistant/commit/caa1744a607313d4c446aa6e19db27b684783fa8))
* timeout on large activity lists & feat: extract activity ratings ([#42](https://github.com/dreamiurg/mountaineers-assistant/issues/42)) ([7da9409](https://github.com/dreamiurg/mountaineers-assistant/commit/7da940904045132184548c4254d583ac6e80a2de))
* upload assets to existing release instead of creating new one ([#51](https://github.com/dreamiurg/mountaineers-assistant/issues/51)) ([b7a8af0](https://github.com/dreamiurg/mountaineers-assistant/commit/b7a8af0f320c35293f82af3237d67356fcec385a))
* use config and manifest files instead of release-type input ([#56](https://github.com/dreamiurg/mountaineers-assistant/issues/56)) ([c446f52](https://github.com/dreamiurg/mountaineers-assistant/commit/c446f522aba22370c7108329d696d6ed2aa408ee))
* use draft releases to allow asset uploads before publishing ([#54](https://github.com/dreamiurg/mountaineers-assistant/issues/54)) ([41e91f2](https://github.com/dreamiurg/mountaineers-assistant/commit/41e91f2003aef960d220672a8ec961db98db43a2))

## [0.4.5](https://github.com/dreamiurg/mountaineers-assistant/compare/v0.4.4...v0.4.5) (2026-01-12)


### Bug Fixes

* use draft releases to allow asset uploads before publishing ([#54](https://github.com/dreamiurg/mountaineers-assistant/issues/54)) ([41e91f2](https://github.com/dreamiurg/mountaineers-assistant/commit/41e91f2003aef960d220672a8ec961db98db43a2))

## [0.4.4](https://github.com/dreamiurg/mountaineers-assistant/compare/v0.4.3...v0.4.4) (2026-01-12)


### Bug Fixes

* add --clobber flag to release upload for idempotency ([#52](https://github.com/dreamiurg/mountaineers-assistant/issues/52)) ([0d56908](https://github.com/dreamiurg/mountaineers-assistant/commit/0d569085a73e8c51c623b8ac5c3d9ca97ae7612d))
* upload assets to existing release instead of creating new one ([#51](https://github.com/dreamiurg/mountaineers-assistant/issues/51)) ([b7a8af0](https://github.com/dreamiurg/mountaineers-assistant/commit/b7a8af0f320c35293f82af3237d67356fcec385a))

## [0.4.3](https://github.com/dreamiurg/mountaineers-assistant/compare/v0.4.2...v0.4.3) (2026-01-12)


### Bug Fixes

* skip release-please release creation, create manually ([#49](https://github.com/dreamiurg/mountaineers-assistant/issues/49)) ([caa1744](https://github.com/dreamiurg/mountaineers-assistant/commit/caa1744a607313d4c446aa6e19db27b684783fa8))

## [0.4.2](https://github.com/dreamiurg/mountaineers-assistant/compare/v0.4.1...v0.4.2) (2026-01-12)


### Bug Fixes

* set draft option in release-please action, not config ([#47](https://github.com/dreamiurg/mountaineers-assistant/issues/47)) ([9fe395a](https://github.com/dreamiurg/mountaineers-assistant/commit/9fe395ac5e98ca2e5e61405d5421088a98777902))

## [0.4.1](https://github.com/dreamiurg/mountaineers-assistant/compare/v0.4.0...v0.4.1) (2026-01-12)


### Bug Fixes

* create draft releases to allow asset uploads ([#45](https://github.com/dreamiurg/mountaineers-assistant/issues/45)) ([1daa515](https://github.com/dreamiurg/mountaineers-assistant/commit/1daa5158b3907bed6b05fe367d96f6ac8d777df4))

## [0.4.0](https://github.com/dreamiurg/mountaineers-assistant/compare/v0.3.0...v0.4.0) (2026-01-12)


### Features

* display shared activities on member profile pages ([#43](https://github.com/dreamiurg/mountaineers-assistant/issues/43)) ([1b63ae0](https://github.com/dreamiurg/mountaineers-assistant/commit/1b63ae0032771d52ca3bddeff79088e986dd601e))

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
