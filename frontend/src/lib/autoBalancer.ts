/**
 * AI Auto-Balancer — 시뮬레이션 결과를 목표 승률에 맞추기 위한 파라미터 자동 조정.
 *
 * GoalSolver 와의 차이점: closed-form 이 없는 복합 시뮬에서 bisection / golden-section
 * 으로 단일 파라미터(HP / ATK / DEF / Speed) 의 곱셈 인자를 탐색.
 *
 * 알고리즘:
 *   1. 현재 파라미터로 baseline winRate 측정
 *   2. 곱셈 인자 [0.3 ~ 3.0] 범위에서 bisection
 *      - winRate(factor) 가 target 보다 높으면 (조정 대상이 1유닛이고 강한 쪽이면) factor 감소
 *   3. 매 단계마다 작은 runs (default 500) 로 빠르게 평가, 마지막에 큰 runs (2000) 로 검증
 *
 * 안정성: 시뮬은 stochastic 이므로 작은 runs 에서 노이즈가 큼 — bisection 종료 조건은
 * |winRate - target| < tolerance(2%) 또는 max iterations(8) 도달.
 */

import { runMonteCarloSimulationAsync } from './simulation/monteCarloSimulator';
import type { UnitStats, Skill, BattleConfig } from './simulation/types';

export type BalanceTarget = 'unit1' | 'unit2';
export type BalanceParam = 'hp' | 'atk' | 'def' | 'speed';

export interface AutoBalanceInput {
  unit1: UnitStats;
  unit2: UnitStats;
  skills1?: Skill[];
  skills2?: Skill[];
  config?: Partial<BattleConfig>;
  /** 0 ~ 1 (default 0.5) — unit1 의 목표 승률 */
  targetWinRate?: number;
  /** 어느 유닛의 어느 스탯을 조정할지 */
  target: BalanceTarget;
  param: BalanceParam;
  /** bisection 단계당 시뮬 횟수 (default 500) */
  probeRuns?: number;
  /** 최종 검증 시뮬 횟수 (default 2000) */
  verifyRuns?: number;
  /** 곱셈 인자 탐색 범위 (default [0.3, 3.0]) */
  factorRange?: [number, number];
  /** 종료 허용 오차 (default 0.02) */
  tolerance?: number;
  /** 최대 bisection 반복 (default 8) */
  maxIterations?: number;
  onProgress?: (step: number, total: number, currentFactor: number, currentWinRate: number) => void;
}

export interface AutoBalanceResult {
  success: boolean;
  /** 최종 곱셈 인자 (1 = 변경 없음) */
  factor: number;
  /** 변경 전 값 */
  originalValue: number;
  /** 변경 후 추천 값 */
  suggestedValue: number;
  /** 추천 값으로 측정한 unit1 승률 */
  finalWinRate: number;
  /** 목표 승률 */
  targetWinRate: number;
  /** 탐색 단계별 기록 (factor, winRate) */
  trace: Array<{ factor: number; winRate: number; runs: number }>;
  /** 사람이 읽는 설명 */
  explanation: string;
  /** 경고 (인자가 한쪽 끝에 도달, 비현실적 등) */
  warnings?: string[];
}

function applyFactor(unit: UnitStats, param: BalanceParam, factor: number): UnitStats {
  const next = { ...unit };
  switch (param) {
    case 'hp':
      next.hp = Math.max(1, Math.round(unit.hp * factor));
      next.maxHp = Math.max(1, Math.round(unit.maxHp * factor));
      break;
    case 'atk':
      next.atk = Math.max(1, Math.round(unit.atk * factor));
      break;
    case 'def':
      next.def = Math.max(0, Math.round(unit.def * factor));
      break;
    case 'speed':
      next.speed = Math.max(0.1, Math.round(unit.speed * factor * 100) / 100);
      break;
  }
  return next;
}

function getValue(unit: UnitStats, param: BalanceParam): number {
  switch (param) {
    case 'hp': return unit.maxHp;
    case 'atk': return unit.atk;
    case 'def': return unit.def;
    case 'speed': return unit.speed;
  }
}

async function probe(
  unit1: UnitStats,
  unit2: UnitStats,
  skills1: Skill[],
  skills2: Skill[],
  config: Partial<BattleConfig> | undefined,
  target: BalanceTarget,
  param: BalanceParam,
  factor: number,
  runs: number,
): Promise<number> {
  const u1 = target === 'unit1' ? applyFactor(unit1, param, factor) : unit1;
  const u2 = target === 'unit2' ? applyFactor(unit2, param, factor) : unit2;
  const result = await runMonteCarloSimulationAsync(u1, u2, skills1, skills2, {
    runs,
    config: {
      maxDuration: 300,
      timeStep: 0.1,
      damageFormula: 'simple',
      ...config,
    },
    saveSampleBattles: 0,
  });
  return result.unit1WinRate;
}

/**
 * 단일 파라미터 1차원 탐색. 파라미터 → unit1 승률 함수가 단조성 (monotonic) 이라고
 * 가정 — 일반적으로 ATK/HP 증가 → 해당 유닛 승률 증가, DEF 도 동일, Speed 도 동일.
 *
 * unit2 를 조정하는 경우 부호 반대 — 이 함수는 unit1 승률을 기준으로 하므로
 * 자동으로 처리된다 (target=unit2 면 factor 증가가 unit1 승률 감소를 의미).
 */
export async function autoBalance(input: AutoBalanceInput): Promise<AutoBalanceResult> {
  const {
    unit1,
    unit2,
    skills1 = [],
    skills2 = [],
    config,
    targetWinRate = 0.5,
    target,
    param,
    probeRuns = 500,
    verifyRuns = 2000,
    factorRange = [0.3, 3.0],
    tolerance = 0.02,
    maxIterations = 8,
    onProgress,
  } = input;

  const trace: Array<{ factor: number; winRate: number; runs: number }> = [];

  // baseline (factor=1)
  const baselineRate = await probe(unit1, unit2, skills1, skills2, config, target, param, 1, probeRuns);
  trace.push({ factor: 1, winRate: baselineRate, runs: probeRuns });
  onProgress?.(1, maxIterations + 2, 1, baselineRate);

  // baseline 이 이미 tolerance 안이면 종료
  if (Math.abs(baselineRate - targetWinRate) <= tolerance) {
    const original = getValue(target === 'unit1' ? unit1 : unit2, param);
    return {
      success: true,
      factor: 1,
      originalValue: original,
      suggestedValue: original,
      finalWinRate: baselineRate,
      targetWinRate,
      trace,
      explanation: `현재 밸런스가 이미 목표 승률 ${(targetWinRate * 100).toFixed(0)}% ± ${(tolerance * 100).toFixed(0)}% 범위 안에 있습니다 (현재 ${(baselineRate * 100).toFixed(1)}%). 조정 불필요.`,
    };
  }

  // bisection
  // 단조성 결정: target=unit1 + param 증가 → unit1 승률 증가
  //             target=unit2 + param 증가 → unit1 승률 감소
  // → "factor 증가 시 unit1 승률 증가" 여부
  const directionUp = target === 'unit1';

  let lo = factorRange[0];
  let hi = factorRange[1];
  // 양 끝점 평가
  const loRate = await probe(unit1, unit2, skills1, skills2, config, target, param, lo, probeRuns);
  trace.push({ factor: lo, winRate: loRate, runs: probeRuns });
  onProgress?.(2, maxIterations + 2, lo, loRate);

  const hiRate = await probe(unit1, unit2, skills1, skills2, config, target, param, hi, probeRuns);
  trace.push({ factor: hi, winRate: hiRate, runs: probeRuns });
  onProgress?.(3, maxIterations + 2, hi, hiRate);

  const warnings: string[] = [];
  // unit1 승률이 단조 증가 (directionUp=true) 인지 검증
  const monotonicUp = directionUp ? hiRate >= loRate : hiRate <= loRate;
  if (!monotonicUp) {
    warnings.push('단조성 가정 위반 — 시뮬 노이즈 또는 비선형 효과. 결과가 불안정할 수 있습니다.');
  }

  // target 이 [loRate, hiRate] 사이에 없으면 가까운 끝점 추천
  const minRate = Math.min(loRate, hiRate);
  const maxRate = Math.max(loRate, hiRate);
  if (targetWinRate < minRate - tolerance) {
    const factor = directionUp ? lo : hi;
    const winRate = directionUp ? loRate : hiRate;
    warnings.push(`목표 승률 ${(targetWinRate * 100).toFixed(0)}% 달성 불가 — factor=${factor} 에서 최저 ${(winRate * 100).toFixed(1)}% 까지만 도달. 다른 파라미터를 함께 조정하세요.`);
    const original = getValue(target === 'unit1' ? unit1 : unit2, param);
    return {
      success: false,
      factor,
      originalValue: original,
      suggestedValue: Math.round(original * factor),
      finalWinRate: winRate,
      targetWinRate,
      trace,
      explanation: warnings[warnings.length - 1],
      warnings,
    };
  }
  if (targetWinRate > maxRate + tolerance) {
    const factor = directionUp ? hi : lo;
    const winRate = directionUp ? hiRate : loRate;
    warnings.push(`목표 승률 ${(targetWinRate * 100).toFixed(0)}% 달성 불가 — factor=${factor} 에서 최고 ${(winRate * 100).toFixed(1)}% 까지만 도달. 다른 파라미터를 함께 조정하세요.`);
    const original = getValue(target === 'unit1' ? unit1 : unit2, param);
    return {
      success: false,
      factor,
      originalValue: original,
      suggestedValue: Math.round(original * factor),
      finalWinRate: winRate,
      targetWinRate,
      trace,
      explanation: warnings[warnings.length - 1],
      warnings,
    };
  }

  // 본격 bisection
  let bestFactor = 1;
  let bestRate = baselineRate;
  for (let i = 0; i < maxIterations; i++) {
    const mid = (lo + hi) / 2;
    const midRate = await probe(unit1, unit2, skills1, skills2, config, target, param, mid, probeRuns);
    trace.push({ factor: mid, winRate: midRate, runs: probeRuns });
    onProgress?.(4 + i, maxIterations + 2, mid, midRate);

    if (Math.abs(midRate - targetWinRate) < Math.abs(bestRate - targetWinRate)) {
      bestFactor = mid;
      bestRate = midRate;
    }

    if (Math.abs(midRate - targetWinRate) <= tolerance) {
      bestFactor = mid;
      bestRate = midRate;
      break;
    }

    // directionUp=true: midRate < target 이면 factor 더 키워야 함 → lo = mid
    // directionUp=false: midRate < target 이면 factor 더 줄여야 함 → hi = mid
    if (directionUp) {
      if (midRate < targetWinRate) lo = mid;
      else hi = mid;
    } else {
      if (midRate < targetWinRate) hi = mid;
      else lo = mid;
    }
  }

  // 최종 검증 (큰 runs)
  const verifyRate = await probe(unit1, unit2, skills1, skills2, config, target, param, bestFactor, verifyRuns);
  trace.push({ factor: bestFactor, winRate: verifyRate, runs: verifyRuns });
  onProgress?.(maxIterations + 2, maxIterations + 2, bestFactor, verifyRate);

  const original = getValue(target === 'unit1' ? unit1 : unit2, param);
  const suggested = Math.round(original * bestFactor * 100) / 100;
  const change = ((bestFactor - 1) * 100).toFixed(1);
  const sign = bestFactor >= 1 ? '+' : '';

  const targetUnitName = target === 'unit1' ? (unit1.name || 'Unit 1') : (unit2.name || 'Unit 2');
  const paramLabel: Record<BalanceParam, string> = {
    hp: 'HP', atk: 'ATK', def: 'DEF', speed: 'Speed',
  };

  return {
    success: Math.abs(verifyRate - targetWinRate) <= tolerance * 1.5,
    factor: Math.round(bestFactor * 1000) / 1000,
    originalValue: original,
    suggestedValue: suggested,
    finalWinRate: verifyRate,
    targetWinRate,
    trace,
    explanation: `${targetUnitName} 의 ${paramLabel[param]} 을 ${original} → ${suggested} (×${bestFactor.toFixed(3)}, ${sign}${change}%) 로 조정하면 unit1 승률이 ${(verifyRate * 100).toFixed(1)}% (목표 ${(targetWinRate * 100).toFixed(0)}%) 에 도달합니다.\n검증: ${verifyRuns} 회 시뮬 기준.`,
    warnings: warnings.length ? warnings : undefined,
  };
}

// ────────────────────────────────────────────────────────────────
// v2: 멀티변수 최적화 — Coarse grid search
// ────────────────────────────────────────────────────────────────

export interface MultiBalanceDimension {
  target: BalanceTarget;
  param: BalanceParam;
  /** [min, max] 곱셈 인자. 기본 [0.5, 2.0] */
  range?: [number, number];
  /** 샘플링 포인트 수 (기본 5) */
  steps?: number;
}

export interface MultiBalanceInput {
  unit1: UnitStats;
  unit2: UnitStats;
  skills1?: Skill[];
  skills2?: Skill[];
  config?: Partial<BattleConfig>;
  targetWinRate?: number;
  dimensions: MultiBalanceDimension[];
  /** 각 평가의 시뮬 반복 횟수 (기본 300 — 빠르게) */
  probeRuns?: number;
  verifyRuns?: number;
  onProgress?: (step: number, total: number, currentFactors: number[], currentWinRate: number) => void;
}

export interface MultiBalanceResult {
  success: boolean;
  /** 각 차원의 최적 factor */
  factors: number[];
  /** 각 차원의 원래값/추천값 */
  adjustments: Array<{
    target: BalanceTarget;
    param: BalanceParam;
    factor: number;
    originalValue: number;
    suggestedValue: number;
  }>;
  finalWinRate: number;
  targetWinRate: number;
  explanation: string;
  evaluatedPoints: number;
}

/**
 * 멀티변수 grid search — 각 차원을 steps 포인트로 스윕, 모든 조합 평가.
 * N차원 × K스텝 = K^N 조합이므로 3차원 × 5스텝 = 125 평가 권장.
 *
 * winRate - targetWinRate 거리 최소화 조합을 반환.
 */
export async function autoBalanceMulti(input: MultiBalanceInput): Promise<MultiBalanceResult> {
  const {
    unit1, unit2,
    skills1 = [], skills2 = [],
    config,
    targetWinRate = 0.5,
    dimensions,
    probeRuns = 300,
    verifyRuns = 2000,
    onProgress,
  } = input;

  if (dimensions.length === 0) {
    throw new Error('최소 1개 이상의 dimension 필요');
  }

  // 각 차원의 샘플 factor 배열
  const gridFactors: number[][] = dimensions.map((d) => {
    const [lo, hi] = d.range ?? [0.5, 2.0];
    const steps = d.steps ?? 5;
    const arr: number[] = [];
    for (let i = 0; i < steps; i++) {
      arr.push(lo + ((hi - lo) * i) / (steps - 1));
    }
    return arr;
  });

  // 조합 생성 (cartesian product)
  const combinations: number[][] = [[]];
  for (const dimFactors of gridFactors) {
    const next: number[][] = [];
    for (const combo of combinations) {
      for (const f of dimFactors) {
        next.push([...combo, f]);
      }
    }
    combinations.splice(0, combinations.length, ...next);
  }

  const total = combinations.length;
  let bestCombo: number[] = combinations[0];
  let bestDist = Infinity;

  for (let idx = 0; idx < combinations.length; idx++) {
    const combo = combinations[idx];
    // 변환: 각 차원별 factor 를 적용
    let u1 = unit1;
    let u2 = unit2;
    dimensions.forEach((d, i) => {
      if (d.target === 'unit1') u1 = applyFactor(u1, d.param, combo[i]);
      else u2 = applyFactor(u2, d.param, combo[i]);
    });

    const result = await runMonteCarloSimulationAsync(u1, u2, skills1, skills2, {
      runs: probeRuns,
      config: { maxDuration: 300, timeStep: 0.1, damageFormula: 'simple', ...config },
      saveSampleBattles: 0,
    });
    const rate = result.unit1WinRate;
    const dist = Math.abs(rate - targetWinRate);

    onProgress?.(idx + 1, total, combo, rate);

    if (dist < bestDist) {
      bestDist = dist;
      bestCombo = combo;
    }

    // early stop if very close
    if (dist < 0.005) break;
  }

  // 최적 조합으로 최종 검증 (큰 runs)
  let uFinal1 = unit1;
  let uFinal2 = unit2;
  dimensions.forEach((d, i) => {
    if (d.target === 'unit1') uFinal1 = applyFactor(uFinal1, d.param, bestCombo[i]);
    else uFinal2 = applyFactor(uFinal2, d.param, bestCombo[i]);
  });
  const verify = await runMonteCarloSimulationAsync(uFinal1, uFinal2, skills1, skills2, {
    runs: verifyRuns,
    config: { maxDuration: 300, timeStep: 0.1, damageFormula: 'simple', ...config },
    saveSampleBattles: 0,
  });

  const paramLabel: Record<BalanceParam, string> = {
    hp: 'HP', atk: 'ATK', def: 'DEF', speed: 'Speed',
  };

  const adjustments = dimensions.map((d, i) => {
    const origUnit = d.target === 'unit1' ? unit1 : unit2;
    const original = getValue(origUnit, d.param);
    const factor = bestCombo[i];
    const suggested = Math.round(original * factor * 100) / 100;
    return {
      target: d.target,
      param: d.param,
      factor: Math.round(factor * 1000) / 1000,
      originalValue: original,
      suggestedValue: suggested,
    };
  });

  const lines = adjustments.map((a) => {
    const name = a.target === 'unit1' ? (unit1.name || 'Unit1') : (unit2.name || 'Unit2');
    const pct = ((a.factor - 1) * 100).toFixed(1);
    const sign = a.factor >= 1 ? '+' : '';
    return `  • ${name} ${paramLabel[a.param]}: ${a.originalValue} → ${a.suggestedValue} (${sign}${pct}%)`;
  });

  return {
    success: Math.abs(verify.unit1WinRate - targetWinRate) <= 0.03,
    factors: bestCombo,
    adjustments,
    finalWinRate: verify.unit1WinRate,
    targetWinRate,
    evaluatedPoints: total,
    explanation:
      `멀티변수 최적화 (${dimensions.length}차원 × ${total} 조합 평가):\n` +
      lines.join('\n') +
      `\n→ 최종 승률 ${(verify.unit1WinRate * 100).toFixed(1)}% (목표 ${(targetWinRate * 100).toFixed(0)}%)\n` +
      `단일변수 bisection 으로 해결 안 되는 경우에 사용. 평가 포인트가 많아 오래 걸릴 수 있습니다.`,
  };
}
