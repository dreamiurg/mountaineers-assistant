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
- **UI:** Tailwind CSS with React powering preferences and insights dashboards (Storybook mirrors these surfaces)
- **Storage:** `chrome.storage.local`
- **Build tooling:** Vite for bundling, Tailwind CLI (via `tailwindcss` package), Biome for formatting and linting
- **Package manager:** bun

## Architecture Overview

- `background.ts` listens for messages and injects `collect.ts` into the active mountaineers.org tab.
- `collect.ts` fetches the JSON activities endpoint, walks roster pages, and returns normalized payloads.
- The React preferences experience (under `preferences/`) exposes cache controls and preferences, while the React insights dashboard (under `insights/`) renders derived metrics and handles data refreshes.
- Data never leaves the browser; network calls target mountaineers.org using the current session.

## Directory Layout

```
src/
└─ chrome-ext/
   ├─ background.ts        # service worker entry point
   ├─ collect.ts           # content script injected on demand
   ├─ manifest.json        # extension manifest
   ├─ preferences.html     # preferences shell loaded by Chrome
   ├─ preferences-react-root.tsx # Entry point that mounts the React preferences app
   ├─ preferences/         # React preferences UI (components, hooks, services)
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

- Install dependencies with `bun install` (bun 1.0+ or Node 18+).
- Build the extension bundle with `bun run build` (runs Tailwind CLI then Vite into `dist/`).
- When iterating, re-run `bun run build:css` for Tailwind edits and start Vite with `bun run dev`.
- Use Storybook (`bun run storybook`) for component development; it shares the same Vite/Tailwind pipeline as the extension.
- Run `bun run typecheck` to validate TypeScript changes before packaging.
- Run `bun run storybook:build` before shipping Storybook-facing component changes.
- Run release automation via `just release-bump <version>`, `just release-submit`, and `just release-publish <version>` (requires `just`, `gh`, and `zip`).
- Load the unpacked extension from `dist/` during development; rebuild before reloading in Chrome.
- Maintain the sanitized fixtures at `src/data/sample-activities.json`; keep their shape aligned with production payloads.
- Keep `manifest.json` version aligned with the extension version in `package.json`.
- Install Python tooling with `uv run pre-commit install`; run hooks via `uv run pre-commit run --all-files`.

### Commit Message Style Guide

Use the format `<prefix>: <summary in past tense>`, for example:
`fix: corrected timeout logic in API client`.

- Common prefixes: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `build`, `ci`, `perf`, `chore`.
- Use **lowercase** prefixes and **past tense** verbs (e.g., “added,” “fixed”).
- Keep the first line under ~60 characters, without punctuation.
- Focus on **what changed**, not why; add a short body only if needed.
- Avoid vague language like "updated code" or "made improvements."
- Example: `feat: added dark mode toggle in settings`.

## Quality Gates

- Run `bun run format` before committing to apply Biome formatting.
- Run `bun run lint` to check code quality with Biome.
- Run `bun run typecheck` to ensure the TypeScript sources compile without errors.
- `pre-commit` hooks enforce Biome formatting/linting and gitleaks secret scanning.
- Use `uv run pre-commit run --all-files` before submitting if hooks are not configured locally.
- Biome config lives in `biome.json`; update globals or linter rules there when introducing new APIs.
- When committing, prefer descriptive, sentence-style subjects (e.g., "Introduced a Vite-powered build so the extension bundles to dist/").

## Agent Checklist

- Before returning results, run `uv run pre-commit run --all-files` and resolve every reported issue.
- Follow the architectural outline above when extending the extension.
- Document breaking changes in `README.md`.
- Update Tailwind build step if stylesheets or entry points move.
- Use `bun run test:chrome-extension:update-snapshots` to regenerate Playwright-backed extension snapshots (they seed the extension with `src/data/sample-activities.json` and block external network calls).
- Keep instructions in this file synchronized with actual tooling to avoid confusing future automations.
