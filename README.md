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
npm run build:css
```

`npm run build:css` compiles Tailwind source from `src/chrome-ext/styles/` to `src/chrome-ext/tailwind.css`. Re-run it whenever you change CSS classes or Tailwind configuration.

### Load the Extension in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select `src/chrome-ext/`.

After each code or style update, rebuild CSS if needed and click **Reload** from the extensions page to pick up changes.

## Project Layout

```
mountaineers-assistant/
├─ src/
│  └─ chrome-ext/
│     ├─ background.js        # Service worker: handles refresh requests, caches results in storage.
│     ├─ collect.js           # Injected content script: calls Mountaineers APIs and parses roster pages.
│     ├─ manifest.json        # Manifest V3 definition.
│     ├─ options.html/js      # Options view for inspecting cached JSON.
│     ├─ popup.html/js        # Popup UI with live counts and refresh controls.
│     ├─ insights.html/js     # Derived statistics and insight views.
│     └─ styles/              # Tailwind sources compiled into tailwind.css.
├─ package.json               # npm scripts and extension metadata.
├─ package-lock.json
├─ .pre-commit-config.yaml    # Pre-commit hook definitions (Prettier, ESLint, gitleaks).
└─ README.md
```

## Tooling & Quality Gates

- `npm run format` writes Prettier formatting for JS, HTML, and CSS under `src/`.
- `npm run lint` runs Prettier in check mode (fails on formatting drift).
- `uv run pre-commit install` installs the pinned hook environment; run `uv run pre-commit run --all-files` before submitting changes if hooks are not installed locally.
- Keep the version in `src/chrome-ext/manifest.json` in sync with `package.json` when cutting releases.

## Workflow Tips

- Background scripts reload when you click **Reload** on the extensions page; content scripts require refreshing the Mountaineers tab as well.
- Use the browser DevTools service worker and content script consoles for debugging network calls and storage updates.
- When introducing new APIs, update `.eslintrc.json` (e.g., globals) so lint checks continue to pass.
