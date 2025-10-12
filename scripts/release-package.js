#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const distPath = path.join(repoRoot, 'dist');
const packageJsonPath = path.join(repoRoot, 'package.json');
const manifestPath = path.join(repoRoot, 'src', 'chrome-ext', 'manifest.json');

function runCommand(command, options = {}) {
  execSync(command, {
    stdio: 'inherit',
    cwd: repoRoot,
    ...options,
  });
}

function getCommandOutput(command, options = {}) {
  return execSync(command, {
    stdio: 'pipe',
    cwd: repoRoot,
    encoding: 'utf8',
    ...options,
  }).trim();
}

function ensureCleanGitState() {
  const status = getCommandOutput('git status --porcelain');
  if (status) {
    throw new Error(
      'Git working tree must be clean before packaging. Commit or stash changes and try again.'
    );
  }
}

function ensureDistIsPopulated() {
  if (!fs.existsSync(distPath)) {
    throw new Error('dist/ directory not found. Did the build step complete successfully?');
  }

  const contents = fs.readdirSync(distPath);
  if (contents.length === 0) {
    throw new Error('dist/ is empty. Packaging aborted.');
  }
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureVersionAlignment(expectedVersion) {
  const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-.]+))?(?:\+([0-9A-Za-z-.]+))?$/;

  if (!semverRegex.test(expectedVersion)) {
    throw new Error(
      `Provided version "${expectedVersion}" is not a valid semantic version (expected format: major.minor.patch).`
    );
  }

  const pkg = loadJson(packageJsonPath);
  if (pkg.version !== expectedVersion) {
    throw new Error(
      `Provided version "${expectedVersion}" does not match package.json version "${pkg.version}".`
    );
  }

  const manifest = loadJson(manifestPath);
  if (manifest.version !== expectedVersion) {
    throw new Error(
      `Manifest version "${manifest.version}" does not match the provided version "${expectedVersion}". Run npm run release first.`
    );
  }
}

function packageBuild(version) {
  const zipName = `mountaineers-assistant-${version}.zip`;
  const zipPath = path.join(repoRoot, zipName);

  if (fs.existsSync(zipPath)) {
    fs.rmSync(zipPath);
  }

  const zipTarget = path.relative(distPath, zipPath);

  console.log(`\nCreating ${zipName} in repository root…\n`);
  runCommand(`zip -r "${zipTarget}" .`, { cwd: distPath });

  if (!fs.existsSync(zipPath)) {
    throw new Error('Packaging completed without creating the expected ZIP file.');
  }

  console.log(`\nPackaging complete: ${path.relative(repoRoot, zipPath)}`);
}

function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== '--');
  const targetVersion = args[0];

  if (!targetVersion) {
    throw new Error('Usage: npm run package -- <version>');
  }

  ensureCleanGitState();
  ensureVersionAlignment(targetVersion);

  console.log('\nBuilding extension bundle…\n');
  runCommand('npm run build');

  ensureDistIsPopulated();
  packageBuild(targetVersion);
}

try {
  main();
} catch (error) {
  console.error(`\nPackaging failed: ${error.message}`);
  process.exitCode = 1;
}
