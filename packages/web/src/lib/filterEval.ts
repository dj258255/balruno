/**
 * SavedView 필터 평가 — Linear Triage · Jira JQL 대응 스프레드시트 필터.
 *
 * applyFilter(rows, filterGroup, columns): 필터 통과한 row 만 반환.
 * AND/OR 결합 + 11 연산자 지원. 중첩 그룹도 지원 (재귀).
 */

import type { Row, Column, FilterGroup, FilterCondition, FilterOperator, CellValue } from '@/types';

function cellValueString(v: CellValue | undefined): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

function cellValueNumber(v: CellValue | undefined): number {
  if (v === null || v === undefined || v === '') return NaN;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return n;
}

function currentUserName(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem('balruno:user-name') ?? '';
}

function evaluateCondition(
  row: Row,
  condition: FilterCondition,
  columns: Column[],
): boolean {
  const column = columns.find((c) => c.id === condition.columnId);
  if (!column) return true; // 무효 필터는 skip (pass)
  const raw = row.cells[column.id];
  const str = cellValueString(raw).trim();
  const target = (condition.value ?? '').trim();

  switch (condition.operator) {
    case 'equals':
      return str.toLowerCase() === target.toLowerCase();
    case 'not-equals':
      return str.toLowerCase() !== target.toLowerCase();
    case 'contains':
      return str.toLowerCase().includes(target.toLowerCase());
    case 'not-contains':
      return !str.toLowerCase().includes(target.toLowerCase());
    case 'is-empty':
      return str === '';
    case 'is-not-empty':
      return str !== '';
    case 'greater-than': {
      const n = cellValueNumber(raw);
      const t = parseFloat(target);
      return !isNaN(n) && !isNaN(t) && n > t;
    }
    case 'less-than': {
      const n = cellValueNumber(raw);
      const t = parseFloat(target);
      return !isNaN(n) && !isNaN(t) && n < t;
    }
    case 'includes': {
      // CSV 로 저장되는 multiSelect / person / link 대응
      const parts = str.split(',').map((s) => s.trim().toLowerCase());
      return parts.includes(target.toLowerCase());
    }
    case 'not-includes': {
      const parts = str.split(',').map((s) => s.trim().toLowerCase());
      return !parts.includes(target.toLowerCase());
    }
    case 'is-me': {
      const me = currentUserName().trim().toLowerCase();
      if (!me) return false;
      if (column.type === 'person') {
        const parts = str.split(',').map((s) => s.trim().toLowerCase());
        return parts.includes(me);
      }
      return str.toLowerCase() === me;
    }
    default:
      return true;
  }
}

function evaluateGroup(
  row: Row,
  group: FilterGroup,
  columns: Column[],
): boolean {
  const allChecks: boolean[] = [];

  for (const c of group.conditions) {
    allChecks.push(evaluateCondition(row, c, columns));
  }
  for (const subGroup of group.groups ?? []) {
    allChecks.push(evaluateGroup(row, subGroup, columns));
  }

  if (allChecks.length === 0) return true; // 빈 그룹은 pass
  if (group.combinator === 'or') return allChecks.some(Boolean);
  return allChecks.every(Boolean);
}

/** 필터 적용 — 통과 row 만 반환. filterGroup 없으면 원본 그대로. */
export function applyFilter<T extends Row>(
  rows: T[],
  filterGroup: FilterGroup | undefined,
  columns: Column[],
): T[] {
  if (!filterGroup) return rows;
  if (filterGroup.conditions.length === 0 && (!filterGroup.groups || filterGroup.groups.length === 0)) {
    return rows;
  }
  return rows.filter((r) => evaluateGroup(r, filterGroup, columns));
}

/** 빈 필터 그룹 생성 헬퍼 */
export function createEmptyFilterGroup(): FilterGroup {
  return {
    id: `fg-${Date.now()}`,
    combinator: 'and',
    conditions: [],
  };
}

/** 연산자에 값 입력이 필요한지 */
export function operatorNeedsValue(op: FilterOperator): boolean {
  return op !== 'is-empty' && op !== 'is-not-empty' && op !== 'is-me';
}

/** 연산자별 한국어 라벨 */
export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  'equals': '= 같음',
  'not-equals': '≠ 다름',
  'contains': '포함',
  'not-contains': '미포함',
  'is-empty': '비어있음',
  'is-not-empty': '비어있지 않음',
  'greater-than': '> 초과',
  'less-than': '< 미만',
  'includes': '포함 (목록)',
  'not-includes': '미포함 (목록)',
  'is-me': '나',
};

// Re-export for consumers
export type { FilterOperator } from '@/types';
