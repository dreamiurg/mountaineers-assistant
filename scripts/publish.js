#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const repoRoot = path.resolve(__dirname, '..');
const packageJsonPath = path.join(repoRoot, 'package.json');

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

function ensureCleanGitState() {
  const status = getCommandOutput('git status --porcelain');
  if (status) {
    throw new Error(
      'Git working tree must be clean before publishing. Commit, stash, or discard changes and try again.'
    );
  }
}

function ensureTagDoesNotExist(version) {
  const existing = getCommandOutput(`git tag -l v${version}`);
  if (existing) {
    throw new Error(`Tag v${version} already exists. Choose a new version or delete the tag.`);
  }
}

function getCurrentBranch() {
  const branch = getCommandOutput('git rev-parse --abbrev-ref HEAD');
  if (branch === 'HEAD') {
    throw new Error('Detached HEAD state detected. Checkout a branch before publishing.');
  }
  return branch;
}

function pushBranch(branch) {
  try {
    runCommand('git push');
  } catch (error) {
    console.warn(
      `git push failed (${error.message.trim()}), attempting to set upstream with origin…`
    );
    const remotes = getCommandOutput('git remote');
    if (!remotes.split('\n').includes('origin')) {
      throw new Error(
        'Unable to push branch: no origin remote configured. Push manually once origin is available.'
      );
    }
    runCommand(`git push --set-upstream origin ${branch}`);
  }
}

function ensureGhAvailable() {
  try {
    getCommandOutput('gh --version');
    return true;
  } catch (error) {
    console.warn(
      `GitHub CLI (gh) not found. Skipping release publishing. Install it or create the release manually. (${error.message.trim()})`
    );
    return false;
  }
}

function createGithubRelease(version, zipPath) {
  const ghAvailable = ensureGhAvailable();
  if (!ghAvailable) {
    return;
  }

  const relativeZip = path.relative(repoRoot, zipPath);
  const releaseTitle = `v${version}`;
  const releaseNotes = `Mountaineers Assistant v${version}`;

  try {
    runCommand(
      `gh release create v${version} --title "${releaseTitle}" --notes "${releaseNotes}" "${relativeZip}"`
    );
  } catch (error) {
    console.warn(
      `Failed to create GitHub release for v${version}. You can create it manually and attach ${relativeZip}. (${error.message.trim()})`
    );
  }
}

async function main() {
  ensureCleanGitState();

  const initialPackage = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const currentVersion = initialPackage.version;

  let targetVersion = parseCliVersion();
  if (!targetVersion) {
    targetVersion = await promptForVersion(currentVersion);
  }

  if (!targetVersion) {
    throw new Error('No version provided. Publish aborted.');
  }

  ensureTagDoesNotExist(targetVersion);

  console.log(`\nPreparing release for version ${targetVersion}…\n`);
  runCommand(`node scripts/release.js --version ${targetVersion}`);

  const updatedPackage = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  if (updatedPackage.version !== targetVersion) {
    throw new Error(
      `Release script did not update package.json to ${targetVersion}. Current version is ${updatedPackage.version}.`
    );
  }

  console.log('\nCommitting staged release files…\n');
  runCommand(`git commit -m "release: prepared v${targetVersion}"`);

  console.log('\nBuilding and packaging distributable…\n');
  runCommand(`npm run package -- ${targetVersion}`);

  const zipPath = path.join(repoRoot, `mountaineers-assistant-${targetVersion}.zip`);
  if (!fs.existsSync(zipPath)) {
    throw new Error(`Expected package ${zipPath} not found.`);
  }

  console.log('\nCreating release tag…\n');
  runCommand(`git tag -a v${targetVersion} -m "Release v${targetVersion}"`);

  const branch = getCurrentBranch();
  console.log(`\nPushing branch (${branch})…\n`);
  pushBranch(branch);

  console.log(`\nPushing tag v${targetVersion}…\n`);
  runCommand(`git push origin v${targetVersion}`);

  console.log('\nPublishing GitHub release…\n');
  createGithubRelease(targetVersion, zipPath);

  console.log('\nAll done! Upload the ZIP to the Chrome Web Store to complete the release.\n');
}

main().catch((error) => {
  console.error(`\nPublish script failed: ${error.message}`);
  process.exitCode = 1;
});
