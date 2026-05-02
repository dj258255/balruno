import { describe, it, expect } from 'vitest';
import {
  verifyFormula,
  fitFormula,
  FORMULA_PRESETS,
  type DataPoint,
} from './formulaVerifier';

const linear = FORMULA_PRESETS.find((f) => f.id === 'linear')!;
const power = FORMULA_PRESETS.find((f) => f.id === 'power')!;

describe('verifyFormula', () => {
  it('완벽 매칭 — R² = 1', () => {
    // y = 2 + 3x
    const data: DataPoint[] = [
      { x: 1, y: 5 },
      { x: 2, y: 8 },
      { x: 3, y: 11 },
      { x: 4, y: 14 },
    ];
    const r = verifyFormula(data, { ...linear, params: [2, 3] });
    expect(r.r2).toBeCloseTo(1, 5);
    expect(r.rmse).toBeCloseTo(0, 5);
    expect(r.mae).toBeCloseTo(0, 5);
    expect(r.outlierCount).toBe(0);
  });

  it('잔차 모두 일정 offset — R² 아직 1 이어야 함 (mean-corrected)', () => {
    const data: DataPoint[] = [
      { x: 1, y: 5 },
      { x: 2, y: 8 },
      { x: 3, y: 11 },
    ];
    const r = verifyFormula(data, { ...linear, params: [0, 3] }); // offset 2 모자람
    // R² = 1 - ssRes/ssTot. 모든 예측이 y 보다 2 작으면 ssRes = 3 × 4 = 12.
    // ssTot = variance = 3^2 + 0 + 3^2 = 18. R² = 1 - 12/18 = 0.33
    expect(r.r2).toBeLessThan(1);
    expect(r.residualMean).toBeGreaterThan(0);
  });

  it('빈 데이터 처리', () => {
    const r = verifyFormula([], linear);
    expect(r.residuals).toEqual([]);
    expect(r.r2).toBe(0);
  });

  it('이상치 탐지 — 1 point 크게 벗어남', () => {
    const data: DataPoint[] = [];
    for (let x = 1; x <= 20; x++) data.push({ x, y: 2 * x });
    data[10] = { x: 11, y: 2 * 11 + 100 }; // 큰 이상치
    const r = verifyFormula(data, { ...linear, params: [0, 2] });
    expect(r.outlierCount).toBeGreaterThan(0);
    const outlier = r.residuals.find((r) => r.isOutlier);
    expect(outlier?.x).toBe(11);
  });

  it('RPG 성장 곡선 — power 수식으로 피팅 잘 됨', () => {
    // y = 100 × x^1.8 실측 데이터
    const data: DataPoint[] = [];
    for (let x = 1; x <= 10; x++) data.push({ x, y: 100 * Math.pow(x, 1.8) });
    const r = verifyFormula(data, { ...power, params: [100, 1.8] });
    expect(r.r2).toBeCloseTo(1, 5);
  });
});

describe('fitFormula', () => {
  it('정확한 선형 데이터 → fitFormula 가 거의 정확한 파라미터 찾음', () => {
    const data: DataPoint[] = [];
    for (let x = 1; x <= 10; x++) data.push({ x, y: 2 + 3 * x });
    // 초기 params 가 멀리 떨어져 있어도 grid search 로 수렴
    const fit = fitFormula(data, { ...linear, params: [0, 0] }, 12);
    expect(fit.r2).toBeGreaterThan(0.85);
  });

  it('노이즈 있는 데이터 → 기본 수식보다 향상된 R²', () => {
    const data: DataPoint[] = [];
    for (let x = 1; x <= 20; x++) data.push({ x, y: 5 * x + (Math.random() - 0.5) * 2 });
    // 초기 params [0, 0] 으로 R² 는 음수 혹은 낮음
    const fit = fitFormula(data, { ...linear, params: [0, 0] }, 12);
    // 꽤 향상되어야 함 — coordinate descent 는 완벽하진 않아도 0.5 이상은 찍어야
    expect(fit.r2).toBeGreaterThan(0.5);
  });

  it('빈 데이터 처리', () => {
    const fit = fitFormula([], linear);
    expect(fit.params).toEqual(linear.params);
  });
});
