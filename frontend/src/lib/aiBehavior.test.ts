import { describe, it, expect } from 'vitest';
import { evaluateCondition, evaluateRules, RULE_PRESETS, type BehaviorContext } from './aiBehavior';

const ctx: BehaviorContext = {
  selfHp: 50,
  selfMaxHp: 100,
  enemyHpSamples: [{ id: 'e1', hp: 20, maxHp: 100 }, { id: 'e2', hp: 80, maxHp: 100 }],
  turn: 3,
  aliveEnemyCount: 2,
};

describe('evaluateCondition', () => {
  it('self_hp_pct < 60 → true (현재 50%)', () => {
    expect(evaluateCondition({ type: 'self_hp_pct', op: '<', value: 60 }, ctx)).toBe(true);
  });

  it('enemy_hp_pct < 30 → true (최저 적 20%)', () => {
    expect(evaluateCondition({ type: 'enemy_hp_pct', op: '<', value: 30 }, ctx)).toBe(true);
  });

  it('turn >= 5 → false (현재 3턴)', () => {
    expect(evaluateCondition({ type: 'turn', op: '>=', value: 5 }, ctx)).toBe(false);
  });

  it('always → true', () => {
    expect(evaluateCondition({ type: 'always' }, ctx)).toBe(true);
  });
});

describe('evaluateRules', () => {
  it('aggressive: 적 빈사 → target_lowest_hp', () => {
    const action = evaluateRules(RULE_PRESETS.aggressive, ctx, 100);
    expect(action.type).toBe('target_lowest_hp');
  });

  it('defensive: 내 HP 낮을 때 defensive', () => {
    const lowHp = { ...ctx, selfHp: 20 };
    const action = evaluateRules(RULE_PRESETS.defensive, lowHp, 100);
    expect(action.type).toBe('defensive');
  });

  it('decisionSkill 0 → 규칙 무시하고 attack', () => {
    const action = evaluateRules(RULE_PRESETS.aggressive, ctx, 0);
    expect(action.type).toBe('attack');
  });
});
