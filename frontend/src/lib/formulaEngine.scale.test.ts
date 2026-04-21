/**
 * 대규모 시트 성능 검증 — 10만 행 까지 선형 스케일.
 *
 * 목표:
 *   - 1만 행: < 500ms
 *   - 10만 행: < 5s (현실적으로 밸런싱 시트가 이렇게 클 일은 드물지만 안전 마진)
 *   - 두 번째 호출 (캐시 히트): < 10ms
 */
import { describe, it, expect } from 'vitest';
import { computeSheetRows } from './formulaEngine';
import type { Sheet } from '@/types';

function makeLargeSheet(rowCount: number): Sheet {
  return {
    id: 'big',
    name: 'BigSheet',
    createdAt: 0,
    updatedAt: 0,
    columns: [
      { id: 'id', name: 'id', type: 'general' },
      { id: 'hp', name: 'hp', type: 'general' },
      { id: 'atk', name: 'atk', type: 'general' },
      { id: 'dps', name: 'dps', type: 'formula', formula: '=DPS(atk, 1, 0, 2)' },
      { id: 'ehp', name: 'ehp', type: 'formula', formula: '=EHP(hp, 50)' },
    ],
    rows: Array.from({ length: rowCount }, (_, i) => ({
      id: `r-${i}`,
      cells: { id: `E${i}`, hp: 100 + i, atk: 20 + (i % 50) },
    })),
  };
}

describe('formulaEngine 스케일 테스트', () => {
  it('1만 행 < 500ms', () => {
    const sheet = makeLargeSheet(10_000);
    const start = performance.now();
    const rows = computeSheetRows(sheet, [sheet]);
    const elapsed = performance.now() - start;
    expect(rows).toHaveLength(10_000);
    expect(elapsed).toBeLessThan(500);
  });

  it('10만 행 < 5s', () => {
    const sheet = makeLargeSheet(100_000);
    const start = performance.now();
    const rows = computeSheetRows(sheet, [sheet]);
    const elapsed = performance.now() - start;
    expect(rows).toHaveLength(100_000);
    expect(elapsed).toBeLessThan(5000);
  });

  it('캐시 히트 — 같은 sheets 배열 재호출 시 즉시 반환', () => {
    const sheet = makeLargeSheet(50_000);
    const sheets = [sheet];
    // warm-up
    computeSheetRows(sheet, sheets);
    // 2회차
    const start = performance.now();
    const rows = computeSheetRows(sheet, sheets);
    const elapsed = performance.now() - start;
    expect(rows).toHaveLength(50_000);
    expect(elapsed).toBeLessThan(15); // WeakMap lookup 만
  });
});
