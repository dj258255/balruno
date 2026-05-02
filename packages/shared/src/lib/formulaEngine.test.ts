/**
 * formulaEngine 기본 회귀 테스트
 *
 * 목적:
 * - 70+ 게임 수식의 핵심 함수 검증
 * - computeSheetRows 성능 최적화(WeakMap 캐시) 정상 동작 확인
 * - 수식 파서/평가 기본 동작 검증
 */
import { describe, it, expect } from 'vitest';
import { evaluateFormula, computeSheetRows } from './formulaEngine';
import type { Sheet } from '../types';

// ============ 핵심 게임 수식 ============

describe('게임 수식 — 기본 동작', () => {
  it('DAMAGE(atk, def): 공격력 100, 방어력 0 → 100', () => {
    const r = evaluateFormula('DAMAGE(100, 0)');
    expect(r.error).toBeUndefined();
    expect(r.value).toBeCloseTo(100, 2);
  });

  it('DAMAGE: 방어력 100 → 50% 감소', () => {
    const r = evaluateFormula('DAMAGE(100, 100)');
    expect(r.value).toBeCloseTo(50, 2);
  });

  it('DPS: 공격 100, 속도 2, 크리 0 → 200', () => {
    const r = evaluateFormula('DPS(100, 2, 0, 2)');
    expect(r.value).toBeCloseTo(200, 2);
  });

  it('DPS: 크리 확률 0.5, 크리 배수 2 → 1.5배 기대 데미지', () => {
    const r = evaluateFormula('DPS(100, 1, 0.5, 2)');
    expect(r.value).toBeCloseTo(150, 2);
  });

  it('TTK: HP 100, 데미지 10, 공격속도 1 → 9초 (마지막 타는 쿨 없음)', () => {
    const r = evaluateFormula('TTK(100, 10, 1)');
    expect(r.value).toBeCloseTo(9, 2);
  });

  it('EHP: HP 1000, DEF 100 → 2000 (방어 2배)', () => {
    const r = evaluateFormula('EHP(1000, 100)');
    expect(r.value).toBeCloseTo(2000, 2);
  });

  it('CLAMP: 범위 제한', () => {
    expect(evaluateFormula('CLAMP(150, 0, 100)').value).toBe(100);
    expect(evaluateFormula('CLAMP(-10, 0, 100)').value).toBe(0);
    expect(evaluateFormula('CLAMP(50, 0, 100)').value).toBe(50);
  });

  it('LERP: 선형 보간', () => {
    expect(evaluateFormula('LERP(0, 100, 0.5)').value).toBeCloseTo(50, 2);
    expect(evaluateFormula('LERP(0, 100, 0)').value).toBe(0);
    expect(evaluateFormula('LERP(0, 100, 1)').value).toBe(100);
  });
});

describe('게임 수식 — 성장 곡선 (SCALE)', () => {
  it('linear: base + level × rate', () => {
    const r = evaluateFormula('SCALE(100, 5, 10, "linear")');
    expect(r.value).toBeCloseTo(150, 2);
  });

  it('exponential: base × rate^level', () => {
    const r = evaluateFormula('SCALE(100, 2, 1.5, "exponential")');
    expect(r.value).toBeCloseTo(225, 2);
  });

  it('logarithmic: 로그 성장', () => {
    const r = evaluateFormula('SCALE(100, 10, 50, "logarithmic")');
    expect(typeof r.value).toBe('number');
    expect(r.value as number).toBeGreaterThan(100);
  });
});

describe('게임 수식 — 가챠/확률', () => {
  it('GACHA_PITY: 하드 천장 도달 시 100%', () => {
    const r = evaluateFormula('GACHA_PITY(0.01, 90, 74, 90)');
    expect(r.value).toBeCloseTo(1, 2);
  });

  it('GACHA_PITY: 소프트 천장 전 = 기본 확률', () => {
    const r = evaluateFormula('GACHA_PITY(0.01, 50, 74, 90)');
    expect(r.value).toBeCloseTo(0.01, 4);
  });

  it('CHANCE: n회 시도 시 최소 1회 성공 확률', () => {
    // 1 - (1-0.5)^2 = 0.75
    const r = evaluateFormula('CHANCE(0.5, 2)');
    expect(r.value).toBeCloseTo(0.75, 2);
  });
});

describe('기본 산술/통계', () => {
  it('SUM', () => expect(evaluateFormula('SUM(1, 2, 3)').value).toBe(6));
  it('AVERAGE', () => expect(evaluateFormula('AVERAGE(10, 20, 30)').value).toBe(20));
  it('MIN/MAX', () => {
    expect(evaluateFormula('MIN(5, 2, 8)').value).toBe(2);
    expect(evaluateFormula('MAX(5, 2, 8)').value).toBe(8);
  });
  it('IF', () => {
    expect(evaluateFormula('IF(1 > 0, 10, 20)').value).toBe(10);
    expect(evaluateFormula('IF(1 < 0, 10, 20)').value).toBe(20);
  });
});

describe('수식 에러 처리', () => {
  it('잘못된 수식은 error 반환', () => {
    const r = evaluateFormula('INVALID_FUNCTION(1)');
    expect(r.error).toBeDefined();
  });

  it('= 프리픽스 지원', () => {
    const r = evaluateFormula('=DAMAGE(100, 0)');
    expect(r.error).toBeUndefined();
    expect(r.value).toBeCloseTo(100, 2);
  });
});

// ============ 시트 계산 + 성능 회귀 ============

function makeSheet(id: string, rowCount: number, formulaColumn = true): Sheet {
  const columns = [
    { id: 'atk', name: 'ATK', type: 'general' as const },
    { id: 'def', name: 'DEF', type: 'general' as const },
  ];
  if (formulaColumn) {
    columns.push({
      id: 'dps',
      name: 'DPS',
      type: 'formula' as const,
      formula: '=DAMAGE(ATK, DEF)',
    } as unknown as typeof columns[0]);
  }
  return {
    id,
    name: `Sheet-${id}`,
    columns,
    rows: Array.from({ length: rowCount }, (_, i) => ({
      id: `row-${i}`,
      cells: { atk: 100 + i, def: i },
    })),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

describe('computeSheetRows — 기본 동작', () => {
  it('formula 컬럼이 자동 평가됨', () => {
    const sheet = makeSheet('s1', 3);
    const rows = computeSheetRows(sheet, [sheet]);

    expect(rows).toHaveLength(3);
    // DAMAGE(100, 0) = 100
    expect(rows[0].dps).toBeCloseTo(100, 2);
    // DAMAGE(101, 1) = 101 * (100 / 101) ≈ 100
    expect(rows[1].dps).toBeCloseTo(100, 2);
  });

  it('formula 없는 셀은 원본 유지', () => {
    const sheet = makeSheet('s1', 2, false);
    const rows = computeSheetRows(sheet, [sheet]);
    expect(rows[0].atk).toBe(100);
    expect(rows[0].def).toBe(0);
  });
});

describe('computeSheetRows — 성능 최적화 (WeakMap 캐시)', () => {
  it('같은 sheets 배열로 여러 번 호출 시 두 번째는 캐시 히트', () => {
    const sheet = makeSheet('s1', 50);
    const sheets = [sheet];

    const t1 = performance.now();
    const r1 = computeSheetRows(sheet, sheets);
    const dt1 = performance.now() - t1;

    const t2 = performance.now();
    const r2 = computeSheetRows(sheet, sheets);
    const dt2 = performance.now() - t2;

    // 캐시 히트 시 결과 객체 동일 (같은 참조)
    expect(r2).toBe(r1);
    // 캐시 히트는 첫 계산보다 빠름 (보통 < 1ms vs 여러 ms)
    expect(dt2).toBeLessThan(dt1);
  });

  it('다른 sheets 배열은 독립 캐시', () => {
    const sheet = makeSheet('s1', 5);
    const sheetsA = [sheet];
    const sheetsB = [sheet];  // 다른 배열 객체

    const r1 = computeSheetRows(sheet, sheetsA);
    const r2 = computeSheetRows(sheet, sheetsB);

    // 결과 값은 같지만 객체 참조는 다름 (독립 캐시)
    expect(r2).not.toBe(r1);
    expect(r2).toEqual(r1);
  });

  it('대용량 시트 성능 smoke test (200행)', () => {
    const sheet = makeSheet('large', 200);
    const start = performance.now();
    const rows = computeSheetRows(sheet, [sheet]);
    const elapsed = performance.now() - start;

    expect(rows).toHaveLength(200);
    // 200행이 1초 이내 (이전엔 30초+ 걸림)
    expect(elapsed).toBeLessThan(1000);
  });
});
