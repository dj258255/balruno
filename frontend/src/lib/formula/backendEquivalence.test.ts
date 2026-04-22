/**
 * 백엔드 동등성 — mathjs 와 Formualizer (Rust+WASM) 가 동일 수식에서 같은 결과를 내는지.
 *
 * Formualizer 는 MIT/Apache-2.0 라이선스 — 상업 이용 가능.
 * 마이그레이션 안전성의 핵심 보증. 계산 결과가 달라지면 플러그인 래핑 또는 참조 해석에 버그.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { mathjsBackend, formualizerBackend, initFormualizer } from './index';
import type { EvaluateContext } from './backend';
import type { Sheet } from '@/types';

function bareContext(): EvaluateContext {
  const sheet: Sheet = {
    id: 'test-sheet',
    name: 'Test',
    columns: [],
    rows: [],
    createdAt: 0,
    updatedAt: 0,
  };
  return {
    sheets: [sheet],
    currentSheet: sheet,
    currentRow: {},
  };
}

function bothBackends(formula: string, ctx: EvaluateContext = bareContext()) {
  const a = mathjsBackend.evaluate(formula, ctx);
  const b = formualizerBackend.evaluate(formula, ctx);
  return { mathjs: a, fz: b };
}

beforeAll(async () => {
  await initFormualizer();
});

describe('백엔드 동등성 — 기본 사칙', () => {
  it('덧셈', () => {
    const { mathjs, fz } = bothBackends('1 + 2');
    expect(mathjs.value).toBe(3);
    expect(fz.value).toBe(3);
  });

  it('복합 연산', () => {
    const { mathjs, fz } = bothBackends('(10 + 20) * 3 / 2');
    expect(mathjs.value).toBe(45);
    expect(fz.value).toBe(45);
  });

  it('POWER', () => {
    const { mathjs, fz } = bothBackends('POWER(2, 10)');
    expect(mathjs.value).toBe(1024);
    expect(fz.value).toBe(1024);
  });
});

describe('백엔드 동등성 — 게임 함수', () => {
  it('DAMAGE(100, 50)', () => {
    const { mathjs, fz } = bothBackends('DAMAGE(100, 50)');
    expect(Number(mathjs.value)).toBeCloseTo(66.6667, 3);
    expect(Number(fz.value)).toBeCloseTo(66.6667, 3);
  });

  it('DPS(100, 1.5)', () => {
    const { mathjs, fz } = bothBackends('DPS(100, 1.5)');
    expect(Number(mathjs.value)).toBeCloseTo(150, 3);
    expect(Number(fz.value)).toBeCloseTo(150, 3);
  });

  it('SCALE linear', () => {
    const { mathjs, fz } = bothBackends('SCALE(100, 10, 5, "linear")');
    expect(mathjs.value).toBe(150);
    expect(fz.value).toBe(150);
  });

  it('EHP(1000, 50, 0)', () => {
    const { mathjs, fz } = bothBackends('EHP(1000, 50, 0)');
    expect(Number(mathjs.value)).toBeCloseTo(1500, 3);
    expect(Number(fz.value)).toBeCloseTo(1500, 3);
  });
});

describe('Formualizer 전용 — Excel 호환 함수', () => {
  it('IFERROR fallback', () => {
    const ctx = bareContext();
    const r = formualizerBackend.evaluate('IFERROR(1/0, "div-zero")', ctx);
    expect(r.value).toBe('div-zero');
  });

  it('IF', () => {
    const { mathjs, fz } = bothBackends('IF(5 > 3, 100, 200)');
    expect(mathjs.value).toBe(100);
    expect(fz.value).toBe(100);
  });

  it('TEXT 함수 (UPPER) — mathjs 에 없음', () => {
    const ctx = bareContext();
    const r = formualizerBackend.evaluate('UPPER("hello")', ctx);
    expect(r.value).toBe('HELLO');
  });

  it('LEN', () => {
    const ctx = bareContext();
    const r = formualizerBackend.evaluate('LEN("sword")', ctx);
    expect(r.value).toBe(5);
  });

  it('CONCATENATE', () => {
    const ctx = bareContext();
    const r = formualizerBackend.evaluate('CONCATENATE("Lv", 5)', ctx);
    expect(r.value).toBe('Lv5');
  });

  it('조건부 숫자 반환 — SUM + IF 조합', () => {
    const ctx = bareContext();
    // SUM(1,2,3,4,5) = 15
    const r = formualizerBackend.evaluate('SUM(1,2,3,4,5)', ctx);
    expect(r.value).toBe(15);
  });

  it('ROUND / FLOOR / CEILING', () => {
    const ctx = bareContext();
    expect(formualizerBackend.evaluate('ROUND(3.567, 2)', ctx).value).toBe(3.57);
    expect(formualizerBackend.evaluate('FLOOR(3.9, 1)', ctx).value).toBe(3);
  });
});

/**
 * 참조 시나리오 — 우리 도메인 특유의 한글 컬럼명 / PREV.Column /
 * Sheet.RowID.Column 참조가 양 엔진에서 같은 값을 내는지. 이게 깨지면 마이그레이션
 * 시 사용자 시트 값이 조용히 달라짐.
 */
function sheetWithColumns(cols: { id: string; name: string }[], row: Record<string, number | string | null>, allRows?: Record<string, number | string | null>[]): EvaluateContext {
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

describe('백엔드 동등성 — 컬럼 참조 (영문)', () => {
  it('단일 컬럼 참조', () => {
    const ctx = sheetWithColumns(
      [{ id: 'c1', name: 'atk' }, { id: 'c2', name: 'def' }],
      { c1: 100, c2: 50 },
    );
    const { mathjs, fz } = bothBackends('atk * 2', ctx);
    expect(mathjs.value).toBe(200);
    expect(fz.value).toBe(200);
  });

  it('두 컬럼 조합 + 게임 함수', () => {
    const ctx = sheetWithColumns(
      [{ id: 'c1', name: 'atk' }, { id: 'c2', name: 'def' }],
      { c1: 150, c2: 30 },
    );
    // DAMAGE(atk, def) = atk * (100/(100+def))
    const { mathjs, fz } = bothBackends('DAMAGE(atk, def)', ctx);
    // 150 * (100/130) = 115.384...
    expect(Number(mathjs.value)).toBeCloseTo(115.3846, 3);
    expect(Number(fz.value)).toBeCloseTo(115.3846, 3);
  });
});

describe('백엔드 동등성 — 한글 컬럼명', () => {
  it('한글 컬럼 단일 참조', () => {
    const ctx = sheetWithColumns(
      [{ id: 'c1', name: '공격력' }, { id: 'c2', name: '방어력' }],
      { c1: 200, c2: 80 },
    );
    const { mathjs, fz } = bothBackends('공격력 + 방어력', ctx);
    expect(mathjs.value).toBe(280);
    expect(fz.value).toBe(280);
  });

  it('한글 컬럼 + 게임 함수', () => {
    const ctx = sheetWithColumns(
      [{ id: 'c1', name: '공격력' }, { id: 'c2', name: '방어력' }],
      { c1: 150, c2: 30 },
    );
    const { mathjs, fz } = bothBackends('DAMAGE(공격력, 방어력)', ctx);
    expect(Number(mathjs.value)).toBeCloseTo(115.3846, 3);
    expect(Number(fz.value)).toBeCloseTo(115.3846, 3);
  });

  it('한글·영문 혼합 컬럼', () => {
    const ctx = sheetWithColumns(
      [{ id: 'c1', name: 'hp' }, { id: 'c2', name: '방어력' }, { id: 'c3', name: '감소율' }],
      { c1: 1000, c2: 50, c3: 0 },
    );
    const { mathjs, fz } = bothBackends('EHP(hp, 방어력, 감소율)', ctx);
    expect(Number(mathjs.value)).toBeCloseTo(1500, 3);
    expect(Number(fz.value)).toBeCloseTo(1500, 3);
  });
});

describe('백엔드 동등성 — PREV.Column (이전행 참조)', () => {
  it('이전행 컬럼을 기반으로 누적', () => {
    const rows = [
      { c1: 100 },
      { c1: 50 },
      { c1: 30 },
    ];
    const cols = [{ id: 'c1', name: 'damage' }];
    // currentRow 는 두 번째 행 (index=1), 이전행.damage = 100
    const ctx: EvaluateContext = {
      sheets: [{
        id: 'sheet-1',
        name: 'Wave',
        columns: cols.map((c) => ({ id: c.id, name: c.name, type: 'general' as const, width: 100 })),
        rows: rows.map((r, i) => ({ id: `r${i}`, cells: r })),
        createdAt: 0,
        updatedAt: 0,
      }],
      currentSheet: {
        id: 'sheet-1',
        name: 'Wave',
        columns: cols.map((c) => ({ id: c.id, name: c.name, type: 'general' as const, width: 100 })),
        rows: rows.map((r, i) => ({ id: `r${i}`, cells: r })),
        createdAt: 0,
        updatedAt: 0,
      },
      currentRow: rows[1],
      currentRowIndex: 1,
      allRows: rows,
    };
    const { mathjs, fz } = bothBackends('PREV.damage + damage', ctx);
    // 100 + 50 = 150
    expect(mathjs.value).toBe(150);
    expect(fz.value).toBe(150);
  });
});
