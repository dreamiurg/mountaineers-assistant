import type {
  ActivityRecord,
  CollectorDelta,
  CollectorProgressMessage,
  CollectorResultMessage,
  CollectorSuccessPayload,
  ExtensionCache,
  PersonRecord,
  RefreshProgress,
  RefreshSummary,
  RosterEntryRecord,
} from './shared/types';

// Handle extension icon click - open insights page
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('insights.html') });
});

const REFRESH_MESSAGE = 'start-refresh';
const REFRESH_RESULT_MESSAGE = 'refresh-result';
const REFRESH_PROGRESS_MESSAGE = 'refresh-progress';
const REFRESH_STATUS_REQUEST_MESSAGE = 'get-refresh-status';
const REFRESH_STATUS_CHANGE_MESSAGE = 'refresh-status-changed';

type HandleRefreshResult = {
  success: true;
  summary: RefreshSummary;
};

interface ActiveCacheContext {
  workingCache: ExtensionCache;
}

type CacheMergeInput = Partial<CollectorSuccessPayload> & CollectorDelta;

let activeRefresh: Promise<HandleRefreshResult> | null = null;
let currentProgress: RefreshProgress | null = null;
let activeCacheContext: ActiveCacheContext | null = null;

async function ensureOffscreenDocument(): Promise<void> {
  // Check if offscreen document already exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });

  if (existingContexts.length > 0) {
    return; // Already exists, reuse it
  }

  // Create new offscreen document
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: [chrome.offscreen.Reason.DOM_SCRAPING],
    justification: 'Fetch and parse Mountaineers.org activity data using DOM APIs',
  });
}

chrome.runtime.onMessage.addListener((rawMessage, sender, sendResponse) => {
  if (!isRecord(rawMessage) || typeof rawMessage.type !== 'string') {
    return undefined;
  }

  if (rawMessage.type === REFRESH_STATUS_REQUEST_MESSAGE) {
    sendResponse({
      success: true,
      inProgress: Boolean(activeRefresh),
      progress: currentProgress,
    });
    return false;
  }

  if (isCollectorProgressMessage(rawMessage)) {
    handleProgressUpdate(rawMessage);
    return false;
  }

  if (rawMessage.type !== REFRESH_MESSAGE) {
    return undefined;
  }

  if (activeRefresh) {
    console.info('Mountaineers Assistant: refresh already in progress, ignoring duplicate request');
    sendResponse({
      success: false,
      error: 'A refresh is already running. Please wait for it to finish.',
      inProgress: true,
      progress: currentProgress,
    });
    return false;
  }

  const fetchLimit =
    typeof rawMessage.limit === 'number' && Number.isFinite(rawMessage.limit)
      ? rawMessage.limit
      : undefined;

  const refreshOperation = handleRefreshRequest({ fetchLimit });

  activeRefresh = refreshOperation;
  currentProgress = createInitialProgress();
  notifyRefreshStatusChange(true);

  refreshOperation
    .then((result) => {
      console.info('Mountaineers Assistant: refresh completed', result.summary);
      sendResponse(result);
    })
    .catch((error: unknown) => {
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

function createInitialProgress(): RefreshProgress {
  return {
    total: 0,
    completed: 0,
    remaining: null,
    stage: 'pending',
    activityUid: null,
    activityTitle: null,
    timestamp: Date.now(),
  };
}

async function handleRefreshRequest({
  fetchLimit,
}: {
  fetchLimit?: number | null;
} = {}): Promise<HandleRefreshResult> {
  try {
    // Ensure offscreen document exists
    await ensureOffscreenDocument();

    const stored = (await chrome.storage.local.get('mountaineersAssistantData')) as Record<
      string,
      unknown
    >;
    const existingCache =
      (stored.mountaineersAssistantData as ExtensionCache | undefined) ?? createEmptyCache();

    initializeActiveCache(existingCache);

    const existingActivityUids = existingCache.activities.map((activity) => activity.uid);

    console.debug('Mountaineers Assistant: sending collection request to offscreen document');

    // Send collection request to offscreen document
    const resultPromise = waitForOffscreenResult();

    chrome.runtime.sendMessage({
      type: 'offscreen-collect',
      existingActivityUids,
      fetchLimit: fetchLimit ?? null,
    });

    console.debug('Mountaineers Assistant: awaiting offscreen response');
    const result = await resultPromise;

    if (!result.success || !result.data) {
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

function waitForOffscreenResult(): Promise<CollectorResultMessage> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const timeout = setTimeout(() => {
      finalize(() => reject(new Error('Timed out while refreshing activities.')));
    }, 60_000);

    function handleMessage(message: unknown): void {
      if (!isCollectorResultMessage(message)) {
        return;
      }
      finalize(() => resolve(message));
    }

    function finalize(callback: () => void): void {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      callback();
    }

    function cleanup(): void {
      clearTimeout(timeout);
      chrome.runtime.onMessage.removeListener(handleMessage);
    }

    chrome.runtime.onMessage.addListener(handleMessage);
  });
}

function mergeWithExistingCache(
  existingCache: ExtensionCache,
  incoming: CacheMergeInput
): { updatedCache: ExtensionCache; newActivities: number } {
  const updatedCache: ExtensionCache = {
    activities: [...existingCache.activities],
    people: [...existingCache.people],
    rosterEntries: [...existingCache.rosterEntries],
    lastUpdated: new Date().toISOString(),
    currentUserUid: incoming.currentUserUid ?? existingCache.currentUserUid ?? null,
  };

  const activityMap = new Map<string, ActivityRecord>(
    updatedCache.activities.map((activity) => [activity.uid, activity])
  );

  let newActivities = 0;
  for (const activity of incoming.activities ?? []) {
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
    const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
    const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
    return dateB - dateA;
  });

  const peopleMap = new Map<string, PersonRecord>(
    updatedCache.people.map((person) => [person.uid, person])
  );

  for (const person of incoming.people ?? []) {
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

  const rosterKey = (entry: RosterEntryRecord) => `${entry.activity_uid}|${entry.person_uid}`;

  const rosterMap = new Map<string, RosterEntryRecord>(
    updatedCache.rosterEntries.map((entry) => [rosterKey(entry), entry])
  );

  for (const entry of incoming.rosterEntries ?? []) {
    rosterMap.set(rosterKey(entry), entry);
  }

  updatedCache.rosterEntries = Array.from(rosterMap.values());

  return { updatedCache, newActivities };
}

function notifyRefreshStatusChange(isRefreshing: boolean): void {
  chrome.runtime.sendMessage({
    type: REFRESH_STATUS_CHANGE_MESSAGE,
    inProgress: isRefreshing,
    progress: currentProgress,
  });
}

function handleProgressUpdate(message: CollectorProgressMessage): void {
  const previous = currentProgress;
  const normalized = normalizeProgressPayload(message, previous);
  currentProgress = normalized;
  logProgress(normalized, previous);
  broadcastProgress(normalized);
  if (message.delta) {
    applyDeltaToCache(message.delta).catch((error) => {
      console.warn('Mountaineers Assistant: failed to apply incremental cache update', error);
    });
  }
}

function normalizeProgressPayload(
  update: CollectorProgressMessage,
  previous: RefreshProgress | null = null
): RefreshProgress {
  const base = previous ?? createInitialProgress();
  const total = sanitizeProgressNumber(update.total, base.total ?? 0);
  const completedRaw = sanitizeProgressNumber(update.completed, base.completed ?? 0);
  const completed = total > 0 ? clampNumber(completedRaw, 0, total) : completedRaw;
  const remaining = total > 0 ? Math.max(total - completed, 0) : null;

  return {
    total,
    completed,
    remaining,
    stage: typeof update.stage === 'string' ? update.stage : base.stage,
    activityUid: typeof update.activityUid === 'string' ? update.activityUid : null,
    activityTitle:
      typeof update.activityTitle === 'string' && update.activityTitle.trim()
        ? update.activityTitle
        : null,
    timestamp: Date.now(),
  };
}

function sanitizeProgressNumber(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isFinite(numeric) && numeric >= 0) {
    return Math.floor(numeric);
  }
  if (Number.isFinite(fallback) && fallback >= 0) {
    return Math.floor(fallback);
  }
  return 0;
}

function clampNumber(value: number, min: number, max: number): number {
  let result = value;
  if (Number.isFinite(min)) {
    result = Math.max(min, result);
  }
  if (Number.isFinite(max)) {
    result = Math.min(max, result);
  }
  return result;
}

function broadcastProgress(progress: RefreshProgress): void {
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

function logProgress(progress: RefreshProgress, previous: RefreshProgress | null): void {
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

function initializeActiveCache(existingCache: ExtensionCache): void {
  const clone =
    typeof structuredClone === 'function'
      ? structuredClone(existingCache)
      : (JSON.parse(JSON.stringify(existingCache)) as ExtensionCache);
  activeCacheContext = {
    workingCache: clone,
  };
}

async function applyDeltaToCache(delta: CollectorDelta): Promise<void> {
  if (!activeCacheContext) {
    return;
  }
  const sanitizedDelta = sanitizeDelta(delta);
  if (!sanitizedDelta) {
    return;
  }
  const mergeResult = mergeWithExistingCache(activeCacheContext.workingCache, sanitizedDelta);
  activeCacheContext.workingCache = mergeResult.updatedCache;
  await chrome.storage.local.set({
    mountaineersAssistantData: activeCacheContext.workingCache,
  });
}

function sanitizeDelta(delta: CollectorDelta | null | undefined): CollectorDelta | null {
  if (!delta || typeof delta !== 'object') {
    return null;
  }
  const activities = Array.isArray(delta.activities)
    ? delta.activities.map((item) => ({ ...item }))
    : [];
  const people = Array.isArray(delta.people) ? delta.people.map((item) => ({ ...item })) : [];
  const rosterEntries = Array.isArray(delta.rosterEntries)
    ? delta.rosterEntries.map((item) => ({ ...item }))
    : [];
  if (!activities.length && !people.length && !rosterEntries.length) {
    return null;
  }
  return {
    activities,
    people,
    rosterEntries,
  };
}

function createEmptyCache(): ExtensionCache {
  return {
    activities: [],
    people: [],
    rosterEntries: [],
    lastUpdated: null,
    currentUserUid: null,
  };
}

function isCollectorProgressMessage(value: unknown): value is CollectorProgressMessage {
  if (!isRecord(value)) {
    return false;
  }
  return value.type === REFRESH_PROGRESS_MESSAGE && value.origin === 'collector';
}

function isCollectorResultMessage(value: unknown): value is CollectorResultMessage {
  if (!isRecord(value)) {
    return false;
  }
  return value.type === REFRESH_RESULT_MESSAGE;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
