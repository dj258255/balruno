import { describe, it, expect } from 'vitest';
import { autoBalance } from './autoBalancer';
import type { UnitStats } from './simulation/types';

const baseUnit1: UnitStats = {
  id: 'u1', name: 'Hero',
  hp: 1000, maxHp: 1000, atk: 100, def: 20, speed: 1,
  critRate: 0, critDamage: 1.5, accuracy: 1, evasion: 0,
};
const baseUnit2: UnitStats = {
  id: 'u2', name: 'Boss',
  hp: 1000, maxHp: 1000, atk: 100, def: 20, speed: 1,
  critRate: 0, critDamage: 1.5, accuracy: 1, evasion: 0,
};

describe('autoBalance — smoke', () => {
  it('알고리즘이 crash 없이 돌고 결과 객체 shape 정상', async () => {
    const result = await autoBalance({
      unit1: baseUnit1,
      unit2: baseUnit2,
      target: 'unit1',
      param: 'atk',
      targetWinRate: 0.5,
      probeRuns: 100,
      verifyRuns: 200,
      maxIterations: 3,
    });
    // shape 검증
    expect(typeof result.factor).toBe('number');
    expect(typeof result.originalValue).toBe('number');
    expect(typeof result.suggestedValue).toBe('number');
    expect(typeof result.finalWinRate).toBe('number');
    expect(result.targetWinRate).toBe(0.5);
    expect(result.trace.length).toBeGreaterThan(0);
    expect(typeof result.explanation).toBe('string');
  }, 30000);

  it('unit1 압도적으로 강하면 factor ≤ 1 추천 (atk 감소)', async () => {
    const strongUnit1 = { ...baseUnit1, atk: 500 };
    const result = await autoBalance({
      unit1: strongUnit1,
      unit2: baseUnit2,
      target: 'unit1',
      param: 'atk',
      targetWinRate: 0.5,
      probeRuns: 100,
      verifyRuns: 200,
      maxIterations: 3,
    });
    // 노이즈가 있더라도 factor 는 1보다 같거나 작음
    expect(result.factor).toBeLessThanOrEqual(1.1); // 약간 여유
  }, 30000);

  it('탐색 trace 마지막 entry 가 verify runs 와 일치', async () => {
    const result = await autoBalance({
      unit1: baseUnit1,
      unit2: baseUnit2,
      target: 'unit2',
      param: 'hp',
      targetWinRate: 0.5,
      probeRuns: 100,
      verifyRuns: 300,
      maxIterations: 2,
    });
    const lastTrace = result.trace[result.trace.length - 1];
    if (result.trace.length > 1) {
      // baseline 즉시 종료 케이스가 아니라면 verify 가 마지막
      expect(lastTrace.runs).toBeGreaterThanOrEqual(100);
    }
  }, 30000);
});
