#!/usr/bin/env node
/* eslint-env node */
const fs = require('fs/promises');
const https = require('https');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('playwright');

const ROOT_DIR = path.resolve(__dirname, '..');
const DASHBOARD_DIR = path.join(ROOT_DIR, 'design');
const ARTIFACT_DIR = path.join(ROOT_DIR, 'artifacts', 'dashboards');
const CACHE_DIR = path.join(ROOT_DIR, 'artifacts', 'cache');
const SAMPLE_DATA_PATH = path.join(ROOT_DIR, 'src', 'data', 'sample-activities.json');

const CDN_OVERRIDES = [
  {
    url: 'https://code.highcharts.com/highcharts.js',
    cachePath: path.join(CACHE_DIR, 'highcharts.js'),
    contentType: 'application/javascript',
  },
];

async function getDashboardFiles() {
  try {
    const entries = await fs.readdir(DASHBOARD_DIR, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.html'))
      .map((entry) => ({
        name: entry.name,
        path: path.join(DASHBOARD_DIR, entry.name),
        baseName: path.basename(entry.name, path.extname(entry.name)),
      }));
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function ensureArtifactsDir() {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true });
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

function formatConsoleEntry(entry) {
  const location = entry.location;
  if (location && location.url) {
    const lineInfo = location.lineNumber != null ? `:${location.lineNumber}` : '';
    return `${entry.text}\n    at ${location.url}${lineInfo}`;
  }
  return entry.text;
}

function download(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download ${url} (${response.statusCode})`));
          response.resume();
          return;
        }

        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}

async function prepareCdnAssets() {
  const assets = [];
  for (const asset of CDN_OVERRIDES) {
    let body;
    try {
      body = await fs.readFile(asset.cachePath);
    } catch (readError) {
      if (readError && readError.code !== 'ENOENT') {
        throw readError;
      }
      console.log(`Caching ${asset.url} -> ${path.relative(ROOT_DIR, asset.cachePath)}`);
      body = await download(asset.url);
      await fs.mkdir(path.dirname(asset.cachePath), { recursive: true });
      await fs.writeFile(asset.cachePath, body);
    }

    assets.push({ url: asset.url, body, contentType: asset.contentType });
  }
  return assets;
}

async function main() {
  const dashboards = await getDashboardFiles();
  if (!dashboards.length) {
    console.warn(
      'No legacy dashboard HTML files found. The snapshot pipeline is being migrated to Storybook-rendered stories.'
    );
    return;
  }

  await ensureArtifactsDir();

  const cdnAssets = await prepareCdnAssets();

  let sampleDataBuffer = null;
  let sampleDataObject = null;
  try {
    sampleDataBuffer = await fs.readFile(SAMPLE_DATA_PATH, 'utf8');
    sampleDataObject = JSON.parse(sampleDataBuffer);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      sampleDataBuffer = null;
    } else if (error && error.name === 'SyntaxError') {
      console.warn(
        'Failed to parse src/data/sample-activities.json; falling back to network fetch within the page.'
      );
      sampleDataBuffer = null;
    } else if (error) {
      throw error;
    }
  }

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--allow-file-access-from-files',
        '--disable-web-security',
        '--allow-insecure-localhost',
      ],
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Executable doesn't exist")) {
      console.error(
        'Playwright browser binaries are missing. Run `npx playwright install` once and retry.'
      );
      process.exit(1);
    }
    throw error;
  }

  let hadFailures = false;

  try {
    for (const file of dashboards) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const consoleErrors = [];

      if (sampleDataBuffer) {
        await page.route('**/sample-data.json', (route) => {
          route.fulfill({ status: 200, body: sampleDataBuffer, contentType: 'application/json' });
        });
      }

      if (sampleDataObject) {
        await page.addInitScript((data) => {
          window.__SNAPSHOT_SAMPLE_DATA__ = data;
        }, sampleDataObject);
      }

      for (const asset of cdnAssets) {
        await page.route(asset.url, (route) => {
          route.fulfill({
            status: 200,
            body: asset.body,
            contentType: asset.contentType,
          });
        });
      }

      page.on('console', (message) => {
        if (message.type() === 'error') {
          consoleErrors.push({
            text: message.text(),
            location: message.location(),
          });
        }
      });

      page.on('pageerror', (error) => {
        consoleErrors.push({
          text: error.message,
          location: error.stack ? { url: error.stack.split('\n')[1] || '' } : null,
        });
      });

      const fileUrl = pathToFileURL(file.path).href;
      await page.goto(fileUrl, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      const scenarios = [
        {
          label: 'default view',
          suffix: '',
          settleMs: 800,
          async apply() {
            await page.evaluate(async () => {
              if (!window.mountaineersDashboard || !window.mountaineersDashboard.ready) {
                return;
              }
              await window.mountaineersDashboard.ready;
              window.mountaineersDashboard.clearFilters?.();
            });
            return true;
          },
        },
        {
          label: 'role filter view',
          suffix: 'role-instructor',
          settleMs: 1000,
          async apply() {
            return page.evaluate(async () => {
              if (!window.mountaineersDashboard || !window.mountaineersDashboard.ready) {
                return false;
              }
              const context = await window.mountaineersDashboard.ready;
              const options = window.mountaineersDashboard.getFilterOptions
                ? window.mountaineersDashboard.getFilterOptions()
                : context?.filterOptions;
              if (!options || !Array.isArray(options.roles) || !options.roles.length) return false;

              const targetRole = options.roles.includes('Instructor')
                ? 'Instructor'
                : options.roles[0];

              window.mountaineersDashboard.setFilters?.({
                activityType: [],
                category: [],
                role: [targetRole],
              });
              return true;
            });
          },
        },
        {
          label: 'no results view',
          suffix: 'filtered-empty',
          settleMs: 1200,
          async apply() {
            return page.evaluate(async () => {
              if (!window.mountaineersDashboard || !window.mountaineersDashboard.ready) {
                return false;
              }
              const context = await window.mountaineersDashboard.ready;
              const options = window.mountaineersDashboard.getFilterOptions
                ? window.mountaineersDashboard.getFilterOptions()
                : context?.filterOptions;
              if (!options) return false;

              const pick = (arr, count) =>
                Array.isArray(arr) ? arr.slice(0, Math.max(0, count)) : [];

              const filters = {
                activityType: pick(options.activityTypes, 2),
                category: pick(options.categories, 2),
                role: pick(options.roles, 2),
              };

              window.mountaineersDashboard.setFilters?.(filters);
              return true;
            });
          },
        },
      ];

      for (const scenario of scenarios) {
        const applied = await scenario.apply();
        await page.waitForTimeout(scenario.settleMs);

        const hasVisibleContent = await page.evaluate(() => {
          const body = document.body;
          if (!body) return false;
          const rect = body.getBoundingClientRect();
          return rect.height > 0 && rect.width > 0 && body.innerText.trim().length > 0;
        });

        const suffixPart = scenario.suffix ? `-${scenario.suffix}` : '';
        const screenshotPath = path.join(ARTIFACT_DIR, `${file.baseName}${suffixPart}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(
          `Saved screenshot (${scenario.label}) for ${file.name} -> ${path.relative(
            ROOT_DIR,
            screenshotPath
          )}`
        );

        if (!hasVisibleContent) {
          hadFailures = true;
          console.error(
            `Validation failed: ${file.name} (${scenario.label}) rendered without visible content.`
          );
        }

        if (scenario.suffix && applied === false) {
          hadFailures = true;
          console.error(
            `Filtered scenario skipped for ${file.name}; filter data unavailable in page.`
          );
        }
      }

      if (consoleErrors.length) {
        hadFailures = true;
        console.error(`Console errors detected while rendering ${file.name}:`);
        consoleErrors.forEach((entry) => console.error(`  - ${formatConsoleEntry(entry)}`));
      }

      await page.close();
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  if (hadFailures) {
    console.error('Dashboard snapshot run finished with validation errors.');
    process.exitCode = 1;
  } else {
    console.log('All dashboard snapshots completed without validation errors.');
  }
}

main().catch((error) => {
  console.error('Snapshot pipeline crashed:', error);
  process.exit(1);
});
