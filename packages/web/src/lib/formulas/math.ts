/**
 * 수학 유틸리티 — 보간, 범위 제한, Excel 호환 함수, 삼각함수, 상수.
 */

/** 값을 [min, max] 범위로 제한 */
export function CLAMP(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** 선형 보간 (t는 0~1로 clamp됨) */
export function LERP(start: number, end: number, t: number): number {
  return start + (end - start) * CLAMP(t, 0, 1);
}

/** 역 선형 보간 — 값이 [start, end] 범위에서 어느 위치인지 (0~1) */
export function INVERSE_LERP(start: number, end: number, value: number): number {
  if (start === end) return 0;
  return CLAMP((value - start) / (end - start), 0, 1);
}

/** 값을 한 범위에서 다른 범위로 매핑 */
export function REMAP(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  const t = INVERSE_LERP(inMin, inMax, value);
  return LERP(outMin, outMax, t);
}

// ==== Excel 호환 수학 함수 ====

export function POWER(base: number, exponent: number): number {
  return Math.pow(base, exponent);
}

export function ABS(value: number): number {
  return Math.abs(value);
}

export function ROUND(value: number, decimals: number = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function FLOOR(value: number, decimals: number = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.floor(value * factor) / factor;
}

export function CEIL(value: number, decimals: number = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.ceil(value * factor) / factor;
}

export function SQRT(value: number): number {
  return Math.sqrt(value);
}

export function LOG(value: number, base?: number): number {
  if (base) return Math.log(value) / Math.log(base);
  return Math.log(value);
}

export function LOG10(value: number): number {
  return Math.log10(value);
}

export function LOG2(value: number): number {
  return Math.log2(value);
}

export function EXP(value: number): number {
  return Math.exp(value);
}

export function MOD(value: number, divisor: number): number {
  return value % divisor;
}

export function SIGN(value: number): number {
  return Math.sign(value);
}

export function TRUNC(value: number, decimals: number = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.trunc(value * factor) / factor;
}

// ==== 삼각함수 ====

export function SIN(value: number): number {
  return Math.sin(value);
}

export function COS(value: number): number {
  return Math.cos(value);
}

export function TAN(value: number): number {
  return Math.tan(value);
}

export function ASIN(value: number): number {
  return Math.asin(value);
}

export function ACOS(value: number): number {
  return Math.acos(value);
}

export function ATAN(value: number): number {
  return Math.atan(value);
}

export function ATAN2(y: number, x: number): number {
  return Math.atan2(y, x);
}

export function DEGREES(radians: number): number {
  return radians * (180 / Math.PI);
}

export function RADIANS(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// ==== 상수 ====

export const PI = Math.PI;
export const E = Math.E;
