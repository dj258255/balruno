import { describe, it, expect } from 'vitest';
import {
  simulateBuildOrder,
  SC2_TERRAN_MARINE_RUSH,
  AOE4_FEUDAL_RUSH,
  type BuildStep,
} from './rtsBuildOrder';

describe('simulateBuildOrder', () => {
  it('빈 빌드 — 일꾼 수 그대로 유지, 자원만 쌓임', () => {
    const r = simulateBuildOrder({ steps: [], durationSec: 120 });
    expect(r.finalWorkers).toBe(12);
    expect(r.samples[r.samples.length - 1].minerals).toBeGreaterThan(50);
  });

  it('SC2 Marine rush — 최종 army value > 0', () => {
    const r = simulateBuildOrder({ steps: SC2_TERRAN_MARINE_RUSH, durationSec: 300 });
    expect(r.finalArmyValue).toBeGreaterThan(0);
    expect(r.finalWorkers).toBeGreaterThan(12);
  });

  it('일꾼 트레이닝 완료 후 인구 증가', () => {
    const steps: BuildStep[] = [
      { id: 'w1', timeSec: 0, action: 'build-worker', label: 'SCV', mineralCost: 50, supplyUsed: 1, buildDurationSec: 12 },
    ];
    const r = simulateBuildOrder({ steps, durationSec: 30 });
    expect(r.finalWorkers).toBe(13);
  });

  it('자원 부족 시 failure 기록', () => {
    const steps: BuildStep[] = [
      { id: 'expensive', timeSec: 0, action: 'build-tech', label: 'Test', mineralCost: 99999, buildDurationSec: 60 },
    ];
    const r = simulateBuildOrder({ steps, durationSec: 60 });
    expect(r.failures.length).toBe(1);
    expect(r.failures[0].stepId).toBe('expensive');
  });

  it('서플라이 부족 시 failure', () => {
    const steps: BuildStep[] = [
      // 15 supply cap 초과하려고 유닛 4개 생산 (workers 12 + 4 = 16 > 15)
      { id: 'u1', timeSec: 0, action: 'train-unit', label: 'U1', mineralCost: 50, supplyUsed: 2, buildDurationSec: 10 },
      { id: 'u2', timeSec: 1, action: 'train-unit', label: 'U2', mineralCost: 50, supplyUsed: 2, buildDurationSec: 10 },
      { id: 'u3', timeSec: 2, action: 'train-unit', label: 'U3', mineralCost: 50, supplyUsed: 2, buildDurationSec: 10 },
    ];
    const r = simulateBuildOrder({ steps, durationSec: 30, startingMinerals: 1000 });
    // 자원 충분해도 서플라이 초과해 fail
    expect(r.failures.some((f) => f.reason.includes('서플라이'))).toBe(true);
  });

  it('서플라이 디포 → supplyCap 증가', () => {
    const steps: BuildStep[] = [
      { id: 'd', timeSec: 0, action: 'build-supply', label: 'Depot', mineralCost: 100, buildDurationSec: 5, supplyProvided: 8 },
    ];
    const r = simulateBuildOrder({ steps, durationSec: 30, startingMinerals: 200 });
    const final = r.samples[r.samples.length - 1];
    expect(final.supplyCap).toBeGreaterThanOrEqual(23); // 15 + 8
  });

  it('AoE 4 Feudal rush — 일꾼 + Feudal 도달', () => {
    const r = simulateBuildOrder({ steps: AOE4_FEUDAL_RUSH, durationSec: 450 });
    expect(r.finalWorkers).toBeGreaterThan(12);
  });

  it('수입은 일꾼 수에 비례 (더 많은 일꾼 = 더 높은 income)', () => {
    const r = simulateBuildOrder({
      steps: [],
      durationSec: 60,
      startingWorkers: 20,
    });
    const finalIncome = r.samples[r.samples.length - 1].mineralIncomePerMin;
    expect(finalIncome).toBeGreaterThan(500); // 20 × 45 / min = 900 expected (saturation cap)
  });

  it('idleResourceRatio 는 0-1 범위', () => {
    const r = simulateBuildOrder({ steps: SC2_TERRAN_MARINE_RUSH, durationSec: 300 });
    expect(r.idleResourceRatio).toBeGreaterThanOrEqual(0);
    expect(r.idleResourceRatio).toBeLessThanOrEqual(1);
  });

  it('samples 는 5초 간격', () => {
    const r = simulateBuildOrder({ steps: [], durationSec: 30 });
    for (let i = 1; i < r.samples.length; i++) {
      expect(r.samples[i].timeSec - r.samples[i - 1].timeSec).toBe(5);
    }
  });
});
