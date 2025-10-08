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

Reload the unpacked extension in `chrome://extensions` after every rebuild so Chrome’s service worker, popup, and options pages pick up the latest bundle.

### Iterate quickly

- `npm run dev` starts the Vite development server and rebuilds bundles as you save (served at `http://localhost:5173/`).
- `npm run build:css` regenerates Tailwind output; run `npm run build` afterward to copy the CSS into `dist/`.
- `npx vite build --watch` writes incremental bundles to `dist/` if you prefer a watch-only workflow.

## Storybook

```bash
npm run storybook
```

Storybook reuses the Vite/Tailwind pipeline and provides Chrome API mocks so you can refine React components without loading the full extension. Use `npm run storybook:build` to generate a static bundle in `storybook-static/` for documentation or design review.

## UI Snapshot Pipeline (WIP)

- Run `npx playwright install` once to download the bundled Chromium required for automated checks.
- `npm run test:dashboards` is being migrated to capture Storybook-rendered UI states; treat it as experimental until the migration completes.
- Screenshots, console logs, and HTML dumps will land under `artifacts/` so automated reviews (including LLM-based checks) can inspect the rendered UI without launching Chrome manually.

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
│     ├─ options.html         # Options shell loaded by Chrome.
│     ├─ options-react-root.tsx # Entry point that mounts the React options experience.
│     ├─ options/             # React options application (components, hooks, services).
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
- `npm run test:dashboards` is currently experimental while the snapshot pipeline transitions to Storybook-driven checks.
- `uv run pre-commit install` installs the pinned hook environment; run `uv run pre-commit run --all-files` if hooks are not installed locally.
- Keep the version in `src/chrome-ext/manifest.json` in sync with `package.json` when cutting releases.
