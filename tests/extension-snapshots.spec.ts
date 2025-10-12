import { expect, test as base, chromium, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const STORAGE_KEY = 'mountaineersAssistantData';
const SETTINGS_KEY = 'mountaineersAssistantSettings';
const ACTIVE_TAB_URL = 'https://www.mountaineers.org/my-dashboard';

interface ExtensionHarness {
  context: BrowserContext;
  extensionId: string;
  summary: {
    activityCount: number;
    lastUpdated: string | null;
    newActivities: number;
  };
}

interface SampleData {
  activities?: unknown[];
  people?: unknown[];
  rosterEntries?: unknown[];
  lastUpdated?: string | null;
  currentUserUid?: string | null;
}

const repoRoot = process.cwd();
const distDir = path.resolve(repoRoot, 'dist');
const sampleDataPath = path.resolve(repoRoot, 'src', 'data', 'sample-activities.json');

const test = base.extend<ExtensionHarness>({
  context: async ({}, use) => {
    const tempRoot = path.resolve(repoRoot, '.playwright-tmp');
    await fs.mkdir(tempRoot, { recursive: true });
    const userDataDir = await fs.mkdtemp(path.join(tempRoot, 'chromium-'));
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: true,
      args: [
        '--headless=new',
        `--disable-extensions-except=${distDir}`,
        `--load-extension=${distDir}`,
        '--disable-sync',
        '--disable-features=DialMediaRouteProvider',
      ],
    });

    await context.route('**/*', (route) => {
      const url = route.request().url();
      if (
        url.startsWith('chrome-extension://') ||
        url.startsWith('devtools://') ||
        url.startsWith('about:') ||
        url.startsWith('data:') ||
        url.startsWith('file:')
      ) {
        route.continue();
        return;
      }
      route.abort();
    });

    try {
      await use(context);
    } finally {
      await context.close();
      await fs.rm(userDataDir, { recursive: true, force: true }).catch(() => {});
    }
  },
  extensionId: [
    async ({ context }, use) => {
      let [serviceWorker] = context.serviceWorkers();
      if (!serviceWorker) {
        serviceWorker = await context.waitForEvent('serviceworker');
      }
      const extensionUrl = new URL(serviceWorker.url());
      const extensionId = extensionUrl.hostname;
      await use(extensionId);
    },
    { auto: true },
  ],
  summary: [
    async ({ context }, use) => {
      const rawData = await fs.readFile(sampleDataPath, 'utf-8');
      const fixture = JSON.parse(rawData) as SampleData;
      const activities = Array.isArray(fixture.activities) ? fixture.activities : [];
      const people = Array.isArray(fixture.people) ? fixture.people : [];
      const rosterEntries = Array.isArray(fixture.rosterEntries) ? fixture.rosterEntries : [];
      const lastUpdated = typeof fixture.lastUpdated === 'string' ? fixture.lastUpdated : null;
      const currentUserUid =
        typeof fixture.currentUserUid === 'string' ? fixture.currentUserUid : null;

      let [serviceWorker] = context.serviceWorkers();
      if (!serviceWorker) {
        serviceWorker = await context.waitForEvent('serviceworker');
      }

      await serviceWorker.evaluate(
        async ({ storageKey, settingsKey, cache, settings }) => {
          try {
            await chrome.storage.local.set({
              [storageKey]: cache,
              [settingsKey]: settings,
            });
          } catch (error) {
            console.error(
              'Mountaineers Assistant test harness failed to seed storage:',
              error instanceof Error ? error.message : String(error)
            );
          }
        },
        {
          storageKey: STORAGE_KEY,
          settingsKey: SETTINGS_KEY,
          cache: {
            activities,
            people,
            rosterEntries,
            lastUpdated,
            currentUserUid,
          },
          settings: {
            showAvatars: true,
            fetchLimit: 25,
          },
        }
      );
      await context.addInitScript(
        ({
          activeTabUrl,
          summaryPayload,
          cachePayload,
          settingsPayload,
          storageKey,
          settingsKey,
        }) => {
          const applyStubs = () => {
            const chromeApi = (globalThis as typeof globalThis & { chrome?: typeof chrome }).chrome;
            if (!chromeApi) {
              return false;
            }

            const clone = <T>(value: T): T => {
              if (typeof structuredClone === 'function') {
                return structuredClone(value);
              }
              return JSON.parse(JSON.stringify(value));
            };

            type CacheState = typeof cachePayload | null;
            type SettingsState = typeof settingsPayload;

            let cacheState: CacheState = clone(cachePayload);
            let settingsState: SettingsState = clone(settingsPayload);

            const storageListeners: Array<
              Parameters<typeof chrome.storage.onChanged.addListener>[0]
            > = [];

            if (
              chromeApi.storage?.onChanged?.addListener &&
              !(chromeApi.storage.onChanged.addListener as { __maStubbed?: boolean }).__maStubbed
            ) {
              const originalAdd = chromeApi.storage.onChanged.addListener.bind(
                chromeApi.storage.onChanged
              );
              const wrappedAdd = (
                listener: Parameters<typeof chrome.storage.onChanged.addListener>[0]
              ) => {
                storageListeners.push(listener);
                return originalAdd(listener);
              };
              Object.defineProperty(wrappedAdd, '__maStubbed', {
                value: true,
                configurable: false,
                enumerable: false,
                writable: false,
              });
              Object.defineProperty(chromeApi.storage.onChanged, 'addListener', {
                configurable: true,
                value: wrappedAdd,
              });
            }

            const emitStorageChange = (key: string, newValue: unknown, oldValue: unknown) => {
              if (!storageListeners.length) {
                return;
              }
              const change = {
                [key]: {
                  newValue,
                  oldValue,
                },
              } as Record<string, chrome.storage.StorageChange>;
              for (const listener of storageListeners) {
                try {
                  listener(change, 'local');
                } catch (error) {
                  console.warn('Mountaineers Assistant test stub: storage listener error', error);
                }
              }
            };

            const stubTab = {
              id: 1,
              index: 0,
              windowId: 1,
              highlighted: true,
              active: true,
              pinned: false,
              incognito: false,
              url: activeTabUrl,
            } as unknown as chrome.tabs.Tab;

            if (
              chromeApi.tabs?.query &&
              !(chromeApi.tabs.query as { __maStubbed?: boolean }).__maStubbed
            ) {
              const originalQuery = chromeApi.tabs.query.bind(chromeApi.tabs);
              const stubbedQuery = ((
                queryInfo: chrome.tabs.QueryInfo,
                callback?: (result: chrome.tabs.Tab[]) => void
              ) => {
                if (queryInfo?.active && queryInfo.currentWindow) {
                  const result = [stubTab];
                  if (typeof callback === 'function') {
                    callback(result);
                    return;
                  }
                  return Promise.resolve(result);
                }
                return originalQuery(queryInfo, callback as (result: chrome.tabs.Tab[]) => void);
              }) as unknown as typeof chrome.tabs.query;
              Object.defineProperty(stubbedQuery, '__maStubbed', {
                value: true,
                configurable: false,
                enumerable: false,
                writable: false,
              });
              Object.defineProperty(chromeApi.tabs, 'query', {
                configurable: true,
                value: stubbedQuery,
              });
            }

            if (
              chromeApi.runtime?.sendMessage &&
              !(chromeApi.runtime.sendMessage as { __maStubbed?: boolean }).__maStubbed
            ) {
              const originalSendMessage = chromeApi.runtime.sendMessage.bind(chromeApi.runtime);
              const stubbedSendMessage = ((
                message: unknown,
                optionsOrCallback?: chrome.runtime.MessageOptions | ((response: unknown) => void),
                maybeCallback?: (response: unknown) => void
              ) => {
                const callback =
                  typeof optionsOrCallback === 'function' ? optionsOrCallback : maybeCallback;
                const payload = message as { type?: string; limit?: number | null } | undefined;
                if (payload?.type === 'get-refresh-status') {
                  callback?.({ success: true, inProgress: false });
                  return undefined;
                }
                if (payload?.type === 'start-refresh') {
                  callback?.({
                    success: true,
                    summary: summaryPayload,
                  });
                  return undefined;
                }
                return originalSendMessage(
                  message,
                  optionsOrCallback as never,
                  maybeCallback as never
                );
              }) as unknown as typeof chrome.runtime.sendMessage;
              Object.defineProperty(stubbedSendMessage, '__maStubbed', {
                value: true,
                configurable: false,
                enumerable: false,
                writable: false,
              });
              Object.defineProperty(chromeApi.runtime, 'sendMessage', {
                configurable: true,
                value: stubbedSendMessage,
              });
            }

            if (
              chromeApi.storage?.local &&
              !(chromeApi.storage.local.get as { __maStubbed?: boolean }).__maStubbed
            ) {
              const originalGet = chromeApi.storage.local.get.bind(chromeApi.storage.local);
              const originalSet = chromeApi.storage.local.set.bind(chromeApi.storage.local);
              const originalRemove = chromeApi.storage.local.remove.bind(chromeApi.storage.local);
              const originalClear = chromeApi.storage.local.clear.bind(chromeApi.storage.local);

              const resolveKeys = (
                keys?: string | string[] | Record<string, unknown> | null
              ): string[] => {
                if (!keys) {
                  return [storageKey, settingsKey];
                }
                if (typeof keys === 'string') {
                  return [keys];
                }
                if (Array.isArray(keys)) {
                  return keys;
                }
                return Object.keys(keys);
              };

              const stubbedGet = ((keys?: string | string[] | Record<string, unknown> | null) => {
                const requested = resolveKeys(keys);
                const result: Record<string, unknown> = {};
                for (const key of requested) {
                  if (key === storageKey) {
                    result[key] = clone(cacheState);
                  } else if (key === settingsKey) {
                    result[key] = clone(settingsState);
                  }
                }

                if (typeof keys === 'object' && keys !== null && !Array.isArray(keys)) {
                  for (const [fallbackKey, fallbackValue] of Object.entries(keys)) {
                    if (!(fallbackKey in result)) {
                      result[fallbackKey] = fallbackValue;
                    }
                  }
                }

                return Promise.resolve(result);
              }) as unknown as typeof chrome.storage.local.get;

              const stubbedSet = ((items: Record<string, unknown>) => {
                const updated: string[] = [];
                if (storageKey in items) {
                  const previous = clone(cacheState);
                  const nextValue = items[storageKey] as CacheState;
                  cacheState = nextValue == null ? null : clone(nextValue);
                  emitStorageChange(storageKey, clone(cacheState), previous);
                  updated.push(storageKey);
                }
                if (settingsKey in items) {
                  const previous = clone(settingsState);
                  const nextSettings = items[settingsKey] as Partial<SettingsState> | undefined;
                  settingsState = {
                    ...clone(settingsPayload),
                    ...(nextSettings ? clone(nextSettings) : {}),
                  };
                  emitStorageChange(settingsKey, clone(settingsState), previous);
                  updated.push(settingsKey);
                }
                if (!updated.length) {
                  return originalSet(items);
                }
                return Promise.resolve();
              }) as unknown as typeof chrome.storage.local.set;

              const stubbedRemove = ((keys: string | string[]) => {
                const requested = resolveKeys(keys);
                let touched = false;
                if (requested.includes(storageKey)) {
                  const previous = clone(cacheState);
                  cacheState = null;
                  emitStorageChange(storageKey, null, previous);
                  touched = true;
                }
                if (requested.includes(settingsKey)) {
                  const previous = clone(settingsState);
                  settingsState = clone(settingsPayload);
                  emitStorageChange(settingsKey, clone(settingsState), previous);
                  touched = true;
                }
                if (!touched) {
                  return originalRemove(keys);
                }
                return Promise.resolve();
              }) as unknown as typeof chrome.storage.local.remove;

              const stubbedClear = (() => {
                const prevCache = clone(cacheState);
                const prevSettings = clone(settingsState);
                cacheState = null;
                settingsState = clone(settingsPayload);
                emitStorageChange(storageKey, null, prevCache);
                emitStorageChange(settingsKey, clone(settingsState), prevSettings);
                return Promise.resolve();
              }) as unknown as typeof chrome.storage.local.clear;

              Object.defineProperty(stubbedGet, '__maStubbed', {
                value: true,
                configurable: false,
                enumerable: false,
                writable: false,
              });

              Object.assign(chromeApi.storage.local, {
                get: stubbedGet,
                set: stubbedSet,
                remove: stubbedRemove,
                clear: stubbedClear,
              });
            }

            return true;
          };

          if (!applyStubs()) {
            const interval = setInterval(() => {
              if (applyStubs()) {
                clearInterval(interval);
              }
            }, 10);
          }
        },
        {
          activeTabUrl: ACTIVE_TAB_URL,
          summaryPayload: {
            activityCount: activities.length,
            lastUpdated,
            newActivities: 0,
          },
          cachePayload: {
            activities,
            people,
            rosterEntries,
            lastUpdated,
            currentUserUid,
          },
          settingsPayload: {
            showAvatars: true,
            fetchLimit: 25,
          },
          storageKey: STORAGE_KEY,
          settingsKey: SETTINGS_KEY,
        }
      );

      await use({
        activityCount: activities.length,
        lastUpdated,
        newActivities: 0,
      });
    },
    { auto: true },
  ],
});

test.describe.configure({ mode: 'serial' });

test.describe('Mountaineers Assistant extension snapshots', () => {
  const openInsightsPage = async (context: BrowserContext, extensionId: string) => {
    const page = await context.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`chrome-extension://${extensionId}/insights.html`);
    await page.waitForSelector('text=Activity Insights Dashboard', { state: 'visible' });
    await page.waitForSelector('text=Recent activities', { state: 'visible' });
    await page.addStyleTag({
      content: 'body { scrollbar-width: none; } body::-webkit-scrollbar { display: none; }',
    });
    return page;
  };

  type FilterOverrides = Partial<Record<'activityType' | 'category' | 'role', string[]>>;

  const applyDashboardFilters = async (page: Page, overrides: FilterOverrides) => {
    await page.evaluate((next) => {
      window.mountaineersDashboard?.setFilters(next);
    }, overrides);

    await page.waitForFunction((expected) => {
      const current = window.mountaineersDashboard?.getFilters();
      if (!current) {
        return false;
      }
      return Object.entries(expected).every(([key, value]) => {
        if (!value || !Array.isArray(value)) {
          return true;
        }
        const active = current[key as keyof typeof current];
        if (!Array.isArray(active) || active.length !== value.length) {
          return false;
        }
        return active.every((entry, index) => entry === value[index]);
      });
    }, overrides);
  };

  test('popup renders cached snapshot', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.setViewportSize({ width: 420, height: 640 });
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForSelector('text=Mountaineers Assistant', { state: 'visible' });
    await page.waitForSelector('text=Last refresh completed', { state: 'visible' });
    await expect(page).toHaveScreenshot('popup.png', { fullPage: true });
    await page.close();
  });

  test('preferences render seeded cache view', async ({ context, extensionId }) => {
    const page = await context.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`chrome-extension://${extensionId}/preferences.html`);
    await page.waitForSelector('text=Preferences', { state: 'visible' });
    await page.waitForSelector('text=Cached Activities Data', { state: 'visible' });
    await expect(page).toHaveScreenshot('preferences.png', { fullPage: true });
    await page.close();
  });

  test('insights dashboard renders default analytics', async ({ context, extensionId }) => {
    const page = await openInsightsPage(context, extensionId);
    await expect(page).toHaveScreenshot('insights-default.png', {
      fullPage: true,
      animations: 'disabled',
    });
    await page.close();
  });

  test('insights dashboard shows activity filter dropdown', async ({ context, extensionId }) => {
    const page = await openInsightsPage(context, extensionId);
    const activityTypeChoices = page.locator('label:has-text("Activity type") .choices');
    await activityTypeChoices.locator('.choices__inner').click();
    await expect(activityTypeChoices).toHaveAttribute('class', /is-open/);
    await expect(page).toHaveScreenshot('insights-filter-dropdown.png', {
      fullPage: true,
      animations: 'disabled',
    });
    await page.close();
  });

  test('insights dashboard applies targeted filters', async ({ context, extensionId }) => {
    const page = await openInsightsPage(context, extensionId);
    await applyDashboardFilters(page, {
      activityType: ['Climbing'],
      category: ['course'],
      role: ['Instructor'],
    });
    await expect(page.locator('text=No activities match the current filters')).toBeHidden();
    await expect(page).toHaveScreenshot('insights-filtered.png', {
      fullPage: true,
      animations: 'disabled',
    });
    await page.close();
  });

  test('insights dashboard shows empty state when filters exclude activities', async ({
    context,
    extensionId,
  }) => {
    const page = await openInsightsPage(context, extensionId);
    await applyDashboardFilters(page, {
      activityType: ['Trail Running'],
      category: ['trip'],
      role: ['Instructor'],
    });
    await page.waitForSelector(
      'text=No activities match the current filters. Adjust selections to see insights.',
      { state: 'visible' }
    );
    await expect(page).toHaveScreenshot('insights-filter-empty.png', {
      fullPage: true,
      animations: 'disabled',
    });
    await page.close();
  });
});
