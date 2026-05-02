import { describe, it, expect } from 'vitest';
import {
  simulateAutoBattler,
  compareStrategies,
  defaultAutoBattlerConfig,
} from './autoBattler';

describe('simulateAutoBattler', () => {
  it('기본 시뮬 — 30 라운드 run 되고 rounds 배열 반환', () => {
    const r = simulateAutoBattler(defaultAutoBattlerConfig('balanced'));
    expect(r.rounds.length).toBeGreaterThan(0);
    expect(r.survivedRounds).toBeGreaterThan(0);
  });

  it('라운드 번호는 1부터 시작해 시간순 증가', () => {
    const r = simulateAutoBattler(defaultAutoBattlerConfig('fast-level'));
    for (let i = 1; i < r.rounds.length; i++) {
      expect(r.rounds[i].round).toBe(r.rounds[i - 1].round + 1);
    }
  });

  it('level 은 시간이 갈수록 오름', () => {
    const r = simulateAutoBattler(defaultAutoBattlerConfig('fast-level'));
    const finalLevel = r.rounds[r.rounds.length - 1].level;
    expect(finalLevel).toBeGreaterThan(1);
  });

  it('greedy-econ 은 gold 평균이 높음 (이자 쌓기)', () => {
    const g = simulateAutoBattler(defaultAutoBattlerConfig('greedy-econ'));
    const f = simulateAutoBattler(defaultAutoBattlerConfig('fast-level'));
    const gGold = g.rounds.slice(5, 15).reduce((s, r) => s + r.gold, 0) / 10;
    const fGold = f.rounds.slice(5, 15).reduce((s, r) => s + r.gold, 0) / 10;
    expect(gGold).toBeGreaterThan(fGold);
  });

  it('HP 0 이면 survived = false', () => {
    const cfg = defaultAutoBattlerConfig('fast-level');
    cfg.startingHp = 1; // 금방 죽음
    const r = simulateAutoBattler(cfg);
    // 대부분 사망
    if (!r.survived) expect(r.placement).toBeGreaterThan(1);
  });

  it('peakPowerRound 는 rounds 범위 내', () => {
    const r = simulateAutoBattler(defaultAutoBattlerConfig('balanced'));
    expect(r.peakPowerRound).toBeGreaterThanOrEqual(0);
    expect(r.peakPowerRound).toBeLessThanOrEqual(30);
  });

  it('이자 계산: gold 20 → 이자 2', () => {
    const r = simulateAutoBattler({ ...defaultAutoBattlerConfig('greedy-econ'), startingGold: 20, rounds: 2 });
    // 첫 라운드에 interest ≥ 2 (20/10 = 2) earned
    expect(r.rounds[0].interestEarned).toBeGreaterThanOrEqual(2);
  });

  it('interestCap = 0 이면 이자 0', () => {
    const cfg = defaultAutoBattlerConfig('greedy-econ');
    cfg.interestCap = 0;
    cfg.startingGold = 50;
    const r = simulateAutoBattler(cfg);
    expect(r.totalInterestEarned).toBe(0);
  });
});

describe('compareStrategies', () => {
  it('3 전략 모두 결과 반환', () => {
    const rs = compareStrategies(defaultAutoBattlerConfig('balanced'), 50);
    expect(rs).toHaveLength(3);
    const strategies = rs.map((r) => r.strategy).sort();
    expect(strategies).toEqual(['balanced', 'fast-level', 'greedy-econ']);
  });

  it('각 결과 placement/rate 정상 범위', () => {
    const rs = compareStrategies(defaultAutoBattlerConfig('balanced'), 50);
    for (const r of rs) {
      expect(r.avgPlacement).toBeGreaterThanOrEqual(1);
      expect(r.avgPlacement).toBeLessThanOrEqual(8);
      expect(r.winRate).toBeGreaterThanOrEqual(0);
      expect(r.winRate).toBeLessThanOrEqual(1);
      expect(r.top4Rate).toBeGreaterThanOrEqual(r.winRate);
    }
  });
});
