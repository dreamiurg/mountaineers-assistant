import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ExtensionCache, RefreshSummary } from '../../shared/types';
import {
  DEFAULT_DISPLAY_SETTINGS,
  buildSummary,
  calculateDashboard,
  formatNumber,
  prepareDashboardData,
  titleCase,
} from '../utils';
import type { DashboardFilters, DashboardView, DisplaySettings, PreparedData } from '../types';

const STORAGE_KEY = 'mountaineersAssistantData';
const SETTINGS_KEY = 'mountaineersAssistantSettings';
const REFRESH_MESSAGE = 'start-refresh';
const REFRESH_PROGRESS_MESSAGE = 'refresh-progress';
const REFRESH_STATUS_CHANGE_MESSAGE = 'refresh-status-changed';

type ReadyPayload = {
  filterOptions: PreparedData['filterOptions'] | null;
  empty?: boolean;
};

type ReadyResolver = (payload: ReadyPayload | null) => void;

const INITIAL_FILTERS: DashboardFilters = {
  activityType: [],
  category: [],
  role: [],
  partner: [],
};

const cloneFilterOptions = (options: PreparedData['filterOptions'] | null) => {
  if (!options) return null;
  if (typeof structuredClone === 'function') {
    return structuredClone(options);
  }
  return JSON.parse(JSON.stringify(options)) as PreparedData['filterOptions'];
};

const normalizeSettings = (value: unknown): DisplaySettings => {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_DISPLAY_SETTINGS };
  }
  const candidate = value as Partial<DisplaySettings>;
  return {
    showAvatars:
      typeof candidate.showAvatars === 'boolean'
        ? candidate.showAvatars
        : DEFAULT_DISPLAY_SETTINGS.showAvatars,
  };
};

const sanitizeSelection = (values: unknown, allowed: string[]): string[] => {
  if (!Array.isArray(values)) {
    return [];
  }
  const allowedSet = new Set(allowed);
  return values
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .filter((value) => allowedSet.has(value));
};

const arraysEqual = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
};

export interface InsightsState {
  loading: boolean;
  error: string | null;
  empty: boolean;
  filters: DashboardFilters;
  filterOptions: PreparedData['filterOptions'];
  settings: DisplaySettings;
  view: DashboardView | null;
  summary: string;
  statusMessage: string;
  setFilter: (key: keyof DashboardFilters, values: string[]) => void;
  clearFilters: () => void;
  fetchActivities: () => Promise<void>;
  isLoading: boolean;
  fetchLimit: number | null;
  refreshSummary: RefreshSummary;
}

declare global {
  interface Window {
    mountaineersDashboard?: {
      ready: Promise<ReadyPayload | null>;
      getFilters: () => DashboardFilters;
      getFilterOptions: () => PreparedData['filterOptions'] | null;
      clearFilters: () => void;
      setFilters: (filters: Partial<DashboardFilters>) => void;
      filterOptions?: PreparedData['filterOptions'] | null;
    };
  }
}

export const useInsightsDashboard = (): InsightsState => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);
  const [filters, setFilters] = useState<DashboardFilters>(INITIAL_FILTERS);
  const [filterOptions, setFilterOptions] = useState<PreparedData['filterOptions']>({
    activityTypes: [],
    categories: [],
    roles: [],
    partners: [],
  });
  const [settings, setSettings] = useState<DisplaySettings>(DEFAULT_DISPLAY_SETTINGS);
  const [view, setView] = useState<DashboardView | null>(null);
  const [summary, setSummary] = useState<string>(
    'Snapshot of recent Mountaineers activities with quick views of cadence, discipline mix, and the partners you adventure with most often.'
  );
  const [statusMessage, setStatusMessage] = useState<string>('Loading cached data…');
  const [isLoading, setIsLoading] = useState(false);
  const [fetchLimit, setFetchLimit] = useState<number | null>(null);
  const [refreshSummary, setRefreshSummary] = useState<RefreshSummary>({
    activityCount: 0,
    lastUpdated: null,
    newActivities: 0,
  });

  const baseDataRef = useRef<PreparedData | null>(null);
  const filtersRef = useRef<DashboardFilters>(filters);
  const filterOptionsRef = useRef<PreparedData['filterOptions']>(filterOptions);
  const readyResolveRef = useRef<ReadyResolver | null>(null);
  const readyPromiseRef = useRef<Promise<ReadyPayload | null>>(
    new Promise((resolve) => {
      readyResolveRef.current = resolve;
    })
  );

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    filterOptionsRef.current = filterOptions;
  }, [filterOptions]);

  const resolveReady = useCallback((payload: ReadyPayload | null) => {
    if (readyResolveRef.current) {
      readyResolveRef.current(payload);
      readyResolveRef.current = null;
    }
  }, []);

  useEffect(() => {
    window.mountaineersDashboard = {
      ready: readyPromiseRef.current,
      getFilters: () => ({ ...filtersRef.current }),
      getFilterOptions: () => cloneFilterOptions(filterOptionsRef.current),
      clearFilters: () => {
        setFilters({ ...INITIAL_FILTERS });
      },
      setFilters: (overrides) => {
        setFilters((current) => {
          const options = filterOptionsRef.current;
          return {
            activityType: overrides.activityType
              ? sanitizeSelection(overrides.activityType, options.activityTypes)
              : current.activityType,
            category: overrides.category
              ? sanitizeSelection(overrides.category, options.categories)
              : current.category,
            role: overrides.role ? sanitizeSelection(overrides.role, options.roles) : current.role,
            partner: overrides.partner
              ? sanitizeSelection(
                  overrides.partner,
                  options.partners.map((p) => p.uid)
                )
              : current.partner,
          };
        });
      },
      filterOptions: cloneFilterOptions(filterOptionsRef.current),
    };
  }, []);

  const loadSettings = useCallback(async (): Promise<DisplaySettings> => {
    try {
      const stored = await chrome.storage.local.get(SETTINGS_KEY);
      return normalizeSettings(stored?.[SETTINGS_KEY]);
    } catch (err) {
      console.warn('Mountaineers Assistant insights: unable to load settings', err);
      return { ...DEFAULT_DISPLAY_SETTINGS };
    }
  }, []);

  const loadExtensionData = useCallback(async (): Promise<ExtensionCache | null> => {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    return (stored?.[STORAGE_KEY] as ExtensionCache | undefined) ?? null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      setLoading(true);
      setError(null);
      setEmpty(false);
      setStatusMessage('Loading cached data…');

      try {
        const [loadedSettings, data] = await Promise.all([loadSettings(), loadExtensionData()]);
        if (cancelled) return;

        setSettings(loadedSettings);

        if (!data) {
          setEmpty(true);
          setStatusMessage(
            'No cached data available. Open the extension popup and run a refresh first.'
          );
          resolveReady({ filterOptions: null, empty: true });
          setFilterOptions({ activityTypes: [], categories: [], roles: [], partners: [] });
          window.mountaineersDashboard!.filterOptions = null;
          setLoading(false);
          return;
        }

        const prepared = prepareDashboardData(data);
        baseDataRef.current = prepared;
        setFilterOptions(prepared.filterOptions);
        window.mountaineersDashboard!.filterOptions = cloneFilterOptions(prepared.filterOptions);

        if (!prepared.activities.length) {
          setEmpty(true);
          setStatusMessage(
            'No cached activities yet. Open the extension popup to fetch your history.'
          );
          resolveReady({ filterOptions: prepared.filterOptions, empty: true });
          setLoading(false);
          return;
        }

        setFilters({ ...INITIAL_FILTERS });
        resolveReady({ filterOptions: prepared.filterOptions });
        setStatusMessage(
          `Cached ${formatNumber(prepared.activities.length)} activities ready for exploration.`
        );
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setError(err instanceof Error ? err.message : String(err));
        setStatusMessage('Unable to load dashboard data.');
        resolveReady(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    initialize();

    return () => {
      cancelled = true;
    };
  }, [loadExtensionData, loadSettings, resolveReady]);

  useEffect(() => {
    const prepared = baseDataRef.current;
    if (!prepared || !prepared.activities.length) {
      setView(null);
      return;
    }
    const sanitized = {
      activityType: sanitizeSelection(filters.activityType, prepared.filterOptions.activityTypes),
      category: sanitizeSelection(filters.category, prepared.filterOptions.categories),
      role: sanitizeSelection(filters.role, prepared.filterOptions.roles),
      partner: sanitizeSelection(
        filters.partner,
        prepared.filterOptions.partners.map((p) => p.uid)
      ),
    } satisfies DashboardFilters;

    if (
      !arraysEqual(sanitized.activityType, filters.activityType) ||
      !arraysEqual(sanitized.category, filters.category) ||
      !arraysEqual(sanitized.role, filters.role) ||
      !arraysEqual(sanitized.partner, filters.partner)
    ) {
      setFilters(sanitized);
      return;
    }

    const nextView = calculateDashboard(prepared, sanitized);
    setView(nextView);
    setSummary(buildSummary(nextView, sanitized, prepared));
  }, [filters]);

  const setFilter = useCallback((key: keyof DashboardFilters, values: string[]) => {
    setFilters((current) => ({ ...current, [key]: values }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ ...INITIAL_FILTERS });
  }, []);

  // Load fetch limit from settings
  useEffect(() => {
    let isMounted = true;

    const loadFetchLimit = async () => {
      try {
        const stored = await chrome.storage.local.get(SETTINGS_KEY);
        if (!isMounted) return;

        const limit = stored?.[SETTINGS_KEY]?.fetchLimit;
        const parsed = typeof limit === 'number' && limit > 0 ? limit : null;
        setFetchLimit(parsed);
      } catch (error) {
        console.error('Failed to load fetch limit', error);
      }
    };

    loadFetchLimit();

    return () => {
      isMounted = false;
    };
  }, []);

  // Listen for progress and status messages
  useEffect(() => {
    const messageListener = (message: unknown) => {
      if (!message || typeof message !== 'object') return;

      const payload = message as { type?: string; stage?: string; inProgress?: boolean };

      if (payload.type === REFRESH_PROGRESS_MESSAGE) {
        const stage = payload.stage || '';
        let message = '';

        switch (stage) {
          case 'fetching-activities':
          case 'starting':
            message = 'Refreshing list of activities…';
            break;
          case 'activities-collected':
            message = 'Caching activity details…';
            break;
          case 'loading-details':
          case 'loading-roster':
          case 'processing':
            message = 'Caching activity data…';
            break;
          case 'finalizing':
            message = 'Wrapping up…';
            break;
          case 'no-new-activities':
            message = 'No new activities found.';
            setIsLoading(false);
            break;
          case 'error':
            message = 'Refresh encountered an error.';
            setIsLoading(false);
            break;
        }

        if (message) {
          setStatusMessage(message);
        }
      }

      if (payload.type === REFRESH_STATUS_CHANGE_MESSAGE) {
        setIsLoading(Boolean(payload.inProgress));
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  // Listen for storage changes to reload data when cache is updated
  useEffect(() => {
    const storageListener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes[STORAGE_KEY]) {
        // Cache was updated, reload the dashboard
        loadExtensionData()
          .then(() => {
            setStatusMessage('Dashboard updated with latest data.');
            // Clear the message after a few seconds
            setTimeout(() => {
              setStatusMessage('');
            }, 3000);
          })
          .catch((error) => {
            console.error('Failed to reload data after storage change', error);
          });
      }
    };

    chrome.storage.onChanged.addListener(storageListener);

    return () => {
      chrome.storage.onChanged.removeListener(storageListener);
    };
  }, [loadExtensionData]);

  // Fetch activities function
  const fetchActivities = useCallback(async () => {
    setIsLoading(true);
    setStatusMessage('Starting refresh…');

    try {
      const response = await chrome.runtime.sendMessage({
        type: REFRESH_MESSAGE,
        limit: fetchLimit,
      });

      if (!response) {
        setStatusMessage('No response from background script.');
        setIsLoading(false);
        return;
      }

      if (!response.success) {
        setStatusMessage(response.error || 'Refresh failed.');
        setIsLoading(false);
        return;
      }

      const newActivities = response.summary?.newActivities ?? 0;
      setStatusMessage(`Cached ${newActivities} new activities.`);
      setRefreshSummary(response.summary);
      setIsLoading(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error.';
      setStatusMessage(message);
      setIsLoading(false);
    }
  }, [fetchLimit]);

  // Update refresh summary when data changes
  useEffect(() => {
    const updateSummary = async () => {
      try {
        const data = await loadExtensionData();
        if (data) {
          setRefreshSummary({
            activityCount: data.activities.length,
            lastUpdated: data.lastUpdated,
            newActivities: 0,
          });
        }
      } catch (error) {
        console.error('Failed to update refresh summary', error);
      }
    };

    updateSummary();
  }, [loadExtensionData, view]);

  return useMemo(
    () => ({
      loading,
      error,
      empty,
      filters,
      filterOptions,
      settings,
      view,
      summary,
      statusMessage,
      setFilter,
      clearFilters,
      fetchActivities,
      isLoading,
      fetchLimit,
      refreshSummary,
    }),
    [
      loading,
      error,
      empty,
      filters,
      filterOptions,
      settings,
      view,
      summary,
      statusMessage,
      setFilter,
      clearFilters,
      fetchActivities,
      isLoading,
      fetchLimit,
      refreshSummary,
    ]
  );
};
