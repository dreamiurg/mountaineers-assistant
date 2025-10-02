(function () {
  const REFRESH_MESSAGE = 'start-refresh';
  const REFRESH_RESULT_MESSAGE = 'refresh-result';
  const SUPPORTED_HOST = 'www.mountaineers.org';

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== REFRESH_MESSAGE) {
      return undefined;
    }

    console.info('Mountaineers Assistant: refresh request received');
    handleRefreshRequest({ fetchLimit: message.limit })
      .then((result) => {
        console.info('Mountaineers Assistant: refresh completed', result.summary);
        sendResponse(result);
      })
      .catch((error) => {
        console.error('Mountaineers Assistant refresh failed', error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });

    return true;
  });

  async function handleRefreshRequest({ fetchLimit } = {}) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!activeTab?.id || !activeTab.url) {
      throw new Error('Unable to locate the active tab.');
    }

    const url = new URL(activeTab.url);
    if (url.hostname !== SUPPORTED_HOST) {
      throw new Error('Open a Mountaineers.org page (for example My Activities) to fetch updates.');
    }

    const cachedData = await chrome.storage.local.get('mountaineersAssistantData');
    const existingCache = cachedData?.mountaineersAssistantData || {
      activities: [],
      people: [],
      rosterEntries: [],
      lastUpdated: null,
      currentUserUid: null,
    };

    const existingActivityUids = existingCache.activities.map((activity) => activity.uid);

    console.debug('Mountaineers Assistant: injecting collector into tab', activeTab.id);
    const resultPromise = waitForRefreshResult(activeTab.id);

    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: (uids, limit) => {
        window.__mtgExistingActivityUids = uids;
        window.__mtgFetchLimit = limit;
      },
      args: [existingActivityUids, fetchLimit ?? null],
    });

    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      files: ['collect.js'],
    });

    console.debug('Mountaineers Assistant: awaiting collector response');
    const result = await resultPromise;

    if (!result.success) {
      throw new Error(result.error || 'Refresh failed');
    }

    const mergeResult = mergeWithExistingCache(existingCache, result.data);

    await chrome.storage.local.set({ mountaineersAssistantData: mergeResult.updatedCache });

    return {
      success: true,
      summary: {
        activityCount: mergeResult.updatedCache.activities.length,
        lastUpdated: mergeResult.updatedCache.lastUpdated,
        newActivities: mergeResult.newActivities,
      },
    };
  }

  function waitForRefreshResult(tabId) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Timed out while refreshing activities.'));
      }, 60_000);

      function handleMessage(message, sender) {
        if (message?.type !== REFRESH_RESULT_MESSAGE) {
          return;
        }
        if (sender.tab?.id !== tabId) {
          return;
        }
        cleanup();
        resolve(message);
      }

      function cleanup() {
        clearTimeout(timeout);
        chrome.runtime.onMessage.removeListener(handleMessage);
      }

      chrome.runtime.onMessage.addListener(handleMessage);
    });
  }

  function mergeWithExistingCache(existingCache, incoming) {
    const updatedCache = {
      activities: [...existingCache.activities],
      people: [...existingCache.people],
      rosterEntries: [...existingCache.rosterEntries],
      lastUpdated: new Date().toISOString(),
      currentUserUid: incoming.currentUserUid || existingCache.currentUserUid || null,
    };

    const activityMap = new Map(
      updatedCache.activities.map((activity) => [activity.uid, activity])
    );
    let newActivities = 0;
    for (const activity of incoming.activities || []) {
      const existing = activityMap.get(activity.uid);
      if (!existing) {
        activityMap.set(activity.uid, activity);
        newActivities += 1;
        continue;
      }
      const merged = { ...existing, ...activity };
      if (activity.activity_type == null && existing.activity_type != null) {
        merged.activity_type = existing.activity_type;
      }
      activityMap.set(activity.uid, merged);
    }
    updatedCache.activities = Array.from(activityMap.values()).sort((a, b) => {
      const dateA = new Date(a.start_date || 0);
      const dateB = new Date(b.start_date || 0);
      return dateB - dateA;
    });

    const peopleMap = new Map(updatedCache.people.map((person) => [person.uid, person]));
    for (const person of incoming.people || []) {
      const existing = peopleMap.get(person.uid);
      if (!existing) {
        peopleMap.set(person.uid, person);
        continue;
      }
      const mergedPerson = { ...existing };
      let changed = false;
      if (!existing.href && person.href) {
        mergedPerson.href = person.href;
        changed = true;
      }
      if (!existing.avatar && person.avatar) {
        mergedPerson.avatar = person.avatar;
        changed = true;
      }
      if (!existing.name && person.name) {
        mergedPerson.name = person.name;
        changed = true;
      }
      if (changed) {
        peopleMap.set(person.uid, mergedPerson);
      }
    }
    updatedCache.people = Array.from(peopleMap.values()).sort((a, b) =>
      (a.name || '').localeCompare(b.name || '')
    );

    const rosterKey = (entry) => `${entry.activity_uid}|${entry.person_uid}`;
    const rosterMap = new Map(updatedCache.rosterEntries.map((entry) => [rosterKey(entry), entry]));
    for (const entry of incoming.rosterEntries || []) {
      rosterMap.set(rosterKey(entry), entry);
    }
    updatedCache.rosterEntries = Array.from(rosterMap.values());

    return { updatedCache, newActivities };
  }
})();
