# Release Workflow Refactor Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Split `release:prepare` into two commands (`release:bump` and `release:submit`) and automate release publishing via GitHub Actions.

**Architecture:** Refactor existing monolithic `release-prepare.js` into two separate scripts: `release-bump.js` (updates files locally) and `release-submit.js` (commits, pushes, creates draft PR). Add a GitHub Actions workflow that triggers on release PR merge to automatically build, tag, and create GitHub release. Keep `release:publish` as manual override.

**Tech Stack:** Node.js, GitHub CLI (gh), GitHub Actions

---

## Task 1: Create Changelog Parser Utility

**Files:**

- Create: `scripts/changelog-parser.js`
- Test: Manual verification with existing CHANGELOG.md

**Step 1: Write changelog parser with tests**

Create `scripts/changelog-parser.js`:

```javascript
const fs = require('fs');

/**
 * Extract a specific version section from CHANGELOG.md
 * @param {string} changelogPath - Path to CHANGELOG.md
 * @param {string} version - Version to extract (e.g., "0.1.8")
 * @returns {string} The changelog section for that version (without the ## [version] header)
 */
function extractVersionSection(changelogPath, version) {
  const content = fs.readFileSync(changelogPath, 'utf8');
  const lines = content.split('\n');

  const versionHeaderRegex = new RegExp(`^## \\[${escapeRegex(version)}\\]`);
  const nextVersionRegex = /^## \[/;

  let inSection = false;
  let sectionLines = [];

  for (const line of lines) {
    if (versionHeaderRegex.test(line)) {
      inSection = true;
      continue; // Skip the header line itself
    }

    if (inSection) {
      // Stop when we hit the next version section
      if (nextVersionRegex.test(line)) {
        break;
      }
      sectionLines.push(line);
    }
  }

  // Trim empty lines from start and end
  while (sectionLines.length > 0 && sectionLines[0].trim() === '') {
    sectionLines.shift();
  }
  while (sectionLines.length > 0 && sectionLines[sectionLines.length - 1].trim() === '') {
    sectionLines.pop();
  }

  return sectionLines.join('\n');
}

/**
 * Escape special regex characters
 * @param {string} str
 * @returns {string}
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  extractVersionSection,
};
```

**Step 2: Test the parser manually**

Run in Node REPL:

```bash
node -e "const {extractVersionSection} = require('./scripts/changelog-parser.js'); console.log(extractVersionSection('CHANGELOG.md', '0.1.7'));"
```

Expected output: The changelog content for version 0.1.7 (should include "### Added", etc.)

**Step 3: Commit**

```bash
git add scripts/changelog-parser.js
git commit -m "feat: add changelog parser utility"
```

---

## Task 2: Create release-bump.js Script

**Files:**

- Create: `scripts/release-bump.js`
- Reference: `scripts/release-prepare.js` (copy and modify)

**Step 1: Create release-bump.js from release-prepare.js**

Copy and modify:

```bash
cp scripts/release-prepare.js scripts/release-bump.js
```

Then edit `scripts/release-bump.js`:

Remove these functions:

- `commitReleaseFiles()`
- `pushReleaseBranch()`
- `createPullRequest()`

Modify the `main()` function to stop after `formatReleaseFiles()`:

```javascript
async function main() {
  ensureGhAvailable();

  const version = parseVersion();

  if (!version) {
    throw new Error('Version required. Usage: npm run release:bump <version>');
  }

  ensureCleanWorkingTree();
  ensureOnMain();

  const packageJsonPath = path.join(repoRoot, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const currentVersion = pkg.version;

  validateVersion(version, currentVersion);

  console.log(`\nPreparing release files for version ${version}...\n`);

  fetchLatest();
  const releaseBranch = createOrSwitchReleaseBranch(version);

  runTypecheck();
  bumpVersions(version);
  generateChangelogFile(version);
  formatReleaseFiles();

  console.log('='.repeat(60));
  console.log('Release files updated successfully!');
  console.log('='.repeat(60));
  console.log(`\nRelease branch: ${releaseBranch}`);
  console.log('\nModified files:');
  console.log('  - package.json');
  console.log('  - package-lock.json');
  console.log('  - src/chrome-ext/manifest.json');
  console.log('  - CHANGELOG.md');
  console.log('\nNext steps:');
  console.log('1. Review the changes (especially CHANGELOG.md)');
  console.log('2. Make any additional edits if needed');
  console.log('3. When ready, run: npm run release:submit');
  console.log('');
}
```

**Step 2: Test release-bump.js**

Test with a dry-run version (we'll clean up after):

```bash
node scripts/release-bump.js 0.1.8-test
```

Expected: Creates branch, updates files, stops without committing

**Step 3: Clean up test**

```bash
git checkout main
git branch -D release/v0.1.8-test 2>/dev/null || true
```

**Step 4: Commit**

```bash
git add scripts/release-bump.js
git commit -m "feat: add release-bump script for local file updates"
```

---

## Task 3: Create release-submit.js Script

**Files:**

- Create: `scripts/release-submit.js`
- Uses: `scripts/changelog-parser.js`

**Step 1: Create release-submit.js**

Create `scripts/release-submit.js`:

```javascript
#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { extractVersionSection } = require('./changelog-parser');

const repoRoot = path.resolve(__dirname, '..');

function runCommand(command, options = {}) {
  return execSync(command, {
    stdio: 'inherit',
    cwd: repoRoot,
    encoding: 'utf8',
    ...options,
  });
}

function getCommandOutput(command) {
  return execSync(command, {
    stdio: 'pipe',
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();
}

function ensureGhAvailable() {
  try {
    getCommandOutput('gh --version');
  } catch {
    throw new Error(
      'GitHub CLI (gh) is required but not found. Install from https://cli.github.com/'
    );
  }
}

function getCurrentBranch() {
  return getCommandOutput('git rev-parse --abbrev-ref HEAD');
}

function extractVersionFromBranch(branchName) {
  const match = branchName.match(/^release\/v(.+)$/);
  if (!match) {
    throw new Error(
      `Current branch "${branchName}" is not a release branch. ` +
        'Expected format: release/v<version>. ' +
        'Run "npm run release:bump <version>" first.'
    );
  }
  return match[1];
}

function hasModifiedFiles() {
  const status = getCommandOutput('git status --porcelain');
  return status.length > 0;
}

function stageReleaseFiles() {
  const packageJsonPath = 'package.json';
  const packageLockPath = 'package-lock.json';
  const manifestPath = 'src/chrome-ext/manifest.json';
  const changelogPath = 'CHANGELOG.md';

  console.log('Staging release files...');

  [packageJsonPath, packageLockPath, manifestPath, changelogPath].forEach((file) => {
    runCommand(`git add "${file}"`);
  });

  console.log('✓ Files staged\n');
}

function commitReleaseFiles(version) {
  console.log('Committing release files...');
  runCommand(`git commit -m "release: prepared v${version}"`);
  console.log(`✓ Committed release files\n`);
}

function pushReleaseBranch(branchName) {
  console.log(`Pushing ${branchName} to origin...`);

  try {
    runCommand('git push');
  } catch {
    // Branch might not have upstream set
    console.log('Setting upstream and pushing...');
    runCommand(`git push --set-upstream origin ${branchName}`);
  }

  console.log(`✓ Pushed ${branchName}\n`);
}

function getChangelogContent(version) {
  const changelogPath = path.join(repoRoot, 'CHANGELOG.md');

  if (!fs.existsSync(changelogPath)) {
    console.log('⚠️  CHANGELOG.md not found, PR will have generic description\n');
    return `Release v${version}`;
  }

  try {
    const changelogSection = extractVersionSection(changelogPath, version);
    if (!changelogSection) {
      console.log('⚠️  Could not extract changelog section, using generic description\n');
      return `Release v${version}`;
    }
    return changelogSection;
  } catch (error) {
    console.log(`⚠️  Error reading changelog: ${error.message}\n`);
    return `Release v${version}`;
  }
}

function createDraftPullRequest(version, branchName) {
  console.log('Creating draft pull request...');

  const title = `Release v${version}`;
  const body = getChangelogContent(version);

  try {
    const prUrl = getCommandOutput(
      `gh pr create --base main --head ${branchName} --title "${title}" --body "${body}" --draft`
    );
    console.log(`✓ Draft pull request created: ${prUrl}\n`);
    return prUrl;
  } catch (error) {
    // PR might already exist
    if (error.message && error.message.includes('already exists')) {
      console.log('⚠️  Pull request already exists for this branch\n');
      try {
        const prUrl = getCommandOutput(`gh pr view ${branchName} --json url --jq .url`);
        console.log(`   Existing PR: ${prUrl}\n`);
        return prUrl;
      } catch {
        console.log('   Run: gh pr list --head ' + branchName + '\n');
        return null;
      }
    }
    throw error;
  }
}

async function main() {
  ensureGhAvailable();

  const currentBranch = getCurrentBranch();
  const version = extractVersionFromBranch(currentBranch);

  if (!hasModifiedFiles()) {
    console.log('\n⚠️  No modified files found.');
    console.log('Did you run "npm run release:bump" first?\n');
    process.exit(1);
  }

  console.log(`\nSubmitting release for version ${version}...\n`);

  stageReleaseFiles();
  commitReleaseFiles(version);
  pushReleaseBranch(currentBranch);
  const prUrl = createDraftPullRequest(version, currentBranch);

  console.log('='.repeat(60));
  console.log('Release submitted successfully!');
  console.log('='.repeat(60));
  console.log(`\nRelease branch: ${currentBranch}`);
  if (prUrl) {
    console.log(`Draft PR: ${prUrl}`);
  }
  console.log('\nNext steps:');
  console.log('1. Review the draft PR and CI checks');
  console.log('2. Mark PR as ready for review when satisfied');
  console.log('3. Merge the PR when approved');
  console.log('4. GitHub Actions will automatically build and create the release');
  console.log('');
}

main().catch((error) => {
  console.error(`\nRelease submission failed: ${error.message}`);
  process.exitCode = 1;
});
```

**Step 2: Make script executable**

```bash
chmod +x scripts/release-submit.js
```

**Step 3: Commit**

```bash
git add scripts/release-submit.js
git commit -m "feat: add release-submit script for creating draft PRs"
```

---

## Task 4: Update package.json Scripts

**Files:**

- Modify: `package.json:12-13`

**Step 1: Update scripts section**

Edit `package.json` scripts section:

Change from:

```json
"release:prepare": "node scripts/release-prepare.js",
```

To:

```json
"release:bump": "node scripts/release-bump.js",
"release:submit": "node scripts/release-submit.js",
```

Keep existing `release:publish` and `release:package` as-is.

**Step 2: Verify with npm run**

```bash
npm run | grep release
```

Expected output should show:

- release:bump
- release:submit
- release:publish
- release:package

**Step 3: Commit**

```bash
git add package.json
git commit -m "refactor: split release:prepare into bump and submit commands"
```

---

## Task 5: Create GitHub Actions Workflow

**Files:**

- Create: `.github/workflows/release.yml`

**Step 1: Create .github directory structure**

```bash
mkdir -p .github/workflows
```

**Step 2: Create release.yml workflow**

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  pull_request:
    types: [closed]
    branches:
      - main

jobs:
  release:
    # Only run if PR was merged (not just closed) and branch is a release branch
    if: github.event.pull_request.merged == true && startsWith(github.event.pull_request.head.ref, 'release/v')

    runs-on: ubuntu-latest

    permissions:
      contents: write

    steps:
      - name: Extract version from branch name
        id: extract_version
        run: |
          BRANCH_NAME="${{ github.event.pull_request.head.ref }}"
          VERSION="${BRANCH_NAME#release/v}"
          echo "version=$VERSION" >> $GITHUB_OUTPUT
          echo "Extracted version: $VERSION"

      - name: Checkout code
        uses: actions/checkout@v4
        with:
          ref: main

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run typecheck
        run: npm run typecheck

      - name: Build extension
        run: npm run build

      - name: Package extension
        run: |
          VERSION="${{ steps.extract_version.outputs.version }}"
          cd dist
          zip -r "../mountaineers-assistant-${VERSION}.zip" .
          cd ..

      - name: Verify package exists
        run: |
          VERSION="${{ steps.extract_version.outputs.version }}"
          if [ ! -f "mountaineers-assistant-${VERSION}.zip" ]; then
            echo "Package file not found: mountaineers-assistant-${VERSION}.zip"
            exit 1
          fi
          echo "Package created successfully"

      - name: Extract changelog for this version
        id: changelog
        run: |
          VERSION="${{ steps.extract_version.outputs.version }}"
          node -e "
            const { extractVersionSection } = require('./scripts/changelog-parser.js');
            const content = extractVersionSection('CHANGELOG.md', '${VERSION}');
            const fs = require('fs');
            fs.writeFileSync('release-notes.txt', content);
          "
          echo "Changelog extracted for version ${VERSION}"

      - name: Create git tag
        run: |
          VERSION="${{ steps.extract_version.outputs.version }}"
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git tag -a "v${VERSION}" -m "Release v${VERSION}"
          git push origin "v${VERSION}"
          echo "Tag v${VERSION} created and pushed"

      - name: Create GitHub Release
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          VERSION="${{ steps.extract_version.outputs.version }}"
          RELEASE_NOTES=$(cat release-notes.txt)
          gh release create "v${VERSION}" \
            --title "Release v${VERSION}" \
            --notes "${RELEASE_NOTES}" \
            "mountaineers-assistant-${VERSION}.zip"
          echo "GitHub release created for v${VERSION}"
```

**Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "feat: add GitHub Actions workflow for automated releases"
```

---

## Task 6: Update Documentation (Optional Cleanup)

**Files:**

- Modify: `scripts/release-prepare.js` (mark as deprecated)

**Step 1: Add deprecation notice to release-prepare.js**

Add at the top of `scripts/release-prepare.js` after the shebang:

```javascript
console.warn(
  '\n⚠️  DEPRECATED: Use "npm run release:bump" followed by "npm run release:submit" instead.\n'
);
```

**Step 2: Commit**

```bash
git add scripts/release-prepare.js
git commit -m "docs: deprecate release-prepare.js in favor of bump/submit"
```

---

## Testing Plan

### Phase 1: Test Scripts Locally

1. **Test release:bump**

   ```bash
   # On main branch
   npm run release:bump 0.1.9-test
   # Verify files changed, no commit
   git status
   # Should show modified: package.json, package-lock.json, manifest.json, CHANGELOG.md
   ```

2. **Test release:submit**

   ```bash
   # On release branch with modified files
   npm run release:submit
   # Verify commit created, pushed, draft PR created
   ```

3. **Clean up test**
   ```bash
   # Close and delete test PR via GitHub UI
   git checkout main
   git branch -D release/v0.1.9-test
   git push origin --delete release/v0.1.9-test
   ```

### Phase 2: Test GitHub Actions

1. Create a real test release (e.g., 0.1.8)
2. Run through full workflow: bump → edit changelog → submit → merge PR
3. Verify GitHub Actions triggers and creates release
4. Check that ZIP is attached and release notes are correct

### Phase 3: Verify Manual Override Still Works

1. After a release is created, verify `npm run release:publish` still works
2. This ensures the manual override path is preserved

---

## Rollback Plan

If issues are discovered:

1. **Revert to old workflow:**

   ```bash
   git revert <commit-hash-of-package-json-change>
   ```

2. **Disable GitHub Action:**
   - Rename `.github/workflows/release.yml` to `release.yml.disabled`

3. **Use release:publish manually:**
   - The manual override ensures releases can always be created

---

## Success Criteria

- ✅ `npm run release:bump` creates branch and updates files without committing
- ✅ User can edit CHANGELOG.md before submitting
- ✅ `npm run release:submit` creates draft PR with changelog content
- ✅ Merging release PR triggers GitHub Actions
- ✅ GitHub Actions builds, tags, and creates release automatically
- ✅ Release has correct ZIP attachment and changelog notes
- ✅ `npm run release:publish` still works as manual override
