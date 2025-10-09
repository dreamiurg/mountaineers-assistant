# Mountaineers Assistant

Mountaineers Assistant is a Chrome extension (Manifest V3) that brings your Mountaineers.org activity history and quick insights directly into the site.

## Capabilities

- Fetches Mountaineers activity JSON and roster pages from the active tab using your signed-in browser session.
- Persists normalized data in `chrome.storage.local` so insights remain available offline.

## Development Setup

## Tech Stack

- TypeScript + React
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Vite](https://vitejs.dev/) for bundling and local development
- [Storybook](https://storybook.js.org/) for isolated component work

### Prerequisites

- Node.js 18 or newer
- `npm`

Install the pinned Node version with Homebrew if needed:

```bash
brew install node@18
npm --version
```

### Install & build

```bash
npm install
npm run build
```

`npm run build` runs Tailwind CSS and bundles the extension into `dist/` via Vite. Run it after any change to TypeScript/JavaScript, Tailwind sources, or static assets so Chrome loads the latest bundle.

### Load the extension

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and choose the freshly built `dist/` directory.

Reload the unpacked extension in `chrome://extensions` after every rebuild so Chrome’s service worker, popup, and preferences page pick up the latest bundle.

### Iterate quickly

- `npm run dev` starts the Vite development server and rebuilds bundles as you save (served at `http://localhost:5173/`).
- `npm run build:css` quickly refreshes `src/chrome-ext/tailwind.css` without touching the rest of the bundle
- `npm run build` does a full extension rebuild into `dist/` (Tailwind CSS compilation included)
- `npx vite build --watch` writes incremental bundles to `dist/` if you prefer a watch-only workflow.

## Storybook

```bash
npm run storybook
```

Storybook consumes the compiled stylesheet at `src/chrome-ext/tailwind.css`. Run `npm run build:css` before launching Storybook (and whenever you change Tailwind tokens) so the utilities are up to date. Use `npm run storybook:build` to generate a static bundle in `storybook-static/` for documentation or design review.

## Extension UI Snapshots

- Run `npx playwright install` once to download the Chromium build Playwright uses to exercise the extension.
- `npm run test:extension` seeds `chrome.storage.local` with `src/data/sample-activities.json`, launches Chromium with the MV3 bundle from `dist/`, blocks all outbound network traffic, and captures deterministic screenshots of the popup (`popup.html`), preferences (`preferences.html`), and insights dashboard (`insights.html`).
- Regenerate baselines after intentional UI updates with `npm run test:extension:update`.
- Snapshot artifacts live under `tests/extension-snapshots.spec.ts-snapshots/`; Playwright drops comparison diffs and traces under `test-results/` when assertions fail (ignored by git via `.gitignore`).

## Sample Data Fixtures

- Sanitized fixtures now live at `src/data/sample-activities.json` and mirror the structure returned by Mountaineers APIs.
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
├─ src/data/               # Sanitized Storybook/Playwright fixtures.
├─ dist/                   # Generated MV3 bundle emitted by Vite (not checked in).
├─ package.json               # npm scripts and extension metadata.
├─ package-lock.json
├─ .pre-commit-config.yaml    # Pre-commit hook definitions (Prettier, ESLint, gitleaks).
└─ README.md
```

## Quality Gates & Tooling

- `npm run format` applies Prettier to JS/TS, HTML, and CSS under `src/`.
- `npm run lint` runs Prettier in check mode and fails on formatting drift.
- `npm run typecheck` validates the TypeScript sources with the project `tsconfig`.
- `npm run test:extension` runs the Playwright-driven MV3 snapshot suite against the built bundle.
- `npm run test:dashboards` is currently experimental while the snapshot pipeline transitions to Storybook-driven checks.
- `uv run pre-commit install` installs the pinned hook environment; run `uv run pre-commit run --all-files` if hooks are not installed locally.
- Keep the version in `src/chrome-ext/manifest.json` in sync with `package.json` when cutting releases.
