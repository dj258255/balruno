import { describe, it, expect } from 'vitest';
import { bisect } from './bisection';

describe('bisect', () => {
  it('선형 함수: f(x) = 2x 에서 f(x)=10 → x=5', () => {
    const r = bisect((x) => 2 * x, 10, { lo: 0, hi: 100 });
    expect(r?.converged).toBe(true);
    expect(r?.x).toBeCloseTo(5, 1);
  });

  it('단조 감소 함수도 처리', () => {
    // f(x) = 100 - x, f(x)=70 → x=30
    const r = bisect((x) => 100 - x, 70, { lo: 0, hi: 100 });
    expect(r?.converged).toBe(true);
    expect(r?.x).toBeCloseTo(30, 1);
  });

  it('범위 밖 target 은 null', () => {
    const r = bisect((x) => 2 * x, 500, { lo: 0, hi: 100 }); // max=200
    expect(r).toBeNull();
  });

  it('EHP 역산: HP 1000, damageReduction 0 에서 목표 EHP 1500 → DEF 는?', () => {
    // EHP = HP / (100 / (100 + def))  (LoL 스타일)
    const hp = 1000;
    const r = bisect((def) => hp * (100 + def) / 100, 1500, { lo: 0, hi: 500 });
    expect(r?.converged).toBe(true);
    expect(r?.x).toBeCloseTo(50, 0);
  });

  it('DPS 역산: damage 100, attackSpeed=? for DPS 300', () => {
    const r = bisect((atkSpd) => 100 * atkSpd, 300, { lo: 0.1, hi: 10 });
    expect(r?.converged).toBe(true);
    expect(r?.x).toBeCloseTo(3, 1);
  });

  it('tolerance 작으면 정밀도 ↑', () => {
    const r = bisect((x) => x * x, 25, { lo: 0, hi: 100, tolerance: 0.0001 });
    expect(r?.converged).toBe(true);
    expect(r?.x).toBeCloseTo(5, 3);
  });
});
