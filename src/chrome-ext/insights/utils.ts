import type { ExtensionCache } from '../shared/types';
import type {
  DashboardFilters,
  DashboardView,
  DisplaySettings,
  PreparedActivity,
  PreparedData,
  DistributionEntry,
  PartnerEntry,
  RecentActivityEntry,
} from './types';

const numberFormatter = new Intl.NumberFormat('en-US');
const monthYearFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  year: 'numeric',
});
const fullDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const ACTIVITY_TYPE_COLORS = [
  '#0ea5e9',
  '#22d3ee',
  '#818cf8',
  '#f59e0b',
  '#94a3b8',
  '#22c55e',
  '#f97316',
  '#38bdf8',
];

const TRIP_CATEGORIES = new Set(['trip', 'trips', 'outing', 'scramble', 'hike', 'backpack']);

const COURSE_CATEGORIES = new Set([
  'course',
  'courses',
  'clinic',
  'seminar',
  'lecture',
  'training',
  'practice',
]);

const MAX_TIMELINE_SERIES = 5;
const OTHER_TIMELINE_LABEL = 'Other types';

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  showAvatars: true,
};

export type PreparedDashboard = {
  prepared: PreparedData | null;
  filters: DashboardFilters;
};

export const formatNumber = (value: number | null | undefined): string =>
  numberFormatter.format(value ?? 0);

export const formatDate = (value: Date | null | undefined): string =>
  value ? fullDateFormatter.format(value) : '–';

export const formatDateRange = (start: Date | null, end: Date | null): string => {
  if (!start && !end) return '–';
  if (!start) return formatDate(end);
  if (!end) return formatDate(start);
  return `${formatDate(start)} – ${formatDate(end)}`;
};

export const titleCase = (value: string | null | undefined): string => {
  if (!value) return 'Uncategorized';
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const getActivityTypeLabel = (raw: unknown): string =>
  typeof raw === 'string' && raw.trim() ? raw : 'Other';

const getRoleLabel = (raw: unknown): string =>
  typeof raw === 'string' && raw.trim() ? raw : 'Participant';

const isTripCategory = (value: string | null | undefined): boolean => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return TRIP_CATEGORIES.has(normalized) || normalized.includes('trip');
};

const isCourseCategory = (value: string | null | undefined): boolean => {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return COURSE_CATEGORIES.has(normalized) || normalized.includes('course');
};

export const toExternalHref = (value: string | null | undefined): string | null => {
  if (!value) return null;
  try {
    return new URL(value, 'https://www.mountaineers.org/').toString();
  } catch (error) {
    console.warn('Mountaineers Assistant insights: unable to normalize URL', value, error);
    return null;
  }
};

export const initials = (value: string | null | undefined): string => {
  if (!value) return '';
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
};

const findCurrentUserUid = (
  activities: ExtensionCache['activities'],
  rosterEntries: ExtensionCache['rosterEntries']
): string | null => {
  if (!Array.isArray(rosterEntries) || rosterEntries.length === 0) return null;
  const activityIds = new Set(
    rosterEntries.map((entry) => entry.activity_uid).filter((uid) => typeof uid === 'string')
  );
  if (activityIds.size === 0) return null;

  const participation = new Map<string, Set<string>>();
  rosterEntries.forEach((entry) => {
    if (!participation.has(entry.person_uid)) {
      participation.set(entry.person_uid, new Set());
    }
    participation.get(entry.person_uid)!.add(entry.activity_uid);
  });

  const candidates = Array.from(participation.entries()).filter(
    ([, activitySet]) => activitySet.size === activityIds.size
  );

  if (candidates.length === 1) {
    return candidates[0][0];
  }

  if (!candidates.length) {
    candidates.push(...Array.from(participation.entries()).sort((a, b) => b[1].size - a[1].size));
  }

  return candidates[0]?.[0] ?? null;
};

export const prepareDashboardData = (payload: ExtensionCache): PreparedData => {
  const activities = Array.isArray(payload.activities) ? payload.activities : [];
  const rosterEntriesRaw = Array.isArray(payload.rosterEntries) ? payload.rosterEntries : [];
  const people = Array.isArray(payload.people) ? payload.people : [];
  const resolvedCurrentUserUid =
    payload.currentUserUid ?? findCurrentUserUid(activities, rosterEntriesRaw);
  const lastUpdated = payload.lastUpdated ? new Date(payload.lastUpdated) : null;

  const peopleMap = new Map(people.map((person) => [person.uid, person]));

  type ActivityWithDate = ExtensionCache['activities'][number] & { date: Date };

  const activitiesWithDates: ActivityWithDate[] = activities
    .map((activity) => ({
      ...activity,
      date: activity.start_date ? new Date(activity.start_date) : null,
    }))
    .filter((activity): activity is ActivityWithDate =>
      Boolean(activity.date && !Number.isNaN(activity.date.valueOf()))
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const validActivityUids = new Set(activitiesWithDates.map((activity) => activity.uid));
  const rosterEntries = rosterEntriesRaw.filter((entry) =>
    validActivityUids.has(entry.activity_uid)
  );

  const rosterByActivity = new Map<string, typeof rosterEntries>();
  rosterEntries.forEach((entry) => {
    if (!rosterByActivity.has(entry.activity_uid)) {
      rosterByActivity.set(entry.activity_uid, []);
    }
    rosterByActivity.get(entry.activity_uid)!.push(entry);
  });

  const categorySet = new Set<string>();
  const activityTypeSet = new Set<string>();
  const roleSet = new Set<string>();

  const activitiesEnriched: PreparedActivity[] = activitiesWithDates.map((activity) => {
    const typeLabel = getActivityTypeLabel(activity.activity_type);
    activityTypeSet.add(typeLabel);

    const categoryKey = activity.category
      ? String(activity.category).toLowerCase()
      : 'uncategorized';
    categorySet.add(categoryKey);

    const roster = rosterByActivity.get(activity.uid) || [];
    const userRoleSet = new Set<string>();
    if (resolvedCurrentUserUid) {
      roster.forEach((entry) => {
        if (entry.person_uid === resolvedCurrentUserUid) {
          const roleLabel = getRoleLabel(entry.role);
          userRoleSet.add(roleLabel);
          roleSet.add(roleLabel);
        }
      });
    }

    const monthKey = activity.date
      ? `${activity.date.getUTCFullYear()}-${activity.date.getUTCMonth()}`
      : null;

    return {
      ...activity,
      typeLabel,
      categoryKey,
      userRoles: Array.from(userRoleSet),
      monthKey,
    };
  });

  const timelineMonths: Array<{ key: string; label: string }> = [];
  if (activitiesEnriched.length) {
    const latestActivityDate = activitiesEnriched[activitiesEnriched.length - 1].date;
    for (let offset = 11; offset >= 0; offset -= 1) {
      const monthDate = new Date(
        Date.UTC(latestActivityDate.getUTCFullYear(), latestActivityDate.getUTCMonth() - offset, 1)
      );
      timelineMonths.push({
        key: `${monthDate.getUTCFullYear()}-${monthDate.getUTCMonth()}`,
        label: monthYearFormatter.format(monthDate),
      });
    }
  }

  const activityTypes = Array.from(activityTypeSet).sort((a, b) => a.localeCompare(b));
  const categories = Array.from(categorySet).sort((a, b) => {
    if (a === 'uncategorized') return 1;
    if (b === 'uncategorized') return -1;
    return a.localeCompare(b);
  });
  const roles = Array.from(roleSet).sort((a, b) => a.localeCompare(b));

  // Extract unique partners (excluding current user)
  const partners: Array<{ uid: string; name: string }> = [];
  const partnerUids = new Set<string>();

  peopleMap.forEach((person, uid) => {
    // Skip current user
    if (uid === resolvedCurrentUserUid) {
      return;
    }
    // Skip if no name
    if (!person.name || person.name.trim().length === 0) {
      return;
    }
    // Skip duplicates
    if (partnerUids.has(uid)) {
      return;
    }
    partnerUids.add(uid);
    partners.push({ uid, name: person.name });
  });

  // Sort alphabetically by name
  partners.sort((a, b) => a.name.localeCompare(b.name));

  return {
    activities: activitiesEnriched,
    rosterByActivity,
    peopleMap,
    currentUserUid: resolvedCurrentUserUid,
    lastUpdated,
    timelineMonths,
    filterOptions: {
      activityTypes,
      categories,
      roles,
      partners,
    },
  };
};

const buildDistributionEntries = (
  entries: Array<[string, number]>,
  total: number
): DistributionEntry[] =>
  entries.map(([label, value]) => ({
    label,
    value,
    percentage: total ? (value / total) * 100 : 0,
  }));

export const calculateDashboard = (
  prepared: PreparedData,
  filters: DashboardFilters
): DashboardView => {
  const typeFilter = new Set(filters.activityType || []);
  const categoryFilter = new Set(filters.category || []);
  const roleFilter = new Set(filters.role || []);

  let filteredActivities = prepared.activities.filter((activity) => {
    if (typeFilter.size && !typeFilter.has(activity.typeLabel)) return false;
    if (categoryFilter.size && !categoryFilter.has(activity.categoryKey)) return false;
    if (roleFilter.size) {
      if (!activity.userRoles.length) return false;
      const matchesRole = activity.userRoles.some((role) => roleFilter.has(role));
      if (!matchesRole) return false;
    }
    return true;
  });

  // Apply partner filter (AND logic: all selected partners must be present)
  if (filters.partner.length > 0) {
    filteredActivities = filteredActivities.filter((activity) => {
      const roster = prepared.rosterByActivity.get(activity.uid);
      if (!roster || roster.length === 0) {
        return false; // No roster data means no partners
      }

      const activityPartnerUids = new Set(roster.map((entry) => entry.person_uid));

      // Check if ALL selected partners are present in this activity
      return filters.partner.every((partnerUid) => activityPartnerUids.has(partnerUid));
    });
  }

  const activityTypeCounts = new Map<string, number>();
  const monthTypeCounts = new Map<string, Map<string, number>>();
  filteredActivities.forEach((activity) => {
    const typeKey = activity.typeLabel;
    activityTypeCounts.set(typeKey, (activityTypeCounts.get(typeKey) || 0) + 1);

    if (activity.monthKey) {
      if (!monthTypeCounts.has(activity.monthKey)) {
        monthTypeCounts.set(activity.monthKey, new Map());
      }
      const typeCounts = monthTypeCounts.get(activity.monthKey)!;
      typeCounts.set(typeKey, (typeCounts.get(typeKey) || 0) + 1);
    }
  });

  // Partners table calculation (uses unfiltered base data)
  const partnerStats = new Map<string, { count: number; lastDate: Date | null }>();
  prepared.activities.forEach((activity) => {
    const roster = prepared.rosterByActivity.get(activity.uid) || [];
    const seen = new Set<string>();
    roster.forEach((entry) => {
      if (entry.person_uid === prepared.currentUserUid) return;
      if (seen.has(entry.person_uid)) return;
      seen.add(entry.person_uid);
      const stats = partnerStats.get(entry.person_uid) || { count: 0, lastDate: null };
      stats.count += 1;
      if (!stats.lastDate || (activity.date && stats.lastDate < activity.date)) {
        stats.lastDate = activity.date;
      }
      partnerStats.set(entry.person_uid, stats);
    });
  });

  const roleCounts = new Map<string, number>();
  filteredActivities.forEach((activity) => {
    activity.userRoles.forEach((role) => {
      roleCounts.set(role, (roleCounts.get(role) || 0) + 1);
    });
  });

  const partners: PartnerEntry[] = Array.from(partnerStats.entries())
    .map(([uid, stats]) => {
      const person = prepared.peopleMap.get(uid) || null;
      return {
        uid,
        name: person?.name || uid,
        profile: person?.href ? toExternalHref(person.href) : null,
        count: stats.count,
        lastDate: stats.lastDate ?? null,
        avatar: person?.avatar || null,
      };
    })
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return (b.lastDate ? b.lastDate.getTime() : 0) - (a.lastDate ? a.lastDate.getTime() : 0);
    })
    .slice(0, 10);

  const metrics = {
    totalActivities: filteredActivities.length,
    tripCount: filteredActivities.filter((activity) => isTripCategory(activity.categoryKey)).length,
    courseCount: filteredActivities.filter((activity) => isCourseCategory(activity.categoryKey))
      .length,
    uniquePartners: partnerStats.size,
    uniqueTypes: activityTypeCounts.size,
  };

  const recentActivities: RecentActivityEntry[] = [...filteredActivities]
    .sort((a, b) => (b.date ? b.date.getTime() : 0) - (a.date ? a.date.getTime() : 0))
    .slice(0, 8)
    .map((activity) => ({
      uid: activity.uid,
      title: activity.title || activity.uid,
      date: activity.date,
      activity_type: activity.typeLabel || 'Unknown',
      href: activity.href ? toExternalHref(activity.href) : null,
    }));

  const rolesSorted = Array.from(roleCounts.entries()).sort((a, b) => b[1] - a[1]);
  const totalRoles = rolesSorted.reduce((sum, [, count]) => sum + count, 0);
  const primaryRoles = rolesSorted.slice(0, 4);
  const otherCount = rolesSorted.slice(4).reduce((sum, [, count]) => sum + count, 0);
  if (otherCount > 0) {
    primaryRoles.push(['Other', otherCount]);
  }

  const roles = {
    entries: buildDistributionEntries(primaryRoles, totalRoles),
    total: totalRoles,
  };

  const sortedTypeEntries = Array.from(activityTypeCounts.entries()).sort((a, b) => b[1] - a[1]);
  const timelineTypeKeys = sortedTypeEntries.slice(0, MAX_TIMELINE_SERIES).map(([label]) => label);
  const timelineTypeSet = new Set(timelineTypeKeys);
  const includeOtherTimelineSeries = sortedTypeEntries.length > timelineTypeKeys.length;
  const timelineSeriesBuckets = new Map<string, number[]>();
  timelineTypeKeys.forEach((label) => {
    timelineSeriesBuckets.set(label, []);
  });
  if (includeOtherTimelineSeries) {
    timelineSeriesBuckets.set(OTHER_TIMELINE_LABEL, []);
  }

  prepared.timelineMonths.forEach((month) => {
    const typeCounts = monthTypeCounts.get(month.key) || new Map<string, number>();

    timelineTypeKeys.forEach((label) => {
      timelineSeriesBuckets.get(label)!.push(typeCounts.get(label) || 0);
    });

    if (includeOtherTimelineSeries) {
      let otherTotal = 0;
      typeCounts.forEach((count, label) => {
        if (!timelineTypeSet.has(label)) {
          otherTotal += count;
        }
      });
      timelineSeriesBuckets.get(OTHER_TIMELINE_LABEL)!.push(otherTotal);
    }
  });

  const timelineSeries = Array.from(timelineSeriesBuckets.entries()).map(([name, data]) => ({
    name,
    data,
  }));

  const meta = {
    earliest: filteredActivities[0]?.date || null,
    latest: filteredActivities[filteredActivities.length - 1]?.date || null,
    lastUpdated: prepared.lastUpdated,
  };

  return {
    metrics,
    meta,
    timeline: {
      categories: prepared.timelineMonths.map((month) => month.label),
      series: timelineSeries,
    },
    activityType: {
      entries: buildDistributionEntries(sortedTypeEntries, metrics.totalActivities),
    },
    roles,
    partners,
    recentActivities,
    totals: { partners: partnerStats.size },
  };
};

export const buildSummary = (
  view: DashboardView,
  filters: DashboardFilters,
  baseData: PreparedData
): string => {
  if (!view.metrics.totalActivities) {
    return 'No activities match the current filters. Adjust selections to see insights.';
  }

  const filterParts: string[] = [];

  // Add partner filter text
  if (filters.partner.length > 0) {
    const partnerNames = filters.partner
      .map((uid) => {
        const partner = baseData.filterOptions.partners.find((p) => p.uid === uid);
        return partner?.name ?? uid;
      })
      .filter(Boolean);

    if (partnerNames.length === 1) {
      filterParts.push(`activities with ${partnerNames[0]}`);
    } else if (partnerNames.length === 2) {
      filterParts.push(`activities with ${partnerNames[0]} and ${partnerNames[1]}`);
    } else if (partnerNames.length > 2) {
      const first = partnerNames.slice(0, -1).join(', ');
      const last = partnerNames[partnerNames.length - 1];
      filterParts.push(`activities with ${first}, and ${last}`);
    }
  }

  const filterText = filterParts.length > 0 ? ` • Showing ${filterParts.join('; ')}` : '';
  const refreshed = view.meta.lastUpdated ? view.meta.lastUpdated.toLocaleString() : 'Never';
  return `Last refreshed ${refreshed} • ${formatNumber(view.metrics.totalActivities)} activities, ${formatNumber(
    view.metrics.uniquePartners
  )} unique partners${filterText}.`;
};

export const getActivityTypeColors = (): string[] => ACTIVITY_TYPE_COLORS;
