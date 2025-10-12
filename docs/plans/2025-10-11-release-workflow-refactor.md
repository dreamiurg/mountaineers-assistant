# Release Workflow Refactor Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Refactor the release workflow into two clean scripts (`release:prepare` and `release:publish`) that work with GitHub branch protection, separating PR creation from tagging/publishing.

**Architecture:** Split current monolithic release process into two independent scripts: `release-prepare.js` creates a release branch and PR, while `release-publish.js` (run after PR merge) handles tagging and GitHub release creation. Both scripts share `changelog-utils.js` for changelog generation.

**Tech Stack:** Node.js (CommonJS), git CLI, GitHub CLI (`gh`), existing package.js for ZIP creation

---

## Task 1: Create release:prepare script skeleton

**Files:**

- Create: `scripts/release-prepare.js`

**Step 1: Create basic script structure**

Create `scripts/release-prepare.js`:

```javascript
#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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

function parseVersion() {
  const args = process.argv.slice(2);
  return args[0] ? args[0].trim() : null;
}

async function main() {
  const version = parseVersion();

  if (!version) {
    throw new Error('Version required. Usage: npm run release:prepare <version>');
  }

  console.log(`\nPreparing release for version ${version}...\n`);

  // TODO: Implement release preparation steps

  console.log('\nRelease preparation completed!\n');
}

main().catch((error) => {
  console.error(`\nRelease preparation failed: ${error.message}`);
  process.exitCode = 1;
});
```

**Step 2: Test the script runs**

```bash
node scripts/release-prepare.js 0.1.7
```

Expected: Prints "Preparing release for version 0.1.7" and "Release preparation completed!"

**Step 3: Test without version argument**

```bash
node scripts/release-prepare.js
```

Expected: Error "Version required. Usage: npm run release:prepare <version>"

**Step 4: Commit**

```bash
git add scripts/release-prepare.js
git commit -m "feat: added release:prepare script skeleton"
```

---

## Task 2: Add safety checks to release:prepare

**Files:**

- Modify: `scripts/release-prepare.js`

**Step 1: Add gh CLI check**

Add function after `getCommandOutput`:

```javascript
function ensureGhAvailable() {
  try {
    getCommandOutput('gh --version');
  } catch (error) {
    throw new Error(
      'GitHub CLI (gh) is required but not found. Install from https://cli.github.com/'
    );
  }
}
```

Call in `main()` before version check:

```javascript
ensureGhAvailable();
```

**Step 2: Add clean working tree check**

Add function:

```javascript
function ensureCleanWorkingTree() {
  const status = getCommandOutput('git status --porcelain');
  if (status) {
    throw new Error('Working tree must be clean. Commit, stash, or discard changes and try again.');
  }
}
```

Call in `main()` after `ensureGhAvailable()`.

**Step 3: Add main branch check**

Add function:

```javascript
function ensureOnMain() {
  const currentBranch = getCommandOutput('git rev-parse --abbrev-ref HEAD');
  if (currentBranch !== 'main') {
    throw new Error(
      `Must run from main branch. Current branch: ${currentBranch}. Run: git checkout main`
    );
  }
}
```

Call in `main()` after clean working tree check.

**Step 4: Add version validation**

Add function (reuse from existing release.js):

```javascript
function parseSemver(version) {
  const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-.]+))?(?:\+([0-9A-Za-z-.]+))?$/;
  const match = semverRegex.exec(version);
  if (!match) {
    return null;
  }

  const [, major, minor, patch, prerelease = '', build = ''] = match;
  return {
    raw: version,
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    prerelease: prerelease ? prerelease.split('.') : [],
    build,
  };
}

function validateVersion(version, currentVersion) {
  const nextSemver = parseSemver(version);
  if (!nextSemver) {
    throw new Error(
      `Invalid version "${version}". Expected format: major.minor.patch (e.g., 0.1.7)`
    );
  }

  const currentSemver = parseSemver(currentVersion);
  if (!currentSemver) {
    throw new Error(`Current package version "${currentVersion}" is invalid.`);
  }

  // Simple comparison: at least one component must increase
  if (
    nextSemver.major < currentSemver.major ||
    (nextSemver.major === currentSemver.major && nextSemver.minor < currentSemver.minor) ||
    (nextSemver.major === currentSemver.major &&
      nextSemver.minor === currentSemver.minor &&
      nextSemver.patch <= currentSemver.patch)
  ) {
    throw new Error(`Version ${version} must be greater than current version ${currentVersion}`);
  }

  return nextSemver;
}
```

Add to `main()` after version parse:

```javascript
const packageJsonPath = path.join(repoRoot, 'package.json');
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const currentVersion = pkg.version;

validateVersion(version, currentVersion);
```

**Step 5: Test safety checks**

```bash
# Test gh check (skip if gh is installed)
# Test clean working tree (create a file first)
echo "test" > test.txt
node scripts/release-prepare.js 0.1.7
# Expected: Error about dirty working tree

# Clean up
git checkout .
rm test.txt

# Test version validation
node scripts/release-prepare.js 0.0.1
# Expected: Error about version must be greater than current
```

**Step 6: Commit**

```bash
git add scripts/release-prepare.js
git commit -m "feat: added safety checks to release:prepare"
```

---

## Task 3: Add release branch creation to release:prepare

**Files:**

- Modify: `scripts/release-prepare.js`

**Step 1: Add fetch and branch creation logic**

Add functions:

```javascript
function fetchLatest() {
  console.log('Fetching latest from origin...');
  runCommand('git fetch origin');
}

function createOrSwitchReleaseBranch(version) {
  const branchName = `release/v${version}`;

  // Check if branch exists locally
  try {
    const branches = getCommandOutput('git branch --list');
    const branchExists = branches
      .split('\n')
      .some((b) => b.trim() === branchName || b.trim() === `* ${branchName}`);

    if (branchExists) {
      console.log(`\nRelease branch ${branchName} already exists. Switching to it...`);
      runCommand(`git checkout ${branchName}`);
      console.log('⚠️  Working on existing release branch. Previous changes may exist.\n');
      return branchName;
    }
  } catch (error) {
    // Branch check failed, continue to create
  }

  // Create new branch from current main
  console.log(`\nCreating release branch ${branchName} from main...`);
  runCommand(`git checkout -b ${branchName}`);
  console.log(`✓ Created branch ${branchName}\n`);

  return branchName;
}
```

**Step 2: Call in main() after validation**

Add after version validation:

```javascript
fetchLatest();
const releaseBranch = createOrSwitchReleaseBranch(version);
```

**Step 3: Test branch creation**

```bash
node scripts/release-prepare.js 0.1.8
```

Expected:

- Fetches from origin
- Creates `release/v0.1.8` branch
- Switches to that branch

Verify:

```bash
git branch --show-current
# Expected: release/v0.1.8

# Switch back to main and clean up
git checkout main
git branch -D release/v0.1.8
```

**Step 4: Commit**

```bash
git add scripts/release-prepare.js
git commit -m "feat: added release branch creation to release:prepare"
```

---

## Task 4: Add version bumping and changelog generation

**Files:**

- Modify: `scripts/release-prepare.js`

**Step 1: Import changelog utilities and add version bump functions**

Add at top after requires:

```javascript
const { generateChangelog } = require('./changelog-utils');
```

Add functions (adapted from existing release.js):

```javascript
function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function updateManifest(manifestPath, version) {
  const manifest = loadJson(manifestPath);
  manifest.version = version;

  if (manifest.version_name) {
    manifest.version_name = version;
  }

  writeJson(manifestPath, manifest);
}

function bumpVersions(version) {
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const manifestPath = path.join(repoRoot, 'src', 'chrome-ext', 'manifest.json');

  console.log(`Bumping version to ${version}...`);

  // Update package.json and package-lock.json via npm
  runCommand(`npm version ${version} --no-git-tag-version`);

  // Update manifest.json
  updateManifest(manifestPath, version);

  console.log('✓ Version bumped in package.json, package-lock.json, and manifest.json\n');
}

function generateChangelogFile(version) {
  const changelogPath = path.join(repoRoot, 'CHANGELOG.md');
  const changelogDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  console.log('Generating CHANGELOG.md...');
  const changelogContent = generateChangelog(version, changelogDate);
  fs.writeFileSync(changelogPath, changelogContent, 'utf8');
  console.log('✓ CHANGELOG.md generated\n');
}

function formatReleaseFiles() {
  console.log('Formatting release files with Prettier...');
  runCommand(
    'npx prettier --write package.json package-lock.json src/chrome-ext/manifest.json CHANGELOG.md'
  );
  console.log('✓ Files formatted\n');
}
```

**Step 2: Add typecheck before version bump**

Add function:

```javascript
function runTypecheck() {
  console.log('Running typecheck...');
  runCommand('npm run typecheck');
  console.log('✓ Typecheck passed\n');
}
```

**Step 3: Call functions in main()**

Add after branch creation:

```javascript
runTypecheck();
bumpVersions(version);
generateChangelogFile(version);
formatReleaseFiles();
```

**Step 4: Test version bumping**

```bash
node scripts/release-prepare.js 0.1.8
```

Expected:

- Runs typecheck
- Bumps versions in all files
- Generates CHANGELOG.md
- Formats files

Verify:

```bash
git diff
# Should show changes to package.json, package-lock.json, manifest.json, CHANGELOG.md

# Reset for now
git checkout .
git checkout main
git branch -D release/v0.1.8
```

**Step 5: Commit**

```bash
git add scripts/release-prepare.js
git commit -m "feat: added version bumping and changelog generation"
```

---

## Task 5: Add commit, push, and PR creation

**Files:**

- Modify: `scripts/release-prepare.js`

**Step 1: Add commit and push functions**

Add functions:

```javascript
function commitReleaseFiles(version) {
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const packageLockPath = path.join(repoRoot, 'package-lock.json');
  const manifestPath = path.join(repoRoot, 'src', 'chrome-ext', 'manifest.json');
  const changelogPath = path.join(repoRoot, 'CHANGELOG.md');

  console.log('Staging release files...');

  const filesToStage = [
    path.relative(repoRoot, packageJsonPath),
    path.relative(repoRoot, packageLockPath),
    path.relative(repoRoot, manifestPath),
    path.relative(repoRoot, changelogPath),
  ];

  filesToStage.forEach((file) => {
    runCommand(`git add "${file}"`);
  });

  console.log('Committing release files...');
  runCommand(`git commit -m "release: prepared v${version}"`);
  console.log(`✓ Committed release files\n`);
}

function pushReleaseBranch(branchName) {
  console.log(`Pushing ${branchName} to origin...`);

  try {
    runCommand('git push');
  } catch (error) {
    // Branch might not have upstream set
    console.log('Setting upstream and pushing...');
    runCommand(`git push --set-upstream origin ${branchName}`);
  }

  console.log(`✓ Pushed ${branchName}\n`);
}

function createPullRequest(version, branchName) {
  console.log('Creating pull request...');

  const title = `Release v${version}`;
  const body = `Release v${version}`;

  try {
    const prUrl = getCommandOutput(
      `gh pr create --base main --head ${branchName} --title "${title}" --body "${body}"`
    );
    console.log(`✓ Pull request created: ${prUrl}\n`);
    return prUrl;
  } catch (error) {
    // PR might already exist
    if (error.message.includes('already exists')) {
      console.log('⚠️  Pull request already exists for this branch\n');
      try {
        const prUrl = getCommandOutput(`gh pr view ${branchName} --json url --jq .url`);
        console.log(`   Existing PR: ${prUrl}\n`);
        return prUrl;
      } catch (viewError) {
        console.log('   Run: gh pr list --head ' + branchName + '\n');
        return null;
      }
    }
    throw error;
  }
}
```

**Step 2: Call functions in main()**

Add after `formatReleaseFiles()`:

```javascript
commitReleaseFiles(version);
pushReleaseBranch(releaseBranch);
const prUrl = createPullRequest(version, releaseBranch);
```

**Step 3: Add completion message**

Replace final console.log with:

```javascript
console.log('='.repeat(60));
console.log('Release preparation completed!');
console.log('='.repeat(60));
console.log(`\nRelease branch: ${releaseBranch}`);
if (prUrl) {
  console.log(`Pull request: ${prUrl}`);
}
console.log('\nNext steps:');
console.log('1. Review the pull request on GitHub');
console.log('2. Merge the pull request when ready');
console.log(`3. Run: npm run release:publish ${version}`);
console.log('');
```

**Step 4: Test full flow (dry run)**

This step requires actually running the script, but we can verify the structure is correct:

```bash
npm run typecheck
```

Expected: Script compiles without errors

**Step 5: Commit**

```bash
git add scripts/release-prepare.js
git commit -m "feat: added commit, push, and PR creation to release:prepare"
```

---

## Task 6: Create release:publish script skeleton

**Files:**

- Create: `scripts/release-publish.js`

**Step 1: Create basic script structure**

Create `scripts/release-publish.js`:

```javascript
#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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

function parseVersion() {
  const args = process.argv.slice(2);
  return args[0] ? args[0].trim() : null;
}

async function main() {
  const version = parseVersion();

  if (!version) {
    throw new Error('Version required. Usage: npm run release:publish <version>');
  }

  console.log(`\nPublishing release for version ${version}...\n`);

  // TODO: Implement release publishing steps

  console.log('\nRelease published successfully!\n');
}

main().catch((error) => {
  console.error(`\nRelease publishing failed: ${error.message}`);
  process.exitCode = 1;
});
```

**Step 2: Test the script runs**

```bash
node scripts/release-publish.js 0.1.7
```

Expected: Prints "Publishing release for version 0.1.7" and "Release published successfully!"

**Step 3: Commit**

```bash
git add scripts/release-publish.js
git commit -m "feat: added release:publish script skeleton"
```

---

## Task 7: Add safety checks to release:publish

**Files:**

- Modify: `scripts/release-publish.js`

**Step 1: Add all safety check functions**

Add after `parseVersion()`:

```javascript
function ensureGhAvailable() {
  try {
    getCommandOutput('gh --version');
  } catch (error) {
    throw new Error(
      'GitHub CLI (gh) is required but not found. Install from https://cli.github.com/'
    );
  }
}

function ensureOnMain() {
  const currentBranch = getCommandOutput('git rev-parse --abbrev-ref HEAD');
  if (currentBranch !== 'main') {
    throw new Error(`Must run from main branch after PR merge. Current branch: ${currentBranch}`);
  }
}

function ensureCleanWorkingTree() {
  const status = getCommandOutput('git status --porcelain');
  if (status) {
    throw new Error('Working tree must be clean. Commit or discard changes and try again.');
  }
}

function ensureMainUpToDate() {
  console.log('Checking if main is up to date...');
  runCommand('git fetch origin');

  const localCommit = getCommandOutput('git rev-parse HEAD');
  const remoteCommit = getCommandOutput('git rev-parse origin/main');

  if (localCommit !== remoteCommit) {
    const behind = getCommandOutput('git rev-list HEAD..origin/main --count');
    const ahead = getCommandOutput('git rev-list origin/main..HEAD --count');

    if (behind !== '0') {
      throw new Error(`Local main is behind origin/main by ${behind} commits. Run: git pull`);
    }
    if (ahead !== '0') {
      throw new Error(
        `Local main is ahead of origin/main by ${ahead} commits. Push changes first.`
      );
    }
  }

  console.log('✓ Main is up to date\n');
}

function ensureVersionMatches(version) {
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  if (pkg.version !== version) {
    throw new Error(
      `Version mismatch: package.json is v${pkg.version}, but you specified v${version}. ` +
        `Ensure the release PR was merged and you pulled latest main.`
    );
  }

  console.log(`✓ package.json version matches: ${version}\n`);
}

function ensureTagDoesNotExist(version) {
  const tagName = `v${version}`;

  // Check local tags
  const localTags = getCommandOutput('git tag --list');
  if (localTags.split('\n').includes(tagName)) {
    throw new Error(`Tag ${tagName} already exists locally. Version already released.`);
  }

  // Check remote tags
  try {
    const remoteTags = getCommandOutput('git ls-remote --tags origin');
    if (remoteTags.includes(`refs/tags/${tagName}`)) {
      throw new Error(`Tag ${tagName} already exists on remote. Version already released.`);
    }
  } catch (error) {
    console.log('⚠️  Could not check remote tags, proceeding...\n');
  }

  console.log(`✓ Tag ${tagName} does not exist\n`);
}
```

**Step 2: Call safety checks in main()**

Add after version parse:

```javascript
ensureGhAvailable();
ensureOnMain();
ensureCleanWorkingTree();
ensureMainUpToDate();
ensureVersionMatches(version);
ensureTagDoesNotExist(version);
```

**Step 3: Test safety checks**

```bash
# Test from wrong branch
git checkout -b test-branch
node scripts/release-publish.js 0.1.7
# Expected: Error about must run from main

git checkout main
git branch -D test-branch

# Test version mismatch (current version is 0.1.6)
node scripts/release-publish.js 0.1.7
# Expected: Error about version mismatch
```

**Step 4: Commit**

```bash
git add scripts/release-publish.js
git commit -m "feat: added comprehensive safety checks to release:publish"
```

---

## Task 8: Add build, package, tag, and GitHub release

**Files:**

- Modify: `scripts/release-publish.js`

**Step 1: Add build and package functions**

Add functions:

```javascript
function runTypecheck() {
  console.log('Running typecheck...');
  runCommand('npm run typecheck');
  console.log('✓ Typecheck passed\n');
}

function buildExtension() {
  console.log('Building extension...');
  runCommand('npm run build');
  console.log('✓ Extension built\n');
}

function packageExtension(version) {
  console.log('Packaging extension...');
  runCommand(`npm run package -- ${version}`);

  const zipPath = path.join(repoRoot, `mountaineers-assistant-${version}.zip`);
  if (!fs.existsSync(zipPath)) {
    throw new Error(`Expected package file not found: ${zipPath}`);
  }

  console.log(`✓ Extension packaged: mountaineers-assistant-${version}.zip\n`);
  return zipPath;
}
```

**Step 2: Add git tag functions**

Add functions:

```javascript
function createAndPushTag(version) {
  const tagName = `v${version}`;

  console.log(`Creating git tag ${tagName}...`);
  runCommand(`git tag -a ${tagName} -m "Release ${tagName}"`);
  console.log(`✓ Tag ${tagName} created\n`);

  console.log(`Pushing tag ${tagName} to origin...`);
  runCommand(`git push origin ${tagName}`);
  console.log(`✓ Tag ${tagName} pushed\n`);

  return tagName;
}
```

**Step 3: Add GitHub release function**

Add function:

```javascript
function createGitHubRelease(version, zipPath) {
  const tagName = `v${version}`;
  const relativeZipPath = path.relative(repoRoot, zipPath);

  console.log('Creating GitHub release...');

  try {
    const releaseUrl = getCommandOutput(
      `gh release create ${tagName} --title "${tagName}" --notes "Release ${tagName}" "${relativeZipPath}"`
    );
    console.log(`✓ GitHub release created: ${releaseUrl}\n`);
    return releaseUrl;
  } catch (error) {
    console.error(`\n⚠️  Failed to create GitHub release: ${error.message}`);
    console.error(`   Tag ${tagName} was pushed. You can create the release manually:`);
    console.error(
      `   gh release create ${tagName} --title "${tagName}" --notes "Release ${tagName}" "${relativeZipPath}"\n`
    );
    throw error;
  }
}
```

**Step 4: Call functions in main()**

Add after safety checks:

```javascript
runTypecheck();
buildExtension();
const zipPath = packageExtension(version);
const tagName = createAndPushTag(version);
const releaseUrl = createGitHubRelease(version, zipPath);
```

**Step 5: Add completion message**

Replace final console.log with:

```javascript
console.log('='.repeat(60));
console.log('Release published successfully!');
console.log('='.repeat(60));
console.log(`\nVersion: ${version}`);
console.log(`Tag: ${tagName}`);
console.log(`Package: ${path.basename(zipPath)}`);
if (releaseUrl) {
  console.log(`GitHub Release: ${releaseUrl}`);
}
console.log('\nNext steps:');
console.log('1. Upload the ZIP to Chrome Web Store');
console.log('2. Update the extension listing if needed');
console.log('');
```

**Step 6: Test structure**

```bash
npm run typecheck
```

Expected: Script compiles without errors

**Step 7: Commit**

```bash
git add scripts/release-publish.js
git commit -m "feat: added build, package, tag, and GitHub release to release:publish"
```

---

## Task 9: Update package.json scripts

**Files:**

- Modify: `package.json`

**Step 1: Read current scripts section**

```bash
grep -A 15 '"scripts"' package.json
```

**Step 2: Add new release scripts**

In package.json, update the scripts section to add new commands:

```json
{
  "scripts": {
    "release:prepare": "node scripts/release-prepare.js",
    "release:publish": "node scripts/release-publish.js",
    "release": "node scripts/release.js",
    "package": "node scripts/package.js",
    "publish": "node scripts/publish.js"
  }
}
```

Note: Keep old `release` and `publish` for now (will deprecate in next task).

**Step 3: Test script commands**

```bash
# Verify scripts are defined
npm run release:prepare
# Expected: Error about version required

npm run release:publish
# Expected: Error about version required
```

**Step 4: Commit**

```bash
git add package.json
git commit -m "feat: added release:prepare and release:publish npm scripts"
```

---

## Task 10: Deprecate old scripts

**Files:**

- Rename: `scripts/release.js` → `scripts/release.old.js`
- Rename: `scripts/publish.js` → `scripts/publish.old.js`
- Modify: `package.json`

**Step 1: Rename old scripts**

```bash
git mv scripts/release.js scripts/release.old.js
git mv scripts/publish.js scripts/publish.old.js
```

**Step 2: Update package.json to remove old commands**

In package.json, remove the old `release` and `publish` scripts:

```json
{
  "scripts": {
    "release:prepare": "node scripts/release-prepare.js",
    "release:publish": "node scripts/release-publish.js",
    "package": "node scripts/package.js"
  }
}
```

**Step 3: Add deprecation notice to old scripts**

Add at top of `scripts/release.old.js`:

```javascript
console.warn(
  '\n⚠️  DEPRECATED: This script has been replaced by release:prepare and release:publish'
);
console.warn('   Use: npm run release:prepare <version>');
console.warn('   Then: npm run release:publish <version>\n');
process.exit(1);
```

Add at top of `scripts/publish.old.js`:

```javascript
console.warn(
  '\n⚠️  DEPRECATED: This script has been replaced by release:prepare and release:publish'
);
console.warn('   Use: npm run release:prepare <version>');
console.warn('   Then: npm run release:publish <version>\n');
process.exit(1);
```

**Step 4: Commit**

```bash
git add scripts/release.old.js scripts/publish.old.js package.json
git commit -m "chore: deprecated old release and publish scripts"
```

---

## Task 11: Update AGENTS.md documentation

**Files:**

- Modify: `AGENTS.md`

**Step 1: Read current release process section**

```bash
grep -A 20 "### Release Process" AGENTS.md
```

**Step 2: Update release process documentation**

Replace the "Release Process" section in AGENTS.md:

````markdown
### Release Process

The release workflow is split into two phases to accommodate GitHub branch protection:

**Phase 1: Prepare Release (creates PR)**

```bash
npm run release:prepare <version>
```
````

This command:

- Creates a `release/v<version>` branch from latest main
- Runs typecheck before making changes
- Updates version in `package.json`, `package-lock.json`, and `manifest.json`
- Generates `CHANGELOG.md` from conventional commits since the last git tag
- Follows [Keep a Changelog](https://keepachangelog.com/) format
- Categorizes commits: `feat:` → Added, `fix:` → Fixed, `chore:`/`refactor:`/`perf:` → Changed
- Filters out `docs:`, `test:`, `build:`, `ci:`, `release:`, and merge commits
- Commits all changes with message: `release: prepared v<version>`
- Pushes the release branch to origin
- Creates a pull request to main

**Phase 2: Publish Release (after PR merge)**

After reviewing and merging the release PR:

```bash
npm run release:publish <version>
```

This command:

- Verifies you're on main branch and up-to-date with origin
- Verifies package.json version matches the specified version
- Verifies the git tag doesn't already exist
- Runs typecheck and builds the extension
- Creates a ZIP package
- Creates and pushes git tag `v<version>`
- Creates a GitHub release with the ZIP attached
- Prints instructions for uploading to Chrome Web Store

**Requirements:**

- GitHub CLI (`gh`) must be installed for both commands
- Working tree must be clean
- For `release:publish`: must be on main branch after PR merge

````

**Step 3: Run formatting**

```bash
npm run format
````

**Step 4: Commit**

```bash
git add AGENTS.md
git commit -m "docs: updated release process in AGENTS.md"
```

---

## Task 12: Update README.md documentation

**Files:**

- Modify: `README.md`

**Step 1: Read README.md to find release section**

```bash
grep -n -i "release\|publish\|deploy" README.md | head -20
```

**Step 2: Add or update release section in README.md**

If a release section exists, update it. If not, add a new section (likely near the end, before License/Contributing):

````markdown
## Release Process

This project uses a two-phase release workflow:

### 1. Prepare Release

Create a release branch and pull request:

```bash
npm run release:prepare 0.1.7
```
````

This will:

- Create a `release/v0.1.7` branch
- Bump versions and generate changelog
- Push the branch and create a PR to main

Review the PR, then merge it on GitHub.

### 2. Publish Release

After the PR is merged, publish the release:

```bash
git checkout main
git pull
npm run release:publish 0.1.7
```

This will:

- Create and push a git tag
- Build and package the extension
- Create a GitHub release with the ZIP

Finally, upload the ZIP to the [Chrome Web Store](https://chrome.google.com/webstore).

### Requirements

- [GitHub CLI (`gh`)](https://cli.github.com/) must be installed
- You must have push access to the repository
- Main branch has protection rules requiring PR reviews

````

**Step 3: Run formatting**

```bash
npm run format
````

**Step 4: Commit**

```bash
git add README.md
git commit -m "docs: added release process to README"
```

---

## Task 13: Manual end-to-end test (dry run)

**Files:**

- Test with: Complete workflow

**Step 1: Ensure clean state**

```bash
git checkout main
git status
# Expected: Clean working tree
```

**Step 2: Test release:prepare**

```bash
npm run release:prepare 0.1.7
```

Expected output:

- Fetches from origin
- Creates release/v0.1.7 branch
- Runs typecheck
- Bumps versions
- Generates CHANGELOG.md
- Formats files
- Commits changes
- Pushes branch
- Creates PR

**Step 3: Review the PR on GitHub**

Open the PR URL printed by the script and verify:

- [ ] Title is "Release v0.1.7"
- [ ] Body is "Release v0.1.7"
- [ ] Base branch is main
- [ ] Head branch is release/v0.1.7
- [ ] Changes include version bumps and CHANGELOG.md

**Step 4: Merge the PR**

Merge the PR on GitHub (using "Squash and merge" or "Merge commit").

**Step 5: Pull latest main**

```bash
git checkout main
git pull origin main
```

**Step 6: Test release:publish**

```bash
npm run release:publish 0.1.7
```

Expected output:

- Verifies on main and up-to-date
- Verifies version matches
- Verifies tag doesn't exist
- Runs typecheck
- Builds extension
- Creates ZIP
- Creates and pushes tag
- Creates GitHub release

**Step 7: Verify GitHub release**

Open the GitHub release URL and verify:

- [ ] Tag is v0.1.7
- [ ] Title is "v0.1.7"
- [ ] Notes say "Release v0.1.7"
- [ ] ZIP file is attached

**Step 8: Clean up test release (if needed)**

If this was a test, clean up:

```bash
# Delete tag locally and remotely
git tag -d v0.1.7
git push origin :v0.1.7

# Delete GitHub release
gh release delete v0.1.7 --yes

# Reset version in package.json
git revert HEAD
```

---

## Task 14: Run quality gates

**Files:**

- All modified files

**Step 1: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors

**Step 2: Run formatting**

```bash
npm run format
```

Expected: All files formatted

**Step 3: Run pre-commit hooks**

```bash
uv run pre-commit run --all-files
```

Expected: All hooks pass

**Step 4: Commit any formatting changes**

```bash
git add -A
git commit -m "chore: applied formatting and linting fixes"
```

---

## Task 15: Final review and documentation check

**Files:**

- All modified files

**Step 1: Review all changes**

```bash
git log main..HEAD --oneline
```

Verify commits follow project style.

**Step 2: Verify all documentation is updated**

Check that these files mention the new workflow:

- [ ] AGENTS.md - Release Process section
- [ ] README.md - Release section
- [ ] package.json - Scripts defined

**Step 3: Test script help messages**

```bash
npm run release:prepare
# Expected: Clear error about version required

npm run release:publish
# Expected: Clear error about version required
```

**Step 4: Create summary of changes**

Document what was changed for the PR description:

- Created `release-prepare.js` (replaces old release.js prepare phase)
- Created `release-publish.js` (replaces old publish.js)
- Deprecated old scripts (renamed to .old.js)
- Updated package.json scripts
- Updated AGENTS.md and README.md documentation
- Workflow now supports GitHub branch protection

**Step 5: Ready for PR**

All changes are committed and tested. Ready to create PR.

---

## Success Criteria

**release:prepare should:**

- ✓ Verify all prerequisites (gh CLI, clean tree, on main)
- ✓ Create or switch to release/v<version> branch
- ✓ Bump versions consistently across all files
- ✓ Generate changelog from conventional commits
- ✓ Commit and push release branch
- ✓ Create PR to main automatically
- ✓ Handle existing branches and PRs gracefully

**release:publish should:**

- ✓ Verify all safety checks (on main, up-to-date, version match, tag doesn't exist)
- ✓ Build and package extension
- ✓ Create and push git tag
- ✓ Create GitHub release with ZIP
- ✓ Provide clear error messages
- ✓ Be re-runnable if GitHub release fails

**Documentation should:**

- ✓ Clearly explain two-phase workflow
- ✓ List prerequisites (gh CLI)
- ✓ Provide example commands
- ✓ Updated in AGENTS.md and README.md
