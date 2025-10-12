import type {
  ActivityRecord,
  CollectorDelta,
  CollectorSuccessPayload,
  PersonRecord,
  RosterEntryRecord,
} from './shared/types';

const OFFSCREEN_COLLECT_MESSAGE = 'offscreen-collect';
const RESULT_MESSAGE = 'refresh-result';
const PROGRESS_MESSAGE = 'refresh-progress';
const HOME_URL = 'https://www.mountaineers.org/';
const HISTORY_SUFFIX = '/member-activity-history.json';
const ROSTER_SEGMENT = 'roster-tab';

// Listen for collection requests from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') {
    return false;
  }

  const payload = message as {
    type?: string;
    existingActivityUids?: string[];
    fetchLimit?: number | null;
  };

  if (payload.type !== OFFSCREEN_COLLECT_MESSAGE) {
    return false;
  }

  // Handle collection asynchronously
  handleCollectionRequest(payload.existingActivityUids ?? [], payload.fetchLimit ?? null)
    .then(() => {
      sendResponse({ success: true });
    })
    .catch((error) => {
      console.error('Offscreen collector failed', error);
      sendResponse({ success: false, error: error.message });
    });

  return true; // Keep channel open for async response
});

async function handleCollectionRequest(
  existingActivityUids: string[],
  fetchLimit: number | null
): Promise<void> {
  try {
    console.info('Mountaineers Assistant offscreen: starting collection');
    sendProgressUpdate({ stage: 'fetching-activities', total: 0, completed: 0 });

    // Collection logic will go here (next steps)

    sendProgressUpdate({ stage: 'no-new-activities', total: 0, completed: 0 });

    chrome.runtime.sendMessage({
      type: RESULT_MESSAGE,
      success: true,
      data: {
        activities: [],
        people: [],
        rosterEntries: [],
        currentUserUid: null,
      } satisfies CollectorSuccessPayload,
    });
  } catch (error: unknown) {
    console.error('Mountaineers Assistant offscreen: collection failed', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    sendProgressUpdate({
      stage: 'error',
      total: 0,
      completed: 0,
      error: errorMessage,
    });
    chrome.runtime.sendMessage({
      type: RESULT_MESSAGE,
      success: false,
      error: errorMessage,
    });
  }
}

function sendProgressUpdate(update: {
  stage: string;
  total?: number;
  completed?: number;
  activityUid?: string;
  activityTitle?: string | null;
  error?: string;
  delta?: CollectorDelta;
}): void {
  try {
    chrome.runtime.sendMessage({
      type: PROGRESS_MESSAGE,
      origin: 'offscreen',
      ...update,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.warn('Mountaineers Assistant offscreen: failed to send progress', error);
  }
}
