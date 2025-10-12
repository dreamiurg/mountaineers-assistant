#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { generateChangelog } = require('./changelog-utils');

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

function ensureCleanWorkingTree() {
  const status = getCommandOutput('git status --porcelain');
  if (status) {
    throw new Error('Working tree must be clean. Commit, stash, or discard changes and try again.');
  }
}

function ensureOnMain() {
  const currentBranch = getCommandOutput('git rev-parse --abbrev-ref HEAD');
  if (currentBranch !== 'main') {
    throw new Error(
      `Must run from main branch. Current branch: ${currentBranch}. Run: git checkout main`
    );
  }
}

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

function parseVersion() {
  const args = process.argv.slice(2);
  return args[0] ? args[0].trim() : null;
}

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
  } catch {
    // Branch check failed, continue to create
  }

  // Create new branch from current main
  console.log(`\nCreating release branch ${branchName} from main...`);
  runCommand(`git checkout -b ${branchName}`);
  console.log(`✓ Created branch ${branchName}\n`);

  return branchName;
}

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

function runTypecheck() {
  console.log('Running typecheck...');
  runCommand('npm run typecheck');
  console.log('✓ Typecheck passed\n');
}

async function main() {
  ensureGhAvailable();

  const version = parseVersion();

  if (!version) {
    throw new Error('Version required. Usage: npm run release:prepare <version>');
  }

  ensureCleanWorkingTree();
  ensureOnMain();

  const packageJsonPath = path.join(repoRoot, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const currentVersion = pkg.version;

  validateVersion(version, currentVersion);

  console.log(`\nPreparing release for version ${version}...\n`);

  fetchLatest();
  const releaseBranch = createOrSwitchReleaseBranch(version);

  runTypecheck();
  bumpVersions(version);
  generateChangelogFile(version);
  formatReleaseFiles();

  // TODO: Implement commit, push, and PR creation

  console.log('\nRelease preparation completed!\n');
  console.log(`Release branch: ${releaseBranch}\n`);
}

main().catch((error) => {
  console.error(`\nRelease preparation failed: ${error.message}`);
  process.exitCode = 1;
});
