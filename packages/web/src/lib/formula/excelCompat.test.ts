/**
 * Excel 호환 + 게임 함수 통합 테스트.
 *
 * mathjs (기본 연산) + @formulajs/formulajs (Excel 300+ 함수) + 우리 게임 함수 40+
 * 가 한 엔진에 주입됐을 때, 각 레이어의 함수가 모두 동작하고 충돌 없는지 검증.
 */
import { describe, it, expect } from 'vitest';
import { evaluateFormula } from '../formulaEngine';
import type { Sheet } from '@/types';

function bareContext() {
  const sheet: Sheet = {
    id: 'test-sheet',
    name: 'Test',
    columns: [],
    rows: [],
    createdAt: 0,
    updatedAt: 0,
  };
  return { sheets: [sheet], currentSheet: sheet, currentRow: {} };
}

function sheetWithColumns(
  cols: { id: string; name: string }[],
  row: Record<string, number | string | null>,
  allRows?: Record<string, number | string | null>[],
) {
  const sheet: Sheet = {
    id: 'sheet-1',
    name: 'Characters',
    columns: cols.map((c) => ({ id: c.id, name: c.name, type: 'general', width: 100 })),
    rows: (allRows ?? [row]).map((r, i) => ({ id: `r${i}`, cells: r })),
    createdAt: 0,
    updatedAt: 0,
  };
  return {
    sheets: [sheet],
    currentSheet: sheet,
    currentRow: row,
    currentRowIndex: 0,
    allRows: allRows ?? [row],
  };
}

describe('기본 사칙 (mathjs 레이어)', () => {
  it('덧셈', () => expect(evaluateFormula('1 + 2', bareContext()).value).toBe(3));
  it('복합 연산', () => expect(evaluateFormula('(10 + 20) * 3 / 2', bareContext()).value).toBe(45));
  it('POWER', () => expect(evaluateFormula('POWER(2, 10)', bareContext()).value).toBe(1024));
});

describe('게임 함수 (formulaBundle 레이어)', () => {
  it('DAMAGE(100, 50)', () => {
    const r = evaluateFormula('DAMAGE(100, 50)', bareContext());
    expect(Number(r.value)).toBeCloseTo(66.6667, 3);
  });

  it('DPS(100, 1.5)', () => {
    const r = evaluateFormula('DPS(100, 1.5)', bareContext());
    expect(Number(r.value)).toBeCloseTo(150, 3);
  });

  it('SCALE linear', () => {
    const r = evaluateFormula('SCALE(100, 10, 5, "linear")', bareContext());
    expect(r.value).toBe(150);
  });

  it('EHP(1000, 50, 0)', () => {
    const r = evaluateFormula('EHP(1000, 50, 0)', bareContext());
    expect(Number(r.value)).toBeCloseTo(1500, 3);
  });
});

describe('Excel 호환 (formulajs 레이어)', () => {
  it('IF', () => expect(evaluateFormula('IF(5 > 3, 100, 200)', bareContext()).value).toBe(100));
  it('UPPER', () => expect(evaluateFormula('UPPER("hello")', bareContext()).value).toBe('HELLO'));
  it('LOWER', () => expect(evaluateFormula('LOWER("HELLO")', bareContext()).value).toBe('hello'));
  it('LEN', () => expect(evaluateFormula('LEN("sword")', bareContext()).value).toBe(5));
  it('CONCATENATE', () =>
    expect(evaluateFormula('CONCATENATE("Lv", 5)', bareContext()).value).toBe('Lv5'));
  it('LEFT', () =>
    expect(evaluateFormula('LEFT("hello world", 5)', bareContext()).value).toBe('hello'));
  it('RIGHT', () =>
    expect(evaluateFormula('RIGHT("hello world", 5)', bareContext()).value).toBe('world'));
  it('MID', () =>
    expect(evaluateFormula('MID("hello world", 7, 5)', bareContext()).value).toBe('world'));

  it('SUMIF 조건부 합', () => {
    // formulajs: SUMIF(range, criterion)
    const r = evaluateFormula('SUMIF([1, 2, 3, 4, 5], ">3")', bareContext());
    expect(Number(r.value)).toBe(9);
  });

  it('COUNTIF', () => {
    const r = evaluateFormula('COUNTIF([10, 20, 30, 40], ">=20")', bareContext());
    expect(Number(r.value)).toBe(3);
  });

  it('VLOOKUP', () => {
    const r = evaluateFormula(
      'VLOOKUP(2, [[1, "A"], [2, "B"], [3, "C"]], 2, FALSE())',
      bareContext(),
    );
    expect(r.value).toBe('B');
  });
});

describe('컬럼 참조 (영문·한글)', () => {
  it('영문 컬럼 + 게임 함수', () => {
    const ctx = sheetWithColumns(
      [{ id: 'c1', name: 'atk' }, { id: 'c2', name: 'def' }],
      { c1: 150, c2: 30 },
    );
    const r = evaluateFormula('DAMAGE(atk, def)', ctx);
    expect(Number(r.value)).toBeCloseTo(115.3846, 3);
  });

  it('한글 컬럼 + 게임 함수', () => {
    const ctx = sheetWithColumns(
      [{ id: 'c1', name: '공격력' }, { id: 'c2', name: '방어력' }],
      { c1: 150, c2: 30 },
    );
    const r = evaluateFormula('DAMAGE(공격력, 방어력)', ctx);
    expect(Number(r.value)).toBeCloseTo(115.3846, 3);
  });

  it('한글 컬럼 + Excel 함수', () => {
    const ctx = sheetWithColumns([{ id: 'c1', name: '이름' }], { c1: 'sword' });
    const r = evaluateFormula('UPPER(이름)', ctx);
    expect(r.value).toBe('SWORD');
  });
});

describe('이전행 참조', () => {
  it('PREV.damage + damage', () => {
    const rows = [{ c1: 100 }, { c1: 50 }];
    const cols = [{ id: 'c1', name: 'damage' }];
    const makeSheet = (): Sheet => ({
      id: 'sheet-1',
      name: 'Wave',
      columns: cols.map((c) => ({ id: c.id, name: c.name, type: 'general' as const, width: 100 })),
      rows: rows.map((r, i) => ({ id: `r${i}`, cells: r })),
      createdAt: 0,
      updatedAt: 0,
    });
    const sheet = makeSheet();
    const ctx = {
      sheets: [sheet],
      currentSheet: sheet,
      currentRow: rows[1],
      currentRowIndex: 1,
      allRows: rows,
    };
    const r = evaluateFormula('PREV.damage + damage', ctx);
    expect(r.value).toBe(150);
  });
});

describe('에러 케이스', () => {
  it('VLOOKUP 미스 → 에러', () => {
    const r = evaluateFormula('VLOOKUP(99, [[1, "A"]], 2, FALSE())', bareContext());
    expect(r.error).toBeTruthy();
  });
});
