/**
 * 확률 / 복리 / 랜덤 — 최소 1회 성공 확률, 기대 시도, 복리, RNG.
 */

import { CLAMP } from './math';

/** 최소 1회 성공 확률 (반복 시행) */
export function CHANCE(baseChance: number, attempts: number): number {
  return 1 - Math.pow(1 - CLAMP(baseChance, 0, 1), attempts);
}

/** 1회 성공까지 평균 시도 횟수 (기하분포 기대값) */
export function EXPECTED_ATTEMPTS(successRate: number): number {
  if (successRate <= 0) return Infinity;
  if (successRate >= 1) return 1;
  return 1 / successRate;
}

/** 복리 성장 */
export function COMPOUND(principal: number, rate: number, periods: number): number {
  return principal * Math.pow(1 + rate, periods);
}

// ==== 랜덤 (시드 없음) ====

export function RAND(): number {
  return Math.random();
}

export function RANDBETWEEN(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
