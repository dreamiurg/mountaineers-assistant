const STORAGE_KEY = 'mountaineersAssistantData';
const statusEl = document.getElementById('options-status');
const cacheEl = document.getElementById('cache-content');
const SETTINGS_KEY = 'mountaineersAssistantSettings';
const avatarToggle = document.getElementById('toggle-avatars');

const defaultSettings = {
  showAvatars: true,
};

const refreshButton = document.getElementById('refresh-cache');
const openStatsButton = document.getElementById('open-stats');

init();

function init() {
  refreshButton.addEventListener('click', () => {
    refreshButton.disabled = true;
    refreshButton.textContent = 'Refreshing…';
    Promise.all([loadCache(), loadSettings()])
      .catch((error) => {
        console.error('Mountaineers Assistant options: failed to refresh cache', error);
        statusEl.textContent = error instanceof Error ? error.message : String(error);
      })
      .finally(() => {
        refreshButton.disabled = false;
        refreshButton.textContent = 'Refresh Cache View';
      });
  });

  openStatsButton.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('stats.html') });
  });

  avatarToggle.addEventListener('change', async (event) => {
    const checked = event.target.checked;
    await saveSettings({ showAvatars: checked });
    statusEl.textContent = 'Saved display preferences.';
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[STORAGE_KEY]) {
      loadCache().catch((error) => {
        console.error(
          'Mountaineers Assistant options: failed to update after storage change',
          error
        );
      });
    }
    if (area === 'local' && changes[SETTINGS_KEY]) {
      loadSettings().catch((error) => {
        console.error(
          'Mountaineers Assistant options: failed to refresh settings after change',
          error
        );
      });
    }
  });

  Promise.all([loadCache(), loadSettings()]).catch((error) => {
    console.error('Mountaineers Assistant options: failed to initialize', error);
    statusEl.textContent = error instanceof Error ? error.message : String(error);
  });
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  const settings = { ...defaultSettings, ...(stored?.[SETTINGS_KEY] || {}) };
  avatarToggle.checked = Boolean(settings.showAvatars);
  return settings;
}

async function saveSettings(partial) {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  const current = { ...defaultSettings, ...(stored?.[SETTINGS_KEY] || {}) };
  const next = { ...current, ...partial };
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

async function loadCache() {
  statusEl.textContent = 'Loading cached data…';
  cacheEl.textContent = '';

  const data = await chrome.storage.local.get(STORAGE_KEY);
  const payload = data?.[STORAGE_KEY];

  if (!payload) {
    statusEl.textContent =
      'No cached data found yet. Refresh activities from the popup to populate this view.';
    cacheEl.textContent = '// cache empty';
    return;
  }

  const summary = buildSummary(payload);
  statusEl.textContent = summary;
  cacheEl.textContent = JSON.stringify(payload, null, 2);
}

function buildSummary(payload) {
  const activityCount = Array.isArray(payload.activities) ? payload.activities.length : 0;
  const peopleCount = Array.isArray(payload.people) ? payload.people.length : 0;
  const rosterCount = Array.isArray(payload.rosterEntries) ? payload.rosterEntries.length : 0;
  const lastUpdated = payload.lastUpdated ? formatTimestamp(payload.lastUpdated) : 'never';
  return `Cached ${activityCount} activities, ${peopleCount} people, ${rosterCount} roster entries — last refreshed ${lastUpdated}.`;
}

function formatTimestamp(value) {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString();
  } catch (error) {
    return value;
  }
}
