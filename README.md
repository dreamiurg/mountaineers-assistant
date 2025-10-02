# Mountaineers Assistant

Mountaineers Assistant is a Chrome extension that keeps Mountaineers activity history a click away. It runs entirely in the browser: the background service worker reuses your authenticated `mountaineers.org` session, fetches activities plus roster details, and stores them in `chrome.storage.local` so you can inspect or refresh the data without leaving the site.

## Features
- Refresh your personal activity catalog from any authenticated Mountaineers tab.
- Cache activities, people, and roster entries locally for offline inspection.
- Inspect raw JSON in the options page or jump straight to the stats dashboard.
- Tailwind-powered UI with popup summaries and a richer stats view.

## Getting Started

1. Install Node.js 18+.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the Tailwind bundle (rerun after editing CSS classes):
   ```bash
   npm run build:css
   ```
4. Load the extension:
   - Open `chrome://extensions`.
   - Enable **Developer mode**.
   - Click **Load unpacked** and choose `src/chrome-ext/` from this project.

## Development Workflow
- `src/chrome-ext/collect.js` holds the injected content script that calls the Mountaineers JSON APIs and parses roster pages.
- `src/chrome-ext/background.js` orchestrates refresh requests and caches results in `chrome.storage.local`.
- `src/chrome-ext/popup.js` and `popup.html` power the quick-glance UI, while `options.html` and `stats.html` expose the full dataset and derived insights.
- Run `npm run format` to apply Prettier to JS, HTML, and CSS files.
- Pre-commit hooks (`pre-commit run --all-files`) execute formatting, ESLint, and secret scanning.

```
mountaineers-assistant/
├─ src/
│  └─ chrome-ext/
│     ├─ background.js
│     ├─ collect.js
│     ├─ manifest.json
│     ├─ popup.html / popup.js
│     ├─ options.html / options.js
│     ├─ stats.html / stats.js
│     └─ styles/
├─ package.json
├─ package-lock.json
├─ .prettierrc.json
├─ .pre-commit-config.yaml
└─ README.md
```

## Pre-commit Hooks
Install `pre-commit` and register the hooks once:
```bash
pre-commit install
```
The configured hooks run Prettier, ESLint (with `chrome` globals enabled), and gitleaks.
