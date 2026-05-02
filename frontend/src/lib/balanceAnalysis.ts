/**
 * 게임 밸런스 분석 라이브러리
 * Perfect Imbalance, 파워 커브, 상관관계, 데드존, 수확체감 분석
 */

import type { UnitStats } from './simulation/types';
import { simulateBattle } from './simulation/battleEngine';

// ==================== Perfect Imbalance 분석 ====================

export interface MatchupMatrix {
  units: string[];
  winRates: number[][]; // winRates[i][j] = unit i vs unit j 승률
}

export interface PerfectImbalanceResult {
  matrix: MatchupMatrix;
  dominantUnits: string[];       // 다른 모든 유닛을 이기는 유닛
  weakUnits: string[];           // 다른 모든 유닛에게 지는 유닛
  counters: Map<string, string[]>; // 각 유닛의 카운터
  cycles: string[][];            // 가위바위보 순환 (A > B > C > A)
  nashEquilibrium?: { unit: string; probability: number }[]; // 내쉬 균형
  balanceScore: number;          // 0-100, 100이 완벽한 밸런스
}

/**
 * 모든 유닛 간 상성 매트릭스 계산
 */
export function calculateMatchupMatrix(
  units: UnitStats[],
  runsPerMatch: number = 100
): MatchupMatrix {
  const n = units.length;
  const winRates: number[][] = Array(n).fill(null).map(() => Array(n).fill(0.5));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let unit1Wins = 0;

      for (let k = 0; k < runsPerMatch; k++) {
        const result = simulateBattle(units[i], units[j], [], [], {
          maxDuration: 300,
          timeStep: 0.1,
          damageFormula: 'simple',
        });

        if (result.winner === 'unit1') unit1Wins++;
      }

      const winRate = unit1Wins / runsPerMatch;
      winRates[i][j] = winRate;
      winRates[j][i] = 1 - winRate;
    }
    winRates[i][i] = 0.5; // 자기 자신과의 대결은 50%
  }

  return {
    units: units.map(u => u.name),
    winRates,
  };
}

/**
 * Perfect Imbalance 분석 (가위바위보 상성 감지)
 */
export function analyzePerfectImbalance(
  matrix: MatchupMatrix,
  threshold: number = 0.6  // 60% 이상 승률을 "이긴다"로 간주
): PerfectImbalanceResult {
  const { units, winRates } = matrix;
  const n = units.length;

  // 지배적 유닛 찾기 (모든 상대에 대해 threshold 이상 승률)
  const dominantUnits: string[] = [];
  const weakUnits: string[] = [];

  for (let i = 0; i < n; i++) {
    const allWins = winRates[i].every((rate, j) => i === j || rate >= threshold);
    const allLoses = winRates[i].every((rate, j) => i === j || rate <= 1 - threshold);

    if (allWins) dominantUnits.push(units[i]);
    if (allLoses) weakUnits.push(units[i]);
  }

  // 카운터 관계 찾기
  const counters = new Map<string, string[]>();
  for (let i = 0; i < n; i++) {
    const unitCounters: string[] = [];
    for (let j = 0; j < n; j++) {
      if (i !== j && winRates[j][i] >= threshold) {
        unitCounters.push(units[j]);
      }
    }
    counters.set(units[i], unitCounters);
  }

  // 가위바위보 순환 찾기 (A > B > C > A)
  const cycles: string[][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      for (let k = 0; k < n; k++) {
        if (k === i || k === j) continue;

        // i > j > k > i 순환 체크
        if (
          winRates[i][j] >= threshold &&
          winRates[j][k] >= threshold &&
          winRates[k][i] >= threshold
        ) {
          const cycle = [units[i], units[j], units[k]].sort();
          const cycleKey = cycle.join('-');

          // 중복 방지
          if (!cycles.some(c => c.sort().join('-') === cycleKey)) {
            cycles.push([units[i], units[j], units[k]]);
          }
        }
      }
    }
  }

  // 밸런스 점수 계산
  // - 지배적 유닛이 없을수록 좋음
  // - 카운터가 골고루 있을수록 좋음
  // - 순환이 많을수록 좋음 (Perfect Imbalance)
  let balanceScore = 100;

  // 지배적 유닛 페널티
  balanceScore -= dominantUnits.length * 20;
  balanceScore -= weakUnits.length * 20;

  // 승률 분산 체크 (50%에 가까울수록 좋음)
  let varianceSum = 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      varianceSum += Math.abs(winRates[i][j] - 0.5);
      count++;
    }
  }
  const avgVariance = count > 0 ? varianceSum / count : 0;

  // 적당한 승률 변동이 있어야 Perfect Imbalance
  // 너무 평평하면 재미없고, 너무 극단적이면 불균형
  if (avgVariance < 0.05) {
    // 너무 평평 (모두 50:50)
    balanceScore -= 10;
  } else if (avgVariance > 0.3) {
    // 너무 극단적
    balanceScore -= (avgVariance - 0.3) * 100;
  } else {
    // 이상적인 범위 (0.1 ~ 0.2)
    if (avgVariance >= 0.1 && avgVariance <= 0.2) {
      balanceScore += 10;
    }
  }

  // 순환 보너스
  balanceScore += Math.min(20, cycles.length * 5);

  return {
    matrix,
    dominantUnits,
    weakUnits,
    counters,
    cycles,
    balanceScore: Math.max(0, Math.min(100, balanceScore)),
  };
}

// ==================== 파워 커브 분석 ====================

export interface PowerCurvePoint {
  level: number;
  power: number;
  expectedPower?: number;
  deviation?: number;
}

export interface PowerCurveAnalysis {
  points: PowerCurvePoint[];
  curveType: 'linear' | 'exponential' | 'logarithmic' | 'polynomial' | 'custom';
  formula: string;
  r2: number; // 결정계수 (1에 가까울수록 좋은 피팅)
  outliers: PowerCurvePoint[];
  recommendations: string[];
}

/**
 * 파워 커브 피팅 및 분석
 */
export function analyzePowerCurve(
  data: { level: number; power: number }[],
  curveType?: 'linear' | 'exponential' | 'logarithmic'
): PowerCurveAnalysis {
  if (data.length < 2) {
    return {
      points: data.map(d => ({ ...d })),
      curveType: 'linear',
      formula: '데이터 부족',
      r2: 0,
      outliers: [],
      recommendations: ['분석하려면 최소 2개 이상의 데이터가 필요합니다.'],
    };
  }

  // 레벨 분산 확인 (모든 레벨이 같으면 분석 불가)
  const uniqueLevels = new Set(data.map(d => d.level));
  if (uniqueLevels.size < 2) {
    return {
      points: data.map(d => ({ ...d })),
      curveType: 'linear',
      formula: '레벨 다양성 부족',
      r2: 0,
      outliers: [],
      recommendations: ['서로 다른 레벨의 데이터가 2개 이상 필요합니다. 현재 모든 데이터의 레벨이 동일합니다.'],
    };
  }

  // 각 커브 타입에 대해 피팅 시도
  const levels = data.map(d => d.level);
  const powers = data.map(d => d.power);

  // 선형 회귀: y = ax + b
  const linearFit = linearRegression(levels, powers);

  // 지수 회귀: y = a * e^(bx)
  const logPowers = powers.map(p => Math.log(Math.max(1, p)));
  const expFit = linearRegression(levels, logPowers);

  // 로그 회귀: y = a * ln(x) + b
  const logLevels = levels.map(l => Math.log(Math.max(1, l)));
  const logFit = linearRegression(logLevels, powers);

  // R² 계산
  const linearR2 = calculateR2(powers, levels.map(l => linearFit.a * l + linearFit.b));
  const expR2 = calculateR2(powers, levels.map(l => Math.exp(expFit.a * l + expFit.b)));
  const logR2 = calculateR2(powers, logLevels.map((ll, i) => logFit.a * ll + logFit.b));

  // 수식 안전하게 생성하는 헬퍼
  const safeNum = (n: number, decimals: number = 2) =>
    isNaN(n) || !isFinite(n) ? '0' : n.toFixed(decimals);

  // 최적 커브 선택
  let bestType: 'linear' | 'exponential' | 'logarithmic' = 'linear';
  let bestR2 = isNaN(linearR2) ? 0 : linearR2;
  let formula = `y = ${safeNum(linearFit.a)}x + ${safeNum(linearFit.b)}`;
  let expectedPowers = levels.map(l => linearFit.a * l + linearFit.b);

  const safeExpR2 = isNaN(expR2) ? 0 : expR2;
  const safeLogR2 = isNaN(logR2) ? 0 : logR2;

  if (curveType === 'exponential' || (!curveType && safeExpR2 > bestR2)) {
    bestType = 'exponential';
    bestR2 = safeExpR2;
    const expCoeff = Math.exp(expFit.b);
    formula = `y = ${safeNum(expCoeff)} × e^(${safeNum(expFit.a, 4)}x)`;
    expectedPowers = levels.map(l => Math.exp(expFit.a * l + expFit.b));
  }

  if (curveType === 'logarithmic' || (!curveType && safeLogR2 > bestR2)) {
    bestType = 'logarithmic';
    bestR2 = safeLogR2;
    formula = `y = ${safeNum(logFit.a)} × ln(x) + ${safeNum(logFit.b)}`;
    expectedPowers = logLevels.map((ll) => logFit.a * ll + logFit.b);
  }

  // 포인트 생성
  const points: PowerCurvePoint[] = data.map((d, i) => ({
    level: d.level,
    power: d.power,
    expectedPower: expectedPowers[i],
    deviation: d.power - expectedPowers[i],
  }));

  // 이상치 감지 (2 표준편차 이상)
  const deviations = points.map(p => p.deviation || 0);
  const stdDev = Math.sqrt(deviations.reduce((sum, d) => sum + d * d, 0) / deviations.length);
  const outliers = points.filter(p => Math.abs(p.deviation || 0) > 2 * stdDev);

  // 권장사항 생성
  const recommendations: string[] = [];

  if (bestR2 < 0.8) {
    recommendations.push('커브 피팅이 좋지 않습니다. 스탯 성장이 일관되지 않습니다.');
  }

  if (outliers.length > 0) {
    recommendations.push(`레벨 ${outliers.map(o => o.level).join(', ')}에서 파워 일탈이 감지되었습니다.`);
  }

  if (bestType === 'exponential' && expFit.a > 0.1) {
    recommendations.push('지수적 성장이 감지되었습니다. 후반 밸런스 붕괴에 주의하세요.');
  }

  return {
    points,
    curveType: bestType,
    formula,
    r2: bestR2,
    outliers,
    recommendations,
  };
}

// ==================== 상관관계 분석 ====================

export interface CorrelationResult {
  stat1: string;
  stat2: string;
  correlation: number; // -1 ~ 1
  strength: 'strong' | 'moderate' | 'weak' | 'none';
}

/**
 * 스탯 간 상관관계 분석
 */
export function analyzeCorrelations(
  units: Record<string, number>[],
  stats: string[]
): CorrelationResult[] {
  const results: CorrelationResult[] = [];

  for (let i = 0; i < stats.length; i++) {
    for (let j = i + 1; j < stats.length; j++) {
      const values1 = units.map(u => u[stats[i]] || 0);
      const values2 = units.map(u => u[stats[j]] || 0);

      const correlation = pearsonCorrelation(values1, values2);
      const absCorr = Math.abs(correlation);

      let strength: CorrelationResult['strength'] = 'none';
      if (absCorr >= 0.7) strength = 'strong';
      else if (absCorr >= 0.4) strength = 'moderate';
      else if (absCorr >= 0.2) strength = 'weak';

      results.push({
        stat1: stats[i],
        stat2: stats[j],
        correlation,
        strength,
      });
    }
  }

  return results.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
}

// ==================== 데드존 감지 ====================

export interface DeadZone {
  stat: string;
  range: [number, number];
  reason: string;
  affectedUnits: string[];
}

/**
 * 데드존 감지 (의미 없는 스탯 구간)
 */
export function detectDeadZones(
  units: (UnitStats & { power?: number })[],
  stat: keyof UnitStats
): DeadZone[] {
  const deadZones: DeadZone[] = [];
  const values = units.map(u => Number(u[stat]) || 0).filter(v => !isNaN(v));

  if (values.length < 3) return deadZones;

  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const range = max - min;

  if (range === 0) return deadZones;

  // 구간별로 유닛 분포 확인
  const binCount = 10;
  const binSize = range / binCount;
  const bins = new Array(binCount).fill(0);

  for (const v of values) {
    const binIndex = Math.min(binCount - 1, Math.floor((v - min) / binSize));
    bins[binIndex]++;
  }

  // 빈 구간 찾기 (데드존)
  for (let i = 0; i < binCount; i++) {
    if (bins[i] === 0 && i > 0 && i < binCount - 1) {
      // 앞뒤 구간에 유닛이 있는데 이 구간에는 없음 = 데드존
      if (bins[i - 1] > 0 && bins[i + 1] > 0) {
        const rangeStart = min + i * binSize;
        const rangeEnd = rangeStart + binSize;

        deadZones.push({
          stat: stat as string,
          range: [rangeStart, rangeEnd],
          reason: `${stat} ${rangeStart.toFixed(0)}~${rangeEnd.toFixed(0)} 구간에 유닛이 없습니다.`,
          affectedUnits: [],
        });
      }
    }
  }

  return deadZones;
}

// ==================== 밸런스 커브 자동 생성 ====================

export interface BalanceCurve {
  levels: number[];
  stats: Record<string, number[]>;
  growthType: 'linear' | 'exponential' | 'logarithmic';
  parameters: Record<string, { base: number; growth: number }>;
}

/**
 * 레벨별 밸런스 커브 자동 생성
 */
export function generateBalanceCurve(
  baseStats: Record<string, number>,
  maxLevel: number,
  growthType: 'linear' | 'exponential' | 'logarithmic' = 'linear',
  growthRate: number = 0.1  // 레벨당 성장률
): BalanceCurve {
  const levels = Array.from({ length: maxLevel }, (_, i) => i + 1);
  const stats: Record<string, number[]> = {};
  const parameters: Record<string, { base: number; growth: number }> = {};

  for (const [stat, baseValue] of Object.entries(baseStats)) {
    parameters[stat] = { base: baseValue, growth: growthRate };
    stats[stat] = levels.map(level => {
      switch (growthType) {
        case 'linear':
          return Math.round(baseValue * (1 + growthRate * (level - 1)));
        case 'exponential':
          return Math.round(baseValue * Math.pow(1 + growthRate, level - 1));
        case 'logarithmic':
          return Math.round(baseValue * (1 + growthRate * Math.log(level)));
        default:
          return baseValue;
      }
    });
  }

  return { levels, stats, growthType, parameters };
}

// ==================== 헬퍼 함수 ====================

function linearRegression(x: number[], y: number[]): { a: number; b: number } {
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
  const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);

  const a = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const b = (sumY - a * sumX) / n;

  return { a: isNaN(a) ? 0 : a, b: isNaN(b) ? 0 : b };
}

function calculateR2(actual: number[], predicted: number[]): number {
  const mean = actual.reduce((a, b) => a + b, 0) / actual.length;
  const ssTotal = actual.reduce((acc, y) => acc + (y - mean) ** 2, 0);
  const ssResidual = actual.reduce((acc, y, i) => acc + (y - predicted[i]) ** 2, 0);

  return ssTotal === 0 ? 0 : 1 - ssResidual / ssTotal;
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denominator = Math.sqrt(denomX * denomY);
  return denominator === 0 ? 0 : numerator / denominator;
}
