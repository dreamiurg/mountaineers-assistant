# Changelog Automation Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Automatically generate CHANGELOG.md entries from git commits during the release process using Keep a Changelog format.

**Architecture:** Create reusable changelog utility functions in `scripts/changelog-utils.js` that parse conventional commits and format Keep a Changelog entries. Integrate these functions into the existing `scripts/release.js` to generate and stage CHANGELOG.md alongside version files.

**Tech Stack:** Node.js (CommonJS), git CLI, Keep a Changelog format, Conventional Commits pattern

---

## Task 1: Create changelog utility functions

**Files:**

- Create: `scripts/changelog-utils.js`

**Step 1: Write test for getCommitsSinceLastTag function**

Create a minimal test structure to verify git log parsing:

```javascript
// scripts/test-changelog-utils.js
const { getCommitsSinceLastTag } = require('./changelog-utils');

console.log('Testing getCommitsSinceLastTag...');
const commits = getCommitsSinceLastTag();
console.log(`Found ${commits.length} commits`);
console.log('Sample commit:', commits[0]);
console.log('✓ Test passed');
```

**Step 2: Run test to verify it fails**

```bash
node scripts/test-changelog-utils.js
```

Expected: Error "Cannot find module './changelog-utils'"

**Step 3: Implement getCommitsSinceLastTag function**

Create `scripts/changelog-utils.js`:

```javascript
const { execSync } = require('child_process');

/**
 * Get all commits since the last git tag, or all commits if no tags exist.
 * @returns {Array<{hash: string, message: string}>} Array of commit objects
 */
function getCommitsSinceLastTag() {
  try {
    // Try to find the last tag
    const lastTag = execSync('git describe --tags --abbrev=0 2>/dev/null', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    // Get commits since last tag
    const output = execSync(`git log ${lastTag}..HEAD --format=%H|%s`, {
      encoding: 'utf8',
    });

    return parseGitLog(output);
  } catch (error) {
    // No tags exist, get all commits
    const output = execSync('git log --format=%H|%s', {
      encoding: 'utf8',
    });

    return parseGitLog(output);
  }
}

/**
 * Parse git log output into commit objects.
 * @param {string} output - Raw git log output
 * @returns {Array<{hash: string, message: string}>}
 */
function parseGitLog(output) {
  if (!output.trim()) {
    return [];
  }

  return output
    .trim()
    .split('\n')
    .map((line) => {
      const [hash, ...messageParts] = line.split('|');
      return {
        hash: hash.trim(),
        message: messageParts.join('|').trim(),
      };
    })
    .filter((commit) => commit.hash && commit.message);
}

module.exports = {
  getCommitsSinceLastTag,
};
```

**Step 4: Run test to verify it passes**

```bash
node scripts/test-changelog-utils.js
```

Expected: Prints commit count and sample commit, "✓ Test passed"

**Step 5: Commit**

```bash
git add scripts/changelog-utils.js scripts/test-changelog-utils.js
git commit -m "feat: added git commit extraction for changelog"
```

---

## Task 2: Add conventional commit parsing

**Files:**

- Modify: `scripts/changelog-utils.js`
- Modify: `scripts/test-changelog-utils.js`

**Step 1: Write test for parseConventionalCommit**

Add to `scripts/test-changelog-utils.js`:

```javascript
const { getCommitsSinceLastTag, parseConventionalCommit } = require('./changelog-utils');

// ... existing tests ...

console.log('\nTesting parseConventionalCommit...');
const tests = [
  {
    input: 'feat: added partner filter',
    expected: { type: 'feat', scope: null, message: 'added partner filter' },
  },
  {
    input: 'fix(auth): corrected timeout',
    expected: { type: 'fix', scope: 'auth', message: 'corrected timeout' },
  },
  {
    input: 'chore: updated deps',
    expected: { type: 'chore', scope: null, message: 'updated deps' },
  },
  { input: 'random commit', expected: { type: null, scope: null, message: 'random commit' } },
];

tests.forEach((test, i) => {
  const result = parseConventionalCommit(test.input);
  if (JSON.stringify(result) !== JSON.stringify(test.expected)) {
    throw new Error(
      `Test ${i + 1} failed: ${JSON.stringify(result)} !== ${JSON.stringify(test.expected)}`
    );
  }
});
console.log('✓ All parseConventionalCommit tests passed');
```

**Step 2: Run test to verify it fails**

```bash
node scripts/test-changelog-utils.js
```

Expected: Error "parseConventionalCommit is not a function"

**Step 3: Implement parseConventionalCommit function**

Add to `scripts/changelog-utils.js`:

```javascript
/**
 * Parse a conventional commit message.
 * @param {string} message - Commit message
 * @returns {{type: string|null, scope: string|null, message: string}}
 */
function parseConventionalCommit(message) {
  const conventionalRegex =
    /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(([^)]+)\))?!?:\s*(.+)$/i;
  const match = message.match(conventionalRegex);

  if (!match) {
    return {
      type: null,
      scope: null,
      message: message.trim(),
    };
  }

  const [, type, , scope, msg] = match;

  return {
    type: type.toLowerCase(),
    scope: scope || null,
    message: msg.trim(),
  };
}

module.exports = {
  getCommitsSinceLastTag,
  parseConventionalCommit,
};
```

**Step 4: Run test to verify it passes**

```bash
node scripts/test-changelog-utils.js
```

Expected: "✓ All parseConventionalCommit tests passed"

**Step 5: Commit**

```bash
git add scripts/changelog-utils.js scripts/test-changelog-utils.js
git commit -m "feat: added conventional commit parsing"
```

---

## Task 3: Add commit categorization

**Files:**

- Modify: `scripts/changelog-utils.js`
- Modify: `scripts/test-changelog-utils.js`

**Step 1: Write test for categorizeCommits**

Add to `scripts/test-changelog-utils.js`:

```javascript
const {
  getCommitsSinceLastTag,
  parseConventionalCommit,
  categorizeCommits,
} = require('./changelog-utils');

// ... existing tests ...

console.log('\nTesting categorizeCommits...');
const sampleCommits = [
  { hash: 'abc123', message: 'feat: added partner filter' },
  { hash: 'def456', message: 'fix: corrected timeout' },
  { hash: 'ghi789', message: 'chore: updated deps' },
  { hash: 'jkl012', message: 'docs: updated README' },
  { hash: 'mno345', message: 'release: prepared v0.1.6' },
  { hash: 'pqr678', message: 'random commit message' },
];

const categorized = categorizeCommits(sampleCommits);

if (!categorized.added || categorized.added.length !== 1) {
  throw new Error('Expected 1 "added" entry');
}
if (!categorized.fixed || categorized.fixed.length !== 1) {
  throw new Error('Expected 1 "fixed" entry');
}
if (!categorized.changed || categorized.changed.length !== 1) {
  throw new Error('Expected 1 "changed" entry');
}
if (!categorized.other || categorized.other.length !== 1) {
  throw new Error('Expected 1 "other" entry');
}
if (categorized.added[0] !== 'Added partner filter') {
  throw new Error('Expected cleaned message "Added partner filter"');
}

console.log('✓ All categorizeCommits tests passed');
```

**Step 2: Run test to verify it fails**

```bash
node scripts/test-changelog-utils.js
```

Expected: Error "categorizeCommits is not a function"

**Step 3: Implement categorizeCommits function**

Add to `scripts/changelog-utils.js`:

```javascript
/**
 * Categorize commits into Keep a Changelog sections.
 * @param {Array<{hash: string, message: string}>} commits
 * @returns {{added: string[], fixed: string[], changed: string[], other: string[]}}
 */
function categorizeCommits(commits) {
  const categories = {
    added: [],
    fixed: [],
    changed: [],
    other: [],
  };

  commits.forEach((commit) => {
    const parsed = parseConventionalCommit(commit.message);

    // Skip release and merge commits
    if (parsed.type === 'release' || commit.message.toLowerCase().startsWith('merge ')) {
      return;
    }

    // Skip docs, test, build, ci commits
    if (['docs', 'test', 'build', 'ci'].includes(parsed.type)) {
      return;
    }

    const cleanedMessage = cleanCommitMessage(parsed.message);

    // Map conventional commit types to changelog categories
    switch (parsed.type) {
      case 'feat':
        categories.added.push(cleanedMessage);
        break;
      case 'fix':
        categories.fixed.push(cleanedMessage);
        break;
      case 'chore':
      case 'refactor':
      case 'perf':
      case 'style':
      case 'revert':
        categories.changed.push(cleanedMessage);
        break;
      default:
        categories.other.push(cleanedMessage);
        break;
    }
  });

  // Sort entries alphabetically within each category
  Object.keys(categories).forEach((key) => {
    categories[key].sort();
  });

  return categories;
}

/**
 * Clean and format a commit message for changelog display.
 * @param {string} message - Raw commit message
 * @returns {string} Cleaned message
 */
function cleanCommitMessage(message) {
  let cleaned = message.trim();

  // Capitalize first letter if lowercase
  if (cleaned.length > 0 && cleaned[0] === cleaned[0].toLowerCase()) {
    cleaned = cleaned[0].toUpperCase() + cleaned.slice(1);
  }

  // Remove trailing period if present
  if (cleaned.endsWith('.')) {
    cleaned = cleaned.slice(0, -1);
  }

  // Truncate extremely long messages
  if (cleaned.length > 100) {
    cleaned = cleaned.slice(0, 97) + '...';
  }

  return cleaned;
}

module.exports = {
  getCommitsSinceLastTag,
  parseConventionalCommit,
  categorizeCommits,
};
```

**Step 4: Run test to verify it passes**

```bash
node scripts/test-changelog-utils.js
```

Expected: "✓ All categorizeCommits tests passed"

**Step 5: Commit**

```bash
git add scripts/changelog-utils.js scripts/test-changelog-utils.js
git commit -m "feat: added commit categorization for changelog"
```

---

## Task 4: Add changelog entry formatting

**Files:**

- Modify: `scripts/changelog-utils.js`
- Modify: `scripts/test-changelog-utils.js`

**Step 1: Write test for formatChangelogEntry**

Add to `scripts/test-changelog-utils.js`:

```javascript
const {
  getCommitsSinceLastTag,
  parseConventionalCommit,
  categorizeCommits,
  formatChangelogEntry,
} = require('./changelog-utils');

// ... existing tests ...

console.log('\nTesting formatChangelogEntry...');
const categories = {
  added: ['Added partner filter', 'Added dark mode'],
  fixed: ['Corrected timeout'],
  changed: ['Updated dependencies'],
  other: [],
};

const entry = formatChangelogEntry('0.1.7', '2025-10-11', categories);

if (!entry.includes('## [0.1.7] - 2025-10-11')) {
  throw new Error('Missing version header');
}
if (!entry.includes('### Added')) {
  throw new Error('Missing Added section');
}
if (!entry.includes('- Added partner filter')) {
  throw new Error('Missing added entry');
}
if (!entry.includes('### Fixed')) {
  throw new Error('Missing Fixed section');
}
if (!entry.includes('### Changed')) {
  throw new Error('Missing Changed section');
}

console.log('✓ formatChangelogEntry test passed');
```

**Step 2: Run test to verify it fails**

```bash
node scripts/test-changelog-utils.js
```

Expected: Error "formatChangelogEntry is not a function"

**Step 3: Implement formatChangelogEntry function**

Add to `scripts/changelog-utils.js`:

```javascript
/**
 * Format a changelog entry for a version.
 * @param {string} version - Semantic version
 * @param {string} date - Release date (YYYY-MM-DD)
 * @param {{added: string[], fixed: string[], changed: string[], other: string[]}} categories
 * @returns {string} Formatted changelog entry
 */
function formatChangelogEntry(version, date, categories) {
  const lines = [];

  lines.push(`## [${version}] - ${date}`);
  lines.push('');

  // Add sections in Keep a Changelog order
  const sections = [
    { key: 'added', title: 'Added' },
    { key: 'changed', title: 'Changed' },
    { key: 'fixed', title: 'Fixed' },
    { key: 'other', title: 'Other' },
  ];

  sections.forEach(({ key, title }) => {
    const entries = categories[key];
    if (entries && entries.length > 0) {
      lines.push(`### ${title}`);
      lines.push('');
      entries.forEach((entry) => {
        lines.push(`- ${entry}`);
      });
      lines.push('');
    }
  });

  // If no entries at all, add a note
  const totalEntries = Object.values(categories).reduce((sum, arr) => sum + arr.length, 0);
  if (totalEntries === 0) {
    lines.push('No changes recorded.');
    lines.push('');
  }

  return lines.join('\n');
}

module.exports = {
  getCommitsSinceLastTag,
  parseConventionalCommit,
  categorizeCommits,
  formatChangelogEntry,
};
```

**Step 4: Run test to verify it passes**

```bash
node scripts/test-changelog-utils.js
```

Expected: "✓ formatChangelogEntry test passed"

**Step 5: Commit**

```bash
git add scripts/changelog-utils.js scripts/test-changelog-utils.js
git commit -m "feat: added changelog entry formatting"
```

---

## Task 5: Add full changelog file generation

**Files:**

- Modify: `scripts/changelog-utils.js`
- Modify: `scripts/test-changelog-utils.js`

**Step 1: Write test for generateChangelog**

Add to `scripts/test-changelog-utils.js`:

```javascript
const {
  getCommitsSinceLastTag,
  parseConventionalCommit,
  categorizeCommits,
  formatChangelogEntry,
  generateChangelog,
} = require('./changelog-utils');

// ... existing tests ...

console.log('\nTesting generateChangelog...');
const changelog = generateChangelog('0.1.7', '2025-10-11');

if (!changelog.includes('# Changelog')) {
  throw new Error('Missing changelog header');
}
if (!changelog.includes('Keep a Changelog')) {
  throw new Error('Missing Keep a Changelog reference');
}
if (!changelog.includes('Semantic Versioning')) {
  throw new Error('Missing Semantic Versioning reference');
}
if (!changelog.includes('## [0.1.7] - 2025-10-11')) {
  throw new Error('Missing version entry');
}

console.log('✓ generateChangelog test passed');
console.log('\n--- Sample Changelog Output ---');
console.log(changelog.split('\n').slice(0, 20).join('\n'));
console.log('...');
```

**Step 2: Run test to verify it fails**

```bash
node scripts/test-changelog-utils.js
```

Expected: Error "generateChangelog is not a function"

**Step 3: Implement generateChangelog function**

Add to `scripts/changelog-utils.js`:

```javascript
/**
 * Generate complete CHANGELOG.md content.
 * @param {string} version - Semantic version
 * @param {string} date - Release date (YYYY-MM-DD)
 * @returns {string} Complete changelog content
 */
function generateChangelog(version, date) {
  const lines = [];

  // Keep a Changelog header
  lines.push('# Changelog');
  lines.push('');
  lines.push('All notable changes to this project will be documented in this file.');
  lines.push('');
  lines.push('The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),');
  lines.push(
    'and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).'
  );
  lines.push('');

  // Generate entry for this version
  const commits = getCommitsSinceLastTag();
  const categories = categorizeCommits(commits);
  const entry = formatChangelogEntry(version, date, categories);

  lines.push(entry);

  return lines.join('\n');
}

module.exports = {
  getCommitsSinceLastTag,
  parseConventionalCommit,
  categorizeCommits,
  formatChangelogEntry,
  generateChangelog,
};
```

**Step 4: Run test to verify it passes**

```bash
node scripts/test-changelog-utils.js
```

Expected: "✓ generateChangelog test passed" and sample output

**Step 5: Commit**

```bash
git add scripts/changelog-utils.js scripts/test-changelog-utils.js
git commit -m "feat: added full changelog generation"
```

---

## Task 6: Integrate changelog into release script

**Files:**

- Modify: `scripts/release.js`

**Step 1: Read release.js to understand integration point**

```bash
grep -n "updateManifest" scripts/release.js
```

Locate where manifest.json is updated (around line 199-200).

**Step 2: Add changelog generation after manifest update**

In `scripts/release.js`, after the `updateManifest` call and before the formatting step, add:

```javascript
// Import at top of file
const { generateChangelog } = require('./changelog-utils');
const changelogPath = path.join(repoRoot, 'CHANGELOG.md');

// ... existing code ...

// After updateManifest call (around line 200)
console.log(`\nGenerating CHANGELOG.md entry for ${nextSemver.raw}…\n`);
const changelogDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
const changelogContent = generateChangelog(nextSemver.raw, changelogDate);
fs.writeFileSync(changelogPath, changelogContent, 'utf8');
```

**Step 3: Add CHANGELOG.md to files to format**

Update the Prettier command to include CHANGELOG.md (around line 203):

```javascript
console.log('\nFormatting release files with Prettier…\n');
runCommand('npx prettier --write package.json src/chrome-ext/manifest.json CHANGELOG.md');
```

**Step 4: Add CHANGELOG.md to files to stage**

Update `filesToStage` array (around line 205):

```javascript
const filesToStage = [packageJsonPath, manifestPath, changelogPath];
```

**Step 5: Update completion message**

Update the final console.log (around line 216):

```javascript
console.log(
  '\nRelease preparation completed. Review the staged changes with "git diff --cached", then commit and tag when ready.'
);
```

**Step 6: Run typecheck to verify changes**

```bash
npm run typecheck
```

Expected: Should pass (no TypeScript in scripts, but good to verify)

**Step 7: Commit**

```bash
git add scripts/release.js
git commit -m "feat: integrated changelog generation into release script"
```

---

## Task 7: Test the release script with dry run

**Files:**

- Test with: `scripts/release.js`

**Step 1: Create a test tag to simulate previous release**

```bash
git tag -a v0.1.6 -m "Test tag for changelog"
```

**Step 2: Create some test commits**

```bash
echo "test" >> test-file.txt
git add test-file.txt
git commit -m "feat: test feature for changelog"
git commit --allow-empty -m "fix: test fix for changelog"
git commit --allow-empty -m "chore: test change for changelog"
```

**Step 3: Run release script (but don't commit)**

```bash
node scripts/release.js 0.1.7
```

Expected:

- Script runs successfully
- Creates/updates CHANGELOG.md
- Stages package.json, manifest.json, CHANGELOG.md
- Shows completion message

**Step 4: Review generated CHANGELOG.md**

```bash
git diff --cached CHANGELOG.md
```

Verify:

- [ ] Header includes "Keep a Changelog" reference
- [ ] Version section exists with correct version and date
- [ ] Test commits are categorized correctly (Added/Fixed/Changed)
- [ ] Format matches Keep a Changelog style

**Step 5: Reset the test**

```bash
git reset HEAD --hard
git tag -d v0.1.6
rm test-file.txt 2>/dev/null || true
```

**Step 6: Document test results**

If tests passed, the implementation is complete. If issues found, fix and re-test.

**Step 7: Commit test script (optional)**

If you created a test script, you can commit it for future use:

```bash
git add scripts/test-changelog-utils.js
git commit -m "test: added changelog utilities test script"
```

---

## Task 8: Manual testing with actual release

**Files:**

- Test with: Full release workflow

**Step 1: Ensure clean git state**

```bash
git status
```

Expected: No uncommitted changes

**Step 2: Run actual release**

```bash
npm run release 0.1.7
```

**Step 3: Review all staged changes**

```bash
git diff --cached
```

Verify:

- [ ] package.json version updated
- [ ] package-lock.json version updated
- [ ] manifest.json version updated
- [ ] CHANGELOG.md created with proper format
- [ ] All entries look correct

**Step 4: Commit and tag**

```bash
git commit -m "release: prepared v0.1.7"
git tag -a v0.1.7 -m "Release v0.1.7"
```

**Step 5: Verify changelog persists**

```bash
cat CHANGELOG.md
```

Verify complete changelog content is present.

---

## Task 9: Run quality gates

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

## Task 10: Update documentation

**Files:**

- Modify: `AGENTS.md` (optional)
- Create: `docs/features/changelog.md` (optional)

**Step 1: Update AGENTS.md if needed**

If the project's AGENTS.md mentions release workflow, update it to mention automatic changelog generation.

**Step 2: Document the changelog feature (optional)**

Create a brief doc explaining:

- CHANGELOG.md is auto-generated during releases
- Based on conventional commits since last tag
- User can edit before committing
- Follows Keep a Changelog format

**Step 3: Commit documentation updates**

```bash
git add AGENTS.md docs/features/changelog.md
git commit -m "docs: documented automatic changelog generation"
```

---

## Success Criteria

- [ ] `scripts/changelog-utils.js` created with all utility functions
- [ ] `scripts/release.js` generates CHANGELOG.md during releases
- [ ] CHANGELOG.md follows Keep a Changelog format
- [ ] Conventional commits are correctly categorized
- [ ] Non-conventional commits appear in "Other" section
- [ ] Release/merge commits are excluded
- [ ] CHANGELOG.md is staged with other release files
- [ ] TypeScript compiles with no errors
- [ ] Pre-commit hooks pass
- [ ] Manual release test confirms correct behavior
