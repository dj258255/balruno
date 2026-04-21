import { describe, it, expect } from 'vitest';
import { simulateDifficultyCurve, type DifficultySimConfig } from './difficultySimulator';
import type { DifficultySegment } from '@/components/panels/difficulty-curve/hooks';

function mkSeg(stage: number, playerPower: number, enemyPower: number): DifficultySegment {
  return {
    stage,
    playerPower,
    enemyPower,
    ratio: playerPower / enemyPower,
    zone: 'flow',
    ddaAdjustment: 0,
  } as unknown as DifficultySegment;
}

function baseCfg(segments: DifficultySegment[]): DifficultySimConfig {
  return {
    segments,
    wallStages: [],
    restPoints: [],
    virtualPlayers: 200,
    giveUpStreak: 3,
    attemptsPerStage: 1.5,
    secPerAttempt: 60,
  };
}

describe('simulateDifficultyCurve', () => {
  it('빈 segments — 0 반환', () => {
    const r = simulateDifficultyCurve(baseCfg([]));
    expect(r.dropoutRate).toBe(0);
    expect(r.avgReachedStage).toBe(0);
  });

  it('매우 쉬운 곡선 (player >> enemy) — 대부분 클리어', () => {
    const segments = Array.from({ length: 10 }, (_, i) => mkSeg(i + 1, 100, 30));
    const r = simulateDifficultyCurve(baseCfg(segments));
    expect(r.dropoutRate).toBeLessThan(0.1);
    expect(r.avgReachedStage).toBeGreaterThan(9);
  });

  it('매우 어려운 곡선 (enemy >> player) — 대부분 이탈', () => {
    const segments = Array.from({ length: 10 }, (_, i) => mkSeg(i + 1, 20, 100));
    const r = simulateDifficultyCurve(baseCfg(segments));
    expect(r.dropoutRate).toBeGreaterThan(0.8);
  });

  it('중간 스테이지 급경사 — 해당 구간에서 이탈 집중', () => {
    // 연속 3 스테이지 극도 난이도 → giveUpStreak 3 누적 → 이탈
    const segments: DifficultySegment[] = [
      mkSeg(1, 100, 50),
      mkSeg(2, 100, 50),
      mkSeg(3, 100, 500),
      mkSeg(4, 100, 500),
      mkSeg(5, 100, 500),
      mkSeg(6, 100, 50),
      mkSeg(7, 100, 50),
    ];
    const r = simulateDifficultyCurve(baseCfg(segments));
    expect(r.topDropoutStages.length).toBeGreaterThan(0);
    // 벽 구간 (3~5) 중에서 이탈 집중
    expect([3, 4, 5]).toContain(r.topDropoutStages[0].stage);
  });

  it('avgPlaytimeMin 은 생존자 기준', () => {
    const segments = Array.from({ length: 20 }, (_, i) => mkSeg(i + 1, 100, 30));
    const r = simulateDifficultyCurve(baseCfg(segments));
    expect(r.avgPlaytimeMin).toBeGreaterThan(0);
  });

  it('giveUpStreak 높으면 이탈률 감소', () => {
    const segments = Array.from({ length: 10 }, (_, i) => mkSeg(i + 1, 50, 70));
    const patient = simulateDifficultyCurve({ ...baseCfg(segments), giveUpStreak: 10 });
    const impatient = simulateDifficultyCurve({ ...baseCfg(segments), giveUpStreak: 1 });
    expect(patient.dropoutRate).toBeLessThanOrEqual(impatient.dropoutRate);
  });

  it('restPoints 가 있으면 streak 리셋 → 이탈률 감소', () => {
    const segments = Array.from({ length: 15 }, (_, i) => mkSeg(i + 1, 60, 70));
    const noRest = simulateDifficultyCurve({ ...baseCfg(segments), restPoints: [] });
    const withRest = simulateDifficultyCurve({
      ...baseCfg(segments),
      // RestPoint 실제 필드는 시뮬에서 stage 만 쓰므로 minimal mock
      restPoints: [
        { stage: 5 } as unknown as import('@/components/panels/difficulty-curve/hooks').RestPoint,
        { stage: 10 } as unknown as import('@/components/panels/difficulty-curve/hooks').RestPoint,
      ],
    });
    // rest 있을 때 평균 도달이 더 멀거나 비슷
    expect(withRest.avgReachedStage).toBeGreaterThanOrEqual(noRest.avgReachedStage - 1);
  });

  it('dropoutByStage 합 + survivors = virtualPlayers', () => {
    const segments = Array.from({ length: 8 }, (_, i) => mkSeg(i + 1, 50, 70));
    const r = simulateDifficultyCurve(baseCfg(segments));
    const totalDropouts = r.dropoutByStage.reduce((s, n) => s + n, 0);
    const survivors = Math.round(200 * (1 - r.dropoutRate));
    expect(totalDropouts + survivors).toBe(200);
  });
});

