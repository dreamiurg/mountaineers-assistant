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

    const existingSet = new Set<string>(existingActivityUids);

    const { activities, currentUserUid } = await collectMemberActivities(existingSet, fetchLimit);

    console.info('Mountaineers Assistant offscreen: loaded %d activities', activities.length);
    const totalActivities = activities.length;
    if (totalActivities === 0) {
      sendProgressUpdate({ stage: 'no-new-activities', total: 0, completed: 0 });
    } else {
      sendProgressUpdate({ stage: 'activities-collected', total: totalActivities, completed: 0 });
    }

    const exportData = await loadRosters(activities);
    console.info(
      'Mountaineers Assistant offscreen: collected %d people and %d roster entries',
      exportData.people.length,
      exportData.rosterEntries.length
    );

    sendProgressUpdate({
      stage: 'finalizing',
      total: totalActivities,
      completed: totalActivities,
    });

    chrome.runtime.sendMessage({
      type: RESULT_MESSAGE,
      success: true,
      data: {
        ...exportData,
        currentUserUid,
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

async function collectMemberActivities(
  existingActivityUids: Set<string>,
  fetchLimit: number | null
): Promise<{ activities: ActivityRecord[]; currentUserUid: string | null }> {
  const { url: activitiesUrl, currentUserUid } = await discoverActivitiesUrl();
  const historyUrl = deriveHistoryUrl(activitiesUrl);
  const { csrfToken, refererUrl } = await collectCsrfToken(activitiesUrl);
  const payload = await fetchHistoryPayload(historyUrl, refererUrl, csrfToken);

  const activities = payload
    .map(normalizeActivity)
    .filter((activity): activity is ActivityRecord => {
      if (!activity) {
        return false;
      }
      if (!isSuccessful(activity)) {
        return false;
      }
      return !existingActivityUids.has(activity.uid);
    })
    .sort((a, b) => {
      const timeA = a.start_date ? new Date(a.start_date).getTime() : 0;
      const timeB = b.start_date ? new Date(b.start_date).getTime() : 0;
      return timeB - timeA;
    });

  const limitedActivities =
    typeof fetchLimit === 'number' && fetchLimit > 0 ? activities.slice(0, fetchLimit) : activities;

  return { activities: limitedActivities, currentUserUid };
}

async function discoverActivitiesUrl(): Promise<{ url: string; currentUserUid: string | null }> {
  console.debug('Mountaineers Assistant: fetching homepage to locate activities link');
  const response = await fetch(HOME_URL, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Failed to load homepage (${response.status})`);
  }

  const html = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const links = Array.from(doc.querySelectorAll('a'));
  const match = links.find((link) => link.textContent?.trim().includes('My Activities'));
  if (!match) {
    throw new Error("Unable to locate 'My Activities' link on homepage.");
  }
  const href = match.getAttribute('href') ?? '';
  const url = new URL(href, response.url).toString();
  console.debug('Mountaineers Assistant: activities URL discovered -> %s', url);
  const profileSlug = extractProfileSlug(doc);
  if (profileSlug) {
    console.debug('Mountaineers Assistant: detected current user slug -> %s', profileSlug);
  }
  return { url, currentUserUid: profileSlug };
}

function deriveHistoryUrl(activitiesUrl: string): string {
  const trimmed = activitiesUrl.replace(/\/$/, '');
  if (trimmed.endsWith('/member-activities')) {
    return `${trimmed.slice(0, -'/member-activities'.length)}${HISTORY_SUFFIX}`;
  }
  throw new Error('Activities URL does not match expected pattern.');
}

async function collectCsrfToken(
  activitiesUrl: string
): Promise<{ csrfToken: string | null; refererUrl: string }> {
  console.debug('Mountaineers Assistant: loading activities page to collect CSRF token');
  const response = await fetch(activitiesUrl, { credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Failed to load activities page (${response.status})`);
  }
  const html = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const metaToken = doc.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? null;
  const dataToken = doc.querySelector('[data-csrf-token]')?.getAttribute('data-csrf-token') ?? null;
  const scriptTokenMatch = html.match(/x-csrf-token\s*=\s*"([^"]+)"/i);
  const csrfToken =
    metaToken || dataToken || (scriptTokenMatch ? decodeHtml(scriptTokenMatch[1]) : null);
  return { csrfToken, refererUrl: response.url };
}

async function fetchHistoryPayload(
  historyUrl: string,
  refererUrl: string,
  csrfToken: string | null
): Promise<unknown[]> {
  const headers: Record<string, string> = {
    Accept: 'application/json, text/javascript, */*; q=0.01',
    'X-Requested-With': 'XMLHttpRequest',
    Referer: refererUrl,
  };
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }
  console.debug('Mountaineers Assistant: requesting history payload %s', historyUrl);
  const response = await fetch(historyUrl, {
    credentials: 'include',
    headers,
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch activity history (${response.status})`);
  }
  const payload = await response.json();
  if (Array.isArray(payload)) {
    return payload;
  }
  for (const key of ['items', 'results', 'data']) {
    if (Array.isArray((payload as Record<string, unknown>)[key])) {
      return (payload as Record<string, unknown>)[key] as unknown[];
    }
  }
  throw new Error('Unexpected JSON structure from activity history endpoint.');
}

function normalizeActivity(record: unknown): ActivityRecord | null {
  if (!isRecord(record)) {
    return null;
  }
  const uidRaw = stringOrNull(record.uid);
  const uid = uidRaw ? uidRaw.trim() : null;
  const hrefRaw = stringOrNull(record.href);
  const href = ensureAbsoluteUrl(hrefRaw ? hrefRaw.trim() : null);
  if (!uid || !href) {
    return null;
  }

  return {
    uid,
    href,
    title: stringOrNull(record.title),
    category: stringOrNull(record.category),
    start_date: parseDate((record as Record<string, unknown>).start),
    trip_results: stringOrNull(record.trip_results),
    result: stringOrNull(record.result),
    rawResult: record.result,
    activity_type: stringOrNull(record.activity_type),
  };
}

function isSuccessful(activity: ActivityRecord): boolean {
  const result = (activity.result ?? activity.rawResult ?? '').toString().toLowerCase();
  return result === 'successful';
}

async function loadRosters(
  activities: ActivityRecord[]
): Promise<Omit<CollectorSuccessPayload, 'currentUserUid'>> {
  const peopleByUid = new Map<string, PersonRecord>();
  const rosterEntries: RosterEntryRecord[] = [];
  const enrichedActivities: ActivityRecord[] = [];
  const total = activities.length;
  let processed = 0;

  if (total > 0) {
    sendProgressUpdate({ stage: 'processing', total, completed: 0 });
  }

  for (const activity of activities) {
    let resolvedType = activity.activity_type ?? null;
    const activityTitle = activity.title ?? null;

    const detailsPromise = loadActivityDetails(activity);
    const rosterPromise = loadActivityRoster(activity);

    sendProgressUpdate({
      stage: 'loading-details',
      total,
      completed: processed,
      activityUid: activity.uid,
      activityTitle,
    });

    const detailsResult = await settlePromise(detailsPromise);

    if (detailsResult.status === 'fulfilled') {
      if (detailsResult.value.activityType) {
        resolvedType = detailsResult.value.activityType;
      }
    } else {
      console.warn(
        `Mountaineers Assistant: failed to load activity details for ${activity.uid}`,
        detailsResult.reason
      );
    }

    sendProgressUpdate({
      stage: 'loading-roster',
      total,
      completed: processed,
      activityUid: activity.uid,
      activityTitle,
    });

    const rosterResult = await settlePromise(rosterPromise);

    if (rosterResult.status === 'fulfilled') {
      const { people, entries } = rosterResult.value;
      for (const person of people) {
        const existing = peopleByUid.get(person.uid);
        if (!existing) {
          peopleByUid.set(person.uid, person);
          continue;
        }
        const mergedPerson: PersonRecord = { ...existing };
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
          peopleByUid.set(person.uid, mergedPerson);
        }
      }
      rosterEntries.push(...entries);
    } else {
      console.warn(`Failed to collect roster for ${activity.uid}`, rosterResult.reason);
    }

    const enrichedActivity: ActivityRecord = { ...activity, activity_type: resolvedType };
    enrichedActivities.push(enrichedActivity);
    processed += 1;
    const rosterDelta =
      rosterResult.status === 'fulfilled'
        ? {
            people: rosterResult.value.people,
            rosterEntries: rosterResult.value.entries,
          }
        : {
            people: [],
            rosterEntries: [],
          };
    sendProgressUpdate({
      stage: 'processing',
      total,
      completed: processed,
      activityUid: activity.uid,
      activityTitle,
      delta: {
        activities: [enrichedActivity],
        people: rosterDelta.people,
        rosterEntries: rosterDelta.rosterEntries,
      },
    });
  }

  return {
    activities: enrichedActivities,
    people: Array.from(peopleByUid.values()),
    rosterEntries,
  };
}

function settlePromise<T>(promise: Promise<T>): Promise<PromiseSettledResult<T>> {
  return promise
    .then<PromiseSettledResult<T>>((value) => ({ status: 'fulfilled', value }))
    .catch<PromiseSettledResult<T>>((reason) => ({ status: 'rejected', reason }));
}

async function loadActivityDetails(
  activity: ActivityRecord
): Promise<{ activityType: string | null }> {
  if (!activity?.href) {
    return { activityType: null };
  }
  try {
    const response = await fetch(activity.href, { credentials: 'include' });
    if (!response.ok) {
      console.warn(
        `Mountaineers Assistant: activity page unavailable (${response.status}) for ${activity.uid}`
      );
      return { activityType: null };
    }
    const html = await response.text();
    return { activityType: extractActivityType(html) };
  } catch (error) {
    console.warn(`Mountaineers Assistant: failed to load activity page for ${activity.uid}`, error);
    return { activityType: null };
  }
}

function extractActivityType(html: string): string | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const detailItems = Array.from(doc.querySelectorAll('.program-core .details li'));
  for (const item of detailItems) {
    const label = item.querySelector('label');
    const labelText = normalizeWhitespace(label?.textContent ?? '');
    if (labelText && labelText.replace(/:$/, '').toLowerCase() === 'activity type') {
      const clone = item.cloneNode(true) as HTMLElement;
      const cloneLabel = clone.querySelector('label');
      if (cloneLabel) {
        cloneLabel.remove();
      }
      const value = normalizeWhitespace(clone.textContent ?? '');
      if (value) {
        return value;
      }
    }
  }
  return null;
}

async function loadActivityRoster(
  activity: ActivityRecord
): Promise<{ people: PersonRecord[]; entries: RosterEntryRecord[] }> {
  if (!activity.href) {
    return { people: [], entries: [] };
  }
  const rosterUrl = deriveRosterUrl(activity.href);
  const response = await fetch(rosterUrl, {
    credentials: 'include',
    headers: {
      Accept: 'text/html, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: activity.href,
    },
  });
  if (!response.ok) {
    throw new Error(`Roster fetch failed (${response.status})`);
  }
  const contentType = response.headers.get('Content-Type') ?? '';
  if (contentType.includes('application/json')) {
    const payload = await response.json();
    if (payload?.error_type) {
      throw new Error(`Roster request failed: ${payload.error_type}`);
    }
    return { people: [], entries: [] };
  }
  const html = await response.text();
  return parseRosterHtml(html, activity.uid);
}

function deriveRosterUrl(activityHref: string): string {
  const url = new URL(activityHref);
  const path = url.pathname.replace(/\/$/, '');
  url.pathname = `${path}/${ROSTER_SEGMENT}`;
  url.search = '';
  url.hash = '';
  return url.toString();
}

function parseRosterHtml(
  html: string,
  activityUid: string
): {
  people: PersonRecord[];
  entries: RosterEntryRecord[];
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const contacts = Array.from(doc.querySelectorAll('.roster-contact'));
  const people: PersonRecord[] = [];
  const entries: RosterEntryRecord[] = [];

  for (const contact of contacts) {
    const parsed = parseRosterContact(contact as HTMLElement, activityUid);
    if (!parsed) {
      continue;
    }
    people.push(parsed.person);
    entries.push(parsed.entry);
  }

  return { people, entries };
}

function parseRosterContact(
  element: HTMLElement,
  activityUid: string
): { person: PersonRecord; entry: RosterEntryRecord } | null {
  const name = extractText(element, ['.roster-name', "a[href*='/members/']", 'div']);
  if (!name) {
    return null;
  }

  const anchor = element.querySelector("a[href*='/members/']");
  const anchorHref = anchor?.getAttribute('href') ?? null;
  const href = anchorHref ? new URL(anchorHref, HOME_URL).toString() : null;
  const img = element.querySelector("img[src*='/members/']");
  const imageHref = img?.getAttribute('src') ?? null;

  const rawSlugCandidate = anchorHref ?? imageHref;
  const slug = extractSlug(rawSlugCandidate) ?? slugify(name);
  if (!slug) {
    return null;
  }

  const roleText = extractText(element, ['.roster-position']);
  const role = normalizeRole(roleText);
  const avatar = normalizeAvatarUrl(imageHref);

  const person: PersonRecord = {
    uid: slug,
    href: href ?? buildMemberHref(slug),
    name,
    avatar,
  };

  const entry: RosterEntryRecord = {
    activity_uid: activityUid,
    person_uid: slug,
    role,
  };

  return { person, entry };
}

function extractText(element: HTMLElement, selectors: string[]): string | null {
  for (const selector of selectors) {
    const node = element.querySelector(selector);
    const text = node?.textContent?.trim();
    if (text) {
      return text;
    }
  }
  const textContent = element.textContent?.trim();
  return textContent || null;
}

function extractSlug(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const match = value.match(/\/members\/([^/]+)/);
  return match ? match[1] : null;
}

function buildMemberHref(slug: string): string {
  return new URL(`/members/${slug}`, HOME_URL).toString();
}

function normalizeRole(roleText: string | null): string {
  const defaultRole = 'Participant';
  const knownRoles = ['Primary Leader', 'Assistant Leader', 'Instructor', 'Participant'];
  if (!roleText) {
    return defaultRole;
  }
  const cleaned = roleText.trim().toLowerCase();
  const match = knownRoles.find((role) => role.toLowerCase() === cleaned);
  if (match) {
    return match;
  }
  if (cleaned.includes('participant')) {
    return defaultRole;
  }
  return defaultRole;
}

function normalizeAvatarUrl(value: string | null): string | null {
  const url = ensureAbsoluteUrl(value);
  if (!url) {
    return null;
  }
  if (url.includes('/placeholder-contact-profile/')) {
    return null;
  }
  return url;
}

function normalizeWhitespace(value: string | null): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned || null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function parseDate(value: unknown): string | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value as string);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function decodeHtml(value: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
}

function extractProfileSlug(doc: Document): string | null {
  const anchors = Array.from(doc.querySelectorAll("a[href*='/members/']"));
  for (const anchor of anchors) {
    const text = anchor.textContent?.trim().toLowerCase();
    if (text && text.includes('my profile')) {
      const href = anchor.getAttribute('href') ?? '';
      const match = href.match(/\/members\/([^/]+)/);
      if (match) {
        return match[1];
      }
    }
  }
  return null;
}

function ensureAbsoluteUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }
  try {
    return new URL(value, HOME_URL).toString();
  } catch (error) {
    console.warn(
      'Mountaineers Assistant: unable to convert activity href to absolute URL',
      value,
      error
    );
    return value;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sanitizeDelta(delta: CollectorDelta | null | undefined): CollectorDelta | null {
  if (!delta || typeof delta !== 'object') {
    return null;
  }
  const activities = Array.isArray(delta.activities)
    ? delta.activities.map((activity) => ({ ...activity }))
    : [];
  const people = Array.isArray(delta.people) ? delta.people.map((person) => ({ ...person })) : [];
  const rosterEntries = Array.isArray(delta.rosterEntries)
    ? delta.rosterEntries.map((entry) => ({ ...entry }))
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
