import { describe, it, expect } from 'vitest';
import { solveGeneric, calculateStatWeights, solvePareto, solveMonteCarlo, findAlternativeSolutions } from './goalSolver';

describe('solveGeneric (범용 수식 역산)', () => {
  it('선형: atk * 2 = 200 → atk = 100', () => {
    const r = solveGeneric({
      expression: 'atk * 2',
      fixedVars: {},
      solveFor: 'atk',
      target: 200,
    });
    expect(r.success).toBe(true);
    expect(r.value).toBeCloseTo(100, 1);
  });

  it('DAMAGE 역산: atk * (100 / (100 + def)) = 50, def=100 → atk=100', () => {
    const r = solveGeneric({
      expression: 'atk * (100 / (100 + def))',
      fixedVars: { def: 100 },
      solveFor: 'atk',
      target: 50,
    });
    expect(r.success).toBe(true);
    expect(r.value).toBeCloseTo(100, 1);
  });

  it('범위 밖 목표값 — 친절한 에러', () => {
    const r = solveGeneric({
      expression: 'x * 2',
      fixedVars: {},
      solveFor: 'x',
      target: 500000,
      lo: 1,
      hi: 100, // max output = 200
    });
    expect(r.success).toBe(false);
    expect(r.error).toContain('범위');
  });

  it('파싱 실패 — 잘못된 수식 (괄호 불균형)', () => {
    const r = solveGeneric({
      expression: '((atk + 2',
      fixedVars: {},
      solveFor: 'atk',
      target: 10,
    });
    expect(r.success).toBe(false);
    expect(r.error).toBeDefined();
  });

  it('mathjs 함수 지원: sqrt(x) = 10 → x ≈ 100', () => {
    const r = solveGeneric({
      expression: 'sqrt(x)',
      fixedVars: {},
      solveFor: 'x',
      target: 10,
      lo: 0.01,
      hi: 1000,
      tolerance: 0.01,
    });
    expect(r.success).toBe(true);
    expect(r.value).toBeCloseTo(100, 0);
  });

  it('단조 감소 함수도 처리', () => {
    // 100 - x = 70 → x = 30
    const r = solveGeneric({
      expression: '100 - x',
      fixedVars: {},
      solveFor: 'x',
      target: 70,
      lo: 0,
      hi: 100,
    });
    expect(r.success).toBe(true);
    expect(r.value).toBeCloseTo(30, 1);
  });

  it('여러 고정 변수 조합', () => {
    // (a + b) * c = 100, a=10, c=5 → b=10
    const r = solveGeneric({
      expression: '(a + b) * c',
      fixedVars: { a: 10, c: 5 },
      solveFor: 'b',
      target: 100,
    });
    expect(r.success).toBe(true);
    expect(r.value).toBeCloseTo(10, 1);
  });
});

describe('calculateStatWeights', () => {
  it('DPS weights — damage 가 attackSpeed 보다 높은 기여도 (당연)', () => {
    const evaluate = (s: Record<string, number>) =>
      s.damage * (1 + s.critRate * (s.critDamage - 1)) * s.attackSpeed;
    const weights = calculateStatWeights({
      evaluate,
      currentStats: { damage: 100, attackSpeed: 1, critRate: 0.2, critDamage: 2 },
      deltas: { critRate: 0.01 },
    });
    expect(weights.length).toBe(4);
    // weight 내림차순 정렬
    for (let i = 1; i < weights.length; i++) {
      expect(Math.abs(weights[i - 1].weight)).toBeGreaterThanOrEqual(Math.abs(weights[i].weight));
    }
  });

  it('정규화 normalized — 최대 |weight| = 1.0', () => {
    const evaluate = (s: Record<string, number>) => s.a * 10 + s.b * 1;
    const weights = calculateStatWeights({
      evaluate,
      currentStats: { a: 1, b: 1 },
    });
    const maxNorm = Math.max(...weights.map((w) => Math.abs(w.normalized)));
    expect(maxNorm).toBeCloseTo(1.0, 5);
  });
});

describe('solvePareto', () => {
  it('EHP 목표 만족하는 HP × DEF 조합 찾기', () => {
    const points = solvePareto({
      varX: { key: 'hp', min: 1000, max: 5000, step: 500 },
      varY: { key: 'def', min: 0, max: 300, step: 50 },
      metric: (hp, def) => hp * (1 + def / 100),
      metricTarget: 3000,
      cost: (hp, def) => hp + def * 3,
    });
    expect(points.length).toBeGreaterThan(0);
    // 최소 cost 가 맨 앞
    for (let i = 1; i < points.length; i++) {
      expect(points[i - 1].costValue).toBeLessThanOrEqual(points[i].costValue);
    }
    // 모든 점이 metricTarget 이상
    for (const p of points) {
      expect(p.metricValue).toBeGreaterThanOrEqual(3000);
    }
  });

  it('범위 내 해 없으면 빈 배열', () => {
    const points = solvePareto({
      varX: { key: 'x', min: 0, max: 10, step: 1 },
      varY: { key: 'y', min: 0, max: 10, step: 1 },
      metric: (x, y) => x + y,
      metricTarget: 1000,
      cost: (x, y) => x + y,
    });
    expect(points).toEqual([]);
  });
});

describe('solveMonteCarlo', () => {
  it('결정론적 함수 (random 없음) — bisection 과 동일', () => {
    const r = solveMonteCarlo({
      trial: (x) => x * 2, // 랜덤 없음
      lo: 1,
      hi: 1000,
      targetMean: 200,
      tolerance: 1,
      trialsPerStep: 10, // 랜덤 없으므로 적게
    });
    expect(r.success).toBe(true);
    expect(r.value).toBeCloseTo(100, 0);
  });

  it('확률 포함 — 평균이 목표에 수렴 + CI 계산', () => {
    // crit 확률 50% 시 기대 dmg = damage * 1.5
    const r = solveMonteCarlo({
      trial: (damage) => (Math.random() < 0.5 ? damage * 2 : damage),
      lo: 1,
      hi: 1000,
      targetMean: 150, // damage=100 이면 기대값 150
      tolerance: 5,
      trialsPerStep: 1000,
    });
    expect(r.success).toBe(true);
    expect(r.value).toBeCloseTo(100, -1); // ±10 이내
    expect(r.ci99).toBeGreaterThan(0);
    expect(r.stdev).toBeGreaterThan(0);
  });
});

describe('findAlternativeSolutions', () => {
  it('단조 함수 — 대체 해 없음', () => {
    const alts = findAlternativeSolutions(
      { formula: 'damage_for_ttk', params: { enemyHP: 1000, attackSpeed: 1 }, targetValue: 10 },
      100,
    );
    expect(alts.length).toBe(0);
  });
});
