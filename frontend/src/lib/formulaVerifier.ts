/**
 * 게임 수식 검증기 — 실측 데이터 vs 가정 수식의 회귀 분석.
 *
 * 게임 기획자 / 데이터 엔지니어 workflow:
 *  1. 레벨 1~99 의 "필요 경험치" 테이블이 있음
 *  2. 수식 assumption: "XP(L) = 100 × L^1.8"
 *  3. 이 가정이 맞는지? 어느 레벨에서 벗어나는지?
 *
 * 이 lib 가 하는 것:
 *  - 주어진 (x, y) 관측값과 예측 함수 f(x) 로 잔차 계산
 *  - R² (결정계수), RMSE, MAE 계산
 *  - 이상치 (outlier) 자동 탐지 — 잔차 > 2σ
 *  - 몇몇 표준 수식 프리셋 제공 (linear / power / exp / log / polynomial)
 */

export interface DataPoint {
  x: number;
  y: number;
  /** 선택: 라벨 (레벨명 등) */
  label?: string;
}

export interface FormulaSpec {
  id: string;
  name: string;
  /** 사람이 읽기 — "y = a × x^b" 형식 */
  expression: string;
  /** 계수 — 대부분 2개 (a, b). polynomial 은 [a0, a1, a2] 등 */
  params: number[];
  /** 함수 본체 */
  fn: (x: number, params: number[]) => number;
}

export interface VerificationResult {
  residuals: Array<{ x: number; yObserved: number; yPredicted: number; residual: number; residualPct: number; isOutlier: boolean; label?: string }>;
  r2: number;
  rmse: number;
  mae: number;
  /** 잔차 2σ 초과 이상치 개수 */
  outlierCount: number;
  /** 잔차 평균 (bias) */
  residualMean: number;
  /** 잔차 표준편차 */
  residualStdev: number;
}

// ============================================================================
// 기본 수식 프리셋
// ============================================================================

export const FORMULA_PRESETS: FormulaSpec[] = [
  {
    id: 'linear',
    name: '선형',
    expression: 'y = a + b × x',
    params: [0, 1],
    fn: (x, [a, b]) => a + b * x,
  },
  {
    id: 'power',
    name: '멱함수 (RPG 성장 곡선)',
    expression: 'y = a × x^b',
    params: [100, 1.8],
    fn: (x, [a, b]) => a * Math.pow(x, b),
  },
  {
    id: 'exp',
    name: '지수 함수',
    expression: 'y = a × b^x',
    params: [10, 1.3],
    fn: (x, [a, b]) => a * Math.pow(b, x),
  },
  {
    id: 'log',
    name: '로그 함수 (수확 체감)',
    expression: 'y = a + b × ln(x)',
    params: [0, 10],
    fn: (x, [a, b]) => a + b * Math.log(Math.max(0.01, x)),
  },
  {
    id: 'quadratic',
    name: '이차 다항식',
    expression: 'y = a + b×x + c×x²',
    params: [0, 0, 1],
    fn: (x, [a, b, c]) => a + b * x + c * x * x,
  },
  {
    id: 'cubic',
    name: '삼차 다항식',
    expression: 'y = a + b×x + c×x² + d×x³',
    params: [0, 0, 0, 1],
    fn: (x, [a, b, c, d]) => a + b * x + c * x * x + d * x * x * x,
  },
];

// ============================================================================
// 검증 — 잔차 / R² / 이상치
// ============================================================================

export function verifyFormula(
  data: DataPoint[],
  formula: FormulaSpec,
): VerificationResult {
  if (data.length === 0) {
    return {
      residuals: [],
      r2: 0, rmse: 0, mae: 0,
      outlierCount: 0, residualMean: 0, residualStdev: 0,
    };
  }

  const yMean = data.reduce((s, p) => s + p.y, 0) / data.length;
  const ssTot = data.reduce((s, p) => s + (p.y - yMean) ** 2, 0);

  const residualsOnly: number[] = [];
  const initial = data.map((p) => {
    const yPredicted = formula.fn(p.x, formula.params);
    const residual = p.y - yPredicted;
    residualsOnly.push(residual);
    return {
      x: p.x,
      yObserved: p.y,
      yPredicted,
      residual,
      residualPct: p.y !== 0 ? (residual / p.y) * 100 : 0,
      label: p.label,
    };
  });

  const ssRes = residualsOnly.reduce((s, r) => s + r * r, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  const rmse = Math.sqrt(ssRes / data.length);
  const mae = residualsOnly.reduce((s, r) => s + Math.abs(r), 0) / data.length;
  const residualMean = residualsOnly.reduce((s, r) => s + r, 0) / data.length;
  const residualStdev = Math.sqrt(
    residualsOnly.reduce((s, r) => s + (r - residualMean) ** 2, 0) / Math.max(1, data.length - 1),
  );

  // outlier: |residual - mean| > 2σ
  const threshold = residualStdev * 2;
  const residuals = initial.map((r) => ({
    ...r,
    isOutlier: Math.abs(r.residual - residualMean) > threshold,
  }));
  const outlierCount = residuals.filter((r) => r.isOutlier).length;

  return {
    residuals,
    r2,
    rmse,
    mae,
    outlierCount,
    residualMean,
    residualStdev,
  };
}

// ============================================================================
// 파라미터 자동 피팅 — 단순 grid search + fine refinement
// ============================================================================

export interface FitResult {
  params: number[];
  r2: number;
  rmse: number;
}

/**
 * 간단한 grid search — 각 파라미터마다 ±50% 범위에서 20 스텝 탐색.
 * 최적 이후 3회 재귀적으로 범위 좁혀서 fine-tune.
 *
 * scipy.optimize 급은 아니지만 단순 멱함수/지수 같은 케이스에 충분.
 */
export function fitFormula(
  data: DataPoint[],
  formula: FormulaSpec,
  iterations = 10,
): FitResult {
  if (data.length === 0 || formula.params.length === 0) {
    return { params: formula.params, r2: 0, rmse: 0 };
  }

  // 첫 iter 에 충분히 넓게 — 초기값 0 이어도 커버
  // y 범위 기반으로 scale 추정 (대략적인 magnitude)
  const yMax = Math.max(...data.map((p) => Math.abs(p.y)), 1);
  const xMax = Math.max(...data.map((p) => Math.abs(p.x)), 1);
  const scale = yMax / xMax;
  const ranges = formula.params.map((p) => Math.max(Math.abs(p) * 2, scale * 10, 10));
  const steps = 15;

  let best = { params: [...formula.params], r2: -Infinity, rmse: Infinity };

  const eval_ = (params: number[]) => {
    const r = verifyFormula(data, { ...formula, params });
    return { params: [...params], r2: r.r2, rmse: r.rmse };
  };

  const center = [...formula.params];
  for (let iter = 0; iter < iterations; iter++) {
    for (let p = 0; p < center.length; p++) {
      const current = [...center];
      const step = (ranges[p] * 2) / steps;
      let localBest = eval_(current);
      for (let i = 0; i <= steps; i++) {
        current[p] = center[p] - ranges[p] + i * step;
        const candidate = eval_(current);
        if (candidate.r2 > localBest.r2) localBest = candidate;
      }
      center[p] = localBest.params[p];
      if (localBest.r2 > best.r2) best = localBest;
    }
    // 범위를 최적 근처로 좁히되 너무 빨리 축소하지 않음
    for (let p = 0; p < ranges.length; p++) ranges[p] *= 0.5;
  }

  return best;
}
