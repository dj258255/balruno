/**
 * 전투 시뮬레이션 엔진
 */

import { evaluateRules, type BehaviorRule } from '@/lib/aiBehavior';
import type {
  UnitStats,
  Skill,
  BattleConfig,
  BattleLogEntry,
  BattleResult,
  ArmorPenetrationConfig,
  DefenseFormulaType,
  ActiveHoT,
  InvincibleTradeoff,
} from './types';

// 기본 설정
const DEFAULT_CONFIG: BattleConfig = {
  maxDuration: 300,  // 5분
  timeStep: 0.1,     // 0.1초 단위
  damageFormula: 'simple',
  defenseFormula: 'subtractive',
  allowOverkill: false,
};

/**
 * 방어관통 적용된 유효 방어력 계산
 * LoL/Dota 스타일: 퍼센트 감소 → 고정 감소 → 퍼센트 관통 → 고정 관통
 */
function calculateEffectiveDefense(
  baseDef: number,
  penetration?: ArmorPenetrationConfig
): number {
  if (!penetration) return baseDef;

  let effectiveDef = baseDef;

  // 1. 퍼센트 방어 감소 (디버프)
  if (penetration.percentReduction && penetration.percentReduction > 0) {
    effectiveDef *= (1 - Math.min(1, penetration.percentReduction));
  }

  // 2. 고정 방어 감소 (디버프)
  if (penetration.flatReduction && penetration.flatReduction > 0) {
    effectiveDef = Math.max(0, effectiveDef - penetration.flatReduction);
  }

  // 3. 퍼센트 방어 관통 (공격자 스탯)
  if (penetration.percentPenetration && penetration.percentPenetration > 0) {
    effectiveDef *= (1 - Math.min(1, penetration.percentPenetration));
  }

  // 4. 고정 방어 관통 / Lethality (공격자 스탯)
  if (penetration.flatPenetration && penetration.flatPenetration > 0) {
    effectiveDef = Math.max(0, effectiveDef - penetration.flatPenetration);
  }

  return effectiveDef;
}

/**
 * 방어 공식에 따른 피해 감소율 계산
 */
function calculateDamageReduction(
  defense: number,
  formula: DefenseFormulaType = 'subtractive',
  baseDamage?: number
): { reduction: number; minDamage: number } {
  switch (formula) {
    case 'subtractive':
      // 빼기식: damage = ATK - DEF (최소 1)
      return { reduction: defense, minDamage: 1 };

    case 'divisive':
      // 나누기식 (LoL/WoW): reduction = DEF / (DEF + 100)
      // 100 방어력 = 50% 감소, 200 방어력 = 66.7% 감소
      const divisiveReduction = defense / (defense + 100);
      return { reduction: divisiveReduction, minDamage: 1 };

    case 'multiplicative':
      // 곱셈식: damage = ATK * (1 - DEF%)
      // DEF가 0~100 사이의 퍼센트 값이라고 가정
      const percentReduction = Math.min(0.9, defense / 100);
      return { reduction: percentReduction, minDamage: 1 };

    case 'logarithmic':
      // 로그식: reduction = log10(DEF + 10) / 5
      // 극후반 스케일링에서 수확체감 효과
      const logReduction = Math.min(0.9, Math.log10(defense + 10) / 5);
      return { reduction: logReduction, minDamage: 1 };

    default:
      return { reduction: defense, minDamage: 1 };
  }
}

/**
 * 데미지 계산 (방어관통 및 다양한 방어 공식 지원)
 */
/**
 * 0-100 실력 점수를 multiplier 로 변환.
 * 50=기준(1.0), 0=약함(0.6), 100=강함(1.4)
 * Overwatch / Destiny 밸런싱 문서의 "skill tier" 공식 기반.
 */
function skillMul(skill: number | undefined): number {
  if (skill === undefined) return 1;
  const clamped = Math.max(0, Math.min(100, skill));
  return 0.6 + (clamped / 100) * 0.8;
}

function calculateDamage(
  attacker: UnitStats,
  defender: UnitStats,
  formula: BattleConfig['damageFormula'] = 'simple',
  defFormula: DefenseFormulaType = 'subtractive',
  armorPen?: ArmorPenetrationConfig
): { damage: number; isCrit: boolean; isMiss: boolean; effectiveDef: number } {
  // 명중 체크 — 에임 실력으로 accuracy 보정, 반응 실력으로 evasion 보정
  const baseAccuracy = attacker.accuracy ?? 1;
  const baseEvasion = defender.evasion ?? 0;
  const effAccuracy = baseAccuracy * skillMul(attacker.aimSkill);
  const effEvasion = baseEvasion * skillMul(defender.reactionSkill);
  const hitChance = Math.max(0, Math.min(1, effAccuracy - effEvasion));

  if (Math.random() > hitChance) {
    return { damage: 0, isCrit: false, isMiss: true, effectiveDef: defender.def };
  }

  // 크리티컬 체크 — 에임 실력이 critRate 에도 보정 적용 (약한 보정)
  const baseCritRate = attacker.critRate ?? 0;
  const effCritRate = baseCritRate * (0.8 + (skillMul(attacker.aimSkill) - 0.6) * 0.25);
  const isCrit = Math.random() < Math.max(0, Math.min(1, effCritRate));
  const critMultiplier = isCrit ? (attacker.critDamage ?? 1.5) : 1;

  // 방어관통 적용한 유효 방어력 계산
  const effectiveDef = calculateEffectiveDefense(defender.def, armorPen);

  // 기본 데미지 계산 (damageFormula 기반)
  let baseDamage: number;

  switch (formula) {
    case 'simple':
      // 단순 공식: ATK - DEF (최소 1)
      baseDamage = Math.max(1, attacker.atk - effectiveDef);
      break;

    case 'mmorpg':
      // MMORPG 공식: ATK * (100 / (100 + DEF))
      baseDamage = attacker.atk * (100 / (100 + effectiveDef));
      break;

    case 'percentage':
      // 퍼센트 감소: ATK * (1 - DEF/200)
      const reduction = Math.min(0.9, effectiveDef / 200);
      baseDamage = attacker.atk * (1 - reduction);
      break;

    case 'random':
      // 랜덤 변동: ATK * random(0.9~1.1) - DEF
      const randomMultiplier = 0.9 + Math.random() * 0.2;
      baseDamage = Math.max(1, attacker.atk * randomMultiplier - effectiveDef);
      break;

    case 'multiplicative':
      // 곱셈식: 방어 공식에 따른 감소율 적용
      const defReduction = calculateDamageReduction(effectiveDef, defFormula);
      if (defFormula === 'subtractive') {
        baseDamage = Math.max(defReduction.minDamage, attacker.atk - defReduction.reduction);
      } else {
        baseDamage = Math.max(defReduction.minDamage, attacker.atk * (1 - defReduction.reduction));
      }
      break;

    default:
      baseDamage = Math.max(1, attacker.atk - effectiveDef);
  }

  // 크리티컬 적용
  const finalDamage = Math.round(baseDamage * critMultiplier);

  return { damage: finalDamage, isCrit, isMiss: false, effectiveDef };
}

/**
 * 단일 전투 시뮬레이션
 */
export function simulateBattle(
  unit1: UnitStats,
  unit2: UnitStats,
  skills1: Skill[] = [],
  skills2: Skill[] = [],
  config: Partial<BattleConfig> = {}
): BattleResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // 유닛 상태 복사
  const state1 = { ...unit1, hp: unit1.maxHp };
  const state2 = { ...unit2, hp: unit2.maxHp };

  // 전투 로그
  const log: BattleLogEntry[] = [];

  // 통계
  let unit1TotalDamage = 0;
  let unit2TotalDamage = 0;
  let unit1Hits = 0;
  let unit2Hits = 0;
  let unit1Crits = 0;
  let unit2Crits = 0;

  // 공격 타이머 (공격 속도 기반)
  let unit1NextAttack = 1 / state1.speed;
  let unit2NextAttack = 1 / state2.speed;

  // 시뮬레이션 루프
  let time = 0;

  while (time < cfg.maxDuration && state1.hp > 0 && state2.hp > 0) {
    time += cfg.timeStep;

    // 동시 공격 처리: 양쪽 데미지를 먼저 계산하되, speed 빠른 쪽 먼저 적용.
    // 죽이는 순간 같은 timeStep 의 보복 공격은 cancel — 죽은 자는 공격 못 함.
    const unit1Attacks = time >= unit1NextAttack;
    const unit2Attacks = time >= unit2NextAttack;

    let unit1Result: ReturnType<typeof calculateDamage> | null = null;
    let unit2Result: ReturnType<typeof calculateDamage> | null = null;

    if (unit1Attacks) {
      unit1Result = calculateDamage(state1, state2, cfg.damageFormula, cfg.defenseFormula, cfg.armorPenetration);
    }
    if (unit2Attacks) {
      unit2Result = calculateDamage(state2, state1, cfg.damageFormula, cfg.defenseFormula, cfg.armorPenetration);
    }

    // Speed 순 적용 — 같은 speed 면 unit1 우선 (안정적 순서)
    const order: Array<'unit1' | 'unit2'> = state1.speed >= state2.speed
      ? ['unit1', 'unit2']
      : ['unit2', 'unit1'];

    for (const who of order) {
      if (who === 'unit1' && unit1Result) {
        if (state1.hp <= 0) continue; // unit1 이 같은 timeStep 에 이미 죽었으면 cancel
        if (!unit1Result.isMiss) {
          state2.hp = cfg.allowOverkill
            ? state2.hp - unit1Result.damage
            : Math.max(0, state2.hp - unit1Result.damage);
          unit1TotalDamage += unit1Result.damage;
          unit1Hits++;
          if (unit1Result.isCrit) unit1Crits++;
        }
        log.push({
          time: Math.round(time * 100) / 100,
          actor: state1.name,
          action: 'attack',
          target: state2.name,
          damage: unit1Result.damage,
          isCrit: unit1Result.isCrit,
          isMiss: unit1Result.isMiss,
          remainingHp: state2.hp,
        });
        unit1NextAttack = time + 1 / state1.speed;
      } else if (who === 'unit2' && unit2Result) {
        if (state2.hp <= 0) continue;
        if (!unit2Result.isMiss) {
          state1.hp = cfg.allowOverkill
            ? state1.hp - unit2Result.damage
            : Math.max(0, state1.hp - unit2Result.damage);
          unit2TotalDamage += unit2Result.damage;
          unit2Hits++;
          if (unit2Result.isCrit) unit2Crits++;
        }
        log.push({
          time: Math.round(time * 100) / 100,
          actor: state2.name,
          action: 'attack',
          target: state1.name,
          damage: unit2Result.damage,
          isCrit: unit2Result.isCrit,
          isMiss: unit2Result.isMiss,
          remainingHp: state1.hp,
        });
        unit2NextAttack = time + 1 / state2.speed;
      }
    }
  }

  // 사망 로그
  if (state1.hp <= 0) {
    log.push({
      time: Math.round(time * 100) / 100,
      actor: state1.name,
      action: 'death',
    });
  }
  if (state2.hp <= 0) {
    log.push({
      time: Math.round(time * 100) / 100,
      actor: state2.name,
      action: 'death',
    });
  }

  // 승자 결정
  let winner: BattleResult['winner'];
  if (state1.hp <= 0 && state2.hp <= 0) {
    winner = 'draw';
  } else if (state1.hp <= 0) {
    winner = 'unit2';
  } else if (state2.hp <= 0) {
    winner = 'unit1';
  } else {
    // 시간 초과 - HP 비율로 승자 결정
    const ratio1 = state1.hp / state1.maxHp;
    const ratio2 = state2.hp / state2.maxHp;
    if (Math.abs(ratio1 - ratio2) < 0.01) {
      winner = 'draw';
    } else {
      winner = ratio1 > ratio2 ? 'unit1' : 'unit2';
    }
  }

  return {
    winner,
    duration: Math.round(time * 100) / 100,
    unit1FinalHp: Math.max(0, state1.hp),
    unit2FinalHp: Math.max(0, state2.hp),
    unit1TotalDamage,
    unit2TotalDamage,
    unit1Hits,
    unit2Hits,
    unit1Crits,
    unit2Crits,
    log,
  };
}

/**
 * 스킬 발동 조건 확인
 */
function shouldTriggerSkill(
  skill: Skill,
  caster: UnitStats & { hp: number },
  target: UnitStats & { hp: number },
  context: {
    time: number;
    lastHit?: boolean;
    lastCrit?: boolean;
    turnCount?: number;
  }
): boolean {
  if (!skill.trigger) return true;

  const { type, value = 0, chance = 1 } = skill.trigger;

  // 확률 체크
  if (Math.random() > chance) return false;

  switch (type) {
    case 'hp_below':
      return (caster.hp / caster.maxHp) <= value;
    case 'hp_above':
      return (caster.hp / caster.maxHp) >= value;
    case 'turn':
      return (context.turnCount || 0) % value === 0;
    case 'on_hit':
      return context.lastHit === true;
    case 'on_crit':
      return context.lastCrit === true;
    case 'always':
      return true;
    default:
      return false;
  }
}

/**
 * 스킬 데미지 계산 (방어관통 지원)
 */
function calculateSkillDamage(
  skill: Skill,
  caster: UnitStats,
  target: UnitStats,
  formula: BattleConfig['damageFormula'] = 'simple',
  armorPen?: ArmorPenetrationConfig
): number {
  let baseDamage: number;

  if (skill.damageType === 'flat') {
    baseDamage = skill.damage;
  } else {
    // multiplier: ATK * 배율
    baseDamage = caster.atk * skill.damage;
  }

  // 방어관통 적용한 유효 방어력 계산
  const effectiveDef = calculateEffectiveDefense(target.def, armorPen);

  // 방어력 적용
  switch (formula) {
    case 'simple':
      return Math.max(1, baseDamage - effectiveDef);
    case 'mmorpg':
      return baseDamage * (100 / (100 + effectiveDef));
    case 'percentage':
      const reduction = Math.min(0.9, effectiveDef / 200);
      return baseDamage * (1 - reduction);
    default:
      return Math.max(1, baseDamage - effectiveDef);
  }
}

/**
 * 힐 스킬 처리
 */
function processHealSkill(
  skill: Skill,
  caster: UnitStats & { hp: number; maxHp: number }
): { healAmount: number; newHp: number } {
  const healAmount = skill.healType === 'percent'
    ? Math.round(caster.maxHp * (skill.healAmount || 0))
    : Math.round(skill.healAmount || 0);

  const newHp = Math.min(caster.maxHp, caster.hp + healAmount);
  return { healAmount, newHp };
}

/**
 * 무적 스킬 처리
 */
function processInvincibleSkill(
  skill: Skill,
  currentTime: number
): { invincibleUntil: number; tradeoff?: InvincibleTradeoff } {
  return {
    invincibleUntil: currentTime + (skill.invincibleDuration || 0),
    tradeoff: skill.invincibleTradeoff
  };
}

/**
 * HoT (Heal Over Time) 스킬 생성
 */
function createHoT(
  skill: Skill,
  currentTime: number,
  casterMaxHp: number
): ActiveHoT {
  return {
    skillId: skill.id,
    skillName: skill.name,
    endTime: currentTime + (skill.hotDuration || 5),
    nextTickTime: currentTime + (skill.hotTickInterval || 1),
    tickInterval: skill.hotTickInterval || 1,
    healAmount: skill.hotAmount || 0,
    healType: skill.hotType || 'flat',
    casterMaxHp,
  };
}

/**
 * HoT 틱 처리
 */
function processHoTTick(
  hot: ActiveHoT,
  currentHp: number,
  maxHp: number
): { healAmount: number; newHp: number } {
  const healAmount = hot.healType === 'percent'
    ? Math.round(hot.casterMaxHp * hot.healAmount)
    : Math.round(hot.healAmount);

  const newHp = Math.min(maxHp, currentHp + healAmount);
  return { healAmount, newHp };
}

/**
 * 활성 HoT 목록 처리 (틱 적용 및 만료 제거)
 */
function processActiveHoTs(
  hots: ActiveHoT[],
  currentTime: number,
  unit: { hp: number; maxHp: number; name: string },
  log: BattleLogEntry[]
): ActiveHoT[] {
  const remainingHots: ActiveHoT[] = [];

  for (const hot of hots) {
    // HoT 만료 체크
    if (currentTime >= hot.endTime) {
      log.push({
        time: Math.round(currentTime * 100) / 100,
        actor: unit.name,
        action: 'hot_end',
        skillName: hot.skillName,
        remainingHp: unit.hp,
      });
      continue;
    }

    // 틱 시간 체크
    if (currentTime >= hot.nextTickTime) {
      const tickResult = processHoTTick(hot, unit.hp, unit.maxHp);
      unit.hp = tickResult.newHp;

      log.push({
        time: Math.round(currentTime * 100) / 100,
        actor: unit.name,
        action: 'hot_tick',
        skillName: hot.skillName,
        healAmount: tickResult.healAmount,
        remainingHp: unit.hp,
      });

      // 다음 틱 시간 업데이트
      hot.nextTickTime = currentTime + hot.tickInterval;
    }

    remainingHots.push(hot);
  }

  return remainingHots;
}

/**
 * 부활 스킬 체크 (죽었을 때 발동)
 * 1v1에서는 자기부활(self)만 체크
 */
function checkReviveSkill(
  skills: Skill[],
  skillCooldowns: Map<string, number>,
  time: number,
  maxHp: number
): { revived: boolean; newHp: number; skillName?: string } {
  for (const skill of skills) {
    if (skill.skillType !== 'revive') continue;
    // 1v1에서는 자기부활(self)만 가능
    if (skill.reviveTarget !== 'self') continue;

    const cooldownEnds = skillCooldowns.get(skill.id) || 0;
    if (time < cooldownEnds) continue;

    // 부활 확률 체크
    if (skill.trigger?.chance && Math.random() > skill.trigger.chance) continue;

    const newHp = Math.round(maxHp * (skill.reviveHpPercent || 0.3));
    skillCooldowns.set(skill.id, time + skill.cooldown);
    return { revived: true, newHp, skillName: skill.name };
  }
  return { revived: false, newHp: 0 };
}

/**
 * 스킬이 있는 전투 시뮬레이션 (힐/무적/부활 지원)
 */
export function simulateBattleWithSkills(
  unit1: UnitStats,
  unit2: UnitStats,
  skills1: Skill[],
  skills2: Skill[],
  config: Partial<BattleConfig> = {}
): BattleResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // 유닛 상태 복사
  const state1 = { ...unit1, hp: unit1.maxHp };
  const state2 = { ...unit2, hp: unit2.maxHp };

  // 전투 로그
  const log: BattleLogEntry[] = [];

  // 통계
  let unit1TotalDamage = 0;
  let unit2TotalDamage = 0;
  let unit1Hits = 0;
  let unit2Hits = 0;
  let unit1Crits = 0;
  let unit2Crits = 0;

  // 공격 타이머
  let unit1NextAttack = 1 / state1.speed;
  let unit2NextAttack = 1 / state2.speed;

  // 스킬 쿨다운 추적
  const skill1Cooldowns = new Map<string, number>();
  const skill2Cooldowns = new Map<string, number>();

  // 턴 카운터
  let unit1Turns = 0;
  let unit2Turns = 0;

  // 무적 상태 (무적 종료 시간)
  let unit1InvincibleUntil = 0;
  let unit2InvincibleUntil = 0;

  // 무적 트레이드오프 저장
  let unit1InvincibleTradeoff: InvincibleTradeoff | undefined;
  let unit2InvincibleTradeoff: InvincibleTradeoff | undefined;

  // 부활 사용 여부 (한 전투에 1회만)
  let unit1ReviveUsed = false;
  let unit2ReviveUsed = false;

  // 활성 HoT 효과 목록
  let unit1ActiveHoTs: ActiveHoT[] = [];
  let unit2ActiveHoTs: ActiveHoT[] = [];

  // 스킬 처리 함수
  const processSkill = (
    skill: Skill,
    caster: typeof state1,
    target: typeof state2,
    skillCooldowns: Map<string, number>,
    isUnit1: boolean,
    currentTime: number
  ): void => {
    const skillType = skill.skillType || 'damage';

    switch (skillType) {
      case 'damage': {
        // 타겟이 무적 상태인지 확인
        const targetInvincibleUntil = isUnit1 ? unit2InvincibleUntil : unit1InvincibleUntil;
        if (currentTime < targetInvincibleUntil) {
          log.push({
            time: Math.round(currentTime * 100) / 100,
            actor: caster.name,
            action: 'skill',
            target: target.name,
            skillName: skill.name,
            damage: 0,
            isMiss: true,
            remainingHp: target.hp,
          });
          break;
        }

        const skillDamage = Math.round(calculateSkillDamage(skill, caster, target, cfg.damageFormula, cfg.armorPenetration));
        target.hp = cfg.allowOverkill
          ? target.hp - skillDamage
          : Math.max(0, target.hp - skillDamage);

        if (isUnit1) {
          unit1TotalDamage += skillDamage;
        } else {
          unit2TotalDamage += skillDamage;
        }

        log.push({
          time: Math.round(currentTime * 100) / 100,
          actor: caster.name,
          action: 'skill',
          target: target.name,
          skillName: skill.name,
          damage: skillDamage,
          remainingHp: target.hp,
        });
        break;
      }

      case 'heal': {
        const healResult = processHealSkill(skill, caster);
        caster.hp = healResult.newHp;

        log.push({
          time: Math.round(currentTime * 100) / 100,
          actor: caster.name,
          action: 'heal',
          skillName: skill.name,
          healAmount: healResult.healAmount,
          remainingHp: caster.hp,
        });
        break;
      }

      case 'hot': {
        // HoT 효과 생성 및 추가
        const newHoT = createHoT(skill, currentTime, caster.maxHp);
        if (isUnit1) {
          unit1ActiveHoTs.push(newHoT);
        } else {
          unit2ActiveHoTs.push(newHoT);
        }

        log.push({
          time: Math.round(currentTime * 100) / 100,
          actor: caster.name,
          action: 'skill',
          skillName: skill.name,
          remainingHp: caster.hp,
        });
        break;
      }

      case 'invincible': {
        const invResult = processInvincibleSkill(skill, currentTime);
        if (isUnit1) {
          unit1InvincibleUntil = invResult.invincibleUntil;
          unit1InvincibleTradeoff = invResult.tradeoff;
        } else {
          unit2InvincibleUntil = invResult.invincibleUntil;
          unit2InvincibleTradeoff = invResult.tradeoff;
        }

        log.push({
          time: Math.round(currentTime * 100) / 100,
          actor: caster.name,
          action: 'invincible',
          skillName: skill.name,
          remainingHp: caster.hp,
        });
        break;
      }

      // revive는 별도로 처리 (사망 시 체크)
      case 'revive':
        break;
    }

    skillCooldowns.set(skill.id, currentTime + skill.cooldown);
  };

  // 부활 체크 함수
  const checkAndProcessRevive = (
    unit: typeof state1,
    skills: Skill[],
    skillCooldowns: Map<string, number>,
    currentTime: number,
    reviveUsed: boolean
  ): { revived: boolean; newReviveUsed: boolean } => {
    if (reviveUsed || unit.hp > 0) {
      return { revived: false, newReviveUsed: reviveUsed };
    }

    const reviveResult = checkReviveSkill(skills, skillCooldowns, currentTime, unit.maxHp);
    if (reviveResult.revived) {
      unit.hp = reviveResult.newHp;

      log.push({
        time: Math.round(currentTime * 100) / 100,
        actor: unit.name,
        action: 'revive',
        skillName: reviveResult.skillName,
        remainingHp: unit.hp,
      });

      return { revived: true, newReviveUsed: true };
    }

    return { revived: false, newReviveUsed: reviveUsed };
  };

  // 시뮬레이션 루프
  let time = 0;

  while (time < cfg.maxDuration && state1.hp > 0 && state2.hp > 0) {
    time += cfg.timeStep;

    // HoT 틱 처리
    unit1ActiveHoTs = processActiveHoTs(unit1ActiveHoTs, time, state1, log);
    unit2ActiveHoTs = processActiveHoTs(unit2ActiveHoTs, time, state2, log);

    // 무적 종료 로그 (한 번만 기록)
    if (unit1InvincibleUntil > 0 && time >= unit1InvincibleUntil && time < unit1InvincibleUntil + cfg.timeStep) {
      log.push({
        time: Math.round(time * 100) / 100,
        actor: state1.name,
        action: 'invincible_end',
        remainingHp: state1.hp,
      });
      unit1InvincibleTradeoff = undefined;
    }
    if (unit2InvincibleUntil > 0 && time >= unit2InvincibleUntil && time < unit2InvincibleUntil + cfg.timeStep) {
      log.push({
        time: Math.round(time * 100) / 100,
        actor: state2.name,
        action: 'invincible_end',
        remainingHp: state2.hp,
      });
      unit2InvincibleTradeoff = undefined;
    }

    // Unit1 공격
    if (time >= unit1NextAttack && state1.hp > 0) {
      unit1Turns++;

      // 무적 중 공격 불가 트레이드오프 체크
      const unit1CannotAttack = time < unit1InvincibleUntil && unit1InvincibleTradeoff?.cannotAttack;

      // 타겟이 무적 상태인지 확인
      const targetIsInvincible = time < unit2InvincibleUntil;

      if (unit1CannotAttack) {
        // 무적 중 공격 불가 (트레이드오프)
        // 공격 시간만 갱신하고 넘어감
      } else if (targetIsInvincible) {
        // 무적 상태면 공격 무효화
        log.push({
          time: Math.round(time * 100) / 100,
          actor: state1.name,
          action: 'attack',
          target: state2.name,
          damage: 0,
          isMiss: true,
          remainingHp: state2.hp,
        });
      } else {
        const result = calculateDamage(state1, state2, cfg.damageFormula, cfg.defenseFormula, cfg.armorPenetration);

        if (!result.isMiss) {
          state2.hp = cfg.allowOverkill
            ? state2.hp - result.damage
            : Math.max(0, state2.hp - result.damage);

          unit1TotalDamage += result.damage;
          unit1Hits++;
          if (result.isCrit) unit1Crits++;
        }

        log.push({
          time: Math.round(time * 100) / 100,
          actor: state1.name,
          action: 'attack',
          target: state2.name,
          damage: result.damage,
          isCrit: result.isCrit,
          isMiss: result.isMiss,
          remainingHp: state2.hp,
        });

        // Unit2 부활 체크
        if (state2.hp <= 0) {
          const reviveCheck = checkAndProcessRevive(state2, skills2, skill2Cooldowns, time, unit2ReviveUsed);
          unit2ReviveUsed = reviveCheck.newReviveUsed;
        }

        // 스킬 사용 체크 (무적 트레이드오프로 스킬 사용 불가인 경우 스킵)
        const unit1CannotUseSkills = time < unit1InvincibleUntil && unit1InvincibleTradeoff?.cannotUseSkills;
        if (!unit1CannotUseSkills) {
          for (const skill of skills1) {
            const cooldownEnds = skill1Cooldowns.get(skill.id) || 0;
            if (time < cooldownEnds) continue;

            const context = {
              time,
              lastHit: !result.isMiss,
              lastCrit: result.isCrit,
              turnCount: unit1Turns
            };

            if (shouldTriggerSkill(skill, state1, state2, context)) {
              processSkill(skill, state1, state2, skill1Cooldowns, true, time);

              // 스킬로 인한 사망 후 부활 체크
              if (state2.hp <= 0) {
                const reviveCheck = checkAndProcessRevive(state2, skills2, skill2Cooldowns, time, unit2ReviveUsed);
                unit2ReviveUsed = reviveCheck.newReviveUsed;
              }
            }
          }
        }
      }

      unit1NextAttack = time + 1 / state1.speed;
    }

    // Unit2 공격
    if (state2.hp > 0 && state1.hp > 0 && time >= unit2NextAttack) {
      unit2Turns++;

      // Unit2가 무적 상태이고 공격 불가 트레이드오프가 있는지 확인
      const unit2CannotAttack = time < unit2InvincibleUntil && unit2InvincibleTradeoff?.cannotAttack;

      // 타겟이 무적 상태인지 확인
      const targetIsInvincible = time < unit1InvincibleUntil;

      if (unit2CannotAttack) {
        // 무적 트레이드오프로 공격 불가 - 공격 스킵
        unit2NextAttack = time + 1 / state2.speed;
      } else if (targetIsInvincible) {
        // 무적 상태면 공격 무효화
        log.push({
          time: Math.round(time * 100) / 100,
          actor: state2.name,
          action: 'attack',
          target: state1.name,
          damage: 0,
          isMiss: true,
          remainingHp: state1.hp,
        });
      } else {
        const result = calculateDamage(state2, state1, cfg.damageFormula, cfg.defenseFormula, cfg.armorPenetration);

        if (!result.isMiss) {
          state1.hp = cfg.allowOverkill
            ? state1.hp - result.damage
            : Math.max(0, state1.hp - result.damage);

          unit2TotalDamage += result.damage;
          unit2Hits++;
          if (result.isCrit) unit2Crits++;
        }

        log.push({
          time: Math.round(time * 100) / 100,
          actor: state2.name,
          action: 'attack',
          target: state1.name,
          damage: result.damage,
          isCrit: result.isCrit,
          isMiss: result.isMiss,
          remainingHp: state1.hp,
        });

        // Unit1 부활 체크
        if (state1.hp <= 0) {
          const reviveCheck = checkAndProcessRevive(state1, skills1, skill1Cooldowns, time, unit1ReviveUsed);
          unit1ReviveUsed = reviveCheck.newReviveUsed;
        }

        // 스킬 사용 체크 (무적 트레이드오프로 스킬 사용 불가인 경우 스킵)
        const unit2CannotUseSkills = time < unit2InvincibleUntil && unit2InvincibleTradeoff?.cannotUseSkills;
        if (!unit2CannotUseSkills) {
          for (const skill of skills2) {
            const cooldownEnds = skill2Cooldowns.get(skill.id) || 0;
            if (time < cooldownEnds) continue;

            const context = {
              time,
              lastHit: !result.isMiss,
              lastCrit: result.isCrit,
              turnCount: unit2Turns
            };

            if (shouldTriggerSkill(skill, state2, state1, context)) {
              processSkill(skill, state2, state1, skill2Cooldowns, false, time);

              // 스킬로 인한 사망 후 부활 체크
              if (state1.hp <= 0) {
                const reviveCheck = checkAndProcessRevive(state1, skills1, skill1Cooldowns, time, unit1ReviveUsed);
                unit1ReviveUsed = reviveCheck.newReviveUsed;
              }
            }
          }
        }
      }

      unit2NextAttack = time + 1 / state2.speed;
    }
  }

  // 사망 로그
  if (state1.hp <= 0) {
    log.push({
      time: Math.round(time * 100) / 100,
      actor: state1.name,
      action: 'death',
    });
  }
  if (state2.hp <= 0) {
    log.push({
      time: Math.round(time * 100) / 100,
      actor: state2.name,
      action: 'death',
    });
  }

  // 승자 결정
  let winner: BattleResult['winner'];
  if (state1.hp <= 0 && state2.hp <= 0) {
    winner = 'draw';
  } else if (state1.hp <= 0) {
    winner = 'unit2';
  } else if (state2.hp <= 0) {
    winner = 'unit1';
  } else {
    const ratio1 = state1.hp / state1.maxHp;
    const ratio2 = state2.hp / state2.maxHp;
    if (Math.abs(ratio1 - ratio2) < 0.01) {
      winner = 'draw';
    } else {
      winner = ratio1 > ratio2 ? 'unit1' : 'unit2';
    }
  }

  return {
    winner,
    duration: Math.round(time * 100) / 100,
    unit1FinalHp: Math.max(0, state1.hp),
    unit2FinalHp: Math.max(0, state2.hp),
    unit1TotalDamage,
    unit2TotalDamage,
    unit1Hits,
    unit2Hits,
    unit1Crits,
    unit2Crits,
    log,
  };
}

/**
 * 시너지 효과 적용
 */
export function applySynergies(
  units: UnitStats[],
  synergies: import('./types').Synergy[]
): UnitStats[] {
  const unitIds = new Set(units.map(u => u.id));

  // 각 유닛에 적용될 버프 수집
  const unitBuffs = new Map<string, import('./types').Buff[]>();
  units.forEach(u => unitBuffs.set(u.id, []));

  // 시너지 조건 확인 및 버프 적용
  for (const synergy of synergies) {
    const hasAll = synergy.requiredUnits.every(id => unitIds.has(id));
    if (hasAll) {
      // 모든 유닛에 버프 적용
      for (const unit of units) {
        const buffs = unitBuffs.get(unit.id) || [];
        buffs.push(...synergy.effect);
        unitBuffs.set(unit.id, buffs);
      }
    }
  }

  // 버프 적용하여 새 유닛 배열 반환
  return units.map(unit => {
    const buffs = unitBuffs.get(unit.id) || [];
    if (buffs.length === 0) return unit;

    const modified = { ...unit };

    for (const buff of buffs) {
      const stat = buff.stat as keyof UnitStats;
      const currentValue = modified[stat];

      if (typeof currentValue === 'number') {
        if (buff.isPercent) {
          (modified as Record<string, unknown>)[stat] = currentValue * (1 + buff.value);
        } else {
          (modified as Record<string, unknown>)[stat] = currentValue + buff.value;
        }
      }
    }

    return modified;
  });
}

/**
 * 팀 전투 시뮬레이션 (1:N, N:N)
 */
export function simulateTeamBattle(
  team1: UnitStats[],
  team2: UnitStats[],
  config: Partial<import('./types').TeamBattleConfig> = {}
): import('./types').TeamBattleResult {
  const cfg: import('./types').TeamBattleConfig = {
    maxDuration: 300,
    timeStep: 0.1,
    damageFormula: 'simple',
    defenseFormula: 'subtractive',
    allowOverkill: false,
    teamSize: Math.max(team1.length, team2.length),
    targetingMode: 'random',
    allowSynergies: false,
    ...config,
  };

  // 유닛 상태 초기화
  interface UnitState extends UnitStats {
    currentHp: number;
    nextAttackTime: number;
    team: 'team1' | 'team2';
    damageDealt: number;
    damageTaken: number;
    kills: number;
    alive: boolean;
  }

  const team1States: UnitState[] = team1.map(u => ({
    ...u,
    currentHp: u.maxHp,
    nextAttackTime: 1 / u.speed,
    team: 'team1' as const,
    damageDealt: 0,
    damageTaken: 0,
    kills: 0,
    alive: true,
  }));

  const team2States: UnitState[] = team2.map(u => ({
    ...u,
    currentHp: u.maxHp,
    nextAttackTime: 1 / u.speed,
    team: 'team2' as const,
    damageDealt: 0,
    damageTaken: 0,
    kills: 0,
    alive: true,
  }));

  // 타겟 선택 함수
  // attacker.decisionSkill 이 높을수록 mode 를 충실히 따름 (최적 타겟).
  // 낮으면 판단 실수 확률 ↑ → 랜덤 선택. 50 = 50% 확률로 실수.
  // time 은 여기서는 사용 안 하지만 API 시그니처를 다른 selectTarget 과 통일.
  const selectTarget = (
    enemies: UnitState[],
    mode: import('./types').TeamBattleConfig['targetingMode'],
    attacker?: UnitState,
    _time?: number,
  ): UnitState | null => {
    const aliveEnemies = enemies.filter(e => e.alive);
    if (aliveEnemies.length === 0) return null;

    // Decision skill 확률 기반 실수 — 낮은 실력일수록 모드 무시하고 랜덤
    if (attacker) {
      const decisionSkill = (attacker as unknown as { decisionSkill?: number }).decisionSkill ?? 50;
      const mistakeProb = 1 - decisionSkill / 100;  // 0 = 전문가(실수 없음), 100 = 초보(항상 실수)
      if (Math.random() < mistakeProb * 0.5) {
        // 판단 실수 — 랜덤 타겟
        return aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
      }
    }

    switch (mode) {
      case 'lowest_hp':
        return aliveEnemies.reduce((min, e) =>
          e.currentHp < min.currentHp ? e : min
        );
      case 'highest_atk':
        return aliveEnemies.reduce((max, e) =>
          e.atk > max.atk ? e : max
        );
      case 'focused':
        // 첫 번째 살아있는 적 집중 공격
        return aliveEnemies[0];
      case 'random':
      default:
        return aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
    }
  };

  // 시뮬레이션 루프
  let time = 0;
  let team1TotalDamage = 0;
  let team2TotalDamage = 0;
  // Replay 로그 — 다대다 timeline 입력. 다른 팀 시뮬과 1v1 BattleResult.log 형태 호환.
  const log: BattleLogEntry[] = [];

  while (time < cfg.maxDuration) {
    time += cfg.timeStep;

    const team1Alive = team1States.filter(u => u.alive);
    const team2Alive = team2States.filter(u => u.alive);

    // 한 팀이 전멸하면 종료
    if (team1Alive.length === 0 || team2Alive.length === 0) break;

    // 동시 공격 처리: 데미지를 먼저 모두 계산한 뒤 일괄 적용
    interface PendingAttack {
      attacker: UnitState;
      target: UnitState;
      damage: number;
      isMiss: boolean;
      isTeam1: boolean;
    }
    const pendingAttacks: PendingAttack[] = [];

    // Team1 공격 계산
    for (const attacker of team1Alive) {
      if (time >= attacker.nextAttackTime) {
        const target = selectTarget(team2States, cfg.targetingMode, attacker, time);
        if (!target) continue;

        const result = calculateDamage(attacker, target, cfg.damageFormula, cfg.defenseFormula, cfg.armorPenetration);
        pendingAttacks.push({
          attacker,
          target,
          damage: result.damage,
          isMiss: result.isMiss,
          isTeam1: true,
        });
        attacker.nextAttackTime = time + 1 / attacker.speed;
      }
    }

    // Team2 공격 계산
    for (const attacker of team2Alive) {
      if (time >= attacker.nextAttackTime) {
        const target = selectTarget(team1States, cfg.targetingMode, attacker, time);
        if (!target) continue;

        const result = calculateDamage(attacker, target, cfg.damageFormula, cfg.defenseFormula, cfg.armorPenetration);
        pendingAttacks.push({
          attacker,
          target,
          damage: result.damage,
          isMiss: result.isMiss,
          isTeam1: false,
        });
        attacker.nextAttackTime = time + 1 / attacker.speed;
      }
    }

    // Speed 빠른 attacker 의 공격을 먼저 적용 — 죽이는 순간 같은 timeStep 의 보복 공격은 cancel.
    // 같은 speed 끼리는 push 순서 유지 (stable sort) → mutual kill 가능.
    pendingAttacks.sort((a, b) => b.attacker.speed - a.attacker.speed);

    // 순차 적용 + 적용 직전 attacker.alive 체크 + 즉시 사망 처리
    for (const attack of pendingAttacks) {
      // 이전 attack 으로 attacker 가 죽었으면 그의 공격은 cancel — 죽은 자는 공격 못 함
      if (!attack.attacker.alive || attack.attacker.currentHp <= 0) continue;

      if (!attack.isMiss) {
        attack.target.currentHp = Math.max(0, attack.target.currentHp - attack.damage);
        attack.target.damageTaken += attack.damage;
        attack.attacker.damageDealt += attack.damage;

        if (attack.isTeam1) {
          team1TotalDamage += attack.damage;
        } else {
          team2TotalDamage += attack.damage;
        }
      }
      log.push({
        time: Math.round(time * 100) / 100,
        actor: attack.attacker.id,
        action: 'attack',
        target: attack.target.id,
        damage: attack.isMiss ? 0 : attack.damage,
        isMiss: attack.isMiss,
        remainingHp: attack.target.currentHp,
      });

      // 즉시 사망 처리 — 다음 attack 의 attacker.alive 체크에 반영
      if (!attack.isMiss && attack.target.currentHp <= 0 && attack.target.alive) {
        attack.target.alive = false;
        attack.attacker.kills++;
        log.push({
          time: Math.round(time * 100) / 100,
          actor: attack.target.id,
          action: 'death',
          remainingHp: 0,
        });
      }
    }
  }

  // 결과 집계
  const team1Survivors = team1States.filter(u => u.alive).length;
  const team2Survivors = team2States.filter(u => u.alive).length;

  let winner: import('./types').TeamBattleResult['winner'];
  if (team1Survivors === 0 && team2Survivors === 0) {
    winner = 'draw';
  } else if (team1Survivors === 0) {
    winner = 'team2';
  } else if (team2Survivors === 0) {
    winner = 'team1';
  } else {
    // 시간 초과 - 생존자 수로 판정
    if (team1Survivors === team2Survivors) {
      // HP 비율 총합으로 판정
      const team1HpRatio = team1States.reduce((sum, u) => sum + (u.alive ? u.currentHp / u.maxHp : 0), 0);
      const team2HpRatio = team2States.reduce((sum, u) => sum + (u.alive ? u.currentHp / u.maxHp : 0), 0);
      winner = team1HpRatio > team2HpRatio ? 'team1' : team2HpRatio > team1HpRatio ? 'team2' : 'draw';
    } else {
      winner = team1Survivors > team2Survivors ? 'team1' : 'team2';
    }
  }

  return {
    winner,
    duration: Math.round(time * 100) / 100,
    team1Survivors,
    team2Survivors,
    team1TotalDamage,
    team2TotalDamage,
    unitResults: [
      ...team1States.map(u => ({
        unit: { id: u.id, name: u.name, hp: u.hp, maxHp: u.maxHp, atk: u.atk, def: u.def, speed: u.speed },
        team: 'team1' as const,
        survived: u.alive,
        damageDealt: u.damageDealt,
        damageTaken: u.damageTaken,
        kills: u.kills,
      })),
      ...team2States.map(u => ({
        unit: { id: u.id, name: u.name, hp: u.hp, maxHp: u.maxHp, atk: u.atk, def: u.def, speed: u.speed },
        team: 'team2' as const,
        survived: u.alive,
        damageDealt: u.damageDealt,
        damageTaken: u.damageTaken,
        kills: u.kills,
      })),
    ],
    log,
  };
}

// 유닛별 통계 (몬테카를로 결과용)
interface UnitBattleStats {
  unitId: string;
  unitName: string;
  team: 'team1' | 'team2';
  survivalRate: number;
  avgDamageDealt: number;
  avgDamageTaken: number;
  avgKills: number;
  totalDamageDealt: number;
  totalKills: number;
  dps: number;
  mvpCount: number;
}

// 팀 전투 상세 결과 타입
export interface DetailedTeamResult {
  totalRuns: number;
  team1Wins: number;
  team2Wins: number;
  draws: number;
  team1WinRate: number;
  team2WinRate: number;
  avgDuration: number;
  avgTeam1Survivors: number;
  avgTeam2Survivors: number;

  // 확장 통계
  durationDistribution: number[];
  minDuration: number;
  maxDuration: number;
  avgTeam1Damage: number;
  avgTeam2Damage: number;
  team1DPS: number;
  team2DPS: number;
  unitStats: UnitBattleStats[];
  avgTeam1SurvivorHpRatio: number;
  avgTeam2SurvivorHpRatio: number;
  sampleBattles: import('./types').TeamBattleResult[];
  team1Reversals: number;
  team2Reversals: number;
  closeMatches: number;
}

/**
 * 몬테카를로 팀 전투 시뮬레이션 (상세 통계 포함)
 */
export function runTeamMonteCarloSimulation(
  team1: UnitStats[],
  team2: UnitStats[],
  runs: number = 1000,
  config: Partial<import('./types').TeamBattleConfig> = {},
  team1Skills?: Map<string, Skill[]>,
  team2Skills?: Map<string, Skill[]>
): DetailedTeamResult {
  let team1Wins = 0;
  let team2Wins = 0;
  let draws = 0;
  let totalDuration = 0;
  let totalTeam1Survivors = 0;
  let totalTeam2Survivors = 0;

  // 확장 통계용 변수
  const durations: number[] = [];
  let totalTeam1Damage = 0;
  let totalTeam2Damage = 0;
  let team1SurvivorHpRatioSum = 0;
  let team2SurvivorHpRatioSum = 0;
  let team1WinCount = 0;
  let team2WinCount = 0;
  let team1Reversals = 0;
  let team2Reversals = 0;
  let closeMatches = 0;

  // 유닛별 통계 누적
  const unitStatsAccum = new Map<string, {
    survivalCount: number;
    totalDamageDealt: number;
    totalDamageTaken: number;
    totalKills: number;
    mvpCount: number;
    unitName: string;
    team: 'team1' | 'team2';
  }>();

  // 모든 유닛 초기화
  team1.forEach(u => unitStatsAccum.set(u.id, {
    survivalCount: 0, totalDamageDealt: 0, totalDamageTaken: 0, totalKills: 0, mvpCount: 0, unitName: u.name, team: 'team1'
  }));
  team2.forEach(u => unitStatsAccum.set(u.id, {
    survivalCount: 0, totalDamageDealt: 0, totalDamageTaken: 0, totalKills: 0, mvpCount: 0, unitName: u.name, team: 'team2'
  }));

  // 샘플 전투 저장 (다양한 결과 포함: Team1 승리, Team2 승리, 무승부)
  const sampleBattles: import('./types').TeamBattleResult[] = [];
  const team1WinSamples: import('./types').TeamBattleResult[] = [];
  const team2WinSamples: import('./types').TeamBattleResult[] = [];
  const drawSamples: import('./types').TeamBattleResult[] = [];

  for (let i = 0; i < runs; i++) {
    const result = (team1Skills || team2Skills)
      ? simulateTeamBattleWithSkills(team1, team2, team1Skills || new Map(), team2Skills || new Map(), config)
      : simulateTeamBattle(team1, team2, config);

    // 결과별로 샘플 저장 (각 최대 2개씩)
    if (result.winner === 'team1' && team1WinSamples.length < 2) {
      team1WinSamples.push(result);
    } else if (result.winner === 'team2' && team2WinSamples.length < 2) {
      team2WinSamples.push(result);
    } else if (result.winner === 'draw' && drawSamples.length < 1) {
      drawSamples.push(result);
    }

    // 기본 통계
    if (result.winner === 'team1') {
      team1Wins++;
      team1WinCount++;
    } else if (result.winner === 'team2') {
      team2Wins++;
      team2WinCount++;
    } else {
      draws++;
    }

    totalDuration += result.duration;
    durations.push(result.duration);
    totalTeam1Survivors += result.team1Survivors;
    totalTeam2Survivors += result.team2Survivors;
    totalTeam1Damage += result.team1TotalDamage;
    totalTeam2Damage += result.team2TotalDamage;

    // 유닛별 통계 수집
    let team1TopDamage = 0;
    let team1MVP = '';
    let team2TopDamage = 0;
    let team2MVP = '';

    for (const unitResult of result.unitResults) {
      const stats = unitStatsAccum.get(unitResult.unit.id);
      if (stats) {
        if (unitResult.survived) stats.survivalCount++;
        stats.totalDamageDealt += unitResult.damageDealt;
        stats.totalDamageTaken += unitResult.damageTaken;
        stats.totalKills += unitResult.kills;

        // MVP 추적
        if (unitResult.team === 'team1' && unitResult.damageDealt > team1TopDamage) {
          team1TopDamage = unitResult.damageDealt;
          team1MVP = unitResult.unit.id;
        }
        if (unitResult.team === 'team2' && unitResult.damageDealt > team2TopDamage) {
          team2TopDamage = unitResult.damageDealt;
          team2MVP = unitResult.unit.id;
        }
      }
    }

    // MVP 카운트
    if (team1MVP) {
      const stats = unitStatsAccum.get(team1MVP);
      if (stats) stats.mvpCount++;
    }
    if (team2MVP) {
      const stats = unitStatsAccum.get(team2MVP);
      if (stats) stats.mvpCount++;
    }

    // 승리 시 생존 HP 비율
    if (result.winner === 'team1') {
      const survivorHpRatio = result.unitResults
        .filter(u => u.team === 'team1' && u.survived)
        .reduce((sum, u) => {
          // 현재 HP를 구하기 어려우므로 생존 자체를 1로 계산
          return sum + 1;
        }, 0) / team1.length;
      team1SurvivorHpRatioSum += survivorHpRatio;
    }
    if (result.winner === 'team2') {
      const survivorHpRatio = result.unitResults
        .filter(u => u.team === 'team2' && u.survived)
        .reduce((sum, u) => sum + 1, 0) / team2.length;
      team2SurvivorHpRatioSum += survivorHpRatio;
    }

    // 역전 분석: 스탯상 불리한 팀이 이긴 경우
    // 팀 전투력 = 총 HP * 평균 ATK (대략적 지표)
    const team1Power = team1.reduce((sum, u) => sum + u.maxHp, 0) * (team1.reduce((sum, u) => sum + u.atk, 0) / team1.length);
    const team2Power = team2.reduce((sum, u) => sum + u.maxHp, 0) * (team2.reduce((sum, u) => sum + u.atk, 0) / team2.length);

    if (result.winner === 'team1') {
      // Team1이 이겼는데: 전투력이 더 낮았으면 역전
      if (team1Power < team2Power) {
        team1Reversals++;
      }
    }
    if (result.winner === 'team2') {
      // Team2가 이겼는데: 전투력이 더 낮았으면 역전
      if (team2Power < team1Power) {
        team2Reversals++;
      }
    }

    // 박빙 (생존자 수 차이가 1 이하)
    if (Math.abs(result.team1Survivors - result.team2Survivors) <= 1 && result.winner !== 'draw') {
      closeMatches++;
    }
  }

  // 샘플 전투 합치기 (Team1 승리 → Team2 승리 → 무승부 순서)
  sampleBattles.push(...team1WinSamples, ...team2WinSamples, ...drawSamples);

  // 전투 시간 분포 (10개 구간으로 나눔)
  const minDuration = Math.min(...durations);
  const maxDuration = Math.max(...durations);
  const bucketCount = 10;
  const bucketSize = (maxDuration - minDuration) / bucketCount || 1;
  const durationDistribution = new Array(bucketCount).fill(0);
  for (const d of durations) {
    const bucket = Math.min(bucketCount - 1, Math.floor((d - minDuration) / bucketSize));
    durationDistribution[bucket]++;
  }

  // 유닛별 최종 통계 계산
  const avgDuration = totalDuration / runs;
  const unitStats: UnitBattleStats[] = [];

  unitStatsAccum.forEach((stats, unitId) => {
    unitStats.push({
      unitId,
      unitName: stats.unitName,
      team: stats.team,
      survivalRate: stats.survivalCount / runs,
      avgDamageDealt: stats.totalDamageDealt / runs,
      avgDamageTaken: stats.totalDamageTaken / runs,
      avgKills: stats.totalKills / runs,
      totalDamageDealt: stats.totalDamageDealt,
      totalKills: stats.totalKills,
      dps: stats.totalDamageDealt / totalDuration,
      mvpCount: stats.mvpCount,
    });
  });

  // 팀별로 정렬 (Team1 먼저, 그 다음 Team2, MVP 카운트 순)
  unitStats.sort((a, b) => {
    if (a.team !== b.team) return a.team === 'team1' ? -1 : 1;
    return b.mvpCount - a.mvpCount;
  });

  return {
    totalRuns: runs,
    team1Wins,
    team2Wins,
    draws,
    team1WinRate: team1Wins / runs,
    team2WinRate: team2Wins / runs,
    avgDuration,
    avgTeam1Survivors: totalTeam1Survivors / runs,
    avgTeam2Survivors: totalTeam2Survivors / runs,

    // 확장 통계
    durationDistribution,
    minDuration,
    maxDuration,
    avgTeam1Damage: totalTeam1Damage / runs,
    avgTeam2Damage: totalTeam2Damage / runs,
    team1DPS: totalTeam1Damage / totalDuration,
    team2DPS: totalTeam2Damage / totalDuration,
    unitStats,
    avgTeam1SurvivorHpRatio: team1WinCount > 0 ? team1SurvivorHpRatioSum / team1WinCount : 0,
    avgTeam2SurvivorHpRatio: team2WinCount > 0 ? team2SurvivorHpRatioSum / team2WinCount : 0,
    sampleBattles,
    team1Reversals,
    team2Reversals,
    closeMatches,
  };
}

/**
 * 스킬이 있는 팀 전투 시뮬레이션 (부활/무적/힐/범위 스킬 지원)
 */
export function simulateTeamBattleWithSkills(
  team1: UnitStats[],
  team2: UnitStats[],
  team1Skills: Map<string, Skill[]>,  // unitId -> skills[]
  team2Skills: Map<string, Skill[]>,
  config: Partial<import('./types').TeamBattleConfig> = {}
): import('./types').TeamBattleResult {
  const cfg: import('./types').TeamBattleConfig = {
    maxDuration: 300,
    timeStep: 0.1,
    damageFormula: 'simple',
    defenseFormula: 'subtractive',
    allowOverkill: false,
    teamSize: Math.max(team1.length, team2.length),
    targetingMode: 'random',
    allowSynergies: false,
    ...config,
  };

  // 유닛 상태 초기화
  interface UnitState extends UnitStats {
    currentHp: number;
    nextAttackTime: number;
    team: 'team1' | 'team2';
    damageDealt: number;
    damageTaken: number;
    kills: number;
    alive: boolean;
    invincibleUntil: number;
    reviveUsed: boolean;
    skillCooldowns: Map<string, number>;
    activeHoTs: ActiveHoT[];
  }

  const createUnitState = (u: UnitStats, team: 'team1' | 'team2'): UnitState => ({
    ...u,
    currentHp: u.maxHp,
    nextAttackTime: 1 / u.speed,
    team,
    damageDealt: 0,
    damageTaken: 0,
    kills: 0,
    alive: true,
    invincibleUntil: 0,
    reviveUsed: false,
    skillCooldowns: new Map(),
    activeHoTs: [],
  });

  const team1States: UnitState[] = team1.map(u => createUnitState(u, 'team1'));
  const team2States: UnitState[] = team2.map(u => createUnitState(u, 'team2'));

  // 스킬 cooldown Map → skillReady lookup (BehaviorContext.skillReady 용)
  // time 기준: 해당 스킬의 cooldownEnds ≤ time 이면 ready.
  const buildSkillReadyMap = (attacker: UnitState, currentTime = 0): Record<string, boolean> => {
    const ready: Record<string, boolean> = {};
    attacker.skillCooldowns.forEach((cooldownEnds, skillId) => {
      ready[skillId] = currentTime >= cooldownEnds;
    });
    return ready;
  };

  // 타겟 선택 함수 (스킬 포함 버전 — decisionSkill 로 mode 적용률 제어)
  const selectTarget = (
    enemies: UnitState[],
    mode: import('./types').TeamBattleConfig['targetingMode'],
    attacker?: UnitState,
    time = 0,
  ): UnitState | null => {
    const aliveEnemies = enemies.filter(e => e.alive);
    if (aliveEnemies.length === 0) return null;

    if (attacker) {
      const a = attacker as unknown as { decisionSkill?: number; aiRules?: unknown[] };
      const decisionSkill = a.decisionSkill ?? 50;

      // AI 규칙이 있으면 aiBehavior.evaluateRules 로 액션 결정
      if (a.aiRules && Array.isArray(a.aiRules) && a.aiRules.length > 0) {
        const ctx = {
          selfHp: attacker.currentHp,
          selfMaxHp: attacker.maxHp,
          enemyHpSamples: aliveEnemies.map((e) => ({ id: e.id, hp: e.currentHp, maxHp: e.maxHp })),
          turn: 0,
          aliveEnemyCount: aliveEnemies.length,
          skillReady: buildSkillReadyMap(attacker, time),
        };
        const action = evaluateRules(a.aiRules as BehaviorRule[], ctx, decisionSkill);
        // 액션별 타겟 결정 override
        if (action.type === 'target_lowest_hp') {
          return aliveEnemies.reduce((min, e) => (e.currentHp < min.currentHp ? e : min));
        }
        if (action.type === 'target_highest_atk') {
          return aliveEnemies.reduce((max, e) => (e.atk > max.atk ? e : max));
        }
        if (action.type === 'target_random') {
          return aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
        }
        // attack / skill / defensive — mode 기본 흐름으로 (아래로 통과)
      }

      const mistakeProb = 1 - decisionSkill / 100;
      if (Math.random() < mistakeProb * 0.5) {
        return aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
      }
    }

    switch (mode) {
      case 'lowest_hp':
        return aliveEnemies.reduce((min, e) => e.currentHp < min.currentHp ? e : min);
      case 'highest_atk':
        return aliveEnemies.reduce((max, e) => e.atk > max.atk ? e : max);
      case 'focused':
        return aliveEnemies[0];
      case 'random':
      default:
        return aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
    }
  };

  // AoE 대상 선택 함수
  const selectAoeTargets = (
    units: UnitState[],
    targetCount: number | undefined,
    targetMode: Skill['aoeTargetMode']
  ): UnitState[] => {
    const aliveUnits = units.filter(u => u.alive);
    if (targetCount === undefined || targetCount >= aliveUnits.length) {
      return aliveUnits;
    }

    let sorted: UnitState[];
    switch (targetMode) {
      case 'lowest_hp':
        sorted = [...aliveUnits].sort((a, b) => a.currentHp - b.currentHp);
        break;
      case 'highest_hp':
        sorted = [...aliveUnits].sort((a, b) => b.currentHp - a.currentHp);
        break;
      case 'random':
      default:
        sorted = [...aliveUnits].sort(() => Math.random() - 0.5);
        break;
    }
    return sorted.slice(0, targetCount);
  };

  // 자기부활 체크 함수 (죽은 유닛 자신의 스킬)
  const checkSelfRevive = (unit: UnitState, skills: Skill[], time: number): boolean => {
    if (unit.reviveUsed || unit.currentHp > 0) return false;

    for (const skill of skills) {
      if (skill.skillType !== 'revive') continue;
      if (skill.reviveTarget !== 'self') continue;  // 자기부활만

      const cooldownEnds = unit.skillCooldowns.get(skill.id) || 0;
      if (time < cooldownEnds) continue;

      if (skill.trigger?.chance && Math.random() > skill.trigger.chance) continue;

      unit.currentHp = Math.round(unit.maxHp * (skill.reviveHpPercent || 0.3));
      unit.alive = true;
      unit.reviveUsed = true;
      unit.skillCooldowns.set(skill.id, time + skill.cooldown);
      return true;
    }
    return false;
  };

  // 타인부활 체크 함수 (살아있는 아군의 스킬로 죽은 아군 부활)
  const checkAllyRevive = (
    deadUnit: UnitState,
    aliveAllies: UnitState[],
    skillsMap: Map<string, Skill[]>,
    time: number
  ): boolean => {
    if (deadUnit.reviveUsed || deadUnit.currentHp > 0) return false;

    for (const ally of aliveAllies) {
      if (!ally.alive || ally.id === deadUnit.id) continue;

      const allySkills = skillsMap.get(ally.id) || [];
      for (const skill of allySkills) {
        if (skill.skillType !== 'revive') continue;
        if (skill.reviveTarget !== 'ally') continue;  // 타인부활만

        const cooldownEnds = ally.skillCooldowns.get(skill.id) || 0;
        if (time < cooldownEnds) continue;

        if (skill.trigger?.chance && Math.random() > skill.trigger.chance) continue;

        // 부활 성공
        deadUnit.currentHp = Math.round(deadUnit.maxHp * (skill.reviveHpPercent || 0.3));
        deadUnit.alive = true;
        deadUnit.reviveUsed = true;
        ally.skillCooldowns.set(skill.id, time + skill.cooldown);  // 부활 스킬 쿨다운은 시전자에게
        return true;
      }
    }
    return false;
  };

  // 통합 부활 체크 (자기부활 -> 타인부활 순으로 시도)
  const checkRevive = (
    unit: UnitState,
    unitSkills: Skill[],
    allies: UnitState[],
    skillsMap: Map<string, Skill[]>,
    time: number
  ): boolean => {
    // 1. 자기부활 먼저 시도
    if (checkSelfRevive(unit, unitSkills, time)) return true;
    // 2. 타인부활 시도 (살아있는 아군이 부활시킴)
    if (checkAllyRevive(unit, allies, skillsMap, time)) return true;
    return false;
  };

  // AI 액션 기반 스킬 우선순위 재정렬 — aiRules 설정된 유닛만
  const reorderSkillsByAI = (
    attacker: UnitState,
    enemies: UnitState[],
    skills: Skill[],
    time: number,
  ): Skill[] => {
    const a = attacker as unknown as { aiRules?: unknown[]; decisionSkill?: number };
    if (!a.aiRules || !Array.isArray(a.aiRules) || a.aiRules.length === 0) return skills;
    const ctx = {
      selfHp: attacker.currentHp,
      selfMaxHp: attacker.maxHp,
      enemyHpSamples: enemies.filter((e) => e.alive).map((e) => ({ id: e.id, hp: e.currentHp, maxHp: e.maxHp })),
      turn: 0,
      aliveEnemyCount: enemies.filter((e) => e.alive).length,
      skillReady: buildSkillReadyMap(attacker, time),
    };
    const action = evaluateRules(a.aiRules as BehaviorRule[], ctx, a.decisionSkill ?? 50);

    // defensive → heal/hot/invincible/revive 스킬 우선
    // skill:<id> → 해당 id 가 맨 앞
    if (action.type === 'defensive') {
      return [...skills].sort((a1, b1) => {
        const defensive = ['heal', 'hot', 'invincible', 'aoe_heal', 'revive'];
        const aDef = defensive.includes(a1.skillType ?? 'damage');
        const bDef = defensive.includes(b1.skillType ?? 'damage');
        return (bDef ? 1 : 0) - (aDef ? 1 : 0);
      });
    }
    if (action.type === 'skill') {
      const idx = skills.findIndex((s) => s.id === action.skillId);
      if (idx >= 0) {
        const target = skills[idx];
        return [target, ...skills.filter((_, i) => i !== idx)];
      }
    }
    return skills;
  };

  // 스킬 처리 함수
  const processUnitSkills = (
    attacker: UnitState,
    enemies: UnitState[],
    allies: UnitState[],
    skills: Skill[],
    time: number
  ): void => {
    if (time < attacker.invincibleUntil) return; // 무적 중 스킬 사용 불가

    // AI 규칙에 따라 스킬 평가 순서 재정렬 (defensive/skill 액션 반영)
    const orderedSkills = reorderSkillsByAI(attacker, enemies, skills, time);

    for (const skill of orderedSkills) {
      const cooldownEnds = attacker.skillCooldowns.get(skill.id) || 0;
      if (time < cooldownEnds) continue;

      // 트리거 조건 확인
      if (skill.trigger) {
        const { type, value = 0, chance = 1 } = skill.trigger;
        if (Math.random() > chance) continue;

        switch (type) {
          case 'hp_below':
            if ((attacker.currentHp / attacker.maxHp) > value) continue;
            break;
          case 'hp_above':
            if ((attacker.currentHp / attacker.maxHp) < value) continue;
            break;
          case 'always':
            break;
          default:
            continue;
        }
      }

      const skillType = skill.skillType || 'damage';

      switch (skillType) {
        case 'damage': {
          const target = selectTarget(enemies, cfg.targetingMode, attacker, time);
          if (!target || time < target.invincibleUntil) break;

          const baseDamage = skill.damageType === 'flat'
            ? skill.damage
            : attacker.atk * skill.damage;
          const effectiveDef = calculateEffectiveDefense(target.def, cfg.armorPenetration);
          const finalDamage = Math.max(1, Math.round(baseDamage - effectiveDef));

          target.currentHp = Math.max(0, target.currentHp - finalDamage);
          target.damageTaken += finalDamage;
          attacker.damageDealt += finalDamage;

          if (target.currentHp <= 0) {
            target.alive = false;
            attacker.kills++;
            const targetSkills = target.team === 'team1'
              ? team1Skills.get(target.id) || []
              : team2Skills.get(target.id) || [];
            const targetAllies = target.team === 'team1' ? team1States : team2States;
            const targetSkillsMap = target.team === 'team1' ? team1Skills : team2Skills;
            checkRevive(target, targetSkills, targetAllies, targetSkillsMap, time);
          }
          break;
        }

        case 'aoe_damage': {
          const targets = selectAoeTargets(enemies, skill.aoeTargetCount, skill.aoeTargetMode);
          for (const target of targets) {
            if (time < target.invincibleUntil) continue;

            const baseDamage = skill.damageType === 'flat'
              ? skill.damage
              : attacker.atk * skill.damage;
            const effectiveDef = calculateEffectiveDefense(target.def, cfg.armorPenetration);
            const finalDamage = Math.max(1, Math.round(baseDamage - effectiveDef));

            target.currentHp = Math.max(0, target.currentHp - finalDamage);
            target.damageTaken += finalDamage;
            attacker.damageDealt += finalDamage;

            if (target.currentHp <= 0) {
              target.alive = false;
              attacker.kills++;
              const targetSkills = target.team === 'team1'
                ? team1Skills.get(target.id) || []
                : team2Skills.get(target.id) || [];
              const targetAllies = target.team === 'team1' ? team1States : team2States;
              const targetSkillsMap = target.team === 'team1' ? team1Skills : team2Skills;
              checkRevive(target, targetSkills, targetAllies, targetSkillsMap, time);
            }
          }
          break;
        }

        case 'heal': {
          const healAmount = skill.healType === 'percent'
            ? Math.round(attacker.maxHp * (skill.healAmount || 0))
            : Math.round(skill.healAmount || 0);
          attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + healAmount);
          break;
        }

        case 'aoe_heal': {
          const healTargets = selectAoeTargets(allies, skill.aoeTargetCount, skill.aoeTargetMode);
          const healAmount = skill.healType === 'percent'
            ? (skill.healAmount || 0)
            : (skill.healAmount || 0);

          for (const target of healTargets) {
            const heal = skill.healType === 'percent'
              ? Math.round(target.maxHp * healAmount)
              : Math.round(healAmount);
            target.currentHp = Math.min(target.maxHp, target.currentHp + heal);
          }
          break;
        }

        case 'hot': {
          const newHoT: ActiveHoT = {
            skillId: skill.id,
            skillName: skill.name,
            endTime: time + (skill.hotDuration || 5),
            nextTickTime: time + (skill.hotTickInterval || 1),
            tickInterval: skill.hotTickInterval || 1,
            healAmount: skill.hotAmount || 0,
            healType: skill.hotType || 'flat',
            casterMaxHp: attacker.maxHp,
          };
          attacker.activeHoTs.push(newHoT);
          break;
        }

        case 'invincible': {
          attacker.invincibleUntil = time + (skill.invincibleDuration || 0);
          break;
        }
      }

      attacker.skillCooldowns.set(skill.id, time + skill.cooldown);
    }
  };

  // HoT 처리 함수
  const processHoTs = (unit: UnitState, time: number): void => {
    const remainingHots: ActiveHoT[] = [];

    for (const hot of unit.activeHoTs) {
      if (time >= hot.endTime) continue;

      if (time >= hot.nextTickTime) {
        const healAmount = hot.healType === 'percent'
          ? Math.round(hot.casterMaxHp * hot.healAmount)
          : Math.round(hot.healAmount);
        unit.currentHp = Math.min(unit.maxHp, unit.currentHp + healAmount);
        hot.nextTickTime = time + hot.tickInterval;
      }
      remainingHots.push(hot);
    }

    unit.activeHoTs = remainingHots;
  };

  // 시뮬레이션 루프
  let time = 0;
  let team1TotalDamage = 0;
  let team2TotalDamage = 0;
  // Replay 로그 — 다대다 timeline 입력. 스킬 이벤트는 깊은 분기에 산재해 추후 추가.
  const log: BattleLogEntry[] = [];

  while (time < cfg.maxDuration) {
    time += cfg.timeStep;

    // HoT 처리
    for (const unit of [...team1States, ...team2States]) {
      if (unit.alive) processHoTs(unit, time);
    }

    const team1Alive = team1States.filter(u => u.alive);
    const team2Alive = team2States.filter(u => u.alive);

    if (team1Alive.length === 0 || team2Alive.length === 0) break;

    // 스킬 처리 (양팀 동시)
    for (const attacker of team1Alive) {
      if (time >= attacker.nextAttackTime) {
        const skills = team1Skills.get(attacker.id) || [];
        processUnitSkills(attacker, team2States, team1States, skills, time);
      }
    }
    for (const attacker of team2Alive) {
      if (time >= attacker.nextAttackTime) {
        const skills = team2Skills.get(attacker.id) || [];
        processUnitSkills(attacker, team1States, team2States, skills, time);
      }
    }

    // 동시 공격 처리: 데미지를 먼저 모두 계산한 뒤 일괄 적용
    interface PendingAttack {
      attacker: UnitState;
      target: UnitState;
      damage: number;
      isMiss: boolean;
      isTeam1: boolean;
    }
    const pendingAttacks: PendingAttack[] = [];

    // Team1 공격 계산
    for (const attacker of team1Alive) {
      if (time >= attacker.nextAttackTime) {
        // 무적 중 공격 불가
        if (time < attacker.invincibleUntil) {
          attacker.nextAttackTime = time + 1 / attacker.speed;
          continue;
        }

        const target = selectTarget(team2States, cfg.targetingMode, attacker, time);
        if (!target) continue;

        // 대상 무적 체크
        if (time < target.invincibleUntil) {
          attacker.nextAttackTime = time + 1 / attacker.speed;
          continue;
        }

        const result = calculateDamage(attacker, target, cfg.damageFormula, cfg.defenseFormula, cfg.armorPenetration);
        pendingAttacks.push({
          attacker,
          target,
          damage: result.damage,
          isMiss: result.isMiss,
          isTeam1: true,
        });
        attacker.nextAttackTime = time + 1 / attacker.speed;
      }
    }

    // Team2 공격 계산
    for (const attacker of team2Alive) {
      if (time >= attacker.nextAttackTime) {
        // 무적 중 공격 불가
        if (time < attacker.invincibleUntil) {
          attacker.nextAttackTime = time + 1 / attacker.speed;
          continue;
        }

        const target = selectTarget(team1States, cfg.targetingMode, attacker, time);
        if (!target) continue;

        // 대상 무적 체크
        if (time < target.invincibleUntil) {
          attacker.nextAttackTime = time + 1 / attacker.speed;
          continue;
        }

        const result = calculateDamage(attacker, target, cfg.damageFormula, cfg.defenseFormula, cfg.armorPenetration);
        pendingAttacks.push({
          attacker,
          target,
          damage: result.damage,
          isMiss: result.isMiss,
          isTeam1: false,
        });
        attacker.nextAttackTime = time + 1 / attacker.speed;
      }
    }

    // Speed 빠른 attacker 먼저 — 죽이는 순간 같은 timeStep 의 보복 공격 cancel.
    pendingAttacks.sort((a, b) => b.attacker.speed - a.attacker.speed);

    // 순차 적용 + alive 체크 + 즉시 사망/부활 처리
    for (const attack of pendingAttacks) {
      if (!attack.attacker.alive || attack.attacker.currentHp <= 0) continue;

      if (!attack.isMiss) {
        attack.target.currentHp = Math.max(0, attack.target.currentHp - attack.damage);
        attack.target.damageTaken += attack.damage;
        attack.attacker.damageDealt += attack.damage;

        if (attack.isTeam1) {
          team1TotalDamage += attack.damage;
        } else {
          team2TotalDamage += attack.damage;
        }
      }
      log.push({
        time: Math.round(time * 100) / 100,
        actor: attack.attacker.id,
        action: 'attack',
        target: attack.target.id,
        damage: attack.isMiss ? 0 : attack.damage,
        isMiss: attack.isMiss,
        remainingHp: attack.target.currentHp,
      });

      // 즉시 사망 처리 + 부활 체크
      if (!attack.isMiss && attack.target.currentHp <= 0 && attack.target.alive) {
        attack.target.alive = false;
        attack.attacker.kills++;
        log.push({
          time: Math.round(time * 100) / 100,
          actor: attack.target.id,
          action: 'death',
          remainingHp: 0,
        });
        const targetSkills = attack.target.team === 'team1'
          ? team1Skills.get(attack.target.id) || []
          : team2Skills.get(attack.target.id) || [];
        const targetAllies = attack.target.team === 'team1' ? team1States : team2States;
        const targetSkillsMap = attack.target.team === 'team1' ? team1Skills : team2Skills;
        const wasRevived = checkRevive(attack.target, targetSkills, targetAllies, targetSkillsMap, time);
        if (wasRevived) {
          log.push({
            time: Math.round(time * 100) / 100,
            actor: attack.target.id,
            action: 'revive',
            remainingHp: attack.target.currentHp,
          });
        }
      }
    }
  }

  // 결과 집계
  const team1Survivors = team1States.filter(u => u.alive).length;
  const team2Survivors = team2States.filter(u => u.alive).length;

  let winner: import('./types').TeamBattleResult['winner'];
  if (team1Survivors === 0 && team2Survivors === 0) {
    winner = 'draw';
  } else if (team1Survivors === 0) {
    winner = 'team2';
  } else if (team2Survivors === 0) {
    winner = 'team1';
  } else {
    if (team1Survivors === team2Survivors) {
      const team1HpRatio = team1States.reduce((sum, u) => sum + (u.alive ? u.currentHp / u.maxHp : 0), 0);
      const team2HpRatio = team2States.reduce((sum, u) => sum + (u.alive ? u.currentHp / u.maxHp : 0), 0);
      winner = team1HpRatio > team2HpRatio ? 'team1' : team2HpRatio > team1HpRatio ? 'team2' : 'draw';
    } else {
      winner = team1Survivors > team2Survivors ? 'team1' : 'team2';
    }
  }

  return {
    winner,
    duration: Math.round(time * 100) / 100,
    team1Survivors,
    team2Survivors,
    team1TotalDamage,
    team2TotalDamage,
    unitResults: [
      ...team1States.map(u => ({
        unit: { id: u.id, name: u.name, hp: u.hp, maxHp: u.maxHp, atk: u.atk, def: u.def, speed: u.speed },
        team: 'team1' as const,
        survived: u.alive,
        damageDealt: u.damageDealt,
        damageTaken: u.damageTaken,
        kills: u.kills,
      })),
      ...team2States.map(u => ({
        unit: { id: u.id, name: u.name, hp: u.hp, maxHp: u.maxHp, atk: u.atk, def: u.def, speed: u.speed },
        team: 'team2' as const,
        survived: u.alive,
        damageDealt: u.damageDealt,
        damageTaken: u.damageTaken,
        kills: u.kills,
      })),
    ],
    log,
  };
}
