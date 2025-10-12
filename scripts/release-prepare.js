#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

// eslint-disable-next-line no-unused-vars
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

  // TODO: Implement release preparation steps

  console.log('\nRelease preparation completed!\n');
}

main().catch((error) => {
  console.error(`\nRelease preparation failed: ${error.message}`);
  process.exitCode = 1;
});
