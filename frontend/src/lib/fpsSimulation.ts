/**
 * FPS TTK (Time-to-Kill) 시뮬레이션 — Destiny/Valorant/CoD 밸런싱 문서 기반.
 *
 * 핵심 지표:
 *  - TTK: 첫 명중부터 적 처치까지 밀리초
 *  - BTK (Bullets To Kill): 처치에 필요한 총알 수
 *  - Effective DPS at distance: 거리별 유효 DPS
 *  - 1v1 Win Rate: 두 무기 교전 시 승률
 *
 * 모델:
 *  - shot 당 부위(head/body/limb) 확률 분포 — aim skill 로 조절
 *  - Range falloff: 거리 ≥ start 부터 선형 감쇠, end 에서 최대 감쇠
 *  - Armor: 장갑 + 관통률 로 최종 감소 계산
 *  - 연사: RPM 기반 shot interval, magazine 끝나면 reload
 *  - 첫발 우위: 누가 먼저 쏘느냐 (A / B / both-aware)
 */

export interface WeaponStats {
  id: string;
  name: string;
  /** 한 발당 머리 피해 */
  damageHead: number;
  /** 한 발당 몸통 피해 */
  damageBody: number;
  /** 한 발당 팔다리 피해 */
  damageLimb: number;
  /** 분당 발사 수 (Rounds Per Minute) */
  rpm: number;
  /** 탄창 크기 */
  magazineSize: number;
  /** 재장전 시간 (초) */
  reloadTimeSeconds: number;
  /** ADS (aim-down-sight) 시간 (초) */
  adsTimeSeconds: number;
  /** 감쇠 시작 거리 (m) — 이 거리 전엔 100% 피해 */
  rangeFalloffStart: number;
  /** 감쇠 끝 거리 (m) — 이 거리 이상이면 최저 피해 */
  rangeFalloffEnd: number;
  /** 감쇠 끝에서의 피해 배율 (0-1) */
  falloffDamageMultiplier: number;
  /** 방어 관통률 (0-1) — armor 를 무시하는 비율 */
  armorPenPercent: number;
  /** 첫 발 hit bonus (0-1) — 조준 완료 상태 첫 발은 정확함. CoD/Valorant 모델 */
  firstShotAccuracyBonus?: number;
  /** recoil 강도 (0-1) — 1 이면 연사할수록 hit rate 급감, 0 이면 무반동 */
  recoilIntensity?: number;
  /** 이동 중 명중률 감소 (0-1) — 1 이면 이동 시 아예 못 맞춤 */
  movingAccuracyPenalty?: number;
}

export interface PlayerStats {
  /** 체력 */
  hp: number;
  /** 쉴드 / 아머 (추가 체력) */
  shield: number;
  /** 장갑 배율 (0-1) — 1 이면 피해 0, 0 이면 감소 없음 */
  armor: number;
}

/**
 * Apex Legends 스타일 쉴드 티어.
 * 각 티어별 shield HP 와 헬멧(헤드샷 감소) 추가.
 * 실제 Apex:
 *  - 흰(1): shield 50,  helmet 10%
 *  - 파(2): shield 75,  helmet 20%
 *  - 보(3): shield 100, helmet 25%
 *  - 금(4): shield 100, helmet 25% + 부가 효과 (단순화 생략)
 *  - 레드(Evo full): shield 125, helmet 25%
 */
export type ShieldTier = 'none' | 'white' | 'blue' | 'purple' | 'red';

export interface ShieldBracket {
  tier: ShieldTier;
  label: string;
  shieldHp: number;
  headshotReduction: number; // 0-1, 헬멧이 헤드 피해를 감소시키는 비율
  color: string;
}

export const SHIELD_BRACKETS: Record<ShieldTier, ShieldBracket> = {
  none:   { tier: 'none',   label: '무',   shieldHp: 0,   headshotReduction: 0,    color: '#6b7280' },
  white:  { tier: 'white',  label: 'Lv1',  shieldHp: 50,  headshotReduction: 0.1,  color: '#e5e7eb' },
  blue:   { tier: 'blue',   label: 'Lv2',  shieldHp: 75,  headshotReduction: 0.2,  color: '#3b82f6' },
  purple: { tier: 'purple', label: 'Lv3',  shieldHp: 100, headshotReduction: 0.25, color: '#8b5cf6' },
  red:    { tier: 'red',    label: 'Red',  shieldHp: 125, headshotReduction: 0.25, color: '#ef4444' },
};

/** 티어에서 PlayerStats 생성 — 기본 HP 100 */
export function playerFromShieldTier(tier: ShieldTier, baseHp = 100): PlayerStats {
  const b = SHIELD_BRACKETS[tier];
  return { hp: baseHp, shield: b.shieldHp, armor: 0 };
}

/**
 * 쉴드 티어별 TTK/BTK 비교 (한 번의 연산으로 전체 티어).
 * 각 티어에서 몇 발에 깨지고 몇 초 걸리는지 brackets chart 로 표시.
 */
export interface ShieldBreakdown {
  tier: ShieldTier;
  label: string;
  totalHp: number;
  btkBody: number;     // 몸샷만으로 처치 필요 발수
  btkHead: number;     // 헤드샷만으로 (헬멧 감소 반영)
  ttkBodyMs: number;
  ttkHeadMs: number;
}

export function calculateShieldBreakdown(
  weapon: WeaponStats,
  distance: number,
): ShieldBreakdown[] {
  const tiers: ShieldTier[] = ['none', 'white', 'blue', 'purple', 'red'];
  const shotIntervalMs = 60_000 / weapon.rpm;
  const rangeMul = rangeMultiplier(weapon, distance);

  return tiers.map((tier) => {
    const bracket = SHIELD_BRACKETS[tier];
    const totalHp = 100 + bracket.shieldHp; // base HP 100

    const bodyDmg = weapon.damageBody * rangeMul;
    const headDmgReduced = weapon.damageHead * rangeMul * (1 - bracket.headshotReduction);

    const btkBody = Math.ceil(totalHp / Math.max(1, bodyDmg));
    const btkHead = Math.ceil(totalHp / Math.max(1, headDmgReduced));

    // TTK: (btk - 1) 개의 shotInterval (첫 발은 즉시)
    const ttkBodyMs = (btkBody - 1) * shotIntervalMs;
    const ttkHeadMs = (btkHead - 1) * shotIntervalMs;

    return {
      tier,
      label: bracket.label,
      totalHp,
      btkBody,
      btkHead,
      ttkBodyMs,
      ttkHeadMs,
    };
  });
}

export interface AimProfile {
  /** 헤드샷 확률 (0-1) — aim skill 로부터 유도 */
  headshotRate: number;
  /** 몸통 확률 (0-1) */
  bodyRate: number;
  /** 팔다리 확률 = 1 - head - body */
  // limbRate = 1 - headshotRate - bodyRate (자동)
  /** 전체 hit 확률 (0-1) — 거리/aim 에 따라 miss 가능 */
  hitRate: number;
  /** 사전 반응 지연 (ms) — reaction time */
  reactionMs: number;
}

export interface FpsEngagement {
  /** 교전 거리 (m) */
  distance: number;
  /** 첫발 우위: 누가 먼저 쏘나 */
  firstShot: 'A' | 'B' | 'both-aware';
  /** ms 기준 동시 조우 후 ADS 대기 */
  bothAwareDelayMs: number;
  /** A/B 이동 상태 — 이동 중이면 movingAccuracyPenalty 적용 */
  aMoving?: boolean;
  bMoving?: boolean;
}

export interface FpsSimResult {
  /** 평균 TTK (ms) */
  avgTtkMs: number;
  minTtkMs: number;
  maxTtkMs: number;
  medianTtkMs: number;
  /** 평균 BTK (발수) */
  avgBtk: number;
  minBtk: number;
  maxBtk: number;
  /** kill 확률 (한 탄창 내) */
  killProbability: number;
  /** 평균 피해 */
  avgDamagePerShot: number;
  /** 이론 최대 DPS (모두 명중/헤드샷 가정) */
  theoreticalMaxDps: number;
  /** 거리에서의 실효 DPS (hitRate + falloff 반영) */
  effectiveDps: number;
}

export interface FpsDuelResult {
  /** A 승률 (0-1) */
  aWinRate: number;
  bWinRate: number;
  drawRate: number;
  /** 평균 교전 지속 시간 (ms) */
  avgDurationMs: number;
  /** A/B 각자의 TTK 분포 */
  aTtkSamples: number[];
  bTtkSamples: number[];
}

// ============================================================================
// 유틸
// ============================================================================

/** 거리에 따른 피해 배율 (1.0 ~ falloffDamageMultiplier) */
export function rangeMultiplier(weapon: WeaponStats, distance: number): number {
  if (distance <= weapon.rangeFalloffStart) return 1;
  if (distance >= weapon.rangeFalloffEnd) return weapon.falloffDamageMultiplier;
  const t =
    (distance - weapon.rangeFalloffStart) /
    Math.max(1, weapon.rangeFalloffEnd - weapon.rangeFalloffStart);
  return 1 + (weapon.falloffDamageMultiplier - 1) * t;
}

/** aim skill (0-100) → AimProfile.
 *  - 50 기준: 헤드 15%, 몸 60%, 팔다리 25%, hit 85%, reaction 350ms
 *  - 0:  헤드 5%,  몸 40%, 팔다리 55%, hit 55%, reaction 600ms
 *  - 100: 헤드 35%, 몸 60%, 팔다리 5%,  hit 98%, reaction 150ms
 */
export function aimSkillToProfile(aimSkill: number): AimProfile {
  const s = Math.max(0, Math.min(100, aimSkill)) / 100;
  return {
    headshotRate: 0.05 + s * 0.3,
    bodyRate: 0.4 + s * 0.2,
    hitRate: 0.55 + s * 0.43,
    reactionMs: 600 - s * 450,
  };
}

/** 장갑 + 관통 적용 후 최종 피해 배율 */
function armorDamageMultiplier(armor: number, armorPen: number): number {
  const effArmor = armor * (1 - armorPen);
  return Math.max(0, 1 - effArmor);
}

// ============================================================================
// 한 발 피해 계산
// ============================================================================

/**
 * 한 발의 effective hit rate 계산 — 첫 발 보너스, recoil (연사 shot index), 이동 페널티 반영.
 * Valorant / CoD 공식 밸런싱에서 다음 3 요소를 종합:
 *  - First shot: 첫 발은 completely accurate (spread 0)
 *  - Recoil: shot index 증가하면 spread 증가 → hit rate 감소
 *  - Movement: 이동 중 spread 증가
 */
function effectiveHitRate(
  weapon: WeaponStats,
  aim: AimProfile,
  shotIndex: number,
  moving: boolean,
): number {
  let rate = aim.hitRate;

  // 첫 발 보너스
  if (shotIndex === 0 && weapon.firstShotAccuracyBonus) {
    rate = Math.min(1, rate + weapon.firstShotAccuracyBonus);
  } else if (shotIndex > 0 && weapon.recoilIntensity) {
    // Recoil: shot 5발 째부터 본격 감소. max 약 -50%
    const recoilFactor = Math.min(1, (shotIndex - 1) / 15);
    rate *= 1 - weapon.recoilIntensity * 0.5 * recoilFactor;
  }

  if (moving && weapon.movingAccuracyPenalty) {
    rate *= 1 - weapon.movingAccuracyPenalty;
  }

  return Math.max(0, Math.min(1, rate));
}

function rollShotDamage(
  weapon: WeaponStats,
  player: PlayerStats,
  distance: number,
  aim: AimProfile,
  shotIndex = 0,
  moving = false,
): { damage: number; part: 'head' | 'body' | 'limb' | 'miss' } {
  // 동적 hit rate
  const hitRate = effectiveHitRate(weapon, aim, shotIndex, moving);

  // miss 체크
  if (Math.random() > hitRate) {
    return { damage: 0, part: 'miss' };
  }

  // 부위 판정
  const r = Math.random();
  let part: 'head' | 'body' | 'limb';
  let baseDmg: number;
  if (r < aim.headshotRate) {
    part = 'head';
    baseDmg = weapon.damageHead;
  } else if (r < aim.headshotRate + aim.bodyRate) {
    part = 'body';
    baseDmg = weapon.damageBody;
  } else {
    part = 'limb';
    baseDmg = weapon.damageLimb;
  }

  const rangeMul = rangeMultiplier(weapon, distance);
  const armorMul = armorDamageMultiplier(player.armor, weapon.armorPenPercent);
  return { damage: baseDmg * rangeMul * armorMul, part };
}

// ============================================================================
// 단일 무기 TTK 시뮬 (distance + target 에 대해 N회 시도)
// ============================================================================

export function simulateWeaponTtk(
  weapon: WeaponStats,
  target: PlayerStats,
  distance: number,
  aim: AimProfile,
  runs = 10_000,
): FpsSimResult {
  const ttks: number[] = [];
  const btks: number[] = [];
  let kills = 0;
  let totalShots = 0;
  let totalDamage = 0;

  const shotIntervalMs = 60_000 / weapon.rpm;
  const totalHp = target.hp + target.shield;

  for (let run = 0; run < runs; run++) {
    let remaining = totalHp;
    let shotsFired = 0;
    let timeMs = aim.reactionMs;
    let killed = false;

    while (shotsFired < weapon.magazineSize) {
      const { damage } = rollShotDamage(weapon, target, distance, aim, shotsFired, false);
      shotsFired++;
      totalShots++;
      totalDamage += damage;
      remaining -= damage;
      if (remaining <= 0) {
        killed = true;
        ttks.push(timeMs);
        btks.push(shotsFired);
        kills++;
        break;
      }
      timeMs += shotIntervalMs;
    }

    // 탄창 소모 — 생존 처리 (kill 못함) → 통계 제외
    if (!killed) {
      // 기록 안 함 (kill 안 난 경우)
    }
  }

  ttks.sort((a, b) => a - b);
  btks.sort((a, b) => a - b);

  const avgTtk = ttks.length > 0 ? ttks.reduce((a, b) => a + b, 0) / ttks.length : 0;
  const avgBtk = btks.length > 0 ? btks.reduce((a, b) => a + b, 0) / btks.length : 0;

  const avgDmg = totalShots > 0 ? totalDamage / totalShots : 0;
  const theoMaxDps = (weapon.damageHead * weapon.rpm) / 60; // 모두 헤드샷 가정
  const effDps = (avgDmg * weapon.rpm) / 60;

  return {
    avgTtkMs: avgTtk,
    minTtkMs: ttks[0] ?? 0,
    maxTtkMs: ttks[ttks.length - 1] ?? 0,
    medianTtkMs: ttks[Math.floor(ttks.length / 2)] ?? 0,
    avgBtk: avgBtk,
    minBtk: btks[0] ?? 0,
    maxBtk: btks[btks.length - 1] ?? 0,
    killProbability: runs > 0 ? kills / runs : 0,
    avgDamagePerShot: avgDmg,
    theoreticalMaxDps: theoMaxDps,
    effectiveDps: effDps,
  };
}

// ============================================================================
// 1v1 교전 시뮬 (A vs B)
// ============================================================================

export function simulateFpsDuel(
  weaponA: WeaponStats,
  aimA: AimProfile,
  weaponB: WeaponStats,
  aimB: AimProfile,
  playerA: PlayerStats,
  playerB: PlayerStats,
  engagement: FpsEngagement,
  runs = 10_000,
): FpsDuelResult {
  let aWins = 0;
  let bWins = 0;
  let draws = 0;
  const durations: number[] = [];
  const aTtk: number[] = [];
  const bTtk: number[] = [];

  const intervalA = 60_000 / weaponA.rpm;
  const intervalB = 60_000 / weaponB.rpm;

  for (let run = 0; run < runs; run++) {
    // 첫발 타이밍
    let aStartMs: number;
    let bStartMs: number;
    if (engagement.firstShot === 'A') {
      aStartMs = aimA.reactionMs;
      bStartMs = aimA.reactionMs + engagement.bothAwareDelayMs + aimB.reactionMs;
    } else if (engagement.firstShot === 'B') {
      bStartMs = aimB.reactionMs;
      aStartMs = aimB.reactionMs + engagement.bothAwareDelayMs + aimA.reactionMs;
    } else {
      // 둘 다 인지 — reaction + 동시 ADS
      aStartMs = aimA.reactionMs + engagement.bothAwareDelayMs;
      bStartMs = aimB.reactionMs + engagement.bothAwareDelayMs;
    }

    let aHp = playerA.hp + playerA.shield;
    let bHp = playerB.hp + playerB.shield;
    let aNext = aStartMs;
    let bNext = bStartMs;
    let aShots = 0;     // 현재 탄창 내 shot index (recoil 계산용)
    let bShots = 0;
    let aTotalFired = 0;
    let bTotalFired = 0;
    let winnerA = false;
    let winnerB = false;

    // 탄창 2개 소진할 때까지 (대부분 훨씬 전에 끝남)
    while (aTotalFired < weaponA.magazineSize * 2 && bTotalFired < weaponB.magazineSize * 2) {
      if (aNext <= bNext) {
        // A 가 먼저 발사
        const { damage } = rollShotDamage(weaponA, playerB, engagement.distance, aimA, aShots, !!engagement.aMoving);
        aShots++;
        aTotalFired++;
        bHp -= damage;
        if (bHp <= 0) {
          aTtk.push(aNext);
          durations.push(aNext);
          winnerA = true;
          break;
        }
        aNext += intervalA;
        // 탄창 끝 → reload 시간 후 shotIndex 리셋 (reload 중 취약 창)
        if (aShots >= weaponA.magazineSize) {
          aNext += weaponA.reloadTimeSeconds * 1000;
          aShots = 0;
        }
      } else {
        const { damage } = rollShotDamage(weaponB, playerA, engagement.distance, aimB, bShots, !!engagement.bMoving);
        bShots++;
        bTotalFired++;
        aHp -= damage;
        if (aHp <= 0) {
          bTtk.push(bNext);
          durations.push(bNext);
          winnerB = true;
          break;
        }
        bNext += intervalB;
        if (bShots >= weaponB.magazineSize) {
          bNext += weaponB.reloadTimeSeconds * 1000;
          bShots = 0;
        }
      }
    }

    if (winnerA) aWins++;
    else if (winnerB) bWins++;
    else draws++;
  }

  const avgDur = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

  return {
    aWinRate: aWins / runs,
    bWinRate: bWins / runs,
    drawRate: draws / runs,
    avgDurationMs: avgDur,
    aTtkSamples: aTtk,
    bTtkSamples: bTtk,
  };
}

// ============================================================================
// 거리별 Effective DPS 곡선 (차트용)
// ============================================================================

export interface DpsCurvePoint {
  distance: number;
  effectiveDps: number;
  avgDamagePerShot: number;
}

export function calculateDpsCurve(
  weapon: WeaponStats,
  target: PlayerStats,
  aim: AimProfile,
  distances: number[],
): DpsCurvePoint[] {
  return distances.map((d) => {
    const rangeMul = rangeMultiplier(weapon, d);
    const armorMul = armorDamageMultiplier(target.armor, weapon.armorPenPercent);
    // 기대 피해 = hit% × (head% × dmgHead + body% × dmgBody + limb% × dmgLimb)
    const limbRate = Math.max(0, 1 - aim.headshotRate - aim.bodyRate);
    const expectedDmgPerShot =
      aim.hitRate *
      (aim.headshotRate * weapon.damageHead +
        aim.bodyRate * weapon.damageBody +
        limbRate * weapon.damageLimb) *
      rangeMul *
      armorMul;
    return {
      distance: d,
      avgDamagePerShot: expectedDmgPerShot,
      effectiveDps: (expectedDmgPerShot * weapon.rpm) / 60,
    };
  });
}

// ============================================================================
// 기본 무기 프리셋 (사용자 시작점)
// ============================================================================

// 실제 게임 밸런싱 문서 기반 근사치 (Apex R-301/Volt/Longbow/Peacekeeper · CoD MP5 · Valorant Vandal 참고).
export const WEAPON_PRESETS: WeaponStats[] = [
  {
    id: 'assault',
    name: 'Assault Rifle',
    damageHead: 40,
    damageBody: 25,
    damageLimb: 18,
    rpm: 600,
    magazineSize: 30,
    reloadTimeSeconds: 2.2,
    adsTimeSeconds: 0.25,
    rangeFalloffStart: 25,
    rangeFalloffEnd: 60,
    falloffDamageMultiplier: 0.6,
    armorPenPercent: 0.2,
    firstShotAccuracyBonus: 0.1,
    recoilIntensity: 0.5,
    movingAccuracyPenalty: 0.3,
  },
  {
    id: 'smg',
    name: 'SMG',
    damageHead: 25,
    damageBody: 18,
    damageLimb: 12,
    rpm: 900,
    magazineSize: 40,
    reloadTimeSeconds: 1.8,
    adsTimeSeconds: 0.15,
    rangeFalloffStart: 10,
    rangeFalloffEnd: 35,
    falloffDamageMultiplier: 0.4,
    armorPenPercent: 0.1,
    firstShotAccuracyBonus: 0.05,
    recoilIntensity: 0.7,
    movingAccuracyPenalty: 0.15,
  },
  {
    id: 'dmr',
    name: 'DMR',
    damageHead: 90,
    damageBody: 55,
    damageLimb: 30,
    rpm: 280,
    magazineSize: 15,
    reloadTimeSeconds: 2.5,
    adsTimeSeconds: 0.35,
    rangeFalloffStart: 50,
    rangeFalloffEnd: 120,
    falloffDamageMultiplier: 0.8,
    armorPenPercent: 0.4,
    firstShotAccuracyBonus: 0.2,
    recoilIntensity: 0.3,
    movingAccuracyPenalty: 0.5,
  },
  {
    id: 'shotgun',
    name: 'Shotgun',
    damageHead: 120,
    damageBody: 80,
    damageLimb: 50,
    rpm: 80,
    magazineSize: 6,
    reloadTimeSeconds: 0.7,
    adsTimeSeconds: 0.2,
    rangeFalloffStart: 5,
    rangeFalloffEnd: 20,
    falloffDamageMultiplier: 0.15,
    armorPenPercent: 0.3,
    firstShotAccuracyBonus: 0.05,
    recoilIntensity: 0.2,
    movingAccuracyPenalty: 0.1,
  },
];
