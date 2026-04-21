/**
 * 최근 접근 시트 기록 — CommandPalette 의 "최근" 그룹 + 사이드바 "최근 본 시트" 용.
 * localStorage 키: `balruno:recent-sheets`.
 */

const KEY = 'balruno:recent-sheets';
const MAX = 6;

export type RecentEntry = { projectId: string; sheetId: string; ts: number };

export function loadRecent(): RecentEntry[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecentEntry[]) : [];
  } catch {
    return [];
  }
}

function saveRecent(list: RecentEntry[]): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // ignore quota errors
  }
}

/** 현재 시트를 최근 목록 앞에 삽입. 중복은 제거. */
export function recordRecentSheet(projectId: string, sheetId: string): void {
  if (!projectId || !sheetId) return;
  const list = loadRecent().filter((e) => e.sheetId !== sheetId);
  list.unshift({ projectId, sheetId, ts: Date.now() });
  saveRecent(list);
}
