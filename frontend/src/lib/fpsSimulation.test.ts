import { describe, it, expect } from 'vitest';
import {
  aimSkillToProfile,
  rangeMultiplier,
  simulateWeaponTtk,
  simulateFpsDuel,
  calculateDpsCurve,
  calculateShieldBreakdown,
  utilityHitRateMultiplier,
  utilityTickDamage,
  SHIELD_BRACKETS,
  WEAPON_PRESETS,
  UTILITY_PRESETS,
  type ActiveUtility,
} from './fpsSimulation';

const target = { hp: 100, shield: 50, armor: 0.1 };

describe('aimSkillToProfile', () => {
  it('0 = 초보 (낮은 hit + 긴 reaction)', () => {
    const p = aimSkillToProfile(0);
    expect(p.hitRate).toBeCloseTo(0.55, 2);
    expect(p.headshotRate).toBeCloseTo(0.05, 2);
    expect(p.reactionMs).toBeCloseTo(600, 0);
  });

  it('100 = 숙련 (높은 hit + 짧은 reaction)', () => {
    const p = aimSkillToProfile(100);
    expect(p.hitRate).toBeCloseTo(0.98, 2);
    expect(p.headshotRate).toBeCloseTo(0.35, 2);
    expect(p.reactionMs).toBeCloseTo(150, 0);
  });
});

describe('rangeMultiplier', () => {
  const w = WEAPON_PRESETS[0]; // Assault (25m 시작, 60m 끝, 0.6x)

  it('근거리 = 1.0 (감쇠 없음)', () => {
    expect(rangeMultiplier(w, 10)).toBe(1);
    expect(rangeMultiplier(w, 25)).toBe(1);
  });

  it('최대 거리 이상 = 감쇠 최대치', () => {
    expect(rangeMultiplier(w, 60)).toBeCloseTo(0.6, 3);
    expect(rangeMultiplier(w, 100)).toBeCloseTo(0.6, 3);
  });

  it('중간 거리 = 선형 보간', () => {
    // 42.5m = start 와 end 의 중간 → (1 + 0.6) / 2 = 0.8
    expect(rangeMultiplier(w, 42.5)).toBeCloseTo(0.8, 2);
  });
});

describe('simulateWeaponTtk', () => {
  it('숙련 에임 + 근거리 = 대부분 kill', () => {
    const result = simulateWeaponTtk(
      WEAPON_PRESETS[0],
      target,
      10,
      aimSkillToProfile(100),
      1000,
    );
    expect(result.killProbability).toBeGreaterThan(0.95);
    expect(result.avgBtk).toBeGreaterThan(0);
    expect(result.avgTtkMs).toBeGreaterThan(0);
  });

  it('초보 에임 + 최대 거리 = 낮은 kill 확률', () => {
    const result = simulateWeaponTtk(
      WEAPON_PRESETS[2], // DMR (장거리에서도 감쇠 작음)
      target,
      10,
      aimSkillToProfile(0),
      1000,
    );
    expect(result.avgBtk).toBeGreaterThan(2); // 초보라 여러 발 필요
  });
});

describe('simulateFpsDuel', () => {
  it('A 가 첫발 우위 + 같은 에임 → A 승률 우세', () => {
    const aim = aimSkillToProfile(50);
    const result = simulateFpsDuel(
      WEAPON_PRESETS[0], aim,
      WEAPON_PRESETS[0], aim,
      { hp: 100, shield: 0, armor: 0 },
      { hp: 100, shield: 0, armor: 0 },
      { distance: 20, firstShot: 'A', bothAwareDelayMs: 100 },
      2000,
    );
    expect(result.aWinRate).toBeGreaterThan(0.55);
  });

  it('B 숙련 vs A 초보 → B 압승', () => {
    const result = simulateFpsDuel(
      WEAPON_PRESETS[0], aimSkillToProfile(10),
      WEAPON_PRESETS[0], aimSkillToProfile(90),
      { hp: 100, shield: 0, armor: 0 },
      { hp: 100, shield: 0, armor: 0 },
      { distance: 20, firstShot: 'both-aware', bothAwareDelayMs: 100 },
      2000,
    );
    expect(result.bWinRate).toBeGreaterThan(0.75);
  });
});

describe('calculateDpsCurve', () => {
  it('거리 증가할수록 effectiveDps 감소 (감쇠 구간)', () => {
    const curve = calculateDpsCurve(
      WEAPON_PRESETS[0],
      target,
      aimSkillToProfile(80),
      [10, 40, 80],
    );
    expect(curve[0].effectiveDps).toBeGreaterThan(curve[1].effectiveDps);
    expect(curve[1].effectiveDps).toBeGreaterThan(curve[2].effectiveDps);
  });
});

describe('이동 패널티 + recoil + first shot bonus', () => {
  it('이동 중이면 B 승률 저하 (양쪽 동일 에임)', () => {
    const aim = aimSkillToProfile(70);
    const staticResult = simulateFpsDuel(
      WEAPON_PRESETS[0], aim,
      WEAPON_PRESETS[0], aim,
      { hp: 100, shield: 50, armor: 0 },
      { hp: 100, shield: 50, armor: 0 },
      { distance: 20, firstShot: 'both-aware', bothAwareDelayMs: 100, aMoving: false, bMoving: false },
      2000,
    );
    const bMoving = simulateFpsDuel(
      WEAPON_PRESETS[0], aim,
      WEAPON_PRESETS[0], aim,
      { hp: 100, shield: 50, armor: 0 },
      { hp: 100, shield: 50, armor: 0 },
      { distance: 20, firstShot: 'both-aware', bothAwareDelayMs: 100, aMoving: false, bMoving: true },
      2000,
    );
    // B 가 이동 중이면 맞추기 힘들어서 A 승률 UP
    expect(bMoving.aWinRate).toBeGreaterThanOrEqual(staticResult.aWinRate);
  });

  it('recoil 높으면 연사 TTK 증가', () => {
    const weaponLowRecoil = { ...WEAPON_PRESETS[0], recoilIntensity: 0 };
    const weaponHighRecoil = { ...WEAPON_PRESETS[0], recoilIntensity: 1 };
    const aim = aimSkillToProfile(70);
    const target = { hp: 200, shield: 0, armor: 0 };
    const low = simulateWeaponTtk(weaponLowRecoil, target, 30, aim, 2000);
    const high = simulateWeaponTtk(weaponHighRecoil, target, 30, aim, 2000);
    // recoil 있으면 평균 BTK 증가 (또는 kill 확률 감소)
    expect(high.avgBtk).toBeGreaterThanOrEqual(low.avgBtk * 0.95);
  });
});

describe('calculateShieldBreakdown (Apex 방식)', () => {
  it('쉴드 티어 5개 반환 (none/white/blue/purple/red)', () => {
    const rows = calculateShieldBreakdown(WEAPON_PRESETS[0], 10);
    expect(rows).toHaveLength(5);
    expect(rows[0].tier).toBe('none');
    expect(rows[4].tier).toBe('red');
  });

  it('쉴드 티어 높을수록 BTK 증가', () => {
    const rows = calculateShieldBreakdown(WEAPON_PRESETS[0], 10);
    // totalHp 가 증가하므로 BTK 도 증가
    expect(rows[0].totalHp).toBe(100); // none
    expect(rows[4].totalHp).toBe(225); // red (100 + 125)
    expect(rows[4].btkBody).toBeGreaterThanOrEqual(rows[0].btkBody);
  });

  it('헤드샷 BTK 는 몸샷 BTK 보다 적음 (헬멧 감소 반영)', () => {
    const rows = calculateShieldBreakdown(WEAPON_PRESETS[0], 10);
    for (const row of rows) {
      expect(row.btkHead).toBeLessThanOrEqual(row.btkBody);
    }
  });

  it('SHIELD_BRACKETS 값 검증', () => {
    expect(SHIELD_BRACKETS.white.shieldHp).toBe(50);
    expect(SHIELD_BRACKETS.red.shieldHp).toBe(125);
    expect(SHIELD_BRACKETS.red.headshotReduction).toBe(0.25);
  });
});

describe('utilityHitRateMultiplier', () => {
  it('utility 없으면 배율 1', () => {
    expect(utilityHitRateMultiplier(undefined, 'A', 0)).toBe(1);
    expect(utilityHitRateMultiplier([], 'A', 0)).toBe(1);
  });

  it('smoke 활성 시간 중엔 intensity 배율', () => {
    const utils: ActiveUtility[] = [
      { kind: 'smoke', affects: 'both', deployedAtMs: 1000, durationMs: 5000, intensity: 0.3 },
    ];
    // t=500: 아직 발동 전
    expect(utilityHitRateMultiplier(utils, 'A', 500)).toBe(1);
    // t=2000: 활성 → 0.3
    expect(utilityHitRateMultiplier(utils, 'A', 2000)).toBeCloseTo(0.3, 2);
    // t=7000: 지난 뒤
    expect(utilityHitRateMultiplier(utils, 'A', 7000)).toBe(1);
  });

  it('flash 는 시간 지나며 회복 (intensity → 1 선형)', () => {
    const utils: ActiveUtility[] = [
      { kind: 'flash', affects: 'A', deployedAtMs: 0, durationMs: 2000, intensity: 0.1 },
    ];
    // t=0: 0.1 (맹렬)
    expect(utilityHitRateMultiplier(utils, 'A', 0)).toBeCloseTo(0.1, 2);
    // t=1000 (중간): 보간값 (0.1 + 0.9*0.5 = 0.55)
    expect(utilityHitRateMultiplier(utils, 'A', 1000)).toBeCloseTo(0.55, 2);
    // 끝에 가까워짐: 거의 1
    expect(utilityHitRateMultiplier(utils, 'A', 1900)).toBeGreaterThan(0.9);
  });

  it('affects 가 다르면 영향 없음 (A 에게만 flash 인데 B 가 쏠 때)', () => {
    const utils: ActiveUtility[] = [
      { kind: 'flash', affects: 'A', deployedAtMs: 0, durationMs: 2000, intensity: 0.1 },
    ];
    expect(utilityHitRateMultiplier(utils, 'B', 500)).toBe(1);
  });

  it('여러 유틸 동시 적용 시 배율 곱셈 (스모크 + 플래시)', () => {
    const utils: ActiveUtility[] = [
      { kind: 'smoke', affects: 'both', deployedAtMs: 0, durationMs: 10000, intensity: 0.3 },
      { kind: 'flash', affects: 'A', deployedAtMs: 0, durationMs: 2000, intensity: 0.1 },
    ];
    // t=0: smoke 0.3, flash 0.1 → 0.03
    expect(utilityHitRateMultiplier(utils, 'A', 0)).toBeCloseTo(0.03, 3);
  });

  it('molotov 는 hitRate 배율엔 영향 없음', () => {
    const utils: ActiveUtility[] = [
      { kind: 'molotov', affects: 'A', deployedAtMs: 0, durationMs: 5000, intensity: 20 },
    ];
    expect(utilityHitRateMultiplier(utils, 'A', 1000)).toBe(1);
  });
});

describe('utilityTickDamage', () => {
  it('활성 molotov: dps × 경과 초', () => {
    const utils: ActiveUtility[] = [
      { kind: 'molotov', affects: 'A', deployedAtMs: 0, durationMs: 5000, intensity: 20 },
    ];
    // 0~1000ms (1초) 구간 → 20 damage
    expect(utilityTickDamage(utils, 'A', 0, 1000)).toBeCloseTo(20, 2);
    // 0~2500ms → 50
    expect(utilityTickDamage(utils, 'A', 0, 2500)).toBeCloseTo(50, 2);
  });

  it('다른 쪽 affects 에는 피해 0', () => {
    const utils: ActiveUtility[] = [
      { kind: 'molotov', affects: 'A', deployedAtMs: 0, durationMs: 5000, intensity: 20 },
    ];
    expect(utilityTickDamage(utils, 'B', 0, 5000)).toBe(0);
  });

  it('duration 지난 뒤엔 피해 누적 중단', () => {
    const utils: ActiveUtility[] = [
      { kind: 'molotov', affects: 'A', deployedAtMs: 0, durationMs: 2000, intensity: 10 },
    ];
    // 0~5000 query 지만 2000 에서 끝남 → 20 dmg
    expect(utilityTickDamage(utils, 'A', 0, 5000)).toBeCloseTo(20, 2);
  });
});

describe('simulateFpsDuel 유틸리티 통합', () => {
  it('smoke 양쪽 방해 → 교전 지속 시간 증가 (miss 가 많아 kill 지연)', () => {
    const weapon = WEAPON_PRESETS[0];
    const aim = aimSkillToProfile(50);
    const player = { hp: 100, shield: 0, armor: 0 };
    const noSmoke = simulateFpsDuel(
      weapon, aim, weapon, aim, player, player,
      { distance: 20, firstShot: 'both-aware', bothAwareDelayMs: 100 },
      500,
    );
    const withSmoke = simulateFpsDuel(
      weapon, aim, weapon, aim, player, player,
      {
        distance: 20, firstShot: 'both-aware', bothAwareDelayMs: 100,
        utilities: [{ kind: 'smoke', affects: 'both', deployedAtMs: 0, durationMs: 15000, intensity: 0.3 }],
      },
      500,
    );
    // smoke 가 양쪽 모두 명중률 감소 → 전투 지속 평균 늘어남
    expect(withSmoke.avgDurationMs).toBeGreaterThan(noSmoke.avgDurationMs);
  });

  it('A 에게만 flash → B 승률 상승', () => {
    const weapon = WEAPON_PRESETS[0];
    const aim = aimSkillToProfile(50);
    const player = { hp: 100, shield: 0, armor: 0 };
    const withFlashA = simulateFpsDuel(
      weapon, aim, weapon, aim, player, player,
      {
        distance: 20, firstShot: 'both-aware', bothAwareDelayMs: 100,
        utilities: [{ kind: 'flash', affects: 'A', deployedAtMs: 0, durationMs: 2000, intensity: 0.1 }],
      },
      1000,
    );
    // A 가 플래시 맞았으니 B 승률 월등히 높아야 함
    expect(withFlashA.bWinRate).toBeGreaterThan(withFlashA.aWinRate);
  });

  it('UTILITY_PRESETS 기본값 검증', () => {
    expect(UTILITY_PRESETS.smoke.durationMs).toBe(15_000);
    expect(UTILITY_PRESETS.flash.intensity).toBe(0.1);
    expect(UTILITY_PRESETS.molotov.intensity).toBe(20);
  });
});
