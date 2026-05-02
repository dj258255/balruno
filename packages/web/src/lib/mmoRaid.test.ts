import { describe, it, expect } from 'vitest';
import {
  simulateRaid,
  defaultRaidParty,
  BOSS_PRESETS,
  type RaidSimConfig,
} from './mmoRaid';

describe('simulateRaid', () => {
  it('강한 공대 vs 약한 보스 = kill', () => {
    const party = defaultRaidParty().map((r) => ({ ...r, output: r.output * 3 }));
    const weakBoss = { ...BOSS_PRESETS[0], totalHp: 500_000, enrageAtSec: 180 };
    const r = simulateRaid({ raiders: party, boss: weakBoss, maxDurationSec: 300 });
    expect(r.outcome).toBe('kill');
    expect(r.bossHpPct).toBe(0);
    expect(r.survivors).toBeGreaterThan(0);
  });

  it('약한 공대 vs 센 보스 = wipe or enrage', () => {
    // DPS 를 크게 낮추고 HP 도 줄여서 확실히 실패하게
    const party = defaultRaidParty().map((r) => ({ ...r, output: r.output * 0.1, hp: r.hp * 0.5 }));
    const strongBoss = { ...BOSS_PRESETS[1], totalHp: 10_000_000 };
    const r = simulateRaid({ raiders: party, boss: strongBoss, maxDurationSec: 500 });
    expect(['wipe', 'enrage']).toContain(r.outcome);
  });

  it('페이즈 전환 시간 기록', () => {
    const r = simulateRaid({
      raiders: defaultRaidParty().map((p) => ({ ...p, output: p.output * 2 })),
      boss: BOSS_PRESETS[0],
      maxDurationSec: 400,
    });
    // p1 은 항상 0초 진입
    expect(r.phaseEnterTimes[0]).toBe(0);
    // p2, p3 도 도달해야 함 (강한 공대면)
    if (r.outcome === 'kill') {
      expect(r.phaseEnterTimes[1]).toBeGreaterThan(0);
    }
  });

  it('requiredDpsForKill > 0', () => {
    const r = simulateRaid({
      raiders: defaultRaidParty(),
      boss: BOSS_PRESETS[0],
      maxDurationSec: 500,
    });
    expect(r.requiredDpsForKill).toBeGreaterThan(0);
  });

  it('deaths 기록 있음 (힘든 전투)', () => {
    const weakParty = defaultRaidParty().map((r) => ({ ...r, hp: r.hp * 0.2, output: r.output * 0.5 }));
    const r = simulateRaid({
      raiders: weakParty,
      boss: BOSS_PRESETS[1],
      maxDurationSec: 300,
    });
    expect(r.deaths.length).toBeGreaterThan(0);
  });

  it('averageRaidDps 는 양수', () => {
    const r = simulateRaid({
      raiders: defaultRaidParty(),
      boss: BOSS_PRESETS[0],
      maxDurationSec: 300,
    });
    expect(r.averageRaidDps).toBeGreaterThan(0);
    expect(r.averageRaidHps).toBeGreaterThan(0);
  });

  it('enrage 시간 초과 시 outcome = enrage', () => {
    const party = defaultRaidParty().map((r) => ({ ...r, output: 100 }));
    const boss = { ...BOSS_PRESETS[0], totalHp: 10_000_000 };
    const r = simulateRaid({ raiders: party, boss, maxDurationSec: 100 });
    expect(r.outcome).toBe('enrage');
  });

  it('공대 전멸 시 outcome = wipe', () => {
    const fragile = defaultRaidParty().map((r) => ({ ...r, hp: 10, output: 50 }));
    const r = simulateRaid({
      raiders: fragile,
      boss: BOSS_PRESETS[1],
      maxDurationSec: 300,
    });
    expect(r.outcome).toBe('wipe');
    expect(r.survivors).toBe(0);
  });
});
