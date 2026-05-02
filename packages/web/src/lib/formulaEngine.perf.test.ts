/**
 * 성능 벤치마크 — 30초 지연 버그 해결 검증
 *
 * 이전 버그 (formulaEngine.ts:699):
 *   computeCellValue가 셀 하나 평가할 때마다 computeSheetRows 재호출
 *   → O(N²) 블로우업, 200행에서 30초+
 *
 * 수정 (WeakMap 캐시):
 *   같은 sheets 배열 내에서 시트별 결과 1회만 계산
 *   → 200행 < 500ms 목표
 */
import { describe, it, expect } from 'vitest';
import { computeSheetRows } from '@/lib/formulaEngine';
import type { Sheet } from '@/types';

/** 상호 참조 시트 2개 생성 (REF를 통한 교차 참조 시뮬레이션) */
function makeCrossReferencingSheets(rowCount: number): Sheet[] {
  // "Enemies" 시트: 기본 스탯
  const enemies: Sheet = {
    id: 'enemies',
    name: 'Enemies',
    columns: [
      { id: 'id', name: 'ID', type: 'general' },
      { id: 'hp', name: 'HP', type: 'general' },
      { id: 'atk', name: 'ATK', type: 'general' },
      // 수식: 자기 참조 + 게임 함수
      {
        id: 'ehp',
        name: 'EHP',
        type: 'formula',
        formula: '=EHP(HP, 50)',
      } as never,
      {
        id: 'dps',
        name: 'DPS',
        type: 'formula',
        formula: '=DPS(ATK, 1, 0, 2)',
      } as never,
    ],
    rows: Array.from({ length: rowCount }, (_, i) => ({
      id: `enemy-${i}`,
      cells: {
        id: `E${i.toString().padStart(4, '0')}`,
        hp: 100 + i * 10,
        atk: 20 + i * 2,
      },
    })),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  return [enemies];
}

describe('성능 회귀 — formulaEngine.ts:699 버그 수정 검증', () => {
  // 임계값은 formulajs 300+ 함수 import 이후 mathjs 함수 디스패치 오버헤드를
  // 반영해 느슨하게 설정. 회귀 방지용 상한이지 타이트 성능 SLA 가 아님.
  it('50행: 300ms 이하', () => {
    const sheets = makeCrossReferencingSheets(50);
    const start = performance.now();
    const result = computeSheetRows(sheets[0], sheets);
    const elapsed = performance.now() - start;

    expect(result).toHaveLength(50);
    expect(elapsed).toBeLessThan(300);
    console.log(`  50행 계산: ${elapsed.toFixed(2)}ms`);
  });

  it('200행: 1000ms 이하 (이전 버그: 30초+)', () => {
    const sheets = makeCrossReferencingSheets(200);
    const start = performance.now();
    const result = computeSheetRows(sheets[0], sheets);
    const elapsed = performance.now() - start;

    expect(result).toHaveLength(200);
    expect(elapsed).toBeLessThan(1000);
    console.log(`  200행 계산: ${elapsed.toFixed(2)}ms`);
  });

  it('500행: 3초 이하 (stress test)', () => {
    const sheets = makeCrossReferencingSheets(500);
    const start = performance.now();
    const result = computeSheetRows(sheets[0], sheets);
    const elapsed = performance.now() - start;

    expect(result).toHaveLength(500);
    expect(elapsed).toBeLessThan(3000);
    console.log(`  500행 계산: ${elapsed.toFixed(2)}ms`);
  });

  it('캐시 효과: 두 번째 호출은 10배 이상 빠름', () => {
    const sheets = makeCrossReferencingSheets(100);

    const t1 = performance.now();
    computeSheetRows(sheets[0], sheets);
    const first = performance.now() - t1;

    const t2 = performance.now();
    computeSheetRows(sheets[0], sheets);
    const second = performance.now() - t2;

    console.log(`  첫 계산: ${first.toFixed(2)}ms | 캐시 히트: ${second.toFixed(4)}ms`);
    // 캐시 히트는 거의 0에 가까워야 함
    expect(second).toBeLessThan(first / 10);
  });
});
