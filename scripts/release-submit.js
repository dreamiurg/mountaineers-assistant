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

  // Verify package.json version matches branch name
  const packageJsonPath = path.join(repoRoot, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  if (pkg.version !== version) {
    throw new Error(
      `Version mismatch: branch name indicates v${version} but package.json has v${pkg.version}. ` +
        'Did you manually edit package.json after running release:bump?'
    );
  }

  console.log(`✓ Version verified: ${version}\n`);

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
