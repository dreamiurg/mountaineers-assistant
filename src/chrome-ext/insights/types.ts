import type {
  ActivityRecord,
  ExtensionCache,
  PersonRecord,
  RosterEntryRecord,
} from '../shared/types';

export type DashboardFilters = {
  activityType: string[];
  category: string[];
  role: string[];
  partner: string[];
};

export type DisplaySettings = {
  showAvatars: boolean;
};

export interface PreparedActivity extends ActivityRecord {
  date: Date;
  typeLabel: string;
  categoryKey: string;
  userRoles: string[];
  monthKey: string | null;
}

export interface PreparedData {
  activities: PreparedActivity[];
  rosterByActivity: Map<string, RosterEntryRecord[]>;
  peopleMap: Map<string, PersonRecord>;
  currentUserUid: string | null;
  lastUpdated: Date | null;
  timelineMonths: Array<{ key: string; label: string }>;
  filterOptions: {
    activityTypes: string[];
    categories: string[];
    roles: string[];
    partners: Array<{ uid: string; name: string }>;
  };
}

export interface DashboardMetrics {
  totalActivities: number;
  tripCount: number;
  courseCount: number;
  uniquePartners: number;
  uniqueTypes: number;
}

export interface DashboardMeta {
  earliest: Date | null;
  latest: Date | null;
  lastUpdated: Date | null;
}

export interface TimelineSeries {
  name: string;
  data: number[];
}

export interface TimelineView {
  categories: string[];
  series: TimelineSeries[];
}

export interface DistributionEntry {
  label: string;
  value: number;
  percentage: number;
}

export interface PartnerEntry {
  uid: string;
  name: string;
  count: number;
  lastDate: Date | null;
  profile: string | null;
  avatar: string | null;
}

export interface RecentActivityEntry {
  uid: string;
  title: string;
  href: string | null;
  date: Date | null;
  activity_type: string | null;
}

export interface DashboardView {
  metrics: DashboardMetrics;
  meta: DashboardMeta;
  timeline: TimelineView;
  activityType: {
    entries: DistributionEntry[];
  };
  roles: {
    entries: DistributionEntry[];
  };
  partners: PartnerEntry[];
  totals: {
    partners: number;
  };
  recentActivities: RecentActivityEntry[];
}

export interface DashboardContext {
  baseData: PreparedData | null;
  view: DashboardView | null;
  filters: DashboardFilters;
  filterOptions: PreparedData['filterOptions'];
  settings: DisplaySettings;
}

export type ExtensionData = ExtensionCache | null;
