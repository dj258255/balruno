/**
 * useTodaysWork — placeholder pending v0.7 server-canonical aggregation.
 *
 * The original (v0.5) walked Project.changelog + per-sheet PM rows
 * — both Y.Doc fields removed in v0.6 cleanup. Until the server
 * audit-log + sprint/bug/playtest row queries are wired, return
 * empty buckets so SidebarQuickAccess and other consumers render
 * without crashing. The signatures must keep parity with the
 * original to avoid widespread call-site rewrites.
 */

// v0.5 shapes preserved for call-site parity. The `sheet` / `entry`
// nested objects were always populated in the original; they are
// non-optional here too so consumers don't need defensive guards.
// Under the empty-bucket stub these arrays are empty so the nested
// fields are never read at runtime.
export interface RowWithContext {
  projectId: string;
  sheetId: string;
  rowId: string;
  preview?: string;
  sheet: { id: string; name: string };
  entry: { id: string };
}

export interface PmSheetSummary {
  projectId: string;
  sheetId: string;
  name: string;
  type: 'sprint' | 'bug' | 'playtest' | 'generic-pm' | 'unknown';
  sheet: { id: string; name: string };
}

export interface RecentSheetSummary {
  projectId: string;
  sheetId: string;
  name: string;
  sheet: { id: string; name: string };
}

export interface TodaysWorkBuckets {
  activeSprint: RowWithContext[];
  mySprint: RowWithContext[];
  inProgress: RowWithContext[];
  recentChanges: RowWithContext[];
  unresolvedComments: RowWithContext[];
  openBugs: RowWithContext[];
  myBugs: RowWithContext[];
  pmSheets: PmSheetSummary[];
  recentSheets: RecentSheetSummary[];
}

const EMPTY: TodaysWorkBuckets = {
  activeSprint: [],
  mySprint: [],
  inProgress: [],
  recentChanges: [],
  unresolvedComments: [],
  openBugs: [],
  myBugs: [],
  pmSheets: [],
  recentSheets: [],
};

export function useTodaysWork(): TodaysWorkBuckets {
  return EMPTY;
}
