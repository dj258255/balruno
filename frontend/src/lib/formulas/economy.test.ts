/**
 * F2P 경제 수식 단위 테스트.
 */

import { describe, it, expect } from 'vitest';
import {
  LTV, ARPU, ARPDAU, ARPPU, STICKINESS, RETENTION, CHURN_RATE, K_FACTOR,
  PAYBACK_PERIOD, CAC, ROAS, CONVERSION_RATE, WHALE_CURVE, FUNNEL_CONVERSION,
  COHORT_RETENTION, PAYBACK_CURVE, ENGAGEMENT_SCORE, ELASTICITY, VIRALITY, MARGIN,
} from './economy';

describe('F2P 경제 수식', () => {
  it('LTV: arpdau/churn', () => {
    expect(LTV(0.2, 0.05)).toBeCloseTo(4, 2);
    expect(LTV(0, 0.05)).toBe(0);
    expect(LTV(0.2, 0)).toBe(Infinity);
    expect(LTV(0.2, 1)).toBe(Infinity);
  });

  it('ARPU / ARPDAU / ARPPU', () => {
    expect(ARPU(10000, 5000)).toBe(2);
    expect(ARPDAU(1000, 500)).toBe(2);
    expect(ARPPU(5000, 100)).toBe(50);
    expect(ARPU(100, 0)).toBe(0);
  });

  it('STICKINESS: DAU/MAU 비율 0-1 클램프', () => {
    expect(STICKINESS(1000, 5000)).toBe(0.2);
    expect(STICKINESS(6000, 5000)).toBe(1); // 클램프
    expect(STICKINESS(1000, 0)).toBe(0);
  });

  it('RETENTION 지수 감소', () => {
    const day1 = 0.4;
    expect(RETENTION(day1, 1, 0.05)).toBeCloseTo(0.4);
    expect(RETENTION(day1, 30, 0.05)).toBeLessThan(0.4);
    // 더 높은 lambda = 빠른 감소
    expect(RETENTION(day1, 30, 0.1)).toBeLessThan(RETENTION(day1, 30, 0.05));
  });

  it('CHURN_RATE', () => {
    expect(CHURN_RATE(0.4)).toBeCloseTo(0.6);
    expect(CHURN_RATE(0)).toBe(1);
    expect(CHURN_RATE(1)).toBe(0);
    expect(CHURN_RATE(1.5)).toBe(0); // 클램프
  });

  it('K_FACTOR', () => {
    expect(K_FACTOR(3, 0.2)).toBeCloseTo(0.6);
    expect(K_FACTOR(5, 0)).toBe(0);
    expect(K_FACTOR(5, 1.5)).toBe(5); // 클램프
  });

  it('PAYBACK_PERIOD / CAC / ROAS', () => {
    expect(PAYBACK_PERIOD(10, 0.5)).toBe(20);
    expect(PAYBACK_PERIOD(10, 0)).toBe(Infinity);
    expect(CAC(1000, 100)).toBe(10);
    expect(ROAS(500, 100)).toBe(5);
    expect(ROAS(100, 0)).toBe(0);
  });

  it('CONVERSION_RATE', () => {
    expect(CONVERSION_RATE(50, 500)).toBe(0.1);
    expect(CONVERSION_RATE(0, 100)).toBe(0);
    expect(CONVERSION_RATE(100, 0)).toBe(0);
  });

  it('WHALE_CURVE: 80/20 규칙', () => {
    // 상위 20% 가 80% 점유일 때, 20% percentile 에서 cumShare 는 ~80%
    const result = WHALE_CURVE(0.2, 0.2, 0.8);
    expect(result).toBeGreaterThan(0.75);
    expect(result).toBeLessThan(0.85);
  });

  it('FUNNEL_CONVERSION: 각 단계 곱', () => {
    expect(FUNNEL_CONVERSION(0.5, 0.4, 0.2)).toBeCloseTo(0.04);
    expect(FUNNEL_CONVERSION(1, 1, 1)).toBe(1);
    expect(FUNNEL_CONVERSION(0)).toBe(0);
  });

  it('COHORT_RETENTION 멱함수', () => {
    const d1 = COHORT_RETENTION(0.4, 1, 0.6);
    const d30 = COHORT_RETENTION(0.4, 30, 0.6);
    expect(d1).toBeCloseTo(0.4);
    expect(d30).toBeLessThan(d1);
    expect(d30).toBeGreaterThan(0);
  });

  it('PAYBACK_CURVE 누적 증가', () => {
    const d7 = PAYBACK_CURVE(0.2, 0.4, 7, 0.6);
    const d30 = PAYBACK_CURVE(0.2, 0.4, 30, 0.6);
    expect(d30).toBeGreaterThan(d7);
  });

  it('ENGAGEMENT_SCORE 0-100', () => {
    const low = ENGAGEMENT_SCORE(5, 1, 2);
    const high = ENGAGEMENT_SCORE(60, 10, 10);
    expect(low).toBeGreaterThanOrEqual(0);
    expect(high).toBe(100);
  });

  it('ELASTICITY', () => {
    // 가격 +40%, 수량 -20% → 탄력성 -0.5
    const e = ELASTICITY(1000, 800, 5, 7);
    expect(e).toBeCloseTo(-0.5, 1);
  });

  it('VIRALITY 수렴', () => {
    // k<1 일 때 기하급수 합
    expect(VIRALITY(100, 0.5, 10)).toBeGreaterThan(100);
    expect(VIRALITY(100, 0, 10)).toBe(100);
    // k=1 인 경우 (seed + 세대별 동일)
    expect(VIRALITY(100, 1, 3)).toBe(400);
  });

  it('MARGIN', () => {
    expect(MARGIN(1000, 300)).toBeCloseTo(0.7);
    expect(MARGIN(1000, 1000)).toBe(0);
    expect(MARGIN(0, 100)).toBe(0);
  });
});
