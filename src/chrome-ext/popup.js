const REFRESH_MESSAGE = 'start-refresh';
const REFRESH_STATUS_REQUEST_MESSAGE = 'get-refresh-status';
const REFRESH_STATUS_CHANGE_MESSAGE = 'refresh-status-changed';
const REFRESH_BUSY_MESSAGE = 'A refresh is already running. Please wait for it to finish.';
const SETTINGS_KEY = 'mountaineersAssistantSettings';

document.addEventListener('DOMContentLoaded', () => {
  const refreshButton = document.getElementById('refresh-button');
  const statsButton = document.getElementById('open-stats-button');
  const fetchOneButton = document.getElementById('fetch-one-button');
  const statusContainer = document.getElementById('status');
  const statusText = document.getElementById('status-text');
  const statusSpinner = document.getElementById('status-spinner');

  let contextAllowsFetching = false;
  let localBusy = false;
  let refreshInProgress = false;
  let globalBusyForcedMessage = false;
  let configuredFetchLimit = null;

  updateStatsFromStorage();
  evaluateActiveTabContext();
  requestRefreshStatus();
  loadFetchPreferences();

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== REFRESH_STATUS_CHANGE_MESSAGE) {
      return;
    }
    refreshInProgress = Boolean(message.inProgress);
    updateButtons();
    updateIndicator();
    if (refreshInProgress && !localBusy) {
      setStatusText(REFRESH_BUSY_MESSAGE);
      globalBusyForcedMessage = true;
    } else if (!refreshInProgress && globalBusyForcedMessage && !localBusy) {
      setStatusText('');
      globalBusyForcedMessage = false;
    }
  });

  refreshButton.addEventListener('click', () => {
    setBusy(true, 'Refreshing activities…');
    const payload = { type: REFRESH_MESSAGE };
    if (configuredFetchLimit) {
      payload.limit = configuredFetchLimit;
    }
    chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime.lastError) {
        setBusy(false, chrome.runtime.lastError.message || 'Unexpected error.');
        return;
      }
      if (!response?.success) {
        if (response?.inProgress) {
          refreshInProgress = true;
          setBusy(false, response.error || REFRESH_BUSY_MESSAGE);
          globalBusyForcedMessage = true;
          updateButtons();
          updateIndicator();
          return;
        }
        setBusy(false, response?.error || 'Refresh failed.');
        return;
      }
      renderStats(response.summary);
      const message = response.summary.newActivities
        ? `Added ${response.summary.newActivities} new ${
            response.summary.newActivities === 1 ? 'activity' : 'activities'
          }.`
        : 'No new activities found.';
      setBusy(false, message);
    });
  });

  statsButton.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('insights.html') });
  });

  fetchOneButton.addEventListener('click', () => {
    setBusy(true, 'Fetching a single activity…');
    chrome.runtime.sendMessage({ type: REFRESH_MESSAGE, limit: 1 }, (response) => {
      if (chrome.runtime.lastError) {
        setBusy(false, chrome.runtime.lastError.message || 'Unexpected error.');
        return;
      }
      if (!response?.success) {
        if (response?.inProgress) {
          refreshInProgress = true;
          setBusy(false, response.error || REFRESH_BUSY_MESSAGE);
          globalBusyForcedMessage = true;
          updateButtons();
          updateIndicator();
          return;
        }
        setBusy(false, response?.error || 'Refresh failed.');
        return;
      }
      renderStats(response.summary);
      const message = response.summary.newActivities
        ? `Added ${response.summary.newActivities} new ${
            response.summary.newActivities === 1 ? 'activity' : 'activities'
          }.`
        : 'No new activities found.';
      setBusy(false, message);
    });
  });

  async function updateStatsFromStorage() {
    const data = await chrome.storage.local.get('mountaineersAssistantData');
    const payload = data?.mountaineersAssistantData;
    if (!payload) {
      setBusy(false, 'No data cached yet.');
      renderStats({ activityCount: 0, lastUpdated: null });
      return;
    }
    renderStats({
      activityCount: payload.activities?.length ?? 0,
      lastUpdated: payload.lastUpdated,
    });
    setStatusText('Cached snapshot loaded.');
  }

  function renderStats(summary) {
    document.getElementById('activity-count').textContent = String(summary.activityCount ?? 0);
    document.getElementById('last-updated').textContent = summary.lastUpdated
      ? `Last refreshed ${formatRelative(summary.lastUpdated)}`
      : 'Never refreshed';
  }

  function setBusy(isBusy, message) {
    localBusy = isBusy;
    if (typeof message === 'string') {
      setStatusText(message);
      globalBusyForcedMessage = message === REFRESH_BUSY_MESSAGE;
    }
    updateButtons();
    updateIndicator();
  }

  function formatRelative(isoString) {
    try {
      const date = new Date(isoString);
      if (Number.isNaN(date.getTime())) {
        return isoString;
      }
      return `${date.toLocaleString()}`;
    } catch (error) {
      return isoString;
    }
  }

  function evaluateActiveTabContext() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs?.[0];
      const url = activeTab?.url || '';
      const isAllowed = /^https?:\/\/(www\.)?mountaineers\.org\//i.test(url);
      contextAllowsFetching = isAllowed;
      updateButtons();

      if (!isAllowed) {
        setStatusText('Open a Mountaineers.org page to fetch new activities.');
      } else if (!statusText.textContent) {
        setStatusText('');
      }
    });
  }

  function requestRefreshStatus() {
    chrome.runtime.sendMessage({ type: REFRESH_STATUS_REQUEST_MESSAGE }, (response) => {
      if (chrome.runtime.lastError) {
        return;
      }
      refreshInProgress = Boolean(response?.inProgress);
      updateButtons();
      updateIndicator();
      if (refreshInProgress && !localBusy) {
        setStatusText(REFRESH_BUSY_MESSAGE);
        globalBusyForcedMessage = true;
      }
    });
  }

  function updateButtons() {
    const disableFetchActions = localBusy || refreshInProgress || !contextAllowsFetching;
    refreshButton.disabled = disableFetchActions;
    fetchOneButton.disabled = disableFetchActions;
    statsButton.disabled = localBusy;
  }

  function setStatusText(message) {
    if (!statusText) {
      return;
    }
    statusText.textContent = message || '';
  }

  function updateIndicator() {
    if (!statusSpinner || !statusContainer) {
      return;
    }
    const showSpinner = localBusy || refreshInProgress;
    if (showSpinner) {
      statusSpinner.classList.remove('hidden');
    } else {
      statusSpinner.classList.add('hidden');
    }
  }

  function normalizeFetchLimit(value) {
    if (value === null || value === undefined) {
      return null;
    }
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
  }

  async function loadFetchPreferences() {
    try {
      const stored = await chrome.storage.local.get(SETTINGS_KEY);
      configuredFetchLimit = normalizeFetchLimit(stored?.[SETTINGS_KEY]?.fetchLimit);
    } catch (error) {
      console.error('Mountaineers Assistant popup: failed to load fetch preferences', error);
      configuredFetchLimit = null;
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[SETTINGS_KEY]) {
      return;
    }
    configuredFetchLimit = normalizeFetchLimit(changes[SETTINGS_KEY].newValue?.fetchLimit);
  });
});
