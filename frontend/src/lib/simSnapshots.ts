/**
 * 시뮬 스냅샷 저장/비교 — localStorage 기반.
 *
 * 사용 시나리오:
 *  - rebalance 전후 비교 — "이 변경이 얼마나 영향 줬나?"
 *  - 여러 후보 설정 중 베스트 선택 ("A 덱 vs B 덱 vs C 덱 — 클리어율 기준")
 *  - 히스토리 스냅샷 — 점진적 튜닝 기록
 *
 * 저장 정책:
 *  - 설정(config) + 결과 요약(summary) 만. 상세 log/event stream 은 제외 — 용량 절약
 *  - 최대 50개 유지 (FIFO 드롭)
 */

export type SnapshotDomain = 'unit' | 'fps-duel' | 'fps-team' | 'deck' | 'matchup';

export interface SimSnapshot {
  id: string;
  name: string;
  createdAt: number;
  domain: SnapshotDomain;
  /** 도메인 특화 설정 — JSON 직렬화 가능해야 함 */
  config: Record<string, unknown>;
  /** 핵심 지표만 — 비교 diff 의 기준. key 는 사람이 읽을 수 있는 라벨 */
  metrics: Record<string, number>;
  /** 선택적 노트 (사용자 메모) */
  note?: string;
}

export interface SnapshotDiff {
  /** 공통 metric key 들 */
  keys: string[];
  /** key → { before, after, delta (after-before), deltaPct (상대 변화 %) } */
  rows: Array<{
    key: string;
    before: number;
    after: number;
    delta: number;
    /** before 가 0 이면 null */
    deltaPct: number | null;
  }>;
}

const STORAGE_KEY = 'balruno:simSnapshots:v1';
const MAX_SNAPSHOTS = 50;

// ============================================================================
// CRUD
// ============================================================================

export function loadSnapshots(): SimSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr;
  } catch {
    return [];
  }
}

export function saveSnapshot(snapshot: Omit<SimSnapshot, 'id' | 'createdAt'>): SimSnapshot {
  const full: SimSnapshot = {
    ...snapshot,
    id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
  };
  const list = loadSnapshots();
  list.unshift(full);
  // FIFO 초과분 삭제
  const trimmed = list.slice(0, MAX_SNAPSHOTS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  return full;
}

export function deleteSnapshot(id: string): void {
  const list = loadSnapshots().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function renameSnapshot(id: string, name: string): void {
  const list = loadSnapshots().map((s) => (s.id === id ? { ...s, name } : s));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function clearAllSnapshots(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// ============================================================================
// Diff 계산
// ============================================================================

/**
 * 두 스냅샷 비교 — 공통 metric key 만 매칭.
 * before → after 순서로 after - before = delta.
 */
export function diffSnapshots(before: SimSnapshot, after: SimSnapshot): SnapshotDiff {
  const beforeKeys = Object.keys(before.metrics);
  const afterKeys = Object.keys(after.metrics);
  const commonKeys = beforeKeys.filter((k) => afterKeys.includes(k));

  const rows = commonKeys.map((key) => {
    const b = before.metrics[key];
    const a = after.metrics[key];
    const delta = a - b;
    const deltaPct = b === 0 ? null : (delta / Math.abs(b)) * 100;
    return { key, before: b, after: a, delta, deltaPct };
  });

  return { keys: commonKeys, rows };
}

/**
 * 변화 방향 분류 — UI 색상/아이콘용.
 *  - improved: delta 가 원하는 방향 (winRate 올라감, TTK 내려감)
 *  - regressed: 반대
 *  - neutral: 거의 변화 없음
 *
 * direction: 'higher-better' (승률·DPT 등) | 'lower-better' (TTK·deadHandRate)
 */
export function classifyChange(
  delta: number,
  direction: 'higher-better' | 'lower-better',
  threshold = 0.01,
): 'improved' | 'regressed' | 'neutral' {
  if (Math.abs(delta) < threshold) return 'neutral';
  if (direction === 'higher-better') {
    return delta > 0 ? 'improved' : 'regressed';
  }
  return delta < 0 ? 'improved' : 'regressed';
}

/**
 * Metric key 이름으로 방향 추론 (heuristic).
 * 명시적으로 direction 없을 때 fallback.
 */
export function inferDirection(key: string): 'higher-better' | 'lower-better' {
  const lower = key.toLowerCase();
  // 낮을수록 좋은 지표
  if (lower.includes('ttk') || lower.includes('duration') || lower.includes('deadhand')
    || lower.includes('waste') || lower.includes('miss') || lower.includes('dominant')
    || lower.includes('weak')) {
    return 'lower-better';
  }
  return 'higher-better';
}
