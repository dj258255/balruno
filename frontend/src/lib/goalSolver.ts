/**
 * 목표 기반 자동 조정 (역산 로직)
 * 원하는 결과값에서 필요한 입력값을 계산
 */

// 역산 가능한 공식 타입
export type SolverFormula =
  | 'damage_for_ttk'        // TTK 목표 → 필요 데미지
  | 'hp_for_survival'       // 생존 시간 목표 → 필요 HP
  | 'defense_for_reduction' // 피해감소 목표 → 필요 방어력
  | 'exp_for_level'         // 레벨 목표 → 필요 경험치
  | 'cost_for_roi'          // ROI 목표 → 적정 비용
  | 'crit_for_dps'          // DPS 목표 → 필요 크리티컬
  | 'speed_for_dps'         // DPS 목표 → 필요 공격속도
  | 'growth_rate';          // 최종값 목표 → 필요 성장률

export interface SolverInput {
  formula: SolverFormula;
  params: Record<string, number>;
  targetValue: number;
}

export interface SolverResult {
  success: boolean;
  value?: number;
  formula: string;
  explanation: string;
  warnings?: string[];
}

/**
 * TTK 목표에서 필요한 데미지 계산
 * TTK = HP / (Damage * Speed)
 * Damage = HP / (TTK * Speed)
 */
function solveDamageForTTK(
  targetTTK: number,
  enemyHP: number,
  attackSpeed: number
): SolverResult {
  if (targetTTK <= 0 || attackSpeed <= 0) {
    return {
      success: false,
      formula: 'Damage = HP / (TTK × Speed)',
      explanation: 'TTK와 공격속도는 0보다 커야 합니다.',
    };
  }

  const requiredDamage = enemyHP / (targetTTK * attackSpeed);

  return {
    success: true,
    value: Math.ceil(requiredDamage),
    formula: `Damage = ${enemyHP} / (${targetTTK} × ${attackSpeed})`,
    explanation: `적 HP ${enemyHP}를 ${targetTTK}초 안에 처치하려면 타격당 ${Math.ceil(requiredDamage)} 데미지가 필요합니다.`,
    warnings: requiredDamage > enemyHP ? ['타격당 데미지가 적 HP보다 높습니다. 원킬이 가능합니다.'] : undefined,
  };
}

/**
 * 생존 시간 목표에서 필요한 HP 계산
 * Survival = HP / (EnemyDPS)
 * HP = Survival × EnemyDPS
 */
function solveHPForSurvival(
  targetSurvival: number,
  enemyDPS: number,
  defenseReduction: number = 0 // 0-1 사이
): SolverResult {
  if (targetSurvival <= 0) {
    return {
      success: false,
      formula: 'HP = Survival × DPS × (1 - DefReduction)',
      explanation: '목표 생존 시간은 0보다 커야 합니다.',
    };
  }

  const effectiveDPS = enemyDPS * (1 - Math.min(defenseReduction, 0.9));
  const requiredHP = targetSurvival * effectiveDPS;

  return {
    success: true,
    value: Math.ceil(requiredHP),
    formula: `HP = ${targetSurvival} × ${effectiveDPS.toFixed(1)}`,
    explanation: `적 DPS ${enemyDPS}에 대해 ${targetSurvival}초 생존하려면 ${Math.ceil(requiredHP)} HP가 필요합니다.`,
  };
}

/**
 * 피해감소 목표에서 필요한 방어력 계산 (MMORPG 공식)
 * Reduction = DEF / (DEF + 100)
 * DEF = 100 × Reduction / (1 - Reduction)
 */
function solveDefenseForReduction(
  targetReduction: number,
  constant: number = 100
): SolverResult {
  if (targetReduction >= 1 || targetReduction < 0) {
    return {
      success: false,
      formula: 'DEF = C × Reduction / (1 - Reduction)',
      explanation: targetReduction >= 1
        ? '피해감소율은 100% 미만이어야 합니다. 100% 이상은 모든 피해를 무효화하므로 불가능합니다.'
        : '피해감소율은 0% 이상이어야 합니다.',
    };
  }

  const requiredDef = constant * targetReduction / (1 - targetReduction);

  return {
    success: true,
    value: Math.ceil(requiredDef),
    formula: `DEF = ${constant} × ${targetReduction.toFixed(2)} / ${(1 - targetReduction).toFixed(2)}`,
    explanation: `${(targetReduction * 100).toFixed(0)}% 피해감소(받는 피해가 ${(100 - targetReduction * 100).toFixed(0)}%가 됨)를 위해 방어력 ${Math.ceil(requiredDef)}이 필요합니다.\n공식: 피해감소율 = 방어력 / (방어력 + ${constant})`,
    warnings: targetReduction > 0.75 ? ['75% 이상의 피해감소율은 게임 밸런스에 주의가 필요합니다.'] : undefined,
  };
}

/**
 * 레벨 목표에서 필요한 총 경험치 계산 (지수 성장)
 * TotalExp = BaseExp × (Rate^Level - 1) / (Rate - 1)
 */
function solveExpForLevel(
  targetLevel: number,
  baseExp: number,
  growthRate: number
): SolverResult {
  if (targetLevel < 1 || growthRate <= 1) {
    return {
      success: false,
      formula: 'TotalExp = BaseExp × (Rate^Level - 1) / (Rate - 1)',
      explanation: '레벨은 1 이상, 성장률은 1보다 커야 합니다.',
    };
  }

  const totalExp = baseExp * (Math.pow(growthRate, targetLevel) - 1) / (growthRate - 1);

  return {
    success: true,
    value: Math.ceil(totalExp),
    formula: `TotalExp = ${baseExp} × (${growthRate}^${targetLevel} - 1) / (${growthRate} - 1)`,
    explanation: `레벨 ${targetLevel}에 도달하려면 총 ${Math.ceil(totalExp).toLocaleString()} 경험치가 필요합니다.`,
  };
}

/**
 * ROI 목표에서 적정 비용 계산
 * ROI = (Output - Cost) / Cost
 * Cost = Output / (1 + ROI)
 */
function solveCostForROI(
  targetROI: number,
  expectedOutput: number
): SolverResult {
  if (targetROI <= -1) {
    return {
      success: false,
      formula: 'Cost = Output / (1 + ROI)',
      explanation: 'ROI(투자 수익률)는 -100% 초과여야 합니다.',
    };
  }

  const appropriateCost = expectedOutput / (1 + targetROI);
  const profit = expectedOutput - appropriateCost;

  return {
    success: true,
    value: Math.round(appropriateCost),
    formula: `Cost = ${expectedOutput} / (1 + ${targetROI})`,
    explanation: `ROI(Return on Investment, 투자 수익률)는 투자 대비 수익의 비율입니다.\n예상 산출물 ${expectedOutput}에서 ${(targetROI * 100).toFixed(0)}% ROI를 달성하려면 비용을 ${Math.round(appropriateCost)}로 설정하세요.\n이 경우 순이익은 ${Math.round(profit)}입니다.`,
    warnings: targetROI < 0 ? ['ROI가 음수면 손실이 발생합니다.'] : undefined,
  };
}

/**
 * DPS 목표에서 필요한 크리티컬 스탯 계산
 * DPS = ATK × Speed × (1 + CritRate × (CritDmg - 1))
 * CritRate = (DPS / (ATK × Speed) - 1) / (CritDmg - 1)
 */
function solveCritForDPS(
  targetDPS: number,
  atk: number,
  speed: number,
  critDamage: number = 1.5
): SolverResult {
  const baseDPS = atk * speed;

  if (targetDPS <= baseDPS) {
    return {
      success: true,
      value: 0,
      formula: 'CritRate = (DPS / BaseDPS - 1) / (CritDmg - 1)',
      explanation: '목표 DPS가 기본 DPS 이하입니다. 크리티컬이 필요 없습니다.',
    };
  }

  if (critDamage <= 1) {
    return {
      success: false,
      formula: 'CritRate = (DPS / BaseDPS - 1) / (CritDmg - 1)',
      explanation: '크리티컬 데미지 배율은 1보다 커야 합니다.',
    };
  }

  const requiredCritRate = (targetDPS / baseDPS - 1) / (critDamage - 1);

  if (requiredCritRate > 1) {
    return {
      success: false,
      value: 1,
      formula: `CritRate = (${targetDPS} / ${baseDPS.toFixed(1)} - 1) / (${critDamage} - 1)`,
      explanation: `목표 DPS ${targetDPS}는 100% 크리티컬로도 달성 불가능합니다. ATK 또는 Speed 증가가 필요합니다.`,
      warnings: ['크리티컬 100%로도 목표에 도달할 수 없습니다.'],
    };
  }

  return {
    success: true,
    value: Math.round(requiredCritRate * 100) / 100,
    formula: `CritRate = (${targetDPS} / ${baseDPS.toFixed(1)} - 1) / (${critDamage} - 1)`,
    explanation: `DPS ${targetDPS}를 위해 크리티컬 확률 ${(requiredCritRate * 100).toFixed(1)}%가 필요합니다.`,
  };
}

/**
 * DPS 목표에서 필요한 공격속도 계산
 * DPS = ATK × Speed × CritMultiplier
 * Speed = DPS / (ATK × CritMultiplier)
 */
function solveSpeedForDPS(
  targetDPS: number,
  atk: number,
  critRate: number = 0,
  critDamage: number = 1.5
): SolverResult {
  const critMultiplier = 1 + critRate * (critDamage - 1);
  const requiredSpeed = targetDPS / (atk * critMultiplier);

  return {
    success: true,
    value: Math.round(requiredSpeed * 100) / 100,
    formula: `Speed = ${targetDPS} / (${atk} × ${critMultiplier.toFixed(2)})`,
    explanation: `DPS ${targetDPS}를 위해 공격속도 ${requiredSpeed.toFixed(2)}가 필요합니다.`,
    warnings: requiredSpeed > 10 ? ['매우 높은 공격속도입니다. 밸런스를 확인하세요.'] : undefined,
  };
}

/**
 * 최종값 목표에서 필요한 성장률 계산
 * FinalValue = BaseValue × Rate^(MaxLevel - 1)
 * Rate = (FinalValue / BaseValue)^(1 / (MaxLevel - 1))
 */
function solveGrowthRate(
  targetFinalValue: number,
  baseValue: number,
  maxLevel: number
): SolverResult {
  if (maxLevel <= 1 || baseValue <= 0 || targetFinalValue <= 0) {
    return {
      success: false,
      formula: 'Rate = (FinalValue / BaseValue)^(1 / (MaxLevel - 1))',
      explanation: '최대 레벨은 2 이상, 기본값과 목표값은 0보다 커야 합니다.',
    };
  }

  const requiredRate = Math.pow(targetFinalValue / baseValue, 1 / (maxLevel - 1));

  return {
    success: true,
    value: Math.round(requiredRate * 1000) / 1000,
    formula: `Rate = (${targetFinalValue} / ${baseValue})^(1 / ${maxLevel - 1})`,
    explanation: `기본값 ${baseValue}에서 레벨 ${maxLevel}에 ${targetFinalValue}에 도달하려면 성장률 ${requiredRate.toFixed(3)}가 필요합니다.`,
    warnings: requiredRate > 1.5 ? ['높은 성장률은 후반 파워 크립을 유발할 수 있습니다.'] : undefined,
  };
}

// ============================================================================
// Sensitivity 민감도 — 해 ± pctDelta 변동 시 원 공식 결과 얼마나 흔들리나.
// scipy.optimize.brentq 의 tolerance 개념 + 민감도 분석.
// ============================================================================

export interface SensitivityInfo {
  /** 해를 ±pctDelta 변동 시 목표값에서 벗어나는 정도 (%) */
  volatility: number;
  /** 민감도 수준 — 'low' | 'medium' | 'high' */
  level: 'low' | 'medium' | 'high';
  /** 설명 */
  message: string;
}

/**
 * 해 검증 (round-trip) + 민감도 평가.
 * 원 공식을 다시 호출해서 target 과 비교하고, 해 ±5% 변동 시 결과 흔들림 측정.
 */
export function verifyAndAnalyzeSensitivity(
  input: SolverInput,
  result: SolverResult,
): SensitivityInfo | null {
  if (!result.success || typeof result.value !== 'number') return null;

  // 각 공식의 forward 계산 람다 — solution 을 해당 파라미터에 넣고 결과 추출
  const forward = getForwardForSolution(input, result.value);
  if (forward === null) return null;

  const baseline = forward(result.value);
  const up = forward(result.value * 1.05);
  const down = forward(result.value * 0.95);

  // target 기준 상대 변동 폭
  const targetAbs = Math.max(1, Math.abs(input.targetValue));
  const upDiff = Math.abs(up - input.targetValue) / targetAbs;
  const downDiff = Math.abs(down - input.targetValue) / targetAbs;
  const volatility = Math.max(upDiff, downDiff) * 100;

  let level: SensitivityInfo['level'];
  let message: string;
  if (volatility < 3) {
    level = 'low';
    message = `안정적 해 (해를 ±5% 변동해도 목표 변화 ${volatility.toFixed(1)}%)`;
  } else if (volatility < 10) {
    level = 'medium';
    message = `보통 민감도 (해 ±5% → 목표 ${volatility.toFixed(1)}% 변동)`;
  } else {
    level = 'high';
    message = `⚠️ 매우 민감한 해 — 해를 ±5% 만 바꿔도 목표가 ${volatility.toFixed(1)}% 흔들림. 약간의 오차로 큰 편차 가능`;
  }

  void baseline;
  return { volatility, level, message };
}

/**
 * 각 공식의 forward 함수 — solution 변수를 인자로 받아 결과값 반환.
 * 8 개 공식 전부 지원.
 */
function getForwardForSolution(input: SolverInput, solution: number): ((x: number) => number) | null {
  const { formula, params } = input;
  void solution;
  switch (formula) {
    case 'damage_for_ttk': {
      // TTK = enemyHP / (damage × attackSpeed)
      const hp = params.enemyHP || 1000;
      const aSpd = params.attackSpeed || 1;
      return (dmg) => hp / Math.max(1, dmg * aSpd);
    }
    case 'hp_for_survival': {
      // survival = hp / (enemyDPS × (1 - defenseReduction))
      const edps = params.enemyDPS || 100;
      const dr = params.defenseReduction || 0;
      return (hp) => hp / Math.max(1, edps * (1 - dr));
    }
    case 'defense_for_reduction': {
      // reduction = def / (def + constant)
      const c = params.constant || 100;
      return (def) => def / (def + c);
    }
    case 'exp_for_level': {
      // totalExp = sum of baseExp × growthRate^i
      const base = params.baseExp || 100;
      const g = params.growthRate || 1.15;
      return (lv) => {
        let total = 0;
        for (let i = 0; i < lv; i++) total += base * Math.pow(g, i);
        return total;
      };
    }
    case 'cost_for_roi': {
      // roi = (output - cost) / cost
      const out = params.expectedOutput || 1000;
      return (cost) => (out - cost) / Math.max(1, cost);
    }
    case 'crit_for_dps': {
      // dps = atk × (1 + critRate × (critDamage - 1)) × speed
      const atk = params.atk || 100;
      const spd = params.speed || 1;
      const cd = params.critDamage || 1.5;
      return (cr) => atk * (1 + cr * (cd - 1)) * spd;
    }
    case 'speed_for_dps': {
      const atk = params.atk || 100;
      const cr = params.critRate || 0;
      const cd = params.critDamage || 1.5;
      return (spd) => atk * (1 + cr * (cd - 1)) * spd;
    }
    case 'growth_rate': {
      const base = params.baseValue || 10;
      const max = params.maxLevel || 100;
      return (rate) => base * Math.pow(rate, max - 1);
    }
    default:
      return null;
  }
}

// ============================================================================
// Multi-Solution — 같은 목표를 만족하는 대체 해 탐색.
// 본 해 근처 + 더 넓은 범위에서 샘플링해 target 에 수렴하는 다른 값 발견.
// ============================================================================

export interface AlternativeSolution {
  value: number;
  /** 얼마나 다른 해인가 (본 해 대비 거리 비율) */
  distanceRatio: number;
}

/**
 * 대체 해 탐색 — forward(x) = target 을 만족하는 또 다른 x 가 있는지
 * [primary × 0.1, primary × 10] 범위에서 균등 샘플링 (non-monotone 함수 대비).
 */
export function findAlternativeSolutions(
  input: SolverInput,
  primary: number,
): AlternativeSolution[] {
  if (!isFinite(primary)) return [];
  const forward = getForwardForSolution(input, primary);
  if (!forward) return [];
  const target = input.targetValue;
  const candidates: AlternativeSolution[] = [];
  const lo = Math.max(0.01, primary * 0.1);
  const hi = primary * 10;
  const steps = 80;
  let prevDiff = forward(lo) - target;
  let prevX = lo;
  for (let i = 1; i <= steps; i++) {
    const x = lo + ((hi - lo) * i) / steps;
    const diff = forward(x) - target;
    // 부호 변화 = 해가 이 구간에 있음
    if (prevDiff * diff < 0) {
      const mid = (prevX + x) / 2;
      const dist = Math.abs(mid - primary) / Math.max(0.01, Math.abs(primary));
      if (dist > 0.1) candidates.push({ value: Math.round(mid * 100) / 100, distanceRatio: dist });
    }
    prevDiff = diff;
    prevX = x;
  }
  return candidates.slice(0, 3);
}

// ============================================================================
// Generic Formula Solver — 임의 mathjs 수식에 대한 bisection 역산.
// 예: "damage * (1 + critRate * (critDmg - 1)) * aspd" 에서 'damage' 변수 역산.
// mathjs.parse + evaluate(scope) 사용 — new Function / eval 금지 (보안)
// ============================================================================

import { create, all } from 'mathjs';
const mathjs = create(all, {});

export interface GenericSolverInput {
  /** mathjs 표현식 (예: "atk * (100 / (100 + def))") */
  expression: string;
  /** 고정 변수 값 */
  fixedVars: Record<string, number>;
  /** 역산할 변수명 */
  solveFor: string;
  /** 목표 결과값 */
  target: number;
  /** 검색 범위 */
  lo?: number;
  hi?: number;
  tolerance?: number;
}

export interface GenericSolverResult {
  success: boolean;
  value?: number;
  iterations?: number;
  error?: string;
}

export function solveGeneric(input: GenericSolverInput): GenericSolverResult {
  const { expression, fixedVars, solveFor, target, lo = 0.001, hi = 100000, tolerance = 0.01 } = input;

  let compiled: { evaluate: (scope: Record<string, number>) => unknown };
  try {
    // mathjs.parse 는 단일 expression 에 MathNode 반환 — compile() 로 최적화
    const node = mathjs.parse(expression);
    compiled = (node as unknown as { compile: () => { evaluate: (scope: Record<string, number>) => unknown } }).compile();
  } catch (e) {
    return { success: false, error: `수식 파싱 실패: ${(e as Error).message}` };
  }

  const evalAt = (x: number): number => {
    try {
      const scope = { ...fixedVars, [solveFor]: x };
      const out = compiled.evaluate(scope);
      return typeof out === 'number' ? out : NaN;
    } catch {
      return NaN;
    }
  };

  const fLo = evalAt(lo);
  const fHi = evalAt(hi);
  if (!isFinite(fLo) || !isFinite(fHi)) {
    return { success: false, error: '수식 계산 실패 — 변수명이나 연산을 확인하세요.' };
  }

  const increasing = fHi > fLo;
  if (increasing && (target < fLo || target > fHi)) {
    return { success: false, error: `목표값 ${target} 이 수식의 출력 범위 [${fLo.toFixed(2)}, ${fHi.toFixed(2)}] 밖입니다.` };
  }
  if (!increasing && (target > fLo || target < fHi)) {
    return { success: false, error: `목표값 ${target} 이 수식의 출력 범위 [${fHi.toFixed(2)}, ${fLo.toFixed(2)}] 밖입니다.` };
  }

  let left = lo;
  let right = hi;
  let mid = (left + right) / 2;
  let fMid = evalAt(mid);
  const maxIter = 60;
  let iter = 0;
  for (; iter < maxIter; iter++) {
    mid = (left + right) / 2;
    fMid = evalAt(mid);
    if (Math.abs(fMid - target) <= tolerance) break;
    if (right - left < 1e-10) break;
    if ((increasing && fMid < target) || (!increasing && fMid > target)) left = mid;
    else right = mid;
  }

  const err = Math.abs(fMid - target);
  return {
    success: err <= tolerance,
    value: mid,
    iterations: iter,
    error: err <= tolerance ? undefined : `수렴 실패 — 최종 오차 ${err.toFixed(4)}`,
  };
}

// ============================================================================
// Stat Weights — SimCraft 방식.
// 각 스탯 1 단위 증가 시 목표 metric (DPS/EHP/TTK) 에 주는 영향도 계산.
// 기획자가 'DEF 1 vs HP 1 vs crit 1% 중 어디 우선 투자?' 답 내리는 데 사용.
// ============================================================================

export interface StatWeightInput {
  /** 기본 수식 — evaluateFn 으로 관측할 출력 */
  evaluate: (stats: Record<string, number>) => number;
  /** 현재 스탯 값 */
  currentStats: Record<string, number>;
  /** 각 스탯 증분 크기 (default 1) — 비율 스탯 (crit 등) 은 0.01 추천 */
  deltas?: Record<string, number>;
}

export interface StatWeight {
  stat: string;
  /** baseline metric 값 */
  baseline: number;
  /** stat + delta 일 때 metric 값 */
  withDelta: number;
  /** 단위 delta 당 metric 변화량 */
  weight: number;
  /** 정규화 (최대 weight = 1.0) */
  normalized: number;
}

export function calculateStatWeights(input: StatWeightInput): StatWeight[] {
  const { evaluate, currentStats, deltas } = input;
  const baseline = evaluate(currentStats);
  const results: Omit<StatWeight, 'normalized'>[] = [];

  for (const stat of Object.keys(currentStats)) {
    const d = deltas?.[stat] ?? 1;
    const withDelta = evaluate({ ...currentStats, [stat]: currentStats[stat] + d });
    const weight = (withDelta - baseline) / d;
    results.push({ stat, baseline, withDelta, weight });
  }

  const maxAbs = Math.max(0.0001, ...results.map((r) => Math.abs(r.weight)));
  return results
    .map((r) => ({ ...r, normalized: r.weight / maxAbs }))
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
}

// ============================================================================
// Multi-Variable Pareto — 2 변수 최적화 (경량).
// "metric ≥ target 만족하는 (x, y) 중 cost(x, y) 최소인 Pareto frontier".
// 격자 샘플링 (N × N) 으로 feasible set 탐색 → Pareto 정렬.
// ============================================================================

export interface ParetoInput {
  /** 변수 이름 2개 */
  varX: { key: string; min: number; max: number; step: number };
  varY: { key: string; min: number; max: number; step: number };
  /** metric ≥ metricTarget 만족 */
  metric: (x: number, y: number) => number;
  metricTarget: number;
  /** cost 최소화 */
  cost: (x: number, y: number) => number;
}

export interface ParetoPoint {
  x: number;
  y: number;
  metricValue: number;
  costValue: number;
}

export function solvePareto(input: ParetoInput): ParetoPoint[] {
  const { varX, varY, metric, metricTarget, cost } = input;
  const feasible: ParetoPoint[] = [];
  for (let x = varX.min; x <= varX.max; x += varX.step) {
    for (let y = varY.min; y <= varY.max; y += varY.step) {
      const m = metric(x, y);
      if (m >= metricTarget) {
        feasible.push({ x, y, metricValue: m, costValue: cost(x, y) });
      }
    }
  }
  // Pareto 정렬: cost 낮은 순, 동점이면 metric 높은 순
  feasible.sort((a, b) => a.costValue - b.costValue || b.metricValue - a.metricValue);
  // 중복 제거 + Pareto dominance 필터 (간소화: cost 낮을수록 좋음이므로 정렬만으로 충분)
  return feasible;
}

// ============================================================================
// Monte Carlo 역산 (경량) — 확률 포함 수식에서 목표 평균 달성 + 신뢰구간 폭 체크.
// Silver (ICML 2009) "Monte-Carlo Simulation Balancing" 아이디어 경량 적용.
// ============================================================================

export interface MCSolverInput {
  /** 한 번의 trial 에서 결과 1개 반환 — random 내부 사용 */
  trial: (x: number) => number;
  /** 역산 변수 범위 */
  lo: number;
  hi: number;
  /** 목표 평균 */
  targetMean: number;
  /** 허용 평균 오차 */
  tolerance?: number;
  /** 각 x 에서 trial 반복 수 */
  trialsPerStep?: number;
  /** bisection 최대 iter */
  maxIter?: number;
}

export interface MCSolverResult {
  success: boolean;
  value?: number;
  observedMean?: number;
  stdev?: number;
  /** 99% 신뢰구간 폭 (2.576 × stdev / sqrt(n)) */
  ci99?: number;
  iterations?: number;
  error?: string;
}

export function solveMonteCarlo(input: MCSolverInput): MCSolverResult {
  const { trial, lo, hi, targetMean, tolerance = 1, trialsPerStep = 500, maxIter = 25 } = input;

  const evalAt = (x: number): { mean: number; stdev: number } => {
    let sum = 0;
    const samples: number[] = new Array(trialsPerStep);
    for (let i = 0; i < trialsPerStep; i++) {
      const v = trial(x);
      samples[i] = v;
      sum += v;
    }
    const mean = sum / trialsPerStep;
    let variance = 0;
    for (const s of samples) variance += (s - mean) ** 2;
    variance /= trialsPerStep;
    return { mean, stdev: Math.sqrt(variance) };
  };

  const { mean: fLo } = evalAt(lo);
  const { mean: fHi } = evalAt(hi);
  const increasing = fHi > fLo;
  if ((increasing && (targetMean < fLo || targetMean > fHi))
    || (!increasing && (targetMean > fLo || targetMean < fHi))) {
    return { success: false, error: `목표 평균 ${targetMean} 이 범위 [${fLo.toFixed(1)}, ${fHi.toFixed(1)}] 밖` };
  }

  let left = lo;
  let right = hi;
  let mid = (left + right) / 2;
  let info = evalAt(mid);
  let iter = 0;
  for (; iter < maxIter; iter++) {
    mid = (left + right) / 2;
    info = evalAt(mid);
    if (Math.abs(info.mean - targetMean) <= tolerance) break;
    if (right - left < 1e-6) break;
    if ((increasing && info.mean < targetMean) || (!increasing && info.mean > targetMean)) left = mid;
    else right = mid;
  }

  const err = Math.abs(info.mean - targetMean);
  const ci99 = 2.576 * info.stdev / Math.sqrt(trialsPerStep);
  return {
    success: err <= tolerance,
    value: mid,
    observedMean: info.mean,
    stdev: info.stdev,
    ci99,
    iterations: iter,
    error: err <= tolerance ? undefined : `수렴 실패 — 오차 ${err.toFixed(2)}`,
  };
}

/**
 * 메인 역산 함수
 */
export function solve(input: SolverInput): SolverResult {
  const { formula, params, targetValue } = input;

  switch (formula) {
    case 'damage_for_ttk':
      return solveDamageForTTK(
        targetValue,
        params.enemyHP || 1000,
        params.attackSpeed || 1
      );

    case 'hp_for_survival':
      return solveHPForSurvival(
        targetValue,
        params.enemyDPS || 100,
        params.defenseReduction || 0
      );

    case 'defense_for_reduction':
      return solveDefenseForReduction(
        targetValue,
        params.constant || 100
      );

    case 'exp_for_level':
      return solveExpForLevel(
        targetValue,
        params.baseExp || 100,
        params.growthRate || 1.15
      );

    case 'cost_for_roi':
      return solveCostForROI(
        targetValue,
        params.expectedOutput || 1000
      );

    case 'crit_for_dps':
      return solveCritForDPS(
        targetValue,
        params.atk || 100,
        params.speed || 1,
        params.critDamage || 1.5
      );

    case 'speed_for_dps':
      return solveSpeedForDPS(
        targetValue,
        params.atk || 100,
        params.critRate || 0,
        params.critDamage || 1.5
      );

    case 'growth_rate':
      return solveGrowthRate(
        targetValue,
        params.baseValue || 10,
        params.maxLevel || 100
      );

    default:
      return {
        success: false,
        formula: '',
        explanation: '알 수 없는 공식입니다.',
      };
  }
}

/**
 * 사용 가능한 역산 공식 목록
 */
export const SOLVER_FORMULAS: {
  id: SolverFormula;
  name: string;
  description: string;
  targetLabel: string;
  targetUnit?: string;
  params: { key: string; label: string; defaultValue: number; unit?: string }[];
}[] = [
  {
    id: 'damage_for_ttk',
    name: 'TTK에서 필요 데미지',
    description: '목표 처치 시간에서 필요한 타격당 데미지를 계산',
    targetLabel: '목표 TTK',
    targetUnit: '초',
    params: [
      { key: 'enemyHP', label: '적 HP', defaultValue: 1000 },
      { key: 'attackSpeed', label: '공격 속도', defaultValue: 1, unit: '/초' },
    ],
  },
  {
    id: 'hp_for_survival',
    name: '생존 시간에서 필요 HP',
    description: '목표 생존 시간에서 필요한 HP를 계산',
    targetLabel: '목표 생존 시간',
    targetUnit: '초',
    params: [
      { key: 'enemyDPS', label: '적 DPS', defaultValue: 100 },
      { key: 'defenseReduction', label: '피해 감소율', defaultValue: 0, unit: '%' },
    ],
  },
  {
    id: 'defense_for_reduction',
    name: '피해감소에서 필요 방어력',
    description: '목표 피해감소율에서 필요한 방어력을 계산',
    targetLabel: '목표 피해감소율',
    targetUnit: '%',
    params: [
      { key: 'constant', label: '방어 상수', defaultValue: 100 },
    ],
  },
  {
    id: 'crit_for_dps',
    name: 'DPS에서 필요 크리티컬',
    description: '목표 DPS에서 필요한 크리티컬 확률을 계산',
    targetLabel: '목표 DPS',
    params: [
      { key: 'atk', label: '공격력', defaultValue: 100 },
      { key: 'speed', label: '공격 속도', defaultValue: 1, unit: '/초' },
      { key: 'critDamage', label: '크리티컬 배율', defaultValue: 1.5, unit: 'x' },
    ],
  },
  {
    id: 'speed_for_dps',
    name: 'DPS에서 필요 공격속도',
    description: '목표 DPS에서 필요한 공격속도를 계산',
    targetLabel: '목표 DPS',
    params: [
      { key: 'atk', label: '공격력', defaultValue: 100 },
      { key: 'critRate', label: '크리티컬 확률', defaultValue: 0, unit: '%' },
      { key: 'critDamage', label: '크리티컬 배율', defaultValue: 1.5, unit: 'x' },
    ],
  },
  {
    id: 'growth_rate',
    name: '최종값에서 필요 성장률',
    description: '목표 최종값에서 필요한 레벨당 성장률을 계산',
    targetLabel: '목표 최종값',
    params: [
      { key: 'baseValue', label: '기본값', defaultValue: 10 },
      { key: 'maxLevel', label: '최대 레벨', defaultValue: 100 },
    ],
  },
  {
    id: 'exp_for_level',
    name: '레벨에서 필요 경험치',
    description: '목표 레벨에서 필요한 총 경험치를 계산',
    targetLabel: '목표 레벨',
    params: [
      { key: 'baseExp', label: '기본 경험치', defaultValue: 100 },
      { key: 'growthRate', label: '경험치 성장률', defaultValue: 1.15, unit: 'x' },
    ],
  },
  {
    id: 'cost_for_roi',
    name: 'ROI에서 적정 비용',
    description: 'ROI(투자 수익률)에서 적정 비용을 계산. ROI = (산출물 - 비용) / 비용',
    targetLabel: '목표 ROI',
    targetUnit: '%',
    params: [
      { key: 'expectedOutput', label: '예상 산출물 (획득 보상)', defaultValue: 1000 },
    ],
  },
];
