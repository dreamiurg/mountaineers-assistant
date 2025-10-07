export interface ActivityRecord {
  uid: string;
  href: string;
  title: string | null;
  category: string | null;
  start_date: string | null;
  trip_results: string | null;
  result: string | null;
  rawResult?: unknown;
  activity_type: string | null;
}

export interface PersonRecord {
  uid: string;
  href: string | null;
  name: string | null;
  avatar: string | null;
}

export interface RosterEntryRecord {
  activity_uid: string;
  person_uid: string;
  role: string | null;
  status?: string | null;
  isLeader?: boolean;
}

export interface ExtensionCache {
  activities: ActivityRecord[];
  people: PersonRecord[];
  rosterEntries: RosterEntryRecord[];
  lastUpdated: string | null;
  currentUserUid: string | null;
}

export interface ExtensionSettings {
  showAvatars: boolean;
  fetchLimit: number | null;
}

export interface CollectorDelta {
  activities?: ActivityRecord[];
  people?: PersonRecord[];
  rosterEntries?: RosterEntryRecord[];
}

export interface CollectorSuccessPayload {
  activities: ActivityRecord[];
  people: PersonRecord[];
  rosterEntries: RosterEntryRecord[];
  currentUserUid: string | null;
}

export interface CollectorResultMessage {
  type: 'refresh-result';
  success: boolean;
  data?: CollectorSuccessPayload;
  error?: string;
}

export interface CollectorProgressMessage {
  type: 'refresh-progress';
  origin: 'collector';
  stage: string;
  timestamp: number;
  total?: number;
  completed?: number;
  activityUid?: string;
  activityTitle?: string;
  error?: string;
  delta?: CollectorDelta;
}

export interface RefreshProgress {
  total: number;
  completed: number;
  remaining: number | null;
  stage: string;
  activityUid: string | null;
  activityTitle: string | null;
  timestamp: number;
}

export interface RefreshSummary {
  activityCount: number;
  lastUpdated: string | null;
  newActivities: number;
}
