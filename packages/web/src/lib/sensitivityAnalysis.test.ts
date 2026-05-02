/**
 * 민감도 분석 단위 테스트.
 */

import { describe, it, expect } from 'vitest';
import {
  tornadoAnalysis,
  spiderAnalysis,
  sensitivityScore,
} from './sensitivityAnalysis';

describe('sensitivityAnalysis', () => {
  // 예시 함수: TTK = HP / (ATK * speed)
  const ttk = (i: Record<string, number>) => i.HP / (i.ATK * i.speed);

  it('tornadoAnalysis: 영향 큰 순 정렬', () => {
    const bars = tornadoAnalysis(
      [
        { name: 'HP', value: 100 },
        { name: 'ATK', value: 10 },
        { name: 'speed', value: 2 },
      ],
      ttk,
      0.2,
    );
    expect(bars.length).toBe(3);
    // 출력 impact 가 내림차순
    expect(bars[0].impact).toBeGreaterThanOrEqual(bars[1].impact);
    expect(bars[1].impact).toBeGreaterThanOrEqual(bars[2].impact);
    // baseline 일치
    expect(bars[0].baseline).toBeCloseTo(100 / (10 * 2));
  });

  it('tornadoAnalysis: 빈 입력', () => {
    expect(tornadoAnalysis([], ttk)).toEqual([]);
  });

  it('spiderAnalysis: steps × dimensions', () => {
    const series = spiderAnalysis(
      [
        { name: 'HP', value: 100 },
        { name: 'ATK', value: 10 },
      ],
      ttk,
      11,
      0.5,
    );
    expect(series.length).toBe(2);
    expect(series[0].points.length).toBe(11);
    // percent -50 에서 +50 스윕
    expect(series[0].points[0].percent).toBeCloseTo(-50);
    expect(series[0].points[10].percent).toBeCloseTo(50);
  });

  it('sensitivityScore: 최대 1.0', () => {
    const bars = tornadoAnalysis(
      [
        { name: 'HP', value: 100 },
        { name: 'ATK', value: 10 },
        { name: 'speed', value: 2 },
      ],
      ttk,
      0.2,
    );
    const scores = sensitivityScore(bars);
    const values = Array.from(scores.values());
    expect(Math.max(...values)).toBe(1.0);
  });

  it('safeCall: 예외 시 0', () => {
    const throwing = () => { throw new Error('boom'); };
    const bars = tornadoAnalysis(
      [{ name: 'x', value: 1 }],
      throwing as never,
      0.1,
    );
    expect(bars[0].baseline).toBe(0);
  });
});
