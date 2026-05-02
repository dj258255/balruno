/**
 * columnTypeMeta — 시트 용도별 컬럼 타입 노출/추천 정책 테스트.
 *
 * 정책이 의도대로 굳어졌는지 회귀 방지. 메타데이터 변경 시 테스트가 깨지면
 * 의도된 변경인지 확인 후 테스트를 따라 수정한다.
 */
import { describe, it, expect } from 'vitest';
import type { ColumnType, SheetKind } from '@/types';
import {
  COLUMN_TYPE_META,
  COLUMN_CATEGORY_META,
  getColumnTypesByCategory,
  isColumnTypeAllowed,
  getIncompatibleColumnTypes,
} from './columnTypeMeta';

const ALL_COLUMN_TYPES: ColumnType[] = [
  'general',
  'formula',
  'checkbox',
  'select',
  'multiSelect',
  'date',
  'url',
  'currency',
  'rating',
  'link',
  'lookup',
  'rollup',
  'task-link',
  'person',
  'stat-snapshot',
];

const ALL_KINDS: SheetKind[] = ['game-data', 'pm', 'analysis', 'reference'];

describe('COLUMN_TYPE_META — 메타데이터 무결성', () => {
  it('모든 ColumnType 에 메타가 존재한다', () => {
    for (const type of ALL_COLUMN_TYPES) {
      expect(COLUMN_TYPE_META[type]).toBeDefined();
      expect(COLUMN_TYPE_META[type].type).toBe(type);
    }
  });

  it('각 메타는 카테고리/아이콘/라벨을 갖는다', () => {
    for (const meta of Object.values(COLUMN_TYPE_META)) {
      expect(meta.category).toBeTruthy();
      expect(meta.Icon).toBeTruthy();
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.description.length).toBeGreaterThan(0);
    }
  });

  it('카테고리는 COLUMN_CATEGORY_META 에 정의된 값만 사용한다', () => {
    const validCategories = Object.keys(COLUMN_CATEGORY_META);
    for (const meta of Object.values(COLUMN_TYPE_META)) {
      expect(validCategories).toContain(meta.category);
    }
  });
});

describe('shownIn 정책 — 시트 용도별 노출 제한', () => {
  it('basic 카테고리는 모든 SheetKind 에서 노출된다', () => {
    for (const kind of ALL_KINDS) {
      expect(isColumnTypeAllowed('general', kind)).toBe(true);
      expect(isColumnTypeAllowed('checkbox', kind)).toBe(true);
      expect(isColumnTypeAllowed('date', kind)).toBe(true);
      expect(isColumnTypeAllowed('url', kind)).toBe(true);
    }
  });

  it('task-link, person 은 game-data / reference 에서 숨긴다 (PM 전용)', () => {
    expect(isColumnTypeAllowed('task-link', 'game-data')).toBe(false);
    expect(isColumnTypeAllowed('task-link', 'reference')).toBe(false);
    expect(isColumnTypeAllowed('task-link', 'pm')).toBe(true);
    expect(isColumnTypeAllowed('task-link', 'analysis')).toBe(true);

    expect(isColumnTypeAllowed('person', 'game-data')).toBe(false);
    expect(isColumnTypeAllowed('person', 'reference')).toBe(false);
    expect(isColumnTypeAllowed('person', 'pm')).toBe(true);
  });

  it('stat-snapshot 은 game-data / reference 에서 숨긴다 (밸런스 이력 전용)', () => {
    expect(isColumnTypeAllowed('stat-snapshot', 'game-data')).toBe(false);
    expect(isColumnTypeAllowed('stat-snapshot', 'reference')).toBe(false);
    expect(isColumnTypeAllowed('stat-snapshot', 'pm')).toBe(true);
    expect(isColumnTypeAllowed('stat-snapshot', 'analysis')).toBe(true);
  });

  it('formula, link, lookup, rollup 은 모든 SheetKind 에서 노출된다', () => {
    for (const kind of ALL_KINDS) {
      expect(isColumnTypeAllowed('formula', kind)).toBe(true);
      expect(isColumnTypeAllowed('link', kind)).toBe(true);
      expect(isColumnTypeAllowed('lookup', kind)).toBe(true);
      expect(isColumnTypeAllowed('rollup', kind)).toBe(true);
    }
  });
});

describe('recommendedIn 정책 — 추천 배지', () => {
  it('game-data 시트의 추천 컬럼 타입 집합', () => {
    const recommended = ALL_COLUMN_TYPES.filter((t) =>
      COLUMN_TYPE_META[t].recommendedIn.includes('game-data'),
    );
    expect(recommended).toEqual(
      expect.arrayContaining(['general', 'formula', 'currency', 'select', 'link']),
    );
    expect(recommended).not.toContain('task-link');
    expect(recommended).not.toContain('person');
    expect(recommended).not.toContain('stat-snapshot');
  });

  it('pm 시트의 추천 컬럼 타입 집합', () => {
    const recommended = ALL_COLUMN_TYPES.filter((t) =>
      COLUMN_TYPE_META[t].recommendedIn.includes('pm'),
    );
    expect(recommended).toEqual(
      expect.arrayContaining(['checkbox', 'date', 'task-link', 'person', 'stat-snapshot']),
    );
  });

  it('reference 시트의 추천은 url 위주 (read-only 자료)', () => {
    const recommended = ALL_COLUMN_TYPES.filter((t) =>
      COLUMN_TYPE_META[t].recommendedIn.includes('reference'),
    );
    expect(recommended).toContain('url');
    expect(recommended).toContain('general');
    // PM 도구는 reference 에서 추천하지 않음
    expect(recommended).not.toContain('task-link');
    expect(recommended).not.toContain('person');
  });
});

describe('getColumnTypesByCategory — picker UI 데이터', () => {
  it('game-data 시트는 PM/balance 카테고리가 포함되지 않는다', () => {
    const groups = getColumnTypesByCategory('game-data');
    const categoryIds = groups.map((g) => g.category.category);
    expect(categoryIds).not.toContain('pm');
    expect(categoryIds).not.toContain('balance');
    expect(categoryIds).toContain('basic');
    expect(categoryIds).toContain('choice');
    expect(categoryIds).toContain('relational');
    expect(categoryIds).toContain('computed');
  });

  it('pm 시트는 pm/balance 카테고리가 모두 포함된다', () => {
    const groups = getColumnTypesByCategory('pm');
    const categoryIds = groups.map((g) => g.category.category);
    expect(categoryIds).toContain('pm');
    expect(categoryIds).toContain('balance');
    expect(categoryIds).toContain('basic');
  });

  it('각 그룹은 isPrimary 플래그를 갖는다 (UI dim 결정용)', () => {
    const groups = getColumnTypesByCategory('pm');
    const pmGroup = groups.find((g) => g.category.category === 'pm');
    expect(pmGroup?.isPrimary).toBe(true);

    const balanceGroup = groups.find((g) => g.category.category === 'balance');
    expect(balanceGroup?.isPrimary).toBe(true);

    const formatGroup = groups.find((g) => g.category.category === 'format');
    // format 카테고리는 game-data 가 primary, pm 시트에선 secondary (dim)
    expect(formatGroup?.isPrimary).toBe(false);
  });

  it('빈 카테고리는 결과에 포함되지 않는다', () => {
    const groups = getColumnTypesByCategory('reference');
    for (const g of groups) {
      expect(g.types.length).toBeGreaterThan(0);
    }
  });
});

describe('getIncompatibleColumnTypes — Phase 2 변경 가드 (sidebar 가드 시나리오)', () => {
  it('pm → game-data 변경 시 task-link/person/stat-snapshot 이 incompatible', () => {
    const currentTypes: ColumnType[] = [
      'general',
      'date',
      'task-link',
      'person',
      'stat-snapshot',
    ];
    const incompatible = getIncompatibleColumnTypes(currentTypes, 'game-data');
    expect(incompatible).toEqual(
      expect.arrayContaining(['task-link', 'person', 'stat-snapshot']),
    );
    expect(incompatible).not.toContain('general');
    expect(incompatible).not.toContain('date');
  });

  it('game-data → pm 변경 시 incompatible 컬럼 없음 (game-data 는 pm 에 다 호환)', () => {
    const currentTypes: ColumnType[] = ['general', 'formula', 'currency', 'link'];
    const incompatible = getIncompatibleColumnTypes(currentTypes, 'pm');
    expect(incompatible).toEqual([]);
  });

  it('호환 가능한 컬럼만 있으면 빈 배열', () => {
    const incompatible = getIncompatibleColumnTypes(
      ['general', 'date', 'select'],
      'reference',
    );
    expect(incompatible).toEqual([]);
  });

  it('중복 타입은 한 번만 반환', () => {
    const incompatible = getIncompatibleColumnTypes(
      ['task-link', 'task-link', 'person', 'person'],
      'game-data',
    );
    // Set 기반이라 중복 제거됨
    expect(incompatible.sort()).toEqual(['person', 'task-link']);
  });

  it('reference 시트는 PM/balance 도구 타입을 모두 거부한다', () => {
    const incompatible = getIncompatibleColumnTypes(
      ['general', 'task-link', 'person', 'stat-snapshot'],
      'reference',
    );
    expect(incompatible.sort()).toEqual(['person', 'stat-snapshot', 'task-link']);
  });
});
