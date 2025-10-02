const OVERVIEW_EL = document.getElementById('overview');
const TOP_PARTNERS_EL = document.getElementById('top-partners');
const CATEGORY_EL = document.getElementById('category-breakdown');
const MONTHLY_EL = document.getElementById('monthly-breakdown');
const RECENT_EL = document.getElementById('recent-activities');
const SUMMARY_EL = document.getElementById('summary');

const SETTINGS_KEY = 'mountaineersAssistantSettings';
let displaySettings = { showAvatars: true };

init();

async function loadSettings() {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  const raw = stored?.[SETTINGS_KEY] || {};
  displaySettings = {
    showAvatars: raw.showAvatars !== false,
  };
  return displaySettings;
}

async function init() {
  const data = await chrome.storage.local.get('mountaineersAssistantData');
  const payload = data?.mountaineersAssistantData;

  if (!payload) {
    SUMMARY_EL.textContent = 'No cached data available. Refresh from the extension popup first.';
    return;
  }

  await loadSettings();

  const stats = computeStats(payload);
  window.__mtgPeopleByUid = new Map(stats.people.map((person) => [person.uid, person]));
  console.info('Mountaineers Assistant stats: resolved datasets', {
    activities: stats.activities.length,
    people: stats.people.length,
    rosterEntries: stats.rosterEntries.length,
    currentUserUid: stats.currentUserUid,
  });
  renderOverview(stats);
  renderTopPartners(stats.topPartners);
  renderCategories(stats.categories);
  renderMonthly(stats.monthly);
  renderRecent(stats.recentActivities);
  SUMMARY_EL.textContent = `Last refreshed ${formatRelative(stats.lastUpdated)} • ${
    stats.activities.length
  } activities, ${stats.people.length} unique activity partners.`;
}

function computeStats(payload) {
  const activities = payload.activities || [];
  const people = payload.people || [];
  const roster = payload.rosterEntries || [];

  const partnerCounts = new Map();
  for (const entry of roster) {
    partnerCounts.set(entry.person_uid, (partnerCounts.get(entry.person_uid) || 0) + 1);
  }

  const peopleByUid = new Map(people.map((person) => [person.uid, person]));
  const activitiesByUid = new Map(activities.map((activity) => [activity.uid, activity]));

  const currentUser = payload.currentUserUid || findCurrentUserUid(activities, roster);

  const showAvatars = displaySettings.showAvatars !== false;

  const topPartners = Array.from(partnerCounts.entries())
    .filter(([uid]) => uid !== currentUser)
    .map(([uid, count]) => {
      const partnerRoster = roster
        .filter((entry) => entry.person_uid === uid)
        .map((entry) => activitiesByUid.get(entry.activity_uid))
        .filter(Boolean)
        .sort((a, b) => new Date(b.start_date || 0) - new Date(a.start_date || 0));
      const personRecord = peopleByUid.get(uid);
      return {
        uid,
        count,
        name: personRecord?.name || uid,
        href: personRecord?.href || buildMemberHref(uid),
        avatar: showAvatars ? personRecord?.avatar || null : null,
        activities: partnerRoster,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const categoryCounts = new Map();
  for (const activity of activities) {
    const key = (activity.category || 'unknown').toLowerCase();
    categoryCounts.set(key, (categoryCounts.get(key) || 0) + 1);
  }

  const monthlyCounts = new Map();
  for (const activity of activities) {
    if (!activity.start_date) continue;
    const monthKey = activity.start_date.slice(0, 7);
    monthlyCounts.set(monthKey, (monthlyCounts.get(monthKey) || 0) + 1);
  }

  const recentActivities = [...activities]
    .filter((activity) => activity.start_date)
    .sort((a, b) => new Date(b.start_date) - new Date(a.start_date))
    .slice(0, 10)
    .map((activity) => ({
      title: activity.title || activity.uid,
      date: activity.start_date,
      category: activity.category || 'unknown',
      activity_type: activity.activity_type || null,
      result: activity.result || 'unknown',
      href: activity.href || null,
    }));

  return {
    activities,
    people,
    rosterEntries: roster,
    lastUpdated: payload.lastUpdated,
    topPartners,
    categories: Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1]),
    monthly: Array.from(monthlyCounts.entries()).sort().reverse().slice(0, 12),
    recentActivities,
    currentUserUid: currentUser,
  };
}

function findCurrentUserUid(activities, roster) {
  console.debug('Mountaineers Assistant stats: determining current user', {
    rosterCount: roster.length,
  });
  if (!roster.length) {
    return null;
  }
  const activityIdsWithRoster = new Set(roster.map((entry) => entry.activity_uid));
  const totalActivities = activityIdsWithRoster.size;
  if (totalActivities === 0) {
    return null;
  }

  const participation = new Map();
  for (const entry of roster) {
    if (!participation.has(entry.person_uid)) {
      participation.set(entry.person_uid, new Set());
    }
    participation.get(entry.person_uid).add(entry.activity_uid);
  }

  const candidates = Array.from(participation.entries()).filter(
    ([, activitySet]) => activitySet.size === totalActivities
  );

  console.debug('Mountaineers Assistant stats: participation candidates', candidates);

  if (candidates.length === 1) {
    return candidates[0][0];
  }

  if (!candidates.length) {
    return null;
  }

  candidates.sort((a, b) => b[1].size - a[1].size);
  return candidates[0][0];
}

function renderOverview({ activities, people }) {
  OVERVIEW_EL.innerHTML = '';
  addMetric("Activities you've been to", activities.length);
  addMetric("People you've interacted with", people.length);
}

function renderTopPartners(partners) {
  TOP_PARTNERS_EL.innerHTML = '';
  if (!partners.length) {
    TOP_PARTNERS_EL.innerHTML = `<li>No roster data yet.</li>`;
    return;
  }
  const showAvatars = displaySettings.showAvatars !== false;
  for (const partner of partners) {
    const li = document.createElement('li');
    li.className = 'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm';

    const header = document.createElement('div');
    header.className = 'flex items-center gap-3 px-4 py-3';

    const toggle = document.createElement('button');
    toggle.className =
      'flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-lg font-semibold text-slate-700 transition hover:bg-slate-200';
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = '+';

    let avatar = null;
    if (showAvatars) {
      avatar = document.createElement('div');
      avatar.className =
        'flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-sm font-semibold text-slate-700';
      avatar.title = partner.name;
      if (partner.avatar) {
        const img = document.createElement('img');
        img.src = partner.avatar;
        img.alt = `${partner.name} avatar`;
        img.className = 'h-10 w-10 rounded-full object-cover';
        avatar.appendChild(img);
      } else {
        avatar.textContent = initials(partner.name);
        avatar.setAttribute('aria-hidden', 'true');
      }
    }

    const link = document.createElement('a');
    link.textContent = partner.name;
    link.href = partner.href;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.className = 'flex-1 text-base font-semibold text-gray-900 no-underline hover:underline';

    const count = document.createElement('span');
    count.className = 'text-sm text-gray-500';
    count.textContent = `${partner.count} activities`;

    if (avatar) {
      header.append(toggle, avatar, link, count);
    } else {
      header.append(toggle, link, count);
    }
    li.appendChild(header);

    const activityList = document.createElement('ul');
    activityList.className = 'grid gap-2 px-4 pb-4';
    activityList.style.display = 'none';

    for (const activity of partner.activities) {
      const item = document.createElement('li');
      item.className = 'rounded-lg border border-slate-200 bg-slate-50 px-3 py-2';
      const activityLink = document.createElement('a');
      activityLink.textContent = activity.title || activity.uid;
      const partnerActivityHref = toExternalHref(activity.href);
      if (partnerActivityHref) {
        activityLink.href = partnerActivityHref;
        activityLink.target = '_blank';
        activityLink.rel = 'noreferrer';
        activityLink.className = 'text-sm font-semibold text-gray-900 no-underline hover:underline';
      } else {
        activityLink.href = '#';
        activityLink.className =
          'text-sm font-semibold text-gray-500 no-underline cursor-default select-none';
      }

      const meta = document.createElement('span');
      meta.className = 'block text-xs text-gray-500';
      const metaParts = [formatDate(activity.start_date)];
      if (activity.activity_type) {
        metaParts.push(activity.activity_type);
      }
      metaParts.push(capitalize(activity.category));
      meta.textContent = metaParts.join(' • ');

      item.append(activityLink, meta);
      activityList.appendChild(item);
    }

    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      const nextState = !expanded;
      toggle.setAttribute('aria-expanded', String(nextState));
      toggle.textContent = nextState ? '−' : '+';
      activityList.style.display = nextState ? 'grid' : 'none';
    });

    li.appendChild(activityList);
    TOP_PARTNERS_EL.appendChild(li);
  }
}

function renderCategories(categories) {
  CATEGORY_EL.innerHTML = '';
  for (const [category, count] of categories) {
    const li = document.createElement('li');
    li.className = 'rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm';
    li.innerHTML = `<strong class="text-sm font-semibold text-gray-900">${capitalize(
      category
    )}</strong><span class="block text-xs text-gray-500">${count} activities</span>`;
    CATEGORY_EL.appendChild(li);
  }
}

function renderMonthly(monthly) {
  MONTHLY_EL.innerHTML = '';
  if (!monthly.length) {
    MONTHLY_EL.innerHTML = `<li>No dated activities yet.</li>`;
    return;
  }
  for (const [month, count] of monthly) {
    const li = document.createElement('li');
    li.className = 'rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm';
    li.innerHTML = `<strong class="text-sm font-semibold text-gray-900">${formatMonth(
      month
    )}</strong><span class="block text-xs text-gray-500">${count} activities</span>`;
    MONTHLY_EL.appendChild(li);
  }
}

function renderRecent(activities) {
  RECENT_EL.innerHTML = '';
  if (!activities.length) {
    RECENT_EL.innerHTML = `<li>No recent activities recorded.</li>`;
    return;
  }
  for (const activity of activities) {
    const li = document.createElement('li');
    li.className = 'rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm';
    const link = document.createElement('a');
    link.textContent = activity.title;
    const recentActivityHref = toExternalHref(activity.href);
    if (recentActivityHref) {
      link.href = recentActivityHref;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.className = 'text-sm font-semibold text-gray-900 no-underline hover:underline';
    } else {
      link.href = '#';
      link.className =
        'text-sm font-semibold text-gray-500 no-underline cursor-default select-none';
    }
    li.append(link);
    const meta = document.createElement('span');
    meta.className = 'block text-xs text-gray-500';
    const metaParts = [formatDate(activity.date)];
    if (activity.activity_type) {
      metaParts.push(activity.activity_type);
    }
    metaParts.push(capitalize(activity.category));
    meta.textContent = metaParts.join(' • ');
    li.appendChild(meta);
    RECENT_EL.appendChild(li);
  }
}

function addMetric(label, value) {
  const li = document.createElement('li');
  li.className =
    'flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm';
  li.innerHTML = `<strong class="text-sm text-gray-600">${label}</strong><span class="text-xl font-semibold text-gray-900">${value}</span>`;
  OVERVIEW_EL.appendChild(li);
}

function toExternalHref(value) {
  if (!value) return null;
  try {
    return new URL(value, 'https://www.mountaineers.org/').toString();
  } catch (error) {
    console.warn('Mountaineers Assistant stats: unable to normalize activity URL', value, error);
    return null;
  }
}

function initials(value) {
  if (!value) return '';
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function capitalize(value) {
  if (!value) return 'Unknown';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatRelative(isoString) {
  if (!isoString) return 'Never';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString;
  }
  return date.toLocaleString();
}

function formatMonth(monthKey) {
  const [year, month] = monthKey.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
}

function formatDate(iso) {
  if (!iso) return 'Date unknown';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function buildMemberHref(slug) {
  return `https://www.mountaineers.org/members/${slug}`;
}
