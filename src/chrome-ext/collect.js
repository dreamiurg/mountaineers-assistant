(async () => {
  const existingActivityUids = new Set(window.__mtgExistingActivityUids || []);
  const fetchLimit =
    typeof window.__mtgFetchLimit === 'number' && window.__mtgFetchLimit > 0
      ? window.__mtgFetchLimit
      : null;
  if (window.__mtgScrapeRunning) {
    return;
  }
  window.__mtgScrapeRunning = true;

  const RESULT_MESSAGE = 'refresh-result';
  const HOME_URL = 'https://www.mountaineers.org/';
  const HISTORY_SUFFIX = '/member-activity-history.json';
  const ROSTER_SEGMENT = 'roster-tab';
  const PROGRESS_MESSAGE = 'refresh-progress';

  try {
    console.info('Mountaineers Assistant: starting refresh workflow');
    sendProgressUpdate({ stage: 'starting', total: 0, completed: 0 });
    const { activities, currentUserUid } = await collectMemberActivities(
      existingActivityUids,
      fetchLimit
    );
    console.info('Mountaineers Assistant: loaded %d activities', activities.length);
    const totalActivities = activities.length;
    if (totalActivities === 0) {
      sendProgressUpdate({ stage: 'no-new-activities', total: 0, completed: 0 });
    } else {
      sendProgressUpdate({ stage: 'activities-collected', total: totalActivities, completed: 0 });
    }
    const exportData = await loadRosters(activities);
    console.info(
      'Mountaineers Assistant: collected %d people and %d roster entries',
      exportData.people.length,
      exportData.rosterEntries.length
    );
    sendProgressUpdate({ stage: 'finalizing', total: totalActivities, completed: totalActivities });
    chrome.runtime.sendMessage({
      type: RESULT_MESSAGE,
      success: true,
      data: { ...exportData, currentUserUid },
    });
  } catch (error) {
    console.error('Mountaineers Assistant: refresh failed', error);
    sendProgressUpdate({
      stage: 'error',
      total: 0,
      completed: 0,
      error: error instanceof Error ? error.message : String(error),
    });
    chrome.runtime.sendMessage({
      type: RESULT_MESSAGE,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    window.__mtgScrapeRunning = false;
    delete window.__mtgExistingActivityUids;
    delete window.__mtgFetchLimit;
  }

  async function collectMemberActivities(existingActivityUids, fetchLimit) {
    const { url: activitiesUrl, currentUserUid } = await discoverActivitiesUrl();
    const historyUrl = deriveHistoryUrl(activitiesUrl);
    const { csrfToken, refererUrl } = await collectCsrfToken(activitiesUrl);
    const payload = await fetchHistoryPayload(historyUrl, refererUrl, csrfToken);
    const activities = payload
      .map(normalizeActivity)
      .filter(
        (activity) => activity && isSuccessful(activity) && !existingActivityUids.has(activity.uid)
      )
      .sort((a, b) => new Date(b.start_date || 0) - new Date(a.start_date || 0));

    const limitedActivities =
      typeof fetchLimit === 'number' && fetchLimit > 0
        ? activities.slice(0, fetchLimit)
        : activities;

    return { activities: limitedActivities, currentUserUid };
  }

  async function discoverActivitiesUrl() {
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
    const url = new URL(match.getAttribute('href') || '', response.url).toString();
    console.debug('Mountaineers Assistant: activities URL discovered -> %s', url);
    const profileSlug = extractProfileSlug(doc);
    if (profileSlug) {
      console.debug('Mountaineers Assistant: detected current user slug -> %s', profileSlug);
    }
    return { url, currentUserUid: profileSlug };
  }

  function deriveHistoryUrl(activitiesUrl) {
    const trimmed = activitiesUrl.replace(/\/$/, '');
    if (trimmed.endsWith('/member-activities')) {
      return `${trimmed.slice(0, -'/member-activities'.length)}${HISTORY_SUFFIX}`;
    }
    throw new Error('Activities URL does not match expected pattern.');
  }

  async function collectCsrfToken(activitiesUrl) {
    console.debug('Mountaineers Assistant: loading activities page to collect CSRF token');
    const response = await fetch(activitiesUrl, { credentials: 'include' });
    if (!response.ok) {
      throw new Error(`Failed to load activities page (${response.status})`);
    }
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const metaToken = doc.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    const dataToken = doc.querySelector('[data-csrf-token]')?.getAttribute('data-csrf-token');
    const scriptTokenMatch = html.match(/x-csrf-token\s*=\s*"([^"]+)"/i);
    const csrfToken =
      metaToken || dataToken || (scriptTokenMatch ? decodeHtml(scriptTokenMatch[1]) : null);
    return { csrfToken, refererUrl: response.url };
  }

  async function fetchHistoryPayload(historyUrl, refererUrl, csrfToken) {
    const headers = {
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
      if (Array.isArray(payload?.[key])) {
        return payload[key];
      }
    }
    throw new Error('Unexpected JSON structure from activity history endpoint.');
  }

  function normalizeActivity(record) {
    const uid = stringOrNull(record?.uid)?.trim();
    const href = ensureAbsoluteUrl(stringOrNull(record?.href)?.trim());
    if (!uid || !href) {
      return null;
    }
    return {
      uid,
      href,
      title: stringOrNull(record?.title),
      category: stringOrNull(record?.category),
      start_date: parseDate(record?.start),
      trip_results: stringOrNull(record?.trip_results),
      result: stringOrNull(record?.result),
      rawResult: record?.result,
      activity_type: stringOrNull(record?.activity_type),
    };
  }

  function isSuccessful(activity) {
    if (!activity) return false;
    const result = (activity.result || activity.rawResult || '').toLowerCase();
    return result === 'successful';
  }

  async function loadRosters(activities) {
    const peopleByUid = new Map();
    const rosterEntries = [];
    const enrichedActivities = [];
    const total = activities.length;
    let processed = 0;

    if (total > 0) {
      sendProgressUpdate({ stage: 'processing', total, completed: 0 });
    }

    for (const activity of activities) {
      let resolvedType = activity.activity_type || null;

      const [detailsResult, rosterResult] = await Promise.allSettled([
        loadActivityDetails(activity),
        loadActivityRoster(activity),
      ]);

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

      if (rosterResult.status === 'fulfilled') {
        const { people, entries } = rosterResult.value;
        for (const person of people) {
          const existing = peopleByUid.get(person.uid);
          if (!existing) {
            peopleByUid.set(person.uid, person);
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
            peopleByUid.set(person.uid, mergedPerson);
          }
        }
        rosterEntries.push(...entries);
      } else {
        console.warn(`Failed to collect roster for ${activity.uid}`, rosterResult.reason);
      }

      enrichedActivities.push({ ...activity, activity_type: resolvedType });
      processed += 1;
      sendProgressUpdate({
        stage: 'processing',
        total,
        completed: processed,
        activityUid: activity.uid,
        activityTitle: activity.title || null,
      });
    }

    return {
      activities: enrichedActivities,
      people: Array.from(peopleByUid.values()),
      rosterEntries,
    };
  }

  function sendProgressUpdate(update) {
    if (!update || typeof chrome?.runtime?.sendMessage !== 'function') {
      return;
    }
    const payload = {
      stage: typeof update.stage === 'string' ? update.stage : 'unknown',
      timestamp: Date.now(),
    };
    if (Number.isFinite(update.total)) {
      payload.total = Math.max(0, Math.floor(update.total));
    }
    if (Number.isFinite(update.completed)) {
      payload.completed = Math.max(0, Math.floor(update.completed));
    }
    if (typeof update.activityUid === 'string') {
      payload.activityUid = update.activityUid;
    }
    if (typeof update.activityTitle === 'string') {
      payload.activityTitle = update.activityTitle;
    }
    if (update.error) {
      payload.error = update.error;
    }

    try {
      chrome.runtime.sendMessage({
        type: PROGRESS_MESSAGE,
        origin: 'collector',
        ...payload,
      });
    } catch (error) {
      console.warn('Mountaineers Assistant: failed to send progress update', error);
    }
  }

  async function loadActivityDetails(activity) {
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
      console.warn(
        `Mountaineers Assistant: failed to load activity page for ${activity.uid}`,
        error
      );
      return { activityType: null };
    }
  }

  function extractActivityType(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const detailItems = Array.from(doc.querySelectorAll('.program-core .details li'));
    for (const item of detailItems) {
      const label = item.querySelector('label');
      const labelText = normalizeWhitespace(label?.textContent || '');
      if (labelText && labelText.replace(/:$/, '').toLowerCase() === 'activity type') {
        const clone = item.cloneNode(true);
        const cloneLabel = clone.querySelector('label');
        if (cloneLabel) {
          cloneLabel.remove();
        }
        const value = normalizeWhitespace(clone.textContent || '');
        if (value) {
          return value;
        }
      }
    }
    return null;
  }

  async function loadActivityRoster(activity) {
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
    const contentType = response.headers.get('Content-Type') || '';
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

  function deriveRosterUrl(activityHref) {
    const url = new URL(activityHref);
    const path = url.pathname.replace(/\/$/, '');
    url.pathname = `${path}/${ROSTER_SEGMENT}`;
    url.search = '';
    url.hash = '';
    return url.toString();
  }

  function parseRosterHtml(html, activityUid) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const contacts = Array.from(doc.querySelectorAll('.roster-contact'));
    const people = [];
    const entries = [];

    for (const contact of contacts) {
      const parsed = parseRosterContact(contact, activityUid);
      if (!parsed) {
        continue;
      }
      people.push(parsed.person);
      entries.push(parsed.entry);
    }

    return { people, entries };
  }

  function parseRosterContact(element, activityUid) {
    const name = extractText(element, ['.roster-name', "a[href*='/members/']", 'div']);
    if (!name) {
      return null;
    }

    const anchor = element.querySelector("a[href*='/members/']");
    const href = anchor ? new URL(anchor.getAttribute('href'), HOME_URL).toString() : null;
    const img = element.querySelector("img[src*='/members/']");
    const imageHref = img ? img.getAttribute('src') : null;

    const rawSlugCandidate = anchor?.getAttribute('href') || imageHref;
    const slug = extractSlug(rawSlugCandidate) || slugify(name);
    if (!slug) {
      return null;
    }

    const roleText = extractText(element, ['.roster-position']);
    const role = normalizeRole(roleText);
    const avatar = normalizeAvatarUrl(imageHref);

    const person = {
      uid: slug,
      href: href || buildMemberHref(slug),
      name,
      avatar,
    };

    const entry = {
      activity_uid: activityUid,
      person_uid: slug,
      role,
    };

    return { person, entry };
  }

  function extractText(element, selectors) {
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

  function extractSlug(value) {
    if (!value) {
      return null;
    }
    const match = value.match(/\/members\/([^/]+)/);
    return match ? match[1] : null;
  }

  function buildMemberHref(slug) {
    return new URL(`/members/${slug}`, HOME_URL).toString();
  }

  function normalizeRole(roleText) {
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

  function normalizeAvatarUrl(value) {
    const url = ensureAbsoluteUrl(value);
    if (!url) {
      return null;
    }
    if (url.includes('/placeholder-contact-profile/')) {
      return null;
    }
    return url;
  }

  function normalizeWhitespace(value) {
    if (typeof value !== 'string') {
      return null;
    }
    const cleaned = value.replace(/\s+/g, ' ').trim();
    return cleaned || null;
  }

  function slugify(value) {
    return value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  function stringOrNull(value) {
    return typeof value === 'string' ? value : null;
  }

  function parseDate(value) {
    if (!value) {
      return null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  function decodeHtml(value) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value;
  }

  function extractProfileSlug(doc) {
    const anchors = Array.from(doc.querySelectorAll("a[href*='/members/']"));
    for (const anchor of anchors) {
      const text = anchor.textContent?.trim().toLowerCase();
      if (text && text.includes('my profile')) {
        const href = anchor.getAttribute('href') || '';
        const match = href.match(/\/members\/([^/]+)/);
        if (match) {
          return match[1];
        }
      }
    }
    return null;
  }

  function ensureAbsoluteUrl(value) {
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
})();
