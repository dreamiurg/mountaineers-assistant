# Mountaineers Assistant

Mountaineers Assistant is a Chrome extension that improves your Mountaineers.org experience by adding features the site does not offer.

## Table of Contents

- [Features](#features)
- [Privacy](#privacy)
- [Development Setup](#development-setup)
  - [Tech Stack](#tech-stack)
  - [Prerequisites](#prerequisites)
  - [Install Dependencies & Build](#install-dependencies--build)
  - [Load the Extension](#load-the-extension)
  - [Automatic Rebuilds](#automatic-rebuilds)
  - [Storybook](#storybook)
- [Automated Testing](#automated-testing)
- [Sample Data Fixtures](#sample-data-fixtures)
- [Project Layout](#project-layout)
- [Release Workflow](#release-workflow)
- [Cheatsheet](#cheatsheet)

## Features

- Refresh your Mountaineers activity history using your current signed-in session.
- Explore a dedicated insights dashboard that visualizes your activity history, with powerful filters for type, category, and your role in each event.

![Insights dashboard screenshot](tests/extension-snapshots.spec.ts-snapshots/insights-default-chromium-extension-darwin.png)

## Privacy

All your data is stored locally in your browser and never sent to external servers.

## Development Setup

If you would like to contribute to this extension, here's what you may want to know.

### Tech Stack

- TypeScript + React
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Vite](https://vitejs.dev/) for bundling and local development
- [Storybook](https://storybook.js.org/) for isolated component work

### Prerequisites

Install the pinned Node version with Homebrew if needed:

```bash
brew install node@18
npm --version
```

### Install Dependencies & Build

```bash
npm install
npm run build
```

`npm run build` compiles TypeScript, minifies the CSS, and bundles the extension into `dist/`.

### Load the Extension

1. Open [`chrome://extensions`](chrome://extensions).
2. Enable **Developer mode**.
3. Click **Load unpacked** and choose the freshly built `dist/` directory.

Reload the unpacked extension in `chrome://extensions` after every rebuild so Chrome’s service worker, popup, and preferences page pick up the latest bundle.

### Automatic Rebuilds

For continuous development, use Vite autorebuild:

```bash
npx vite build --watch
```

This keeps the output in `dist/` up to date without manual rebuilds. Reload the extension in Chrome after each change to see updates.

### Storybook

If you prefer Storybook-style development, React components have stories as well. Run Storybook and explore in your browser:

```bash
npm run storybook
```

## Automated Testing

In addition to standard pre-commit checks for linting and formatting, this extension includes an automated test suite powered by Playwright. When run, tests verify that the main UI features of the [popup](src/chrome-ext/popup.html), [preferences](src/chrome-ext/preferences.html), and [insights](src/chrome-ext/insights.html) pages are working and that the UI looks as expected.

Here’s what you need to know:

- Run `npx playwright install` once to download the Chromium build Playwright uses to exercise the extension.
- `npm run test:extension` seeds `chrome.storage.local` with `src/data/sample-activities.json`, launches Chromium with the MV3 bundle from `dist/`, blocks all outbound network traffic, and captures deterministic screenshots of the popup (`popup.html`), preferences (`preferences.html`), and insights dashboard (`insights.html`).
- Regenerate baselines after intentional UI updates with `npm run test:extension:update`.
- Snapshot artifacts live under `tests/extension-snapshots.spec.ts-snapshots/`; Playwright drops comparison diffs and traces under `test-results/` when assertions fail.

## Sample Data Fixtures

- Sanitized fixtures live at `src/data/sample-activities.json` and mirror the structure returned by Mountaineers APIs.
- Storybook stories and Playwright tests import this file directly; update it whenever you need to cover new scenarios or edge cases.

## Project Layout

```
mountaineers-assistant/
├─ src/
│  └─ chrome-ext/
│     ├─ background.ts        # Service worker: handles refresh requests and caches results in storage.
│     ├─ collect.ts           # Injected content script: calls Mountaineers APIs and parses roster pages.
│     ├─ manifest.json        # Manifest V3 definition.
│     ├─ preferences.html     # Preferences shell loaded by Chrome.
│     ├─ preferences-react-root.tsx # Entry point that mounts the React preferences experience.
│     ├─ preferences/         # React preferences application (components, hooks, services).
│     ├─ popup.html           # Popup shell loaded by Chrome.
│     ├─ popup-react-root.tsx  # Entry point that mounts the React popup experience.
│     ├─ popup/               # React popup application (components, hooks, services).
│     ├─ insights.html        # Activity insights shell loaded by Chrome.
│     ├─ insights-react-root.tsx # Entry point that mounts the React insights experience.
│     ├─ insights/            # React insights dashboard (components, hooks, utilities).
│     ├─ shared/              # Reusable TypeScript models shared across scripts.
│     ├─ types/               # Ambient type declarations consumed by content scripts.
│     └─ styles/              # Tailwind sources compiled into tailwind.css.
├─ src/data/                  # Sanitized Storybook/Playwright fixtures.
├─ dist/                      # Generated MV3 bundle emitted by Vite (not checked in).
├─ package.json               # npm scripts and extension metadata.
├─ package-lock.json
├─ .pre-commit-config.yaml    # Pre-commit hook definitions (Prettier, ESLint, gitleaks).
└─ README.md
```

## Cheatsheet

- `npm run format` applies Prettier to JS/TS, HTML, and CSS under `src/`.
- `npm run lint` runs Prettier in check mode and fails on formatting drift.
- `npm run typecheck` validates the TypeScript sources with the project `tsconfig`.
- `npm run test:extension` runs the Playwright-driven MV3 snapshot suite against the built bundle.
- `uv run pre-commit install` installs the pinned hook environment; run `uv run pre-commit run --all-files` if hooks are not installed locally.
- Use `npm run publish -- <version>` to automate releases; rely on `npm run release` and `npm run package -- <version>` if you prefer manual control.

## Release Workflow

### One-command flow

1. Run `npm run publish -- <version>` (for example, `npm run publish -- 0.2.0`). The helper verifies a clean git state, bumps versions, runs the build, writes `mountaineers-assistant-<version>.zip` in the repo root, tags the commit, pushes branch and tag, and drafts a GitHub release (if the `gh` CLI is installed). Add `-v` (or `--verbose`) to see full command output.
2. Upload the generated ZIP to the Chrome Web Store to finish the release.

### Manual flow (if you prefer to control each step)

1. Start from a clean working tree (no staged or unstaged changes).
2. Run `npm run release` and enter the next semantic version when prompted. The script runs `npm run typecheck`, updates `package.json`, `package-lock.json`, and `src/chrome-ext/manifest.json`, then stages those files for you.
3. Review the staged diff, commit with your release message, and tag the commit (for example, `git tag v0.2.0`).
4. Package the release with `npm run package -- <version>` (for example, `npm run package -- 0.2.0`). The command rebuilds the extension and drops `mountaineers-assistant-<version>.zip` in the repository root, ready for Chrome Web Store upload or to attach to the GitHub release.
