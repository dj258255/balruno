import { describe, it, expect } from 'vitest';
import {
  simulateLaning,
  simulateAllIn,
  xpToLevel,
  CHAMPION_PRESETS,
  MINION_GOLD,
  MINION_XP,
  type LaneSimConfig,
} from './mobaLaning';

function cfg(blue: number, red: number, duration = 600): LaneSimConfig {
  return {
    blue: CHAMPION_PRESETS[blue],
    red: CHAMPION_PRESETS[red],
    laneType: '1v1',
    durationSec: duration,
    minionsPerWave: 6,
    waveIntervalSec: 30,
    cannonEveryNWaves: 6,
  };
}

describe('xpToLevel', () => {
  it('0 xp = 1 레벨', () => {
    expect(xpToLevel(0)).toBe(1);
  });
  it('경험치 쌓이면 레벨업', () => {
    expect(xpToLevel(300)).toBe(2);
    expect(xpToLevel(100000)).toBe(18); // max
  });
  it('큰 값도 18 에서 클램프', () => {
    expect(xpToLevel(999999)).toBe(18);
  });
});

describe('simulateLaning', () => {
  it('기본 시뮬 — samples 가 시간순 증가', () => {
    const r = simulateLaning(cfg(0, 1, 300));
    for (let i = 1; i < r.samples.length; i++) {
      expect(r.samples[i].timeSec).toBeGreaterThan(r.samples[i - 1].timeSec);
      expect(r.samples[i].blueGold).toBeGreaterThanOrEqual(r.samples[i - 1].blueGold);
      expect(r.samples[i].blueCs).toBeGreaterThanOrEqual(r.samples[i - 1].blueCs);
    }
  });

  it('같은 챔피언 라인전 — CS/gold 차이 작음', () => {
    const r = simulateLaning(cfg(0, 0, 600));
    expect(Math.abs(r.finalGoldDiff)).toBeLessThan(300);
  });

  it('csSkill 높은 쪽이 gold lead', () => {
    // CHAMPION_PRESETS[1] = Yasuo (csSkill 0.9), [3] = Thresh (csSkill 0.1)
    const r = simulateLaning(cfg(1, 3, 600));
    expect(r.finalGoldDiff).toBeGreaterThan(100);
  });

  it('시간 흐름에 따라 aggregation — csSkill 낮은 쪽도 CS 는 쌓임', () => {
    const r = simulateLaning(cfg(3, 1, 600));
    expect(r.samples[r.samples.length - 1].blueCs).toBeGreaterThan(0);
    expect(r.samples[r.samples.length - 1].redCs).toBeGreaterThan(0);
  });

  it('1코어 아이템 도달 시간은 수백 초 내', () => {
    const r = simulateLaning(cfg(0, 1, 900));
    expect(r.blueTimeToFirstItem).toBeGreaterThan(0);
    expect(r.blueTimeToFirstItem).toBeLessThanOrEqual(900);
  });

  it('laneDominanceScore 는 -100~+100 범위', () => {
    const r = simulateLaning(cfg(1, 3, 600));
    expect(r.laneDominanceScore).toBeGreaterThanOrEqual(-100);
    expect(r.laneDominanceScore).toBeLessThanOrEqual(100);
  });
});

describe('simulateAllIn', () => {
  it('같은 레벨 동일 챔피언 = 50% 근사', () => {
    const rate = simulateAllIn(CHAMPION_PRESETS[0], CHAMPION_PRESETS[0], 6, 6, 300);
    expect(rate).toBeGreaterThan(0.3);
    expect(rate).toBeLessThan(0.7);
  });

  it('레벨 차이 크면 높은 쪽 승률 우세', () => {
    const rate = simulateAllIn(CHAMPION_PRESETS[0], CHAMPION_PRESETS[0], 12, 6, 300);
    expect(rate).toBeGreaterThan(0.65);
  });
});

describe('미니언 상수', () => {
  it('MINION_GOLD/XP 양수', () => {
    expect(MINION_GOLD.melee).toBeGreaterThan(0);
    expect(MINION_GOLD.caster).toBeGreaterThan(0);
    expect(MINION_GOLD.cannon).toBeGreaterThan(MINION_GOLD.melee);
    expect(MINION_XP.melee).toBeGreaterThan(MINION_XP.caster);
  });
});
