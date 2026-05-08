/**
 * Horde/Survivor 시뮬 — Vampire Survivors / Brotato / Halls of Torment.
 *
 * 핵심 지표:
 *  - DPS per weapon + synergy (evolution)
 *  - Enemy spawn wave 밀도 (단위 시간 per density)
 *  - XP 곡선 + level-up 속도
 *  - 생존 시간 / 도달 가능 wave
 *  - 빌드 효율 — 무기 6개 slot 최적화
 *
 * 모델:
 *  - 시간 tick (1초). 매 tick 마다 enemies 스폰, 플레이어 DPS 적 제거
 *  - Enemy density: t 분 째 = base * (1 + t * growth) — Vampire Survivors 스케일
 *  - Player DPS: sum(weapons * level * synergy)
 *  - HP 감소: enemy density > player DPS → overflow 가 플레이어 HP 에 접촉
 */

export interface Weapon {
  id: string;
  name: string;
  /** 기본 DPS (1 레벨) */
  baseDps: number;
  /** 레벨당 DPS 증가 (선형) */
  dpsPerLevel: number;
  /** 최대 레벨 (Vampire Survivors = 8) */
  maxLevel: number;
  /** 무기 속성 — evolution 시너지용 */
  element?: 'physical' | 'fire' | 'ice' | 'lightning' | 'holy' | 'poison';
  /** 유사 속성과 함께 들고 있을 때 synergy 배율 */
  synergyMul?: number;
  /** 에어리어 — AoE 이면 overflow 감당 능력 ↑ */
  isAoe?: boolean;
}

export interface HordeSurvivorConfig {
  weapons: Array<{ weapon: Weapon; level: number }>;
  /** 시작 HP (Vampire Survivors 기본 100) */
  startingHp: number;
  /** HP 리젠 per sec */
  hpRegen: number;
  /** 체력 보정 (armor) 0-1, 받는 피해 감소 */
  armor: number;
  /** 이동 속도 (1.0 기본) — 빠르면 overflow 회피 ↑ */
  moveSpeed: number;
  /** 시뮬 최대 시간 (초). Vampire Survivors 1 게임 = 30분 = 1800초 */
  maxDurationSec: number;
  /** 시작 적 밀도 (per sec spawn 가능 수) */
  baseEnemyDensity: number;
  /** 분당 밀도 증가 */
  densityGrowthPerMin: number;
  /** 적 평균 HP (레벨 따라 증가) */
  baseEnemyHp: number;
  enemyHpGrowthPerMin: number;
  /** 적 평균 공격력 */
  enemyDamage: number;
  /** 경험치 곡선 — L 레벨에 필요 XP = base + L*slope */
  xpBase: number;
  xpSlope: number;
  /** 적 처치당 XP 획득 */
  xpPerKill: number;
}

export interface HordeSurvivorSample {
  timeSec: number;
  playerHp: number;
  playerLevel: number;
  playerDps: number;
  enemyDensity: number;
  enemyHp: number;
  killsPerSec: number;
  overflow: number;  // 처치 못 하고 넘친 적 수 / 초
}

export interface HordeSurvivorResult {
  samples: HordeSurvivorSample[];
  survivedSec: number;
  maxLevel: number;
  totalKills: number;
  /** 도달한 최대 overflow 지점 */
  crisisPeakSec: number;
  /** 피크 시점 DPS */
  peakDps: number;
  /** 평균 kill rate (per sec) */
  avgKillsPerSec: number;
  survived: boolean;  // duration 까지 생존 성공
}

// ============================================================================
// 무기 시너지 계산 — 같은 속성 2개 이상 있으면 synergyMul 적용
// ============================================================================

function calculateDps(weapons: HordeSurvivorConfig['weapons'], playerLevel: number): number {
  const elementCounts = new Map<string, number>();
  for (const w of weapons) {
    if (w.weapon.element) {
      elementCounts.set(w.weapon.element, (elementCounts.get(w.weapon.element) ?? 0) + 1);
    }
  }

  // 플레이어 레벨 당 +3% 데미지 전체 보너스 (Vampire Survivors Might 스탯 근사)
  const levelMul = 1 + (playerLevel - 1) * 0.03;

  let totalDps = 0;
  for (const { weapon, level } of weapons) {
    const baseDps = weapon.baseDps + weapon.dpsPerLevel * (level - 1);
    const synergyCount = weapon.element ? elementCounts.get(weapon.element) ?? 0 : 0;
    const synergyMul = synergyCount >= 2 ? (weapon.synergyMul ?? 1.3) : 1;
    totalDps += baseDps * synergyMul * levelMul;
  }
  return totalDps;
}

// ============================================================================
// 메인 시뮬
// ============================================================================

export function simulateHordeSurvivor(cfg: HordeSurvivorConfig): HordeSurvivorResult {
  const samples: HordeSurvivorSample[] = [];
  let hp = cfg.startingHp;
  let level = 1;
  let xp = 0;
  let totalKills = 0;
  let crisisPeakOverflow = 0;
  let crisisPeakSec = 0;
  let peakDps = 0;
  let totalKillRate = 0;

  const sampleEvery = 10; // 10초마다
  const tickSec = 1;

  for (let t = 0; t <= cfg.maxDurationSec; t += tickSec) {
    if (hp <= 0) break;

    const minute = t / 60;
    const enemyDensity = cfg.baseEnemyDensity * (1 + minute * cfg.densityGrowthPerMin);
    const enemyHp = cfg.baseEnemyHp * (1 + minute * cfg.enemyHpGrowthPerMin);
    const dps = calculateDps(cfg.weapons, level);
    peakDps = Math.max(peakDps, dps);

    // killsPerSec = dps / enemyHp (근사)
    const killsPerSec = Math.min(enemyDensity, dps / Math.max(1, enemyHp));
    totalKills += killsPerSec * tickSec;
    totalKillRate += killsPerSec;

    // XP 획득
    xp += killsPerSec * tickSec * cfg.xpPerKill;
    while (xp >= cfg.xpBase + level * cfg.xpSlope) {
      xp -= cfg.xpBase + level * cfg.xpSlope;
      level++;
    }

    // Overflow: 처치 못 하고 접근한 적
    const overflow = Math.max(0, enemyDensity - killsPerSec);
    if (overflow > crisisPeakOverflow) {
      crisisPeakOverflow = overflow;
      crisisPeakSec = t;
    }

    // HP 처리: overflow × 적 공격력 × (1 - armor) × moveSpeed 회피
    const evasionMul = Math.max(0.2, 1 / cfg.moveSpeed);
    const dmgIn = overflow * cfg.enemyDamage * (1 - cfg.armor) * evasionMul * tickSec;
    hp -= dmgIn;
    hp += cfg.hpRegen * tickSec;
    hp = Math.min(cfg.startingHp, hp);

    if (t % sampleEvery === 0) {
      samples.push({
        timeSec: t,
        playerHp: Math.max(0, Math.round(hp * 10) / 10),
        playerLevel: level,
        playerDps: Math.round(dps),
        enemyDensity: Math.round(enemyDensity * 10) / 10,
        enemyHp: Math.round(enemyHp),
        killsPerSec: Math.round(killsPerSec * 10) / 10,
        overflow: Math.round(overflow * 10) / 10,
      });
    }
  }

  const survivedSec = samples.length > 0 ? samples[samples.length - 1].timeSec : 0;
  const avgKillsPerSec = survivedSec > 0 ? totalKillRate / survivedSec : 0;

  return {
    samples,
    survivedSec,
    maxLevel: level,
    totalKills: Math.round(totalKills),
    crisisPeakSec,
    peakDps,
    avgKillsPerSec,
    survived: hp > 0 && survivedSec >= cfg.maxDurationSec,
  };
}

// ============================================================================
// 빌드 평가 — 6 무기 조합 vs 다른 6 무기
// ============================================================================

export interface BuildEvaluation {
  dpsAt10min: number;
  dpsAt20min: number;
  dpsAt30min: number;
  synergyBonus: number;  // 전체 DPS / synergy 미적용 DPS
  /** 종합 점수 (0-100) */
  score: number;
}

export function evaluateBuild(
  weapons: HordeSurvivorConfig['weapons'],
  playerLevelAtTime: (sec: number) => number = (sec) => 1 + Math.floor(sec / 30),
): BuildEvaluation {
  // Level 은 시간에 따라 증가한다고 가정
  const dps600 = calculateDps(weapons, playerLevelAtTime(600));
  const dps1200 = calculateDps(weapons, playerLevelAtTime(1200));
  const dps1800 = calculateDps(weapons, playerLevelAtTime(1800));

  // synergy 미적용 baseline
  const baseline = weapons.reduce(
    (s, { weapon, level }) => s + (weapon.baseDps + weapon.dpsPerLevel * (level - 1)),
    0,
  );
  const synergyBonus = baseline > 0 ? dps1200 / baseline : 1;

  // 점수: 1200s 지점 DPS 로그 정규화 × synergy
  const score = Math.min(100, Math.max(0, Math.round(Math.log10(Math.max(1, dps1200)) * 20 + (synergyBonus - 1) * 100)));

  return { dpsAt10min: dps600, dpsAt20min: dps1200, dpsAt30min: dps1800, synergyBonus, score };
}

// ============================================================================
// 기본 무기 프리셋 — Vampire Survivors 영감
// ============================================================================

export const WEAPON_PRESETS: Weapon[] = [
  { id: 'whip',         name: '채찍',        baseDps: 20,  dpsPerLevel: 8,  maxLevel: 8, element: 'physical', synergyMul: 1.2, isAoe: false },
  { id: 'magic-wand',   name: '매직 완드',   baseDps: 18,  dpsPerLevel: 10, maxLevel: 8, element: 'physical', synergyMul: 1.2, isAoe: false },
  { id: 'garlic',       name: '마늘',        baseDps: 12,  dpsPerLevel: 6,  maxLevel: 8, element: 'physical', synergyMul: 1.2, isAoe: true },
  { id: 'knife',        name: '단검',        baseDps: 25,  dpsPerLevel: 9,  maxLevel: 8, element: 'physical', synergyMul: 1.2, isAoe: false },
  { id: 'fireball',     name: '파이어볼',    baseDps: 22,  dpsPerLevel: 11, maxLevel: 8, element: 'fire',     synergyMul: 1.4, isAoe: true  },
  { id: 'fire-wand',    name: '불꽃 완드',   baseDps: 20,  dpsPerLevel: 10, maxLevel: 8, element: 'fire',     synergyMul: 1.4, isAoe: false },
  { id: 'ice-shard',    name: '얼음 파편',   baseDps: 18,  dpsPerLevel: 9,  maxLevel: 8, element: 'ice',      synergyMul: 1.3, isAoe: true  },
  { id: 'lightning',    name: '번개',        baseDps: 30,  dpsPerLevel: 14, maxLevel: 8, element: 'lightning',synergyMul: 1.5, isAoe: true  },
  { id: 'cross',        name: '성스러운 십자가', baseDps: 15, dpsPerLevel: 7, maxLevel: 8, element: 'holy',   synergyMul: 1.3, isAoe: true  },
  { id: 'poison-vial',  name: '독병',        baseDps: 10,  dpsPerLevel: 8,  maxLevel: 8, element: 'poison',   synergyMul: 1.4, isAoe: true  },
];

export function defaultHordeConfig(): HordeSurvivorConfig {
  return {
    weapons: [
      { weapon: WEAPON_PRESETS[0], level: 1 },
      { weapon: WEAPON_PRESETS[1], level: 1 },
      { weapon: WEAPON_PRESETS[4], level: 1 },
    ],
    startingHp: 100,
    hpRegen: 0.5,
    armor: 0,
    moveSpeed: 1.0,
    maxDurationSec: 1800,
    baseEnemyDensity: 2,
    densityGrowthPerMin: 0.3,
    baseEnemyHp: 10,
    enemyHpGrowthPerMin: 0.15,
    enemyDamage: 1.5,
    xpBase: 10,
    xpSlope: 5,
    xpPerKill: 1,
  };
}
