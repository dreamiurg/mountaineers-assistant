import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefreshProgress, RefreshSummary } from '../../shared/types';

const REFRESH_MESSAGE = 'start-refresh';
const REFRESH_STATUS_REQUEST_MESSAGE = 'get-refresh-status';
const REFRESH_STATUS_CHANGE_MESSAGE = 'refresh-status-changed';
const REFRESH_BUSY_MESSAGE = 'A refresh is already running. Please wait for it to finish.';
const SETTINGS_KEY = 'mountaineersAssistantSettings';
const CONTEXT_WARNING_MESSAGE = 'Open a Mountaineers.org page to fetch new activities.';

type RefreshResponse =
  | {
      success: true;
      summary: RefreshSummary;
    }
  | {
      success: false;
      error?: string;
      inProgress?: boolean;
    };

interface RefreshStatusResponse {
  success: boolean;
  inProgress?: boolean;
  progress?: RefreshProgress | null;
}

interface PopupControllerState {
  summary: RefreshSummary;
  statusMessage: string;
  showSpinner: boolean;
  actionsDisabled: boolean;
  insightsDisabled: boolean;
}

interface PopupControllerActions {
  refreshAll: () => Promise<void>;
  openInsights: () => void;
}

export const usePopupController = (): PopupControllerState & PopupControllerActions => {
  const [summary, setSummary] = useState<RefreshSummary>({
    activityCount: 0,
    lastUpdated: null,
    newActivities: 0,
  });
  const [statusMessage, setStatusMessage] = useState<string>('Loading cached data…');
  const [localBusy, setLocalBusy] = useState<boolean>(false);
  const [refreshInProgress, setRefreshInProgress] = useState<boolean>(false);
  const [contextAllowsFetching, setContextAllowsFetching] = useState<boolean>(false);
  const [configuredFetchLimit, setConfiguredFetchLimit] = useState<number | null>(null);
  const [globalBusyForced, setGlobalBusyForced] = useState<boolean>(false);

  const localBusyRef = useRef(localBusy);
  const globalBusyForcedRef = useRef(globalBusyForced);
  const statusMessageRef = useRef(statusMessage);

  useEffect(() => {
    localBusyRef.current = localBusy;
  }, [localBusy]);

  useEffect(() => {
    globalBusyForcedRef.current = globalBusyForced;
  }, [globalBusyForced]);

  useEffect(() => {
    statusMessageRef.current = statusMessage;
  }, [statusMessage]);

  const updateStatusMessage = useCallback((message: string) => {
    setStatusMessage(message);
    const forced = message === REFRESH_BUSY_MESSAGE;
    setGlobalBusyForced(forced);
    globalBusyForcedRef.current = forced;
  }, []);

  const updateBusyState = useCallback(
    (isBusy: boolean, message?: string) => {
      setLocalBusy(isBusy);
      localBusyRef.current = isBusy;
      if (typeof message === 'string') {
        updateStatusMessage(message);
      }
    },
    [updateStatusMessage]
  );

  useEffect(() => {
    let isMounted = true;

    const updateStatsFromStorage = async () => {
      try {
        const stored = await chrome.storage.local.get('mountaineersAssistantData');
        if (!isMounted) {
          return;
        }
        const payload = stored?.mountaineersAssistantData as
          | {
              activities?: Array<unknown>;
              lastUpdated?: string | null;
            }
          | undefined;
        if (!payload) {
          setSummary({ activityCount: 0, lastUpdated: null, newActivities: 0 });
          updateStatusMessage('No data cached yet.');
          return;
        }
        setSummary((previous) => ({
          ...previous,
          activityCount: Array.isArray(payload.activities) ? payload.activities.length : 0,
          lastUpdated: payload.lastUpdated ?? null,
          newActivities: 0,
        }));
        updateStatusMessage('Cached snapshot loaded.');
      } catch (error) {
        if (!isMounted) {
          return;
        }
        console.error('Mountaineers Assistant popup: failed to read cached data', error);
        updateStatusMessage('Unable to read cached data.');
      }
    };

    const evaluateActiveTabContext = async () => {
      const activeTab = await queryActiveTab();
      if (!isMounted) {
        return;
      }
      const url = activeTab?.url || '';
      const isAllowed = /^https?:\/\/(www\.)?mountaineers\.org\//i.test(url);
      setContextAllowsFetching(isAllowed);
      if (!isAllowed) {
        updateStatusMessage(CONTEXT_WARNING_MESSAGE);
      } else if (statusMessageRef.current === CONTEXT_WARNING_MESSAGE && !localBusyRef.current) {
        updateStatusMessage('');
      }
    };

    const requestRefreshStatus = async () => {
      try {
        const response = await sendRuntimeMessage<RefreshStatusResponse>({
          type: REFRESH_STATUS_REQUEST_MESSAGE,
        });
        if (!isMounted) {
          return;
        }
        const inProgress = Boolean(response?.inProgress);
        setRefreshInProgress(inProgress);
        if (inProgress && !localBusyRef.current) {
          updateStatusMessage(REFRESH_BUSY_MESSAGE);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }
        console.warn('Mountaineers Assistant popup: failed to request refresh status', error);
      }
    };

    const loadFetchPreferences = async () => {
      try {
        const stored = await chrome.storage.local.get(SETTINGS_KEY);
        if (!isMounted) {
          return;
        }
        setConfiguredFetchLimit(normalizeFetchLimit(stored?.[SETTINGS_KEY]?.fetchLimit));
      } catch (error) {
        if (!isMounted) {
          return;
        }
        console.error('Mountaineers Assistant popup: failed to load fetch preferences', error);
        setConfiguredFetchLimit(null);
      }
    };

    updateStatsFromStorage();
    evaluateActiveTabContext();
    requestRefreshStatus();
    loadFetchPreferences();

    const messageListener = (message: unknown) => {
      if (
        !message ||
        typeof message !== 'object' ||
        (message as { type?: string }).type !== REFRESH_STATUS_CHANGE_MESSAGE
      ) {
        return;
      }
      const payload = message as { inProgress?: boolean };
      const inProgress = Boolean(payload.inProgress);
      setRefreshInProgress(inProgress);
      if (inProgress && !localBusyRef.current) {
        updateStatusMessage(REFRESH_BUSY_MESSAGE);
      } else if (!inProgress && globalBusyForcedRef.current && !localBusyRef.current) {
        updateStatusMessage('');
      }
    };

    const storageListener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
      changes,
      areaName
    ) => {
      if (areaName !== 'local') {
        return;
      }
      if (changes.mountaineersAssistantData) {
        const newValue = changes.mountaineersAssistantData.newValue as
          | {
              activities?: Array<unknown>;
              lastUpdated?: string | null;
            }
          | undefined;
        if (!newValue) {
          setSummary({ activityCount: 0, lastUpdated: null, newActivities: 0 });
        } else {
          setSummary((previous) => ({
            ...previous,
            activityCount: Array.isArray(newValue.activities) ? newValue.activities.length : 0,
            lastUpdated: newValue.lastUpdated ?? null,
            newActivities: 0,
          }));
        }
      }
      if (changes[SETTINGS_KEY]) {
        setConfiguredFetchLimit(normalizeFetchLimit(changes[SETTINGS_KEY].newValue?.fetchLimit));
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    chrome.storage.onChanged.addListener(storageListener);

    return () => {
      isMounted = false;
      chrome.runtime.onMessage.removeListener(messageListener);
      chrome.storage.onChanged.removeListener(storageListener);
    };
  }, [updateStatusMessage]);

  const sendRefreshRequest = useCallback(
    async (limit: number | null, busyMessage: string) => {
      updateBusyState(true, busyMessage);
      try {
        const payload: { type: string; limit?: number | null } = { type: REFRESH_MESSAGE };
        if (limit != null) {
          payload.limit = limit;
        }
        const response = await sendRuntimeMessage<RefreshResponse>(payload);
        if (!response) {
          updateBusyState(false, 'No response from background script.');
          return;
        }
        if (!response.success) {
          if (response.inProgress) {
            setRefreshInProgress(true);
            updateBusyState(false, response.error || REFRESH_BUSY_MESSAGE);
            return;
          }
          updateBusyState(false, response.error || 'Refresh failed.');
          return;
        }
        setSummary(response.summary);
        const newActivities = response.summary.newActivities ?? 0;
        const suffix =
          newActivities > 0
            ? `Added ${newActivities} new ${newActivities === 1 ? 'activity' : 'activities'}.`
            : 'No new activities found.';
        updateBusyState(false, suffix);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unexpected error.';
        updateBusyState(false, message);
      }
    },
    [updateBusyState]
  );

  const refreshAll = useCallback(async () => {
    const limit = configuredFetchLimit ?? null;
    await sendRefreshRequest(limit, 'Refreshing activities…');
  }, [configuredFetchLimit, sendRefreshRequest]);

  const openInsights = useCallback(() => {
    const url = chrome.runtime.getURL('insights.html');
    chrome.tabs.create({ url });
  }, []);

  const showSpinner = useMemo(() => localBusy || refreshInProgress, [localBusy, refreshInProgress]);
  const actionsDisabled = useMemo(
    () => localBusy || refreshInProgress || !contextAllowsFetching,
    [localBusy, refreshInProgress, contextAllowsFetching]
  );

  return {
    summary,
    statusMessage,
    showSpinner,
    actionsDisabled,
    insightsDisabled: localBusy,
    refreshAll,
    openInsights,
  };
};

function normalizeFetchLimit(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function queryActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs?.[0]);
    });
  });
}

function sendRuntimeMessage<T>(message: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message || 'Unexpected error.'));
        return;
      }
      resolve(response as T);
    });
  });
}
