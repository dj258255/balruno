/**
 * AI Behavior Tree (rule-based) — 간소화된 Behavior Tree / Utility AI.
 *
 * 설계:
 *  - 규칙(BehaviorRule) 배열: 조건 + 액션
 *  - 우선순위 순서로 평가 → 첫 만족 조건이 선택됨 (Behavior Tree 의 Selector)
 *  - decisionSkill 로 규칙 준수 확률 제어 (낮으면 규칙 무시 → 랜덤)
 *
 * 조건 종류:
 *  - self_hp_below / self_hp_above — 자기 HP 비율
 *  - enemy_hp_below / enemy_hp_above — 적 HP 비율
 *  - enemy_count — 살아있는 적 수
 *  - turn_above / turn_below — 현재 턴
 *  - always — 항상 true (fallback 용)
 *
 * 액션 종류:
 *  - attack — 기본 공격
 *  - skill:<id> — 특정 스킬
 *  - target_lowest_hp / target_highest_hp / target_random — 타게팅 override
 *  - defensive — 방어 (힐/쉴드 스킬 우선)
 */

export type ConditionOp = '<' | '<=' | '>' | '>=' | '==' | '!=';

export interface BehaviorCondition {
  type:
    | 'self_hp_pct'
    | 'enemy_hp_pct'
    | 'enemy_count'
    | 'turn'
    | 'skill_cooldown_ready'
    | 'always';
  op?: ConditionOp;
  value?: number;
  /** skill_cooldown_ready 전용 — 이 스킬 id 가 쿨다운에서 내려왔는지 검사 */
  skillId?: string;
}

export type BehaviorAction =
  | { type: 'attack' }
  | { type: 'skill'; skillId: string }
  | { type: 'target_lowest_hp' }
  | { type: 'target_highest_atk' }
  | { type: 'target_random' }
  | { type: 'defensive' };

export interface BehaviorRule {
  id: string;
  name: string;
  condition: BehaviorCondition;
  action: BehaviorAction;
}

export interface BehaviorContext {
  selfHp: number;
  selfMaxHp: number;
  enemyHpSamples: { id: string; hp: number; maxHp: number }[];
  turn: number;
  aliveEnemyCount: number;
  /**
   * 스킬 id → 준비 여부. true = 쿨다운에서 내려옴(사용 가능), false = 쿨다운 중.
   * skill_cooldown_ready 조건에서 참조.
   */
  skillReady?: Record<string, boolean>;
}

// ============================================================================
// 조건 평가
// ============================================================================

function cmp(op: ConditionOp, a: number, b: number): boolean {
  switch (op) {
    case '<':  return a < b;
    case '<=': return a <= b;
    case '>':  return a > b;
    case '>=': return a >= b;
    case '==': return a === b;
    case '!=': return a !== b;
  }
}

export function evaluateCondition(cond: BehaviorCondition, ctx: BehaviorContext): boolean {
  if (cond.type === 'always') return true;
  if (cond.type === 'skill_cooldown_ready') {
    if (!cond.skillId) return false;
    return ctx.skillReady?.[cond.skillId] === true;
  }
  if (cond.value === undefined || !cond.op) return false;

  switch (cond.type) {
    case 'self_hp_pct': {
      const pct = (ctx.selfHp / ctx.selfMaxHp) * 100;
      return cmp(cond.op, pct, cond.value);
    }
    case 'enemy_hp_pct': {
      // 가장 낮은 HP% 의 적 기준
      const lowestPct = Math.min(
        ...ctx.enemyHpSamples.map((e) => (e.hp / e.maxHp) * 100),
      );
      return cmp(cond.op, lowestPct, cond.value);
    }
    case 'enemy_count':
      return cmp(cond.op, ctx.aliveEnemyCount, cond.value);
    case 'turn':
      return cmp(cond.op, ctx.turn, cond.value);
  }
}

// ============================================================================
// 규칙 체인 평가 — 첫 매칭 규칙의 액션 반환
// ============================================================================

export function evaluateRules(
  rules: BehaviorRule[],
  ctx: BehaviorContext,
  decisionSkill: number = 50,
): BehaviorAction {
  // Decision skill 기반 실수 확률
  // 0 = 초보 (항상 랜덤), 50 = 50%, 100 = 전문가 (규칙 준수)
  const follow = decisionSkill / 100;

  if (Math.random() > follow) {
    // 규칙 무시 — 기본 공격
    return { type: 'attack' };
  }

  for (const rule of rules) {
    if (evaluateCondition(rule.condition, ctx)) {
      return rule.action;
    }
  }

  // 매칭 규칙 없음 → 기본 공격
  return { type: 'attack' };
}

// ============================================================================
// 기본 규칙 프리셋 (각 장르별)
// ============================================================================

export const RULE_PRESETS: Record<string, BehaviorRule[]> = {
  aggressive: [
    {
      id: 'r1',
      name: '적 빈사면 마무리',
      condition: { type: 'enemy_hp_pct', op: '<', value: 30 },
      action: { type: 'target_lowest_hp' },
    },
    {
      id: 'r2',
      name: '항상 공격',
      condition: { type: 'always' },
      action: { type: 'attack' },
    },
  ],
  defensive: [
    {
      id: 'r1',
      name: '내 HP 낮으면 방어 스킬',
      condition: { type: 'self_hp_pct', op: '<', value: 30 },
      action: { type: 'defensive' },
    },
    {
      id: 'r2',
      name: '적 적으면 공격',
      condition: { type: 'enemy_count', op: '<=', value: 2 },
      action: { type: 'attack' },
    },
    {
      id: 'r3',
      name: '기본',
      condition: { type: 'always' },
      action: { type: 'target_lowest_hp' },
    },
  ],
  tactical: [
    {
      id: 'r1',
      name: '위험 → 방어',
      condition: { type: 'self_hp_pct', op: '<', value: 25 },
      action: { type: 'defensive' },
    },
    {
      id: 'r2',
      name: '강적 먼저 제거',
      condition: { type: 'always' },
      action: { type: 'target_highest_atk' },
    },
  ],
};

// ============================================================================
// UI 지원: 조건/액션 라벨
// ============================================================================

export const CONDITION_LABELS: Record<BehaviorCondition['type'], string> = {
  self_hp_pct: '내 HP %',
  enemy_hp_pct: '적 최소 HP %',
  enemy_count: '적 수',
  turn: '턴',
  skill_cooldown_ready: '스킬 사용 가능',
  always: '항상',
};

export const ACTION_LABELS: Record<BehaviorAction['type'], string> = {
  attack: '기본 공격',
  skill: '스킬 사용',
  target_lowest_hp: '최저 HP 적 타겟',
  target_highest_atk: '최고 ATK 적 타겟',
  target_random: '무작위 타겟',
  defensive: '방어 (힐/쉴드)',
};
