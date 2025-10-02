const REFRESH_MESSAGE = 'start-refresh';

document.addEventListener('DOMContentLoaded', () => {
  const refreshButton = document.getElementById('refresh-button');
  const clearButton = document.getElementById('clear-button');
  const statsButton = document.getElementById('open-stats-button');
  const fetchOneButton = document.getElementById('fetch-one-button');
  const statusEl = document.getElementById('status');

  let contextAllowsFetching = false;

  updateStatsFromStorage();
  evaluateActiveTabContext();

  refreshButton.addEventListener('click', () => {
    setBusy(true, 'Refreshing activities…');
    chrome.runtime.sendMessage({ type: REFRESH_MESSAGE }, (response) => {
      if (chrome.runtime.lastError) {
        setBusy(false, chrome.runtime.lastError.message || 'Unexpected error.');
        return;
      }
      if (!response?.success) {
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

  clearButton.addEventListener('click', async () => {
    await chrome.storage.local.remove('mountaineersAssistantData');
    renderStats({ activityCount: 0, lastUpdated: null });
    statusEl.textContent = 'Cached data cleared.';
  });

  statsButton.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('stats.html') });
  });

  fetchOneButton.addEventListener('click', () => {
    setBusy(true, 'Fetching a single activity…');
    chrome.runtime.sendMessage({ type: REFRESH_MESSAGE, limit: 1 }, (response) => {
      if (chrome.runtime.lastError) {
        setBusy(false, chrome.runtime.lastError.message || 'Unexpected error.');
        return;
      }
      if (!response?.success) {
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
    statusEl.textContent = 'Cached snapshot loaded.';
  }

  function renderStats(summary) {
    document.getElementById('activity-count').textContent = String(summary.activityCount ?? 0);
    document.getElementById('last-updated').textContent = summary.lastUpdated
      ? `Last refreshed ${formatRelative(summary.lastUpdated)}`
      : 'Never refreshed';
  }

  function setBusy(isBusy, message) {
    refreshButton.disabled = isBusy || !contextAllowsFetching;
    statusEl.textContent = message || '';
    clearButton.disabled = isBusy;
    statsButton.disabled = isBusy;
    fetchOneButton.disabled = isBusy || !contextAllowsFetching;
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
      refreshButton.disabled = !contextAllowsFetching;
      fetchOneButton.disabled = !contextAllowsFetching;

      if (!isAllowed) {
        statusEl.textContent = 'Open a Mountaineers.org page to fetch new activities.';
      } else if (!statusEl.textContent) {
        statusEl.textContent = '';
      }
    });
  }
});
