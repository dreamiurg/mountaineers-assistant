# Contributing to Mountaineers Assistant

Thank you for your interest in contributing! This guide covers everything you need to know to set up your development environment and make contributions.

## Table of Contents

- [Development Setup](#development-setup)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Code Quality](#code-quality)
- [Release Process](#release-process)

## Development Setup

### Prerequisites

**Bun 1.0+** (recommended) or Node.js 18+

Install bun:

```bash
# macOS/Linux
curl -fsSL https://bun.sh/install | bash

# Or with Homebrew
brew install oven-sh/bun/bun

bun --version  # Should be 1.0+
```

### Install Dependencies

```bash
bun install
```

### Install Pre-commit Hooks

This project uses [pre-commit](https://pre-commit.com/) to automatically run code quality checks before each commit.

**Prerequisites:**

- [uv](https://docs.astral.sh/uv/) - Fast Python package installer

**Install uv (if not already installed):**

```bash
# macOS/Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Or with Homebrew
brew install uv
```

**Install pre-commit hooks:**

```bash
uv run pre-commit install
```

This sets up hooks that will automatically run on every `git commit`:

- **Biome** - Auto-formats code and lints JavaScript/TypeScript
- **detect-secrets** - Prevents committing secrets
- **TypeScript** - Validates types

**Run hooks manually (optional):**

```bash
uv run pre-commit run --all-files
```

### Build the Extension

```bash
bun run build
```

This compiles TypeScript, processes CSS with Tailwind, and bundles everything into `dist/`.

### Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `dist/` directory

**Important:** Reload the extension in `chrome://extensions` after every rebuild to pick up changes.

### Development Mode

For continuous development with auto-rebuild:

```bash
bun x vite build --watch
```

This keeps `dist/` up to date. You still need to reload the extension in Chrome after each change.

## Architecture

### Tech Stack

- **TypeScript + React** - Type-safe UI development
- **Tailwind CSS** - Utility-first styling
- **Vite** - Fast bundling and dev server
- **Biome** - Fast formatting and linting
- **Storybook** - Isolated component development
- **Playwright** - End-to-end testing
- **Manifest V3** - Latest Chrome extension standard

### Key Architectural Decisions

#### Offscreen Document Pattern

The extension uses Chrome's [Offscreen Document API](https://developer.chrome.com/docs/extensions/reference/api/offscreen) to fetch and parse activity data:

**Why?**

- Offscreen documents have access to DOM APIs (needed for HTML parsing)
- Can make authenticated requests using browser's session cookies
- Runs without requiring a specific tab to be open

#### Message Passing Flow

```
User clicks "Fetch" → insights page
  ↓ sends message
background.ts (receives 'start-refresh')
  ↓ calls ensureOffscreenDocument()
  ↓ sends message to offscreen
offscreen.ts (receives 'offscreen-collect')
  ↓ fetches data, parses HTML
  ↓ sends progress updates
background.ts (receives progress, broadcasts)
  ↓ saves to storage
insights page (receives progress, updates UI)
```

## Project Structure

```
mountaineers-assistant/
├─ src/
│  └─ chrome-ext/
│     ├─ background.ts              # Service worker: manages offscreen document
│     ├─ offscreen.html             # Offscreen document shell
│     ├─ offscreen.ts               # Data collection logic
│     ├─ manifest.json              # Extension manifest (MV3)
│     ├─ insights.html              # Insights dashboard shell
│     ├─ insights-react-root.tsx    # React entry point
│     ├─ insights/                  # Dashboard components & hooks
│     │  ├─ components/             # React components
│     │  ├─ hooks/                  # Custom hooks
│     │  └─ utils/                  # Utilities
│     ├─ preferences.html           # Preferences shell
│     ├─ preferences-react-root.tsx # React entry point
│     ├─ preferences/               # Preferences UI
│     ├─ shared/                    # Shared types & utilities
│     ├─ types/                     # TypeScript type declarations
│     └─ styles/                    # Tailwind sources
├─ tests/
│  ├─ unit/                         # Unit tests
│  └─ chrome-extension/             # Chrome extension tests
├─ src/data/                        # Test fixtures
├─ dist/                            # Build output (gitignored)
└─ docs/                            # Documentation
```

## Development Workflow

### Making Changes

1. **Create a feature branch**

   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes**
   - Follow existing code patterns
   - Add tests for new functionality
   - Update documentation if needed

3. **Test your changes**

   ```bash
   bun run typecheck    # TypeScript validation
   bun run lint         # Code formatting check
   bun test             # All tests (unit + chrome extension)
   ```

   **Test Organization:**
   - `tests/unit/` - Unit tests with Node.js test runner
   - `tests/chrome-extension/` - Chrome extension tests with Playwright
     - `*-visual.spec.ts` - Visual regression tests (snapshot comparisons)
     - `*.spec.ts` (without -visual) - Behavioral/functional tests

   **Run specific test suites:**

   ```bash
   bun run test:unit                         # Unit tests only
   bun run test:chrome-extension             # Chrome extension tests only
   bun run test:chrome-extension:update-snapshots  # Update visual snapshots
   bun x playwright test --grep-invert visual  # Behavioral tests only (skip snapshots)
   ```

4. **Commit your changes**
   - Pre-commit hooks will automatically run checks
   - Use conventional commit format: `feat:`, `fix:`, `docs:`, etc.

5. **Push and create PR**
   ```bash
   git push origin feat/your-feature-name
   # Create PR on GitHub
   ```

### Component Development with Storybook

For UI work, use Storybook for isolated component development:

```bash
bun run storybook
```

This opens a local server where you can develop and test components without loading the full extension.

## Testing

### Unit Tests

Located in `tests/unit/`, use Node.js test runner:

```bash
bun test
# or run specific test
bun x tsx --test tests/unit/your-test.test.ts
```

### Chrome Extension Tests

Located in `tests/chrome-extension/`, use Playwright:

```bash
# First time setup
bun x playwright install

# Run chrome extension tests
bun run test:chrome-extension

# Update snapshots after UI changes
bun run test:chrome-extension:update-snapshots
```

**What chrome extension tests do:**

- Load extension into Chromium browser
- Block all external network calls (tests run in isolation)
- Seed storage with sample data from `src/data/sample-activities.json`
- Take visual snapshots of preferences and insights pages
- Verify UI renders correctly
- Test fetch workflows and offscreen document lifecycle

### Test Data

Sample data lives in `src/data/sample-activities.json`. Update this file when you need to test new scenarios or edge cases.

## Code Quality

### Pre-commit Hooks

Pre-commit hooks automatically run on every `git commit` (after installing per setup instructions above).

**What runs automatically:**

- **Biome** - Auto-formats code and lints JavaScript/TypeScript (modifies files)
- **detect-secrets** - Prevents committing secrets
- **TypeScript** - Validates types

**If hooks aren't running:**

```bash
# Ensure hooks are installed
uv run pre-commit install

# Run manually to test
uv run pre-commit run --all-files
```

### Manual Commands

```bash
bun run format      # Apply Biome formatting
bun run lint        # Check code quality with Biome (CI mode)
bun run typecheck   # Validate TypeScript
```

## Release Process

Releases are automated using [release-please](https://github.com/googleapis/release-please).

### How It Works

1. **Write conventional commits** - Use prefixes like `feat:`, `fix:`, `docs:`, etc.
2. **Push to main** - Release-please automatically creates/updates a Release PR
3. **Merge the Release PR** - This triggers the release workflow which:
   - Creates a git tag
   - Updates `CHANGELOG.md`
   - Bumps versions in `package.json` and `manifest.json`
   - Builds and packages the extension
   - Creates a GitHub Release with the ZIP attached

### Commit Message Format

Release-please uses [Conventional Commits](https://www.conventionalcommits.org/) to determine version bumps:

| Prefix | Version Bump | Example |
|--------|-------------|---------|
| `feat:` | Minor (0.x.0) | `feat: add dark mode toggle` |
| `fix:` | Patch (0.0.x) | `fix: resolve cache persistence issue` |
| `feat!:` or `BREAKING CHANGE:` | Major (x.0.0) | `feat!: redesign preferences UI` |
| `docs:`, `chore:`, `refactor:` | No release | `docs: update README` |

### Manual Chrome Web Store Upload

After a GitHub Release is created, manually upload to Chrome Web Store:

1. **Download the ZIP** from the [GitHub Release](https://github.com/dreamiurg/mountaineers-assistant/releases)
2. **Open [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)**
3. **Upload new version** - Select the extension and upload the ZIP
4. **Submit for review** - Google typically reviews within a few hours to days

**Note:** Only maintainers with Chrome Web Store publisher access can complete this step.

### Version Numbering

Follow [Semantic Versioning](https://semver.org/):

- **Major** (1.0.0) - Breaking changes
- **Minor** (0.2.0) - New features, backwards compatible
- **Patch** (0.1.8) - Bug fixes

## Questions?

- Check existing [issues](https://github.com/dreamiurg/mountaineers-assistant/issues)
- Start a [discussion](https://github.com/dreamiurg/mountaineers-assistant/discussions)
