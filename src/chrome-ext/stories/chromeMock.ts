import type { ExtensionCache, ExtensionSettings } from '../shared/types';

const STORAGE_KEY = 'mountaineersAssistantData';
const SETTINGS_KEY = 'mountaineersAssistantSettings';

type RuntimeListener = Parameters<typeof chrome.runtime.onMessage.addListener>[0];
type StorageListener = Parameters<typeof chrome.storage.onChanged.addListener>[0];

const clone = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

export interface ChromeMockConfig {
  data?: ExtensionCache | null;
  settings?: ExtensionSettings;
  popupSummary?: {
    activityCount: number;
    lastUpdated: string | null;
    newActivities: number;
  };
  tabsUrl?: string;
}

const defaultSettings: ExtensionSettings = {
  showAvatars: true,
  fetchLimit: null,
};

export const createChromeMock = ({
  data,
  settings,
  popupSummary,
  tabsUrl = 'https://www.mountaineers.org/my-dashboard',
}: ChromeMockConfig = {}) => {
  const storageListeners: StorageListener[] = [];
  const runtimeListeners: RuntimeListener[] = [];

  let currentData: ExtensionCache | null = data ? clone(data) : null;
  let currentSettings: ExtensionSettings = { ...defaultSettings, ...settings };

  const emitStorageChange = (key: string, newValue: unknown, oldValue: unknown) => {
    const change = {
      [key]: {
        newValue,
        oldValue,
      },
    } as Record<string, chrome.storage.StorageChange>;
    storageListeners.forEach((listener) => listener(change, 'local'));
  };

  const runtime = {
    sendMessage: (message: unknown, responseCallback?: (response: unknown) => void): void => {
      const payload = message as { type?: string; limit?: number | null };
      if (payload?.type === 'get-refresh-status') {
        responseCallback?.({ success: true, inProgress: false });
        return;
      }
      if (payload?.type === 'start-refresh') {
        const summary =
          popupSummary ??
          ({
            activityCount: currentData?.activities?.length ?? 0,
            lastUpdated: currentData?.lastUpdated ?? new Date().toISOString(),
            newActivities: payload.limit ? Math.min(payload.limit, 3) : 0,
          } as const);
        responseCallback?.({ success: true, summary });
        return;
      }
      responseCallback?.({ success: true });
    },
    onMessage: {
      addListener: (listener: RuntimeListener) => {
        runtimeListeners.push(listener);
      },
      removeListener: (listener: RuntimeListener) => {
        const index = runtimeListeners.indexOf(listener);
        if (index >= 0) {
          runtimeListeners.splice(index, 1);
        }
      },
    },
  };

  const storage = {
    local: {
      get: async (keys?: string | string[] | Record<string, unknown>) => {
        if (!keys) {
          return {
            [STORAGE_KEY]: clone(currentData),
            [SETTINGS_KEY]: clone(currentSettings),
          };
        }

        const requestedKeys = Array.isArray(keys)
          ? keys
          : typeof keys === 'string'
            ? [keys]
            : Object.keys(keys);

        const result: Record<string, unknown> = {};
        for (const key of requestedKeys) {
          if (key === STORAGE_KEY) {
            result[key] = clone(currentData);
          }
          if (key === SETTINGS_KEY) {
            result[key] = clone(currentSettings);
          }
        }
        return result;
      },
      set: async (items: Record<string, unknown>) => {
        if (STORAGE_KEY in items) {
          const next = (items[STORAGE_KEY] as ExtensionCache | null) ?? null;
          const prev = clone(currentData);
          currentData = clone(next);
          emitStorageChange(STORAGE_KEY, clone(next), prev);
        }
        if (SETTINGS_KEY in items) {
          const prev = clone(currentSettings);
          currentSettings = {
            ...defaultSettings,
            ...(items[SETTINGS_KEY] as Partial<ExtensionSettings>),
          };
          emitStorageChange(SETTINGS_KEY, clone(currentSettings), prev);
        }
      },
      remove: async (key: string | string[]) => {
        const keys = Array.isArray(key) ? key : [key];
        if (keys.includes(STORAGE_KEY)) {
          const prev = clone(currentData);
          currentData = null;
          emitStorageChange(STORAGE_KEY, null, prev);
        }
        if (keys.includes(SETTINGS_KEY)) {
          const prev = clone(currentSettings);
          currentSettings = { ...defaultSettings };
          emitStorageChange(SETTINGS_KEY, clone(currentSettings), prev);
        }
      },
      clear: async () => {
        const prevData = clone(currentData);
        const prevSettings = clone(currentSettings);
        currentData = null;
        currentSettings = { ...defaultSettings };
        emitStorageChange(STORAGE_KEY, null, prevData);
        emitStorageChange(SETTINGS_KEY, clone(currentSettings), prevSettings);
      },
    },
    onChanged: {
      addListener: (listener: StorageListener) => {
        storageListeners.push(listener);
      },
      removeListener: (listener: StorageListener) => {
        const index = storageListeners.indexOf(listener);
        if (index >= 0) {
          storageListeners.splice(index, 1);
        }
      },
    },
  };

  const tabs = {
    query: (_queryInfo: chrome.tabs.QueryInfo, callback: (result: chrome.tabs.Tab[]) => void) => {
      callback([{ id: 1, url: tabsUrl } as chrome.tabs.Tab]);
    },
    onRemoved: {
      addListener: () => {},
      removeListener: () => {},
    },
  };

  const scripting = {
    executeScript: async () => {},
  };

  const chromeMock: Partial<typeof chrome> = {
    storage: storage as typeof chrome.storage,
    runtime: runtime as typeof chrome.runtime,
    tabs: tabs as unknown as typeof chrome.tabs,
    scripting: scripting as unknown as typeof chrome.scripting,
  };

  (window as typeof window & { chrome?: typeof chrome }).chrome = chromeMock as typeof chrome;
  delete (window as typeof window & { mountaineersDashboard?: unknown }).mountaineersDashboard;

  return {
    getData: () => clone(currentData),
    setData: (next: ExtensionCache | null) => {
      currentData = clone(next);
    },
    setSettings: (next: ExtensionSettings) => {
      currentSettings = clone(next);
    },
    triggerRuntimeMessage: (message: unknown) => {
      runtimeListeners.forEach((listener) =>
        listener(message, {} as chrome.runtime.MessageSender, () => {})
      );
    },
  };
};
