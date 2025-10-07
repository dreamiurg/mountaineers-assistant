# AGENTS.md

Guidance for future contributors, automations, or agents working on **Mountaineers Assistant**.

## Project Identity

- **Name:** Mountaineers Assistant
- **Type:** Chrome extension (Manifest V3)
- **Purpose:** Fetch a member's Mountaineers activity history within the browser and surface quick insights without leaving mountaineers.org.

## Critical Rules

- Never run `git commit`, `git push`, or other history-changing git commands unless the user asks for them in the current task.

## Technologies

- **Platform:** Chrome Extension Manifest V3
- **Language:** Vanilla JavaScript (ES2021)
- **UI:** Tailwind CSS, HTML templates rendered via DOM APIs
- **Storage:** `chrome.storage.local`
- **Build tooling:** Vite for bundling, Tailwind CLI (via `tailwindcss` npm package), Prettier for formatting, ESLint for linting
- **Package manager:** npm

## Architecture Overview

- `background.js` listens for popup messages and injects `collect.js` into the active mountaineers.org tab.
- `collect.js` fetches the JSON activities endpoint, walks roster pages, and returns normalized payloads.
- `popup.js` surfaces counts and kicks off refreshes.
- `options.js` and `stats.js` render cached JSON and derived metrics for deeper inspection.
- Data never leaves the browser; network calls target mountaineers.org using the current session.

## Directory Layout

```
design/
├─ dashboard.html          # Primary design prototype powered by sample-data.json
├─ sample-data.json        # Faker-generated dataset mirroring production schema
└─ …                       # Additional experimental dashboards as needed

src/
└─ chrome-ext/
   ├─ background.js        # service worker entry point
   ├─ collect.js           # content script injected on demand
   ├─ manifest.json        # extension manifest
   ├─ options.html/js      # detailed JSON viewer
   ├─ popup.html/js        # quick status and refresh button
   ├─ stats.html/js        # derived statistics view
   └─ styles/              # Tailwind source (compiled to tailwind.css)
dist/                      # Bundled extension output produced by Vite (gitignored)
```

## Developer Workflow

- Install dependencies with `npm install` (Node 18+).
- Build the extension bundle with `npm run build` (runs Tailwind CLI then Vite into `dist/`).
- When iterating, re-run `npm run build:css` for Tailwind edits and start Vite with `npm run dev`.
- Load the unpacked extension from `dist/` during development; rebuild before reloading in Chrome.
- Maintain the sanitized sample dataset at `design/sample-data.json`; keep its shape aligned with production payloads.
- Serve `design/dashboard.html` via the local server (`npm run dev:design`) so the page can fetch `sample-data.json` during development.
- Keep `manifest.json` version aligned with the extension version in `package.json`.
- Install Python tooling with `uv run pre-commit install`; run hooks via `uv run pre-commit run --all-files`.

## Quality Gates

- Run `npm run format` before committing to apply Prettier.
- `pre-commit` hooks enforce Prettier, ESLint (with `chrome` globals), and gitleaks secret scanning.
- Use `uv run pre-commit run --all-files` before submitting if hooks are not configured locally.
- ESLint config lives in `.eslintrc.json`; update globals or environment settings there when introducing new APIs.

## Agent Checklist

- Follow the architectural outline above when extending the extension.
- Document breaking changes in `README.md`.
- Update Tailwind build step if stylesheets or entry points move.
- Always run `npm run test:dashboards` (wrapper over `scripts/snapshot-dashboards.js`) immediately after any design change, and verify the refreshed PNGs in `artifacts/dashboards/` before considering the work complete.
- Keep instructions in this file synchronized with actual tooling to avoid confusing future automations.
