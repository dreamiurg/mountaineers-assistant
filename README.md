# Mountaineers Assistant

Mountaineers Assistant is a Chrome extension (Manifest V3) that surfaces your Mountaineers.org activity history and quick insights directly within the site.

## Capabilities

- Fetches the Mountaineers activity JSON and roster pages from the active tab using your signed-in browser session.
- Persists fetched data in `chrome.storage.local` so insights remain available while offline.

## Development Setup

### Prerequisites

- Node.js 18 or newer
- npm (comes with Node.js)

### Install and Build

```bash
npm install
npm run build
```

`npm run build` runs the Tailwind CLI and bundles the extension into `dist/` via Vite. If you need to regenerate styles without producing a new bundle, `npm run build:css` is still available and writes `src/chrome-ext/tailwind.css`.

### Start the Vite Dev Server

```bash
npm run build:css   # run again whenever Tailwind sources change
npm run dev
```

Vite serves the extension surfaces on `http://localhost:5173/`. Open `/popup.html`, `/options.html`, or `/insights.html` to iterate quickly. Re-run `npm run build:css` in another terminal whenever you touch Tailwind source files until the styling pipeline is replaced.

### Load the Extension in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select the freshly built `dist/` directory.

Run `npm run build` before each reload so Chrome picks up the latest bundle output.

## Project Layout

```
mountaineers-assistant/
├─ design/                 # Standalone design prototypes and sanitized data snapshots.
├─ src/
│  └─ chrome-ext/
│     ├─ background.ts        # Service worker: handles refresh requests, caches results in storage.
│     ├─ collect.ts           # Injected content script: calls Mountaineers APIs and parses roster pages.
│     ├─ manifest.json        # Manifest V3 definition.
│     ├─ options.html/js      # Options view for inspecting cached JSON.
│     ├─ options-react-root.tsx # React bootstrap (placeholder; no DOM changes yet).
│     ├─ popup.html           # Popup shell loaded by Chrome.
│     ├─ popup-react-root.tsx  # Entry point that mounts the React popup experience.
│     ├─ popup/               # React popup application (components, hooks, services).
│     ├─ insights.html/js     # Derived statistics and insight views.
│     ├─ insights-react-root.tsx # React bootstrap (placeholder; no DOM changes yet).
│     ├─ shared/              # Reusable TypeScript models shared across scripts.
│     ├─ types/               # Ambient type declarations consumed by content scripts.
│     └─ styles/              # Tailwind sources compiled into tailwind.css.
├─ dist/                   # Generated MV3 bundle emitted by Vite (not checked in).
├─ package.json               # npm scripts and extension metadata.
├─ package-lock.json
├─ .pre-commit-config.yaml    # Pre-commit hook definitions (Prettier, ESLint, gitleaks).
└─ README.md
```

## Tooling & Quality Gates

- `npm run format` writes Prettier formatting for JS/TS, HTML, and CSS under `src/`.
- `npm run lint` runs Prettier in check mode (fails on formatting drift).
- `npm run typecheck` validates the TypeScript sources with the project `tsconfig`.
- `uv run pre-commit install` installs the pinned hook environment; run `uv run pre-commit run --all-files` before submitting changes if hooks are not installed locally.
- Keep the version in `src/chrome-ext/manifest.json` in sync with `package.json` when cutting releases.

## Dashboard Snapshot Pipeline

- Run `npx playwright install` once to download the bundled Chromium that powers the dashboard snapshots.
- `npm run test:dashboards` opens every HTML dashboard in `design/`, injects cached Highcharts assets, and fails if the page logs console errors or renders empty content.
- Screenshots land in `artifacts/dashboards/`; share the PNGs directly or ask Codex to `view_image` a specific file for quick review.
- Remote dependencies are cached into `artifacts/cache/` the first time the pipeline runs so subsequent executions work offline.

## Design Sandbox

- The `design/` directory houses standalone HTML experiments (e.g., `dashboard.html`) plus the sanitized dataset `sample-data.json` for safe iteration.
- Start a lightweight server so fetch requests succeed:
  ```bash
  npm run dev:design
  ```
  Then open `http://localhost:5500/dashboard.html`. Reload after editing HTML, CSS, or `sample-data.json`; the server supports live reload as soon as you refresh the browser.
- Update `design/sample-data.json` to prototype new data states; keep the schema aligned with production responses.
- Capture before/after comparisons with `npm run test:dashboards`, which now scans `design/` for HTML files and saves PNGs in `artifacts/dashboards/`.

## Workflow Tips

- Run hooks manually with `uv run pre-commit run --all-files`. The configured checks still cover Prettier, ESLint (with `chrome` globals enabled), and gitleaks.
- Background scripts reload when you click **Reload** on the extensions page; content scripts require refreshing the Mountaineers tab as well.
- Use the browser DevTools service worker and content script consoles for debugging network calls and storage updates.
- When introducing new APIs, update `.eslintrc.json` (e.g., globals) so lint checks continue to pass.
