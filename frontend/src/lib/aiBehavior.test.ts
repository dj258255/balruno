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

describe('skill_cooldown_ready', () => {
  it('skillReady 에 true 면 조건 만족', () => {
    const ctx2 = { ...ctx, skillReady: { ultimate: true, heal: false } };
    expect(
      evaluateCondition({ type: 'skill_cooldown_ready', skillId: 'ultimate' }, ctx2),
    ).toBe(true);
  });

  it('skillReady 에 false 면 조건 불만족', () => {
    const ctx2 = { ...ctx, skillReady: { ultimate: false } };
    expect(
      evaluateCondition({ type: 'skill_cooldown_ready', skillId: 'ultimate' }, ctx2),
    ).toBe(false);
  });

  it('skillReady 자체가 없으면 불만족 (안전 기본값)', () => {
    expect(
      evaluateCondition({ type: 'skill_cooldown_ready', skillId: 'ultimate' }, ctx),
    ).toBe(false);
  });

  it('skillId 빠지면 불만족', () => {
    const ctx2 = { ...ctx, skillReady: { ultimate: true } };
    expect(evaluateCondition({ type: 'skill_cooldown_ready' }, ctx2)).toBe(false);
  });

  it('evaluateRules: 얼티밋 준비되면 해당 스킬 사용, 아니면 attack', () => {
    const rules = [
      {
        id: 'ult-ready',
        name: '얼티밋 발동',
        condition: { type: 'skill_cooldown_ready' as const, skillId: 'ultimate' },
        action: { type: 'skill' as const, skillId: 'ultimate' },
      },
      {
        id: 'fallback',
        name: '기본 공격',
        condition: { type: 'always' as const },
        action: { type: 'attack' as const },
      },
    ];
    const ready = { ...ctx, skillReady: { ultimate: true } };
    const notReady = { ...ctx, skillReady: { ultimate: false } };
    expect(evaluateRules(rules, ready, 100)).toEqual({ type: 'skill', skillId: 'ultimate' });
    expect(evaluateRules(rules, notReady, 100)).toEqual({ type: 'attack' });
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
