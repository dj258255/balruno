/**
 * 통계 함수 — 합계, 평균, 중앙값, 표준편차, 분산.
 */

export function SUM(...values: number[]): number {
  return values.flat().reduce((a, b) => a + b, 0);
}

export function AVERAGE(...values: number[]): number {
  const flat = values.flat();
  return flat.length > 0 ? SUM(...flat) / flat.length : 0;
}

export function MIN(...values: number[]): number {
  return Math.min(...values.flat());
}

export function MAX(...values: number[]): number {
  return Math.max(...values.flat());
}

export function COUNT(...values: number[]): number {
  return values.flat().filter((v) => typeof v === 'number' && !isNaN(v)).length;
}

export function MEDIAN(...values: number[]): number {
  const sorted = values.flat().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function STDEV(...values: number[]): number {
  const flat = values.flat();
  const avg = AVERAGE(...flat);
  const squareDiffs = flat.map((v) => Math.pow(v - avg, 2));
  return Math.sqrt(AVERAGE(...squareDiffs));
}

export function VARIANCE(...values: number[]): number {
  const flat = values.flat();
  const avg = AVERAGE(...flat);
  const squareDiffs = flat.map((v) => Math.pow(v - avg, 2));
  return AVERAGE(...squareDiffs);
}
