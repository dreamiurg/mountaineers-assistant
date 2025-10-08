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
- **Language:** TypeScript targeting modern Chrome (ES2021)
- **UI:** Tailwind CSS with React powering popup, options, and insights dashboards (Storybook mirrors these surfaces)
- **Storage:** `chrome.storage.local`
- **Build tooling:** Vite for bundling, Tailwind CLI (via `tailwindcss` npm package), Prettier for formatting, ESLint for linting
- **Package manager:** npm

## Architecture Overview

- `background.ts` listens for popup messages and injects `collect.ts` into the active mountaineers.org tab.
- `collect.ts` fetches the JSON activities endpoint, walks roster pages, and returns normalized payloads.
- The React popup (under `popup/`) surfaces counts and kicks off refreshes.
- The React options experience (under `options/`) exposes cache controls and preferences, while the React insights dashboard (under `insights/`) renders derived metrics for deeper inspection.
- Data never leaves the browser; network calls target mountaineers.org using the current session.

## Directory Layout

```
src/
└─ chrome-ext/
   ├─ background.ts        # service worker entry point
   ├─ collect.ts           # content script injected on demand
   ├─ manifest.json        # extension manifest
   ├─ options.html         # options shell loaded by Chrome
   ├─ options-react-root.tsx # Entry point that mounts the React options app
   ├─ options/             # React options UI (components, hooks, services)
   ├─ popup.html           # quick status shell for the popup
   ├─ popup-react-root.tsx  # Entry point that mounts the React popup
   ├─ popup/               # React popup UI (components, hooks, services)
   ├─ insights.html        # insights shell loaded by Chrome
   ├─ insights-react-root.tsx # Entry point that mounts the React insights dashboard
   ├─ insights/            # React insights UI (components, hooks, utilities)
   ├─ stories/             # Shared Storybook helpers and mocks
   ├─ shared/              # TypeScript models shared across scripts
   ├─ types/               # Ambient declarations for MV3 globals
   └─ styles/              # Tailwind source (compiled to tailwind.css)
src/data/                 # Sanitized JSON fixtures consumed by Storybook/tests
dist/                      # Bundled extension output produced by Vite (gitignored)
```

## Developer Workflow

- Install dependencies with `npm install` (Node 18+).
- Build the extension bundle with `npm run build` (runs Tailwind CLI then Vite into `dist/`).
- When iterating, re-run `npm run build:css` for Tailwind edits and start Vite with `npm run dev`.
- Use Storybook (`npm run storybook`) for component development; it shares the same Vite/Tailwind pipeline as the extension.
- Run `npm run typecheck` to validate TypeScript changes before packaging.
- Run `npm run storybook:build` before shipping Storybook-facing component changes.
- Load the unpacked extension from `dist/` during development; rebuild before reloading in Chrome.
- Maintain the sanitized fixtures at `src/data/sample-activities.json`; keep their shape aligned with production payloads.
- Keep `manifest.json` version aligned with the extension version in `package.json`.
- Install Python tooling with `uv run pre-commit install`; run hooks via `uv run pre-commit run --all-files`.

## Quality Gates

- Run `npm run format` before committing to apply Prettier.
- Run `npm run typecheck` to ensure the TypeScript sources compile without errors.
- `pre-commit` hooks enforce Prettier, ESLint (with `chrome` globals), and gitleaks secret scanning.
- Use `uv run pre-commit run --all-files` before submitting if hooks are not configured locally.
- ESLint config lives in `eslint.config.mjs`; update globals or environment settings there when introducing new APIs.
- When committing, prefer descriptive, sentence-style subjects (e.g., “Introduced a Vite-powered build so the extension bundles to dist/”).

## Agent Checklist

- Follow the architectural outline above when extending the extension.
- Document breaking changes in `README.md`.
- Update Tailwind build step if stylesheets or entry points move.
- The Playwright UI snapshot script (`npm run test:dashboards`) is being migrated to Storybook-driven checks; treat its output as experimental until the migration is complete.
- Keep instructions in this file synchronized with actual tooling to avoid confusing future automations.
