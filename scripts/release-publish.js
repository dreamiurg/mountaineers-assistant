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

function ensureGhAvailable() {
  try {
    getCommandOutput('gh --version');
  } catch {
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
  } catch {
    console.log('⚠️  Could not check remote tags, proceeding...\n');
  }

  console.log(`✓ Tag ${tagName} does not exist\n`);
}

function parseVersion() {
  const args = process.argv.slice(2);
  return args[0] ? args[0].trim() : null;
}

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

async function main() {
  ensureGhAvailable();

  const version = parseVersion();

  if (!version) {
    throw new Error('Version required. Usage: npm run release:publish <version>');
  }

  ensureOnMain();
  ensureCleanWorkingTree();
  ensureMainUpToDate();
  ensureVersionMatches(version);
  ensureTagDoesNotExist(version);

  console.log(`\nPublishing release for version ${version}...\n`);

  runTypecheck();
  buildExtension();
  const zipPath = packageExtension(version);
  const tagName = createAndPushTag(version);
  const releaseUrl = createGitHubRelease(version, zipPath);

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
}

main().catch((error) => {
  console.error(`\nRelease publishing failed: ${error.message}`);
  process.exitCode = 1;
});
