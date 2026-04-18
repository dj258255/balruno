/**
 * 조건/논리 함수 — Excel 호환.
 */

export function IF(
  condition: boolean | number,
  trueValue: number,
  falseValue: number
): number {
  return condition ? trueValue : falseValue;
}

export function AND(...values: (boolean | number)[]): boolean {
  return values.every((v) => Boolean(v));
}

export function OR(...values: (boolean | number)[]): boolean {
  return values.some((v) => Boolean(v));
}

export function NOT(value: boolean | number): boolean {
  return !value;
}
