import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ExtensionCache } from '../../shared/types';
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
    ]
  );
};
