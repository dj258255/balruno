import { describe, it, expect } from 'vitest';
import {
  simulateHordeSurvivor,
  evaluateBuild,
  defaultHordeConfig,
  WEAPON_PRESETS,
} from './hordeSurvivor';

describe('simulateHordeSurvivor', () => {
  it('기본 빌드 — samples 반환, 레벨업', () => {
    const r = simulateHordeSurvivor(defaultHordeConfig());
    expect(r.samples.length).toBeGreaterThan(0);
    expect(r.maxLevel).toBeGreaterThan(1);
  });

  it('HP 0 시 조기 종료', () => {
    const cfg = defaultHordeConfig();
    cfg.startingHp = 1;
    cfg.hpRegen = 0;
    const r = simulateHordeSurvivor(cfg);
    expect(r.survived).toBe(false);
    expect(r.survivedSec).toBeLessThan(cfg.maxDurationSec);
  });

  it('강력한 빌드 — 30분 생존', () => {
    const cfg = defaultHordeConfig();
    cfg.weapons = [
      { weapon: { ...WEAPON_PRESETS[7], baseDps: 1000, dpsPerLevel: 500 }, level: 8 },
      { weapon: { ...WEAPON_PRESETS[4], baseDps: 1000, dpsPerLevel: 500 }, level: 8 },
      { weapon: { ...WEAPON_PRESETS[5], baseDps: 1000, dpsPerLevel: 500 }, level: 8 },
    ];
    const r = simulateHordeSurvivor(cfg);
    expect(r.survived).toBe(true);
    expect(r.survivedSec).toBe(cfg.maxDurationSec);
  });

  it('samples timeSec 은 10초 간격', () => {
    const r = simulateHordeSurvivor(defaultHordeConfig());
    for (let i = 1; i < r.samples.length; i++) {
      expect(r.samples[i].timeSec - r.samples[i - 1].timeSec).toBe(10);
    }
  });

  it('totalKills > 0', () => {
    const r = simulateHordeSurvivor(defaultHordeConfig());
    expect(r.totalKills).toBeGreaterThan(0);
  });
});

describe('evaluateBuild', () => {
  it('빈 빌드 — dps 0', () => {
    const e = evaluateBuild([]);
    expect(e.dpsAt10min).toBe(0);
    expect(e.dpsAt20min).toBe(0);
  });

  it('synergy 있는 빌드 (같은 속성 2개) 는 synergyBonus > 1', () => {
    const fire1 = WEAPON_PRESETS.find((w) => w.id === 'fireball')!;
    const fire2 = WEAPON_PRESETS.find((w) => w.id === 'fire-wand')!;
    const e = evaluateBuild([
      { weapon: fire1, level: 5 },
      { weapon: fire2, level: 5 },
    ]);
    expect(e.synergyBonus).toBeGreaterThan(1);
  });

  it('synergy 없는 빌드 — synergyBonus ≈ 레벨 보너스만', () => {
    const whip = WEAPON_PRESETS.find((w) => w.id === 'whip')!;
    const e = evaluateBuild([{ weapon: whip, level: 5 }]);
    // 혼자면 synergy 배율 적용 안 됨 — 그러나 레벨 보너스는 있음
    expect(e.synergyBonus).toBeGreaterThan(0);
  });

  it('score 0-100 범위', () => {
    const e = evaluateBuild([
      { weapon: WEAPON_PRESETS[0], level: 8 },
      { weapon: WEAPON_PRESETS[1], level: 8 },
      { weapon: WEAPON_PRESETS[4], level: 8 },
    ]);
    expect(e.score).toBeGreaterThanOrEqual(0);
    expect(e.score).toBeLessThanOrEqual(100);
  });

  it('시간 지날수록 DPS 증가 (player level up)', () => {
    const e = evaluateBuild([{ weapon: WEAPON_PRESETS[0], level: 8 }]);
    expect(e.dpsAt30min).toBeGreaterThan(e.dpsAt10min);
  });
});
