/**
 * 몬테카를로 시뮬레이션 엔진
 * 대량 반복 실행 및 통계 분석
 */

import type {
  UnitStats,
  Skill,
  BattleConfig,
  BattleResult,
  SimulationResult,
  SimulationOptions,
  SkillUsageStats,
} from './types';
import { simulateBattle, simulateBattleWithSkills } from './battleEngine';

/**
 * 배틀 로그에서 스킬 통계 추출
 */
function extractSkillStatsFromBattle(
  result: BattleResult,
  unit1Name: string,
  unit2Name: string
): { unit1: Map<string, { uses: number; damage: number; healing: number }>; unit2: Map<string, { uses: number; damage: number; healing: number }> } {
  const unit1Skills = new Map<string, { uses: number; damage: number; healing: number }>();
  const unit2Skills = new Map<string, { uses: number; damage: number; healing: number }>();

  for (const entry of result.log) {
    if (entry.action === 'skill' || entry.action === 'heal') {
      const skillName = entry.skillName || 'Unknown';
      const isUnit1 = entry.actor === unit1Name;
      const skillMap = isUnit1 ? unit1Skills : unit2Skills;

      if (!skillMap.has(skillName)) {
        skillMap.set(skillName, { uses: 0, damage: 0, healing: 0 });
      }
      const stats = skillMap.get(skillName)!;
      stats.uses++;
      if (entry.damage) stats.damage += entry.damage;
      if (entry.healAmount) stats.healing += entry.healAmount;
    } else if (entry.action === 'hot_tick') {
      const skillName = entry.skillName || 'HoT';
      const isUnit1 = entry.actor === unit1Name;
      const skillMap = isUnit1 ? unit1Skills : unit2Skills;

      if (!skillMap.has(skillName)) {
        skillMap.set(skillName, { uses: 0, damage: 0, healing: 0 });
      }
      const stats = skillMap.get(skillName)!;
      if (entry.healAmount) stats.healing += entry.healAmount;
    }
  }

  return { unit1: unit1Skills, unit2: unit2Skills };
}

// 기본 설정
const DEFAULT_OPTIONS: SimulationOptions = {
  runs: 10000,
  config: {
    maxDuration: 300,
    timeStep: 0.1,
    damageFormula: 'simple',
  },
  saveSampleBattles: 10,
};

/**
 * 신뢰 구간 계산 (Wilson score interval)
 */
function calculateConfidenceInterval(
  wins: number,
  total: number,
  confidence: number = 0.95
): { lower: number; upper: number } {
  if (total === 0) return { lower: 0, upper: 0 };

  const z = confidence === 0.95 ? 1.96 : confidence === 0.99 ? 2.576 : 1.645;
  const p = wins / total;
  const n = total;

  const denominator = 1 + (z * z) / n;
  const center = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * n)) / n);

  return {
    lower: Math.max(0, (center - margin) / denominator),
    upper: Math.min(1, (center + margin) / denominator),
  };
}

/**
 * 히스토그램 생성 (빈 개수 자동 계산)
 */
function createHistogram(data: number[], binCount: number = 20): number[] {
  if (data.length === 0) return [];

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const binSize = range / binCount;

  const histogram = new Array(binCount).fill(0);

  for (const value of data) {
    const binIndex = Math.min(binCount - 1, Math.floor((value - min) / binSize));
    histogram[binIndex]++;
  }

  return histogram;
}

/**
 * Web Worker용 시뮬레이션 (메인 스레드 블로킹 방지)
 */
export async function runMonteCarloSimulationAsync(
  unit1: UnitStats,
  unit2: UnitStats,
  skills1: Skill[] = [],
  skills2: Skill[] = [],
  options: Partial<SimulationOptions> = {}
): Promise<SimulationResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { runs, onProgress } = opts;

  // 청크 단위로 실행 (UI 블로킹 방지)
  const chunkSize = 1000;
  const chunks = Math.ceil(runs / chunkSize);

  let unit1Wins = 0;
  let unit2Wins = 0;
  let draws = 0;

  const durations: number[] = [];
  const unit1Damages: number[] = [];
  const unit2Damages: number[] = [];
  const unit1SurvivalHps: number[] = [];
  const unit2SurvivalHps: number[] = [];
  const unit1TTKs: number[] = [];
  const unit2TTKs: number[] = [];
  const sampleBattles: BattleResult[] = [];

  // 치명타 및 역전 통계
  let unit1TotalCrits = 0;
  let unit1TotalHits = 0;
  let unit2TotalCrits = 0;
  let unit2TotalHits = 0;
  let unit1Reversals = 0;
  let unit2Reversals = 0;
  let critCausedReversals = 0;
  let closeMatches = 0;

  // 스킬 통계 누적
  const unit1SkillStats = new Map<string, { uses: number; damage: number; healing: number }>();
  const unit2SkillStats = new Map<string, { uses: number; damage: number; healing: number }>();
  let unit1TotalHealing = 0;
  let unit2TotalHealing = 0;

  // 유효 전투력 계산 (HP, DPS, 크리티컬, 명중, 회피, 스킬 모두 반영)
  const calcEffectivePower = (unit: UnitStats, skills: Skill[], enemyEvasion: number, battleDuration: number = 30) => {
    const critMultiplier = 1 + (unit.critRate || 0) * ((unit.critDamage || 1.5) - 1);
    const hitRate = Math.max(0, Math.min(1, (unit.accuracy ?? 1) - enemyEvasion));

    // 기본 DPS
    let effectiveDps = unit.atk * unit.speed * critMultiplier * hitRate;

    // 스킬 DPS 추가
    let skillDps = 0;
    let totalHealing = 0;
    let hasInvincible = false;
    let invincibleDuration = 0;
    let hasSelfRevive = false;

    for (const skill of skills) {
      const usesPerBattle = Math.floor(battleDuration / skill.cooldown);

      if (skill.skillType === 'damage' || skill.skillType === 'aoe_damage' || !skill.skillType) {
        const skillDamage = skill.damageType === 'multiplier'
          ? unit.atk * skill.damage
          : skill.damage;
        const skillDpsContribution = (skillDamage * usesPerBattle) / battleDuration;
        skillDps += skillDpsContribution * hitRate;
      } else if (skill.skillType === 'heal') {
        const healAmount = skill.healType === 'percent'
          ? unit.maxHp * (skill.healAmount || 0)
          : (skill.healAmount || 0);
        totalHealing += healAmount * usesPerBattle;
      } else if (skill.skillType === 'hot') {
        const tickCount = Math.floor((skill.hotDuration || 0) / (skill.hotTickInterval || 1));
        const healPerTick = skill.hotType === 'percent'
          ? unit.maxHp * (skill.hotAmount || 0)
          : (skill.hotAmount || 0);
        totalHealing += healPerTick * tickCount * usesPerBattle;
      } else if (skill.skillType === 'invincible') {
        hasInvincible = true;
        invincibleDuration += (skill.invincibleDuration || 0) * usesPerBattle;
      } else if (skill.skillType === 'revive' && skill.reviveTarget === 'self') {
        // 자기 부활만 1v1에서 유효 HP에 반영
        hasSelfRevive = true;
      }
      // ally 부활은 팀 전투에서만 의미 있음 (1v1에서는 무시)
    }

    effectiveDps += skillDps;

    // 유효 HP 계산
    const evasionSurvival = 1 / (1 - Math.min(0.99, unit.evasion || 0));
    let effectiveHp = unit.maxHp * evasionSurvival;

    effectiveHp += totalHealing;

    if (hasInvincible && battleDuration > 0) {
      const invincibleRatio = Math.min(0.5, invincibleDuration / battleDuration);
      effectiveHp *= (1 + invincibleRatio);
    }

    // 자기 부활 스킬이 있으면 유효 HP 1.5배 (한 번 더 살 수 있음)
    if (hasSelfRevive) {
      effectiveHp *= 1.5;
    }

    return effectiveHp * effectiveDps;
  };

  const unit1Power = calcEffectivePower(unit1, skills1, unit2.evasion || 0);
  const unit2Power = calcEffectivePower(unit2, skills2, unit1.evasion || 0);
  const unit1Expected = unit1Power > unit2Power;

  const hasSkills = skills1.length > 0 || skills2.length > 0;
  for (let chunk = 0; chunk < chunks; chunk++) {
    const start = chunk * chunkSize;
    const end = Math.min(start + chunkSize, runs);

    // 청크 실행
    for (let i = start; i < end; i++) {
      const result = hasSkills
        ? simulateBattleWithSkills(unit1, unit2, skills1, skills2, opts.config)
        : simulateBattle(unit1, unit2, skills1, skills2, opts.config);

      if (result.winner === 'unit1') {
        unit1Wins++;
        unit1SurvivalHps.push(result.unit1FinalHp);
        unit1TTKs.push(result.duration);
      } else if (result.winner === 'unit2') {
        unit2Wins++;
        unit2SurvivalHps.push(result.unit2FinalHp);
        unit2TTKs.push(result.duration);
      } else {
        draws++;
      }

      durations.push(result.duration);
      unit1Damages.push(result.unit1TotalDamage);
      unit2Damages.push(result.unit2TotalDamage);

      // 치명타 통계 수집
      unit1TotalCrits += result.unit1Crits;
      unit1TotalHits += result.unit1Hits;
      unit2TotalCrits += result.unit2Crits;
      unit2TotalHits += result.unit2Hits;

      // 역전 분석
      if (result.winner === 'unit1' && !unit1Expected) {
        unit1Reversals++;
        if (result.unit1Crits > result.unit1Hits * (unit1.critRate || 0) * 1.5) {
          critCausedReversals++;
        }
      } else if (result.winner === 'unit2' && unit1Expected) {
        unit2Reversals++;
        if (result.unit2Crits > result.unit2Hits * (unit2.critRate || 0) * 1.5) {
          critCausedReversals++;
        }
      }

      // 박빙 승부
      if (result.winner === 'unit1' && result.unit1FinalHp <= unit1.maxHp * 0.1) {
        closeMatches++;
      } else if (result.winner === 'unit2' && result.unit2FinalHp <= unit2.maxHp * 0.1) {
        closeMatches++;
      }

      if (opts.saveSampleBattles && sampleBattles.length < opts.saveSampleBattles) {
        sampleBattles.push(result);
      }

      // 스킬 통계 수집 (스킬이 있을 때만)
      if (hasSkills) {
        const skillStats = extractSkillStatsFromBattle(result, unit1.name, unit2.name);

        // Unit1 스킬 통계 합산
        for (const [skillName, stats] of skillStats.unit1) {
          if (!unit1SkillStats.has(skillName)) {
            unit1SkillStats.set(skillName, { uses: 0, damage: 0, healing: 0 });
          }
          const accumulated = unit1SkillStats.get(skillName)!;
          accumulated.uses += stats.uses;
          accumulated.damage += stats.damage;
          accumulated.healing += stats.healing;
          unit1TotalHealing += stats.healing;
        }

        // Unit2 스킬 통계 합산
        for (const [skillName, stats] of skillStats.unit2) {
          if (!unit2SkillStats.has(skillName)) {
            unit2SkillStats.set(skillName, { uses: 0, damage: 0, healing: 0 });
          }
          const accumulated = unit2SkillStats.get(skillName)!;
          accumulated.uses += stats.uses;
          accumulated.damage += stats.damage;
          accumulated.healing += stats.healing;
          unit2TotalHealing += stats.healing;
        }
      }
    }

    // 진행률 업데이트
    if (onProgress) {
      onProgress((end / runs) * 100);
    }

    // UI 업데이트 기회 제공
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  // 통계 계산
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const avg = (arr: number[]) => arr.length > 0 ? sum(arr) / arr.length : 0;
  const median = (arr: number[]) => {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  const avgDuration = avg(durations);

  // 이론적 DPS 계산 (크리티컬, 명중률 반영)
  const calculateTheoreticalDps = (unit: typeof unit1, enemyEvasion: number = 0) => {
    const baseDps = unit.atk * unit.speed;
    const critMultiplier = 1 + (unit.critRate || 0) * ((unit.critDamage || 1.5) - 1);
    const hitRate = Math.max(0, Math.min(1, (unit.accuracy ?? 1) - enemyEvasion));
    return baseDps * critMultiplier * hitRate;
  };

  return {
    totalRuns: runs,
    unit1Wins,
    unit2Wins,
    draws,
    unit1WinRate: unit1Wins / runs,
    unit2WinRate: unit2Wins / runs,

    avgDuration,
    minDuration: Math.min(...durations),
    maxDuration: Math.max(...durations),

    unit1AvgDamage: avg(unit1Damages),
    unit1AvgDps: avgDuration > 0 ? avg(unit1Damages) / avgDuration : 0,
    unit1AvgSurvivalHp: avg(unit1SurvivalHps),

    unit2AvgDamage: avg(unit2Damages),
    unit2AvgDps: avgDuration > 0 ? avg(unit2Damages) / avgDuration : 0,
    unit2AvgSurvivalHp: avg(unit2SurvivalHps),

    durationDistribution: createHistogram(durations),
    damageDistribution: {
      unit1: createHistogram(unit1Damages),
      unit2: createHistogram(unit2Damages),
      unit1Range: {
        min: unit1Damages.length > 0 ? Math.min(...unit1Damages) : 0,
        max: unit1Damages.length > 0 ? Math.max(...unit1Damages) : 0,
      },
      unit2Range: {
        min: unit2Damages.length > 0 ? Math.min(...unit2Damages) : 0,
        max: unit2Damages.length > 0 ? Math.max(...unit2Damages) : 0,
      },
    },

    winRateConfidence: {
      unit1: calculateConfidenceInterval(unit1Wins, runs),
      unit2: calculateConfidenceInterval(unit2Wins, runs),
    },

    ttkDistribution: {
      unit1: createHistogram(unit1TTKs),
      unit2: createHistogram(unit2TTKs),
    },

    ttkStats: {
      unit1: {
        avg: avg(unit1TTKs),
        min: unit1TTKs.length > 0 ? Math.min(...unit1TTKs) : 0,
        max: unit1TTKs.length > 0 ? Math.max(...unit1TTKs) : 0,
        median: median(unit1TTKs),
      },
      unit2: {
        avg: avg(unit2TTKs),
        min: unit2TTKs.length > 0 ? Math.min(...unit2TTKs) : 0,
        max: unit2TTKs.length > 0 ? Math.max(...unit2TTKs) : 0,
        median: median(unit2TTKs),
      },
    },

    theoreticalDps: {
      unit1: calculateTheoreticalDps(unit1, unit2.evasion || 0),
      unit2: calculateTheoreticalDps(unit2, unit1.evasion || 0),
    },

    sampleBattles,

    critStats: {
      unit1: {
        totalCrits: unit1TotalCrits,
        totalHits: unit1TotalHits,
        avgCritRate: unit1TotalHits > 0 ? unit1TotalCrits / unit1TotalHits : 0,
        critDamageTotal: 0,
        reversalsByByCrit: 0,
      },
      unit2: {
        totalCrits: unit2TotalCrits,
        totalHits: unit2TotalHits,
        avgCritRate: unit2TotalHits > 0 ? unit2TotalCrits / unit2TotalHits : 0,
        critDamageTotal: 0,
        reversalsByByCrit: 0,
      },
    },

    reversalAnalysis: {
      unit1Reversals,
      unit2Reversals,
      critCausedReversals,
      closeMatches,
    },

    // 스킬 통계 (스킬이 있을 때만)
    skillStats: hasSkills ? {
      unit1: Array.from(unit1SkillStats.entries()).map(([skillName, stats]) => ({
        skillId: skillName,
        skillName,
        totalUses: stats.uses,
        totalDamage: stats.damage,
        totalHealing: stats.healing,
        avgDamagePerUse: stats.uses > 0 ? stats.damage / stats.uses : 0,
        dpsContribution: avgDuration > 0 ? (stats.damage / runs) / avgDuration / (avg(unit1Damages) / avgDuration || 1) : 0,
      } as SkillUsageStats)),
      unit2: Array.from(unit2SkillStats.entries()).map(([skillName, stats]) => ({
        skillId: skillName,
        skillName,
        totalUses: stats.uses,
        totalDamage: stats.damage,
        totalHealing: stats.healing,
        avgDamagePerUse: stats.uses > 0 ? stats.damage / stats.uses : 0,
        dpsContribution: avgDuration > 0 ? (stats.damage / runs) / avgDuration / (avg(unit2Damages) / avgDuration || 1) : 0,
      } as SkillUsageStats)),
    } : undefined,

    // 힐 통계 (스킬이 있을 때만)
    healingStats: hasSkills ? {
      unit1TotalHealing,
      unit2TotalHealing,
      unit1HPS: avgDuration > 0 ? (unit1TotalHealing / runs) / avgDuration : 0,
      unit2HPS: avgDuration > 0 ? (unit2TotalHealing / runs) / avgDuration : 0,
    } : undefined,
  };
}
