/**
 * MOBA 라인전 시뮬 — League of Legends / Dota 2 / Wild Rift 밸런싱.
 *
 * 핵심 지표 (Riot Developer blog / Dota 2 patch notes 기준):
 *  - CS per minute (Creep Score) — 라인 farm 효율
 *  - Gold lead at minute N — 라인전 승/패 정량화
 *  - XP lead — 레벨 차이
 *  - Kill participation — 1v1 / 2v1 / 2v2 교환 승률
 *  - Wave 관리 — 밀림/얼림 상태에 따른 위험도
 *
 * 모델:
 *  - 라인 병사 웨이브: 30s 간격 캐스터 3 + 전사 3 + (3분마다) 캐논 1
 *  - CS 하나당 골드 약 15-65, 경험치 약 35-80 (LoL 2024 기준 근사)
 *  - 챔피언 라인전 스탯: baseStats + perLevel 증가
 *  - 교환(trade) 승률: 라이프·스킬·포지셔닝·하라스 dps 로 계산
 */

export interface LaneChampion {
  id: string;
  name: string;
  role: 'top' | 'mid' | 'bot-adc' | 'bot-sup' | 'jungle';
  /** 레벨 1 HP (LoL 평균 ~570, Dota ~600) */
  baseHp: number;
  /** 레벨당 HP 증가 */
  hpPerLevel: number;
  /** 레벨 1 공격력 (LoL AD 평균 ~60) */
  baseAd: number;
  /** 레벨당 AD 증가 */
  adPerLevel: number;
  /** 스킬 dmg per rank (레벨당 상승분 포함) — 교환 시 Q/W 한방 */
  abilityDamage: number;
  /** 스킬 쿨다운 (초) */
  abilityCooldown: number;
  /** 마나/에너지 소모 — 단순화를 위해 교환 제한 횟수로 */
  abilityCostRatio: number;  // 0-1, maxMana 대비
  /** CS 실력 — 막차 (last hit) 성공률 0-1 */
  csSkill: number;
  /** 라인 공격형/방어형 — 공격적일수록 하라스 잦음 */
  aggression: number; // 0-1
  /** 포크/올인 성향 — 교환 vs 올인 trade-off */
  allInTendency: number; // 0-1
}

/**
 * 미니언 웨이브 구성 (LoL 2024 기준 근사):
 *  - 1:05 부터 30s 간격 웨이브 생성
 *  - 구성: 전사 3 (caster 3, melee 3) — 초기 3 멜리 + 3 캐스터 (순서 다를 수 있음)
 *  - 3분 간격 캐논 미니언 1 포함 (첫 캐논 = 3:15)
 *  - 15분부터 super minion (inhib 깬 후) — 단순화 생략
 *
 * 우린 단일 웨이브 단순 모델 사용 — 6 미니언 / 웨이브 기준
 */
export const MINION_GOLD = {
  melee: 21,
  caster: 14,
  cannon: 58,
  /** 레벨 시간대별 골드 성장 — LoL 은 분당 +0.0015 * time (약 2% per min) */
  timeGrowthPerSecond: 0.000025,
};

export const MINION_XP = {
  melee: 58.88,
  caster: 29.44,
  cannon: 92,
};

export interface LaneSimConfig {
  /** 블루팀 챔피언 */
  blue: LaneChampion;
  /** 레드팀 챔피언 */
  red: LaneChampion;
  /** 라인 유형 — 솔로(1v1) vs 듀오(2v2 서폿 포함) vs 2v1 */
  laneType: '1v1' | '2v2';
  /** 서폿 (2v2 전용) */
  blueSupport?: LaneChampion;
  redSupport?: LaneChampion;
  /** 시뮬 지속 시간 (초) — 보통 라인전은 14분 (840초) */
  durationSec: number;
  /** 웨이브 당 미니언 수 (기본 6) */
  minionsPerWave: number;
  /** 웨이브 간격 (초, 기본 30) */
  waveIntervalSec: number;
  /** 캐논 간격 (웨이브 수) */
  cannonEveryNWaves: number;
}

export interface LaneSample {
  timeSec: number;
  blueGold: number;
  redGold: number;
  blueXp: number;
  redXp: number;
  blueCs: number;
  redCs: number;
  blueLevel: number;
  redLevel: number;
}

export interface LaneSimResult {
  samples: LaneSample[];
  /** 최종 골드 리드 (양수 = blue 유리) */
  finalGoldDiff: number;
  finalXpDiff: number;
  finalLevelDiff: number;
  /** 교환 시뮬 — 1v1 올인 승률 (현재 스탯 기준) */
  blueAllInWinRate: number;
  /** 핵심 타이밍 — 1코어 아이템 (약 1300 gold) 도달 시간 (초) */
  blueTimeToFirstItem: number;
  redTimeToFirstItem: number;
  /** 정량화된 라인 우세 점수 (-100 ~ +100, 0 = 호각) */
  laneDominanceScore: number;
}

// ============================================================================
// XP → 레벨 (LoL 2024 기준 누적 테이블)
// LoL 은 1→2: 280xp / 18→18(max): 16,480xp cumulative
// 단순화: 레벨 L 필요 경험치 = 100 + L*80
// ============================================================================

export function xpToLevel(xp: number): number {
  let level = 1;
  let total = 0;
  while (level < 18) {
    const needed = 100 + level * 80;
    if (xp < total + needed) break;
    total += needed;
    level++;
  }
  return level;
}

// ============================================================================
// 올인 교환 승률 — 단순 DPS race (HP / (enemyDamagePerSec))
// ============================================================================

function championStatsAtLevel(champ: LaneChampion, level: number): { hp: number; ad: number; ability: number } {
  return {
    hp: champ.baseHp + champ.hpPerLevel * (level - 1),
    ad: champ.baseAd + champ.adPerLevel * (level - 1),
    ability: champ.abilityDamage * (1 + 0.2 * (level - 1)), // 랭크 오르면 20% 씩 증가
  };
}

export function simulateAllIn(
  blue: LaneChampion,
  red: LaneChampion,
  blueLevel: number,
  redLevel: number,
  runs = 1000,
): number {
  const b = championStatsAtLevel(blue, blueLevel);
  const r = championStatsAtLevel(red, redLevel);

  // 단순 dps: AD * attackSpeed (고정 0.7) + ability / cooldown
  const bDps = b.ad * 0.7 + b.ability / blue.abilityCooldown;
  const rDps = r.ad * 0.7 + r.ability / red.abilityCooldown;

  let blueWins = 0;
  for (let i = 0; i < runs; i++) {
    // 포지셔닝 난수: allInTendency 높은 쪽이 선공 advantage
    const blueFirst = Math.random() < (0.5 + (blue.allInTendency - red.allInTendency) * 0.3);
    const bAdvantage = blueFirst ? 1.15 : 1;
    const rAdvantage = blueFirst ? 1 : 1.15;

    // 라이프 레이스: time_to_kill
    const bTtk = r.hp / (bDps * bAdvantage);
    const rTtk = b.hp / (rDps * rAdvantage);
    if (bTtk < rTtk) blueWins++;
    else if (Math.abs(bTtk - rTtk) < 0.1 && Math.random() < 0.5) blueWins++;
  }
  return blueWins / runs;
}

// ============================================================================
// 메인 시뮬 — 웨이브 단위 CS + gold + xp 누적
// ============================================================================

export function simulateLaning(cfg: LaneSimConfig): LaneSimResult {
  const samples: LaneSample[] = [];
  let blueGold = 500;  // 시작 골드
  let redGold = 500;
  let blueXp = 0;
  let redXp = 0;
  let blueCs = 0;
  let redCs = 0;

  let waveIdx = 0;
  const sampleEvery = 15; // 15초마다 샘플
  let blueTimeToFirstItem = -1;
  let redTimeToFirstItem = -1;

  for (let t = 0; t <= cfg.durationSec; t += sampleEvery) {
    // 이 tick 까지 일어난 웨이브 수
    const newWaves = Math.floor((t - 65) / cfg.waveIntervalSec) - waveIdx + 1;
    for (let w = 0; w < newWaves && t >= 65; w++) {
      waveIdx++;
      const hasCannon = waveIdx % cfg.cannonEveryNWaves === 0;
      const minions = cfg.minionsPerWave; // melee + caster
      const timeGrowth = 1 + MINION_GOLD.timeGrowthPerSecond * t;

      // CS 분배: 양쪽 csSkill 비율로 미니언 획득
      const totalSkill = cfg.blue.csSkill + cfg.red.csSkill;
      const blueShareRaw = totalSkill > 0 ? cfg.blue.csSkill / totalSkill : 0.5;
      // aggression 이 높으면 상대 pushing off — csShare 증폭
      const blueShare = Math.max(0.2, Math.min(0.8, blueShareRaw + (cfg.blue.aggression - cfg.red.aggression) * 0.1));

      const blueMinions = Math.round(minions * blueShare);
      const redMinions = minions - blueMinions;
      // 미니언 구성 가정: 절반 melee 절반 caster
      const cannonHereForBlue = hasCannon && blueShare >= 0.5 ? 1 : 0;
      const cannonHereForRed = hasCannon && blueShare < 0.5 ? 1 : 0;

      const blueGoldGain =
        Math.round(blueMinions / 2) * MINION_GOLD.melee * timeGrowth +
        Math.round(blueMinions / 2) * MINION_GOLD.caster * timeGrowth +
        cannonHereForBlue * MINION_GOLD.cannon * timeGrowth;
      const redGoldGain =
        Math.round(redMinions / 2) * MINION_GOLD.melee * timeGrowth +
        Math.round(redMinions / 2) * MINION_GOLD.caster * timeGrowth +
        cannonHereForRed * MINION_GOLD.cannon * timeGrowth;

      const blueXpGain =
        Math.round(blueMinions / 2) * MINION_XP.melee +
        Math.round(blueMinions / 2) * MINION_XP.caster +
        cannonHereForBlue * MINION_XP.cannon;
      const redXpGain =
        Math.round(redMinions / 2) * MINION_XP.melee +
        Math.round(redMinions / 2) * MINION_XP.caster +
        cannonHereForRed * MINION_XP.cannon;

      blueGold += blueGoldGain;
      redGold += redGoldGain;
      blueXp += blueXpGain;
      redXp += redXpGain;
      blueCs += blueMinions + cannonHereForBlue;
      redCs += redMinions + cannonHereForRed;
    }

    // 시간당 passive gold (LoL 은 초당 2.04)
    blueGold += 2.04 * sampleEvery;
    redGold += 2.04 * sampleEvery;

    if (blueTimeToFirstItem < 0 && blueGold >= 1300) blueTimeToFirstItem = t;
    if (redTimeToFirstItem < 0 && redGold >= 1300) redTimeToFirstItem = t;

    samples.push({
      timeSec: t,
      blueGold: Math.round(blueGold),
      redGold: Math.round(redGold),
      blueXp: Math.round(blueXp),
      redXp: Math.round(redXp),
      blueCs,
      redCs,
      blueLevel: xpToLevel(blueXp),
      redLevel: xpToLevel(redXp),
    });
  }

  const finalSample = samples[samples.length - 1];
  const blueAllInWinRate = simulateAllIn(
    cfg.blue, cfg.red,
    finalSample.blueLevel, finalSample.redLevel,
    500,
  );

  // 라인 우세 점수 = gold diff 정규화 + xp diff 정규화 + allin 승률 편차
  const goldDiff = finalSample.blueGold - finalSample.redGold;
  const xpDiff = finalSample.blueXp - finalSample.redXp;
  const goldComponent = Math.max(-50, Math.min(50, goldDiff / 20)); // 1000 gold 차이 = 50
  const xpComponent = Math.max(-30, Math.min(30, xpDiff / 30));
  const allInComponent = (blueAllInWinRate - 0.5) * 40; // ±20
  const laneDominanceScore = Math.max(-100, Math.min(100, goldComponent + xpComponent + allInComponent));

  return {
    samples,
    finalGoldDiff: goldDiff,
    finalXpDiff: xpDiff,
    finalLevelDiff: finalSample.blueLevel - finalSample.redLevel,
    blueAllInWinRate,
    blueTimeToFirstItem: blueTimeToFirstItem < 0 ? cfg.durationSec : blueTimeToFirstItem,
    redTimeToFirstItem: redTimeToFirstItem < 0 ? cfg.durationSec : redTimeToFirstItem,
    laneDominanceScore,
  };
}

// ============================================================================
// 프리셋 — LoL 2024 meta 챔피언 근사
// ============================================================================

export const CHAMPION_PRESETS: LaneChampion[] = [
  {
    id: 'sett', name: 'Sett (탱커 브루저)', role: 'top',
    baseHp: 630, hpPerLevel: 101, baseAd: 60, adPerLevel: 3.5,
    abilityDamage: 50, abilityCooldown: 6, abilityCostRatio: 0.2,
    csSkill: 0.85, aggression: 0.7, allInTendency: 0.85,
  },
  {
    id: 'yasuo', name: 'Yasuo (어쌔신)', role: 'mid',
    baseHp: 590, hpPerLevel: 110, baseAd: 60, adPerLevel: 3.2,
    abilityDamage: 55, abilityCooldown: 4, abilityCostRatio: 0,
    csSkill: 0.9, aggression: 0.8, allInTendency: 0.9,
  },
  {
    id: 'jinx', name: 'Jinx (마크스맨)', role: 'bot-adc',
    baseHp: 610, hpPerLevel: 100, baseAd: 57, adPerLevel: 3.3,
    abilityDamage: 45, abilityCooldown: 7, abilityCostRatio: 0.3,
    csSkill: 0.88, aggression: 0.5, allInTendency: 0.4,
  },
  {
    id: 'thresh', name: 'Thresh (엔게이지 서폿)', role: 'bot-sup',
    baseHp: 570, hpPerLevel: 105, baseAd: 55, adPerLevel: 2.8,
    abilityDamage: 60, abilityCooldown: 9, abilityCostRatio: 0.4,
    csSkill: 0.1, aggression: 0.6, allInTendency: 0.7,
  },
  {
    id: 'orianna', name: 'Orianna (컨트롤 메이지)', role: 'mid',
    baseHp: 540, hpPerLevel: 95, baseAd: 48, adPerLevel: 2.5,
    abilityDamage: 70, abilityCooldown: 5, abilityCostRatio: 0.3,
    csSkill: 0.85, aggression: 0.45, allInTendency: 0.3,
  },
  {
    id: 'garen', name: 'Garen (스킬 브루저)', role: 'top',
    baseHp: 690, hpPerLevel: 105, baseAd: 66, adPerLevel: 4.5,
    abilityDamage: 45, abilityCooldown: 8, abilityCostRatio: 0,
    csSkill: 0.8, aggression: 0.6, allInTendency: 0.8,
  },
];
