/**
 * PM 시트 자동 감지 — Home 페이지 aggregation 및 Spaces 분류 기반.
 *
 * 접근: 컬럼 이름 패턴 휴리스틱 (EN + KO).
 * 템플릿 id 에 의존하지 않음 — 유저가 수동으로 만든 시트도 감지 가능.
 *
 * 감지 기준 (high → low confidence):
 *   - sprint: Status + Assignee + Priority + (Points 또는 시트명 "sprint")
 *   - bug:    Status + Severity + (Platform 또는 시트명 "bug")
 *   - playtest: Session 컬럼 + (Feedback 또는 시트명 "playtest")
 *   - roadmap: date 컬럼 + (Phase/Milestone 또는 시트명 "roadmap/epic")
 *   - generic-pm: Status + Assignee (위 4개 미매칭 시 fallback)
 */

import type { Sheet, Column } from '@/types';

export type PmSheetType = 'sprint' | 'bug' | 'playtest' | 'roadmap' | 'generic-pm';

export interface PmDetectionResult {
  type: PmSheetType | null;
  confidence: 'high' | 'medium' | 'low';
  /** Status 컬럼 id (kanban 상태 aggregation 용) */
  statusColumnId?: string;
  /** Assignee 컬럼 id ("내 작업" 필터용) */
  assigneeColumnId?: string;
  /** Severity 컬럼 id (버그 우선순위) */
  severityColumnId?: string;
  /** date 컬럼 id (로드맵/플레이테스트) */
  dateColumnId?: string;
}

// 컬럼 이름 매칭 헬퍼 — 대소문자/공백 무관, EN+KO 동시
const matchCol = (cols: Column[], ...names: string[]): Column | undefined => {
  const normalized = names.map((n) => n.toLowerCase().trim());
  return cols.find((c) => {
    const cn = c.name.toLowerCase().trim();
    return normalized.some((n) => cn === n || cn.includes(n));
  });
};

export function detectPmSheet(sheet: Sheet): PmDetectionResult {
  const cols = sheet.columns;
  const sheetName = sheet.name.toLowerCase();

  const status = matchCol(cols, 'status', '상태');
  const assignee = matchCol(cols, 'assignee', '담당자', 'owner');
  const priority = matchCol(cols, 'priority', '우선순위');
  const points = matchCol(cols, 'points', 'sp', 'storypoints', '포인트');
  const severity = matchCol(cols, 'severity', '심각도', 's1', 's2');
  const platform = matchCol(cols, 'platform', '플랫폼');
  const session = matchCol(cols, 'session', 'playtest', '세션', '플레이테스트');
  const feedback = matchCol(cols, 'feedback', 'notes', 'comment', '피드백');
  const phase = matchCol(cols, 'phase', 'milestone', 'epic', '마일스톤', '에픽');
  const dateCol = cols.find((c) => c.type === 'date');

  // Sprint — 가장 specific: Status + Assignee + Priority 필수
  if (status && assignee && priority && (points || sheetName.includes('sprint') || sheetName.includes('스프린트'))) {
    return {
      type: 'sprint',
      confidence: 'high',
      statusColumnId: status.id,
      assigneeColumnId: assignee.id,
    };
  }

  // Bug tracker
  if (status && severity && (platform || sheetName.includes('bug') || sheetName.includes('버그'))) {
    return {
      type: 'bug',
      confidence: 'high',
      statusColumnId: status.id,
      assigneeColumnId: assignee?.id,
      severityColumnId: severity.id,
    };
  }

  // Playtest
  if (session && (feedback || sheetName.includes('playtest') || sheetName.includes('플레이테스트'))) {
    return {
      type: 'playtest',
      confidence: 'medium',
      dateColumnId: dateCol?.id,
    };
  }

  // Roadmap
  if (dateCol && (phase || sheetName.includes('roadmap') || sheetName.includes('epic') || sheetName.includes('로드맵'))) {
    return {
      type: 'roadmap',
      confidence: 'medium',
      dateColumnId: dateCol.id,
    };
  }

  // Generic PM — Status + Assignee 있으면 PM 일 가능성
  if (status && assignee) {
    return {
      type: 'generic-pm',
      confidence: 'low',
      statusColumnId: status.id,
      assigneeColumnId: assignee.id,
    };
  }

  return { type: null, confidence: 'low' };
}

/** PM 타입별 한국어 라벨 */
export const PM_TYPE_LABELS: Record<PmSheetType, string> = {
  sprint: '스프린트',
  bug: '버그 트래커',
  playtest: '플레이테스트',
  roadmap: '로드맵',
  'generic-pm': '태스크',
};

/** 특정 row 가 "활성" 상태인지 판단 — Kanban status 가 done/closed/cancelled 아닌 것 */
export function isActiveRow(row: { cells: Record<string, unknown> }, statusColumnId: string | undefined): boolean {
  if (!statusColumnId) return true;
  const v = row.cells[statusColumnId];
  if (v === null || v === undefined || v === '') return true;
  const s = String(v).toLowerCase();
  return !['done', 'closed', 'cancelled', 'canceled', 'resolved', '완료', '닫힘', '종료'].includes(s);
}

/** row 가 특정 유저에게 assigned 됐는지 */
export function isAssignedTo(
  row: { cells: Record<string, unknown> },
  assigneeColumnId: string | undefined,
  userName: string,
): boolean {
  if (!assigneeColumnId || !userName) return false;
  const v = row.cells[assigneeColumnId];
  if (v === null || v === undefined || v === '') return false;
  return String(v).toLowerCase().includes(userName.toLowerCase());
}
