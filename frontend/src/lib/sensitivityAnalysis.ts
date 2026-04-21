/**
 * 민감도 분석 — 입력 변수를 흔들었을 때 출력이 얼마나 변하는지 측정.
 *
 * 두 가지 뷰:
 *  1. Tornado — 변수별 최대/최소 영향 (단일 변수 ± 변동)
 *  2. Spider  — 여러 변수의 범위 시리즈 (다변수 비교)
 *
 * 일반 formulaEngine 과 분리된 순수 함수로 구현. UI 는 panel 에서 재사용.
 */

export interface TornadoBar {
  variable: string;
  baseline: number;   // 기준 결과
  low: number;        // 변수를 -variation 만큼 줄였을 때 결과
  high: number;       // 변수를 +variation 만큼 늘렸을 때 결과
  impact: number;     // |high - low| (정렬 기준)
}

export interface SpiderSeries {
  variable: string;
  points: { percent: number; value: number }[];  // percent: -50 ~ +50 (기준 0)
}

export interface SensitivityInput {
  name: string;
  value: number;
}

export type OutputFn = (inputs: Record<string, number>) => number;

/**
 * Tornado 분석 — 각 변수를 ±variation 비율만큼 흔들어 영향 측정.
 * @param inputs 기준 입력 세트
 * @param outputFn 결과 산출 함수
 * @param variation 변동 비율 (기본 0.2 = ±20%)
 */
export function tornadoAnalysis(
  inputs: SensitivityInput[],
  outputFn: OutputFn,
  variation: number = 0.2
): TornadoBar[] {
  if (inputs.length === 0) return [];

  const baseInputs = Object.fromEntries(inputs.map((i) => [i.name, i.value]));
  const baseline = safeCall(outputFn, baseInputs);

  const bars: TornadoBar[] = inputs.map((input) => {
    const low = { ...baseInputs, [input.name]: input.value * (1 - variation) };
    const high = { ...baseInputs, [input.name]: input.value * (1 + variation) };
    const lowOut = safeCall(outputFn, low);
    const highOut = safeCall(outputFn, high);
    return {
      variable: input.name,
      baseline,
      low: lowOut,
      high: highOut,
      impact: Math.abs(highOut - lowOut),
    };
  });

  // 영향 큰 순서로 정렬
  bars.sort((a, b) => b.impact - a.impact);
  return bars;
}

/**
 * Spider 분석 — 변수별로 -50%~+50% 스윕, 시리즈로 반환.
 * 다변수를 한 차트에 겹쳐 그릴 때 사용.
 * @param steps 샘플링 스텝 수 (기본 11 = -50, -40, ..., +50)
 * @param range 스윕 범위 (기본 0.5 = ±50%)
 */
export function spiderAnalysis(
  inputs: SensitivityInput[],
  outputFn: OutputFn,
  steps: number = 11,
  range: number = 0.5
): SpiderSeries[] {
  if (inputs.length === 0) return [];

  const baseInputs = Object.fromEntries(inputs.map((i) => [i.name, i.value]));

  return inputs.map((input) => {
    const points: { percent: number; value: number }[] = [];
    for (let i = 0; i < steps; i++) {
      const percent = -range + (2 * range * i) / (steps - 1);
      const test = { ...baseInputs, [input.name]: input.value * (1 + percent) };
      const value = safeCall(outputFn, test);
      points.push({ percent: percent * 100, value });
    }
    return { variable: input.name, points };
  });
}

/**
 * 민감도 점수 — 각 변수의 상대적 민감도 (0~1).
 * 가장 민감한 변수 = 1.0, 비례 축소.
 */
export function sensitivityScore(bars: TornadoBar[]): Map<string, number> {
  const maxImpact = bars.reduce((m, b) => Math.max(m, b.impact), 0);
  const map = new Map<string, number>();
  if (maxImpact === 0) return map;
  bars.forEach((b) => map.set(b.variable, b.impact / maxImpact));
  return map;
}

function safeCall(fn: OutputFn, inputs: Record<string, number>): number {
  try {
    const v = fn(inputs);
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}
