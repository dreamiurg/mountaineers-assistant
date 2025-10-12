#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { generateChangelog } = require('./changelog-utils');

const repoRoot = path.resolve(__dirname, '..');
const packageJsonPath = path.join(repoRoot, 'package.json');
const packageLockPath = path.join(repoRoot, 'package-lock.json');
const manifestPath = path.join(repoRoot, 'src', 'chrome-ext', 'manifest.json');
const changelogPath = path.join(repoRoot, 'CHANGELOG.md');

function runCommand(command, options = {}) {
  execSync(command, {
    stdio: 'inherit',
    cwd: repoRoot,
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

function ensureCleanGitState() {
  const status = getCommandOutput('git status --porcelain');
  if (status) {
    throw new Error(
      'Git working tree must be clean before running the release script. Commit, stash, or discard changes and try again.'
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

function compareIdentifiers(a, b) {
  const numeric = /^\d+$/;
  const isNumericA = numeric.test(a);
  const isNumericB = numeric.test(b);

  if (isNumericA && isNumericB) {
    return Number(a) - Number(b);
  }

  if (isNumericA) return -1;
  if (isNumericB) return 1;

  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function compareSemver(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;

  const aPre = a.prerelease;
  const bPre = b.prerelease;

  if (!aPre.length && !bPre.length) return 0;
  if (!aPre.length) return 1;
  if (!bPre.length) return -1;

  const len = Math.max(aPre.length, bPre.length);
  for (let i = 0; i < len; i += 1) {
    const aId = aPre[i];
    const bId = bPre[i];

    if (aId === undefined) return -1;
    if (bId === undefined) return 1;

    const diff = compareIdentifiers(aId, bId);
    if (diff !== 0) return diff;
  }

  return 0;
}

function promptForVersion(currentVersion) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = `Enter the new release version (current ${currentVersion}): `;

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function updateManifest(version) {
  const manifest = loadJson(manifestPath);
  manifest.version = version;

  if (manifest.version_name) {
    manifest.version_name = version;
  }

  writeJson(manifestPath, manifest);
}

function parseCliVersion() {
  const args = process.argv.slice(2);
  let versionArg = null;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--') {
      break;
    }
    if (arg === '--version' && args[i + 1]) {
      versionArg = args[i + 1];
      break;
    }
    if (!arg.startsWith('--') && !versionArg) {
      versionArg = arg;
      break;
    }
  }

  return versionArg ? versionArg.trim() : null;
}

async function main() {
  ensureCleanGitState();

  const pkg = loadJson(packageJsonPath);
  const currentVersion = pkg.version;

  if (!currentVersion) {
    throw new Error('Unable to read current version from package.json.');
  }

  const currentSemver = parseSemver(currentVersion);
  if (!currentSemver) {
    throw new Error(`Current package version "${currentVersion}" is not a valid semver string.`);
  }

  let nextVersionInput = parseCliVersion();
  if (!nextVersionInput) {
    nextVersionInput = await promptForVersion(currentVersion);
  }

  if (!nextVersionInput) {
    throw new Error('No version provided. Release aborted.');
  }

  const nextSemver = parseSemver(nextVersionInput);
  if (!nextSemver) {
    throw new Error(
      `Version "${nextVersionInput}" is not a valid semantic version (expected format: major.minor.patch).`
    );
  }

  if (compareSemver(nextSemver, currentSemver) <= 0) {
    throw new Error(
      `Version "${nextSemver.raw}" must be greater than the current version "${currentSemver.raw}".`
    );
  }

  console.log('\nRunning typecheck before version bump…\n');
  runCommand('npm run typecheck');

  console.log(`\nUpdating package.json and package-lock.json to ${nextSemver.raw}…\n`);
  runCommand(`npm version ${nextSemver.raw} --no-git-tag-version`);

  console.log(`\nUpdating manifest version to ${nextSemver.raw}…\n`);
  updateManifest(nextSemver.raw);

  console.log(`\nGenerating CHANGELOG.md entry for ${nextSemver.raw}…\n`);
  const changelogDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const changelogContent = generateChangelog(nextSemver.raw, changelogDate);
  fs.writeFileSync(changelogPath, changelogContent, 'utf8');

  console.log('\nFormatting release files with Prettier…\n');
  runCommand('npx prettier --write package.json src/chrome-ext/manifest.json CHANGELOG.md');

  const filesToStage = [packageJsonPath, manifestPath, changelogPath];

  if (fs.existsSync(packageLockPath)) {
    filesToStage.push(packageLockPath);
  }

  console.log('\nStaging release files…\n');
  filesToStage.forEach((file) => {
    runCommand(`git add "${path.relative(repoRoot, file)}"`);
  });

  console.log(
    '\nRelease preparation completed. Review the staged changes with "git diff --cached", then commit and tag when ready.'
  );
}

main().catch((error) => {
  console.error(`\nRelease script failed: ${error.message}`);
  process.exitCode = 1;
});
