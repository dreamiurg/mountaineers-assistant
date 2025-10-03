(function () {
  const REFRESH_MESSAGE = 'start-refresh';
  const REFRESH_RESULT_MESSAGE = 'refresh-result';
  const REFRESH_PROGRESS_MESSAGE = 'refresh-progress';
  const REFRESH_STATUS_REQUEST_MESSAGE = 'get-refresh-status';
  const REFRESH_STATUS_CHANGE_MESSAGE = 'refresh-status-changed';
  const SUPPORTED_HOST = 'www.mountaineers.org';

  let activeRefresh = null;
  let currentProgress = null;
  let activeCacheContext = null;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message?.type) {
      return undefined;
    }

    if (message.type === REFRESH_STATUS_REQUEST_MESSAGE) {
      sendResponse({
        success: true,
        inProgress: Boolean(activeRefresh),
        progress: currentProgress,
      });
      return false;
    }

    if (message.type === REFRESH_PROGRESS_MESSAGE) {
      if (message.origin !== 'collector') {
        return false;
      }
      handleProgressUpdate(message);
      return false;
    }

    if (message.type !== REFRESH_MESSAGE) {
      return undefined;
    }

    if (activeRefresh) {
      console.info(
        'Mountaineers Assistant: refresh already in progress, ignoring duplicate request'
      );
      sendResponse({
        success: false,
        error: 'A refresh is already running. Please wait for it to finish.',
        inProgress: true,
        progress: currentProgress,
      });
      return false;
    }

    console.info('Mountaineers Assistant: refresh request received');
    const refreshOperation = handleRefreshRequest({ fetchLimit: message.limit });

    activeRefresh = refreshOperation;
    currentProgress = {
      total: 0,
      completed: 0,
      remaining: null,
      stage: 'pending',
      activityUid: null,
      activityTitle: null,
      timestamp: Date.now(),
    };
    notifyRefreshStatusChange(true);

    refreshOperation
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
      })
      .finally(() => {
        if (activeRefresh === refreshOperation) {
          activeRefresh = null;
        }
        currentProgress = null;
        notifyRefreshStatusChange(false);
      });

    return true;
  });

  async function handleRefreshRequest({ fetchLimit } = {}) {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!activeTab?.id || !activeTab.url) {
        throw new Error('Unable to locate the active tab.');
      }

      const url = new URL(activeTab.url);
      if (url.hostname !== SUPPORTED_HOST) {
        throw new Error(
          'Open a Mountaineers.org page (for example My Activities) to fetch updates.'
        );
      }

      const cachedData = await chrome.storage.local.get('mountaineersAssistantData');
      const existingCache = cachedData?.mountaineersAssistantData || {
        activities: [],
        people: [],
        rosterEntries: [],
        lastUpdated: null,
        currentUserUid: null,
      };

      initializeActiveCache(existingCache);

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

      const finalMerge = mergeWithExistingCache(existingCache, result.data);

      await chrome.storage.local.set({ mountaineersAssistantData: finalMerge.updatedCache });

      return {
        success: true,
        summary: {
          activityCount: finalMerge.updatedCache.activities.length,
          lastUpdated: finalMerge.updatedCache.lastUpdated,
          newActivities: finalMerge.newActivities,
        },
      };
    } finally {
      activeCacheContext = null;
    }
  }

  function waitForRefreshResult(tabId) {
    return new Promise((resolve, reject) => {
      let settled = false;

      const timeout = setTimeout(() => {
        finalize(() => reject(new Error('Timed out while refreshing activities.')));
      }, 60_000);

      function handleMessage(message, sender) {
        if (message?.type !== REFRESH_RESULT_MESSAGE) {
          return;
        }
        if (sender.tab?.id !== tabId) {
          return;
        }
        finalize(() => resolve(message));
      }

      function handleTabRemoved(removedTabId) {
        if (removedTabId !== tabId) {
          return;
        }
        finalize(() => reject(new Error('The tab was closed before refresh completed.')));
      }

      function finalize(callback) {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        callback();
      }

      function cleanup() {
        clearTimeout(timeout);
        chrome.runtime.onMessage.removeListener(handleMessage);
        chrome.tabs.onRemoved.removeListener(handleTabRemoved);
      }

      chrome.runtime.onMessage.addListener(handleMessage);
      chrome.tabs.onRemoved.addListener(handleTabRemoved);
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

  function notifyRefreshStatusChange(isRefreshing) {
    chrome.runtime.sendMessage({
      type: REFRESH_STATUS_CHANGE_MESSAGE,
      inProgress: isRefreshing,
      progress: currentProgress,
    });
  }

  function handleProgressUpdate(message) {
    const previous = currentProgress;
    const normalized = normalizeProgressPayload(message, previous);
    currentProgress = normalized;
    logProgress(normalized, previous);
    broadcastProgress(normalized);
    if (message?.delta) {
      applyDeltaToCache(message.delta).catch((error) => {
        console.warn('Mountaineers Assistant: failed to apply incremental cache update', error);
      });
    }
  }

  function normalizeProgressPayload(update, previous = null) {
    const base = previous || {};
    const total = sanitizeProgressNumber(update.total, base.total ?? 0);
    const completedRaw = sanitizeProgressNumber(update.completed, base.completed ?? 0);
    const completed = total > 0 ? clampNumber(completedRaw, 0, total) : completedRaw;
    const remaining = total > 0 ? Math.max(total - completed, 0) : null;

    return {
      total,
      completed,
      remaining,
      stage: typeof update.stage === 'string' ? update.stage : base.stage || 'unknown',
      activityUid: typeof update.activityUid === 'string' ? update.activityUid : null,
      activityTitle:
        typeof update.activityTitle === 'string' && update.activityTitle.trim()
          ? update.activityTitle
          : null,
      timestamp: Date.now(),
    };
  }

  function sanitizeProgressNumber(value, fallback = 0) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric >= 0) {
      return Math.floor(numeric);
    }
    if (Number.isFinite(fallback) && fallback >= 0) {
      return Math.floor(fallback);
    }
    return 0;
  }

  function clampNumber(value, min, max) {
    let result = value;
    if (typeof min === 'number') {
      result = Math.max(min, result);
    }
    if (typeof max === 'number') {
      result = Math.min(max, result);
    }
    return result;
  }

  function broadcastProgress(progress) {
    try {
      chrome.runtime.sendMessage({
        type: REFRESH_PROGRESS_MESSAGE,
        origin: 'background',
        progress,
      });
    } catch (error) {
      console.warn('Mountaineers Assistant: failed to broadcast refresh progress', error);
    }
  }

  function logProgress(progress, previous) {
    if (progress.total > 0) {
      if (
        previous &&
        previous.completed === progress.completed &&
        previous.total === progress.total
      ) {
        return;
      }
      const remaining = progress.remaining ?? Math.max(progress.total - progress.completed, 0);
      console.info(
        'Mountaineers Assistant: processed %d/%d new activities (%d remaining)',
        progress.completed,
        progress.total,
        remaining
      );
      return;
    }
    if (!previous || previous.stage !== progress.stage) {
      console.info('Mountaineers Assistant: refresh stage -> %s', progress.stage);
    }
  }

  function initializeActiveCache(existingCache) {
    if (!existingCache) {
      activeCacheContext = null;
      return;
    }
    const clone = (value) => {
      if (typeof structuredClone === 'function') {
        return structuredClone(value);
      }
      return JSON.parse(JSON.stringify(value));
    };
    activeCacheContext = {
      workingCache: clone(existingCache),
    };
  }

  async function applyDeltaToCache(delta) {
    if (!activeCacheContext) {
      return;
    }
    const sanitizedDelta = sanitizeDelta(delta);
    if (!sanitizedDelta) {
      return;
    }
    const mergeResult = mergeWithExistingCache(activeCacheContext.workingCache, sanitizedDelta);
    activeCacheContext.workingCache = mergeResult.updatedCache;
    await chrome.storage.local.set({ mountaineersAssistantData: activeCacheContext.workingCache });
  }

  function sanitizeDelta(delta) {
    if (!delta || typeof delta !== 'object') {
      return null;
    }
    const activities = Array.isArray(delta.activities) ? delta.activities : [];
    const people = Array.isArray(delta.people) ? delta.people : [];
    const rosterEntries = Array.isArray(delta.rosterEntries) ? delta.rosterEntries : [];
    if (!activities.length && !people.length && !rosterEntries.length) {
      return null;
    }
    return {
      activities,
      people,
      rosterEntries,
    };
  }
})();
