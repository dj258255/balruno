/**
 * 전투 시뮬레이션 타입 정의
 */

// 전투 유닛 기본 스탯
export interface UnitStats {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  speed: number;        // 공격 속도 (초당 공격 횟수)
  critRate?: number;    // 크리티컬 확률 (0-1)
  critDamage?: number;  // 크리티컬 데미지 배율 (기본 1.5)
  accuracy?: number;    // 명중률 (0-1, 기본 1)
  evasion?: number;     // 회피율 (0-1, 기본 0)

  // 플레이어/조종자 실력 (composite) — Overwatch/Destiny 밸런싱 문서 방식
  // 각 0-100, 기본 50 (평균). undefined = 보정 없음 (기존 동작 유지).
  /** 에임/명중 실력 — accuracy + crit 에 곱 보정 */
  aimSkill?: number;
  /** 반응 속도 — evasion + 선공 확률 보정 */
  reactionSkill?: number;
  /** 판단 실력 — 스킬 선택 최적성 (팀전/다중 스킬시 효과) */
  decisionSkill?: number;

  /**
   * AI 행동 규칙 — aiBehavior.ts 의 BehaviorRule[].
   * 설정 시 targetingMode 대신 이 규칙이 우선. decisionSkill 로 준수율 제어.
   * 타입은 구조적 의존을 피해 any → 실제로는 BehaviorRule[] (순환참조 회피).
   */
  aiRules?: unknown[];
}

// 스킬 정의
export interface Skill {
  id: string;
  name: string;
  damage: number;           // 기본 데미지 또는 배율
  damageType: 'flat' | 'multiplier';  // 고정 데미지 or ATK 배율
  cooldown: number;         // 쿨다운 (초)
  trigger?: SkillTrigger;   // 발동 조건
  skillType?: SkillType;    // 스킬 타입 (데미지, 힐, HoT, 무적, 부활)
  healAmount?: number;      // 힐량 (flat 또는 maxHp %)
  healType?: 'flat' | 'percent'; // 힐 타입
  invincibleDuration?: number;  // 무적 지속 시간 (초)
  invincibleTradeoff?: InvincibleTradeoff; // 무적 트레이드오프 설정
  reviveHpPercent?: number;     // 부활 시 HP 비율 (0-1)
  reviveTarget?: 'self' | 'ally';  // 부활 대상 (self: 자기 부활, ally: 아군 부활)
  // HoT (Heal Over Time) 설정
  hotDuration?: number;     // HoT 지속 시간 (초)
  hotTickInterval?: number; // HoT 틱 간격 (초, 기본 1)
  hotAmount?: number;       // 틱당 힐량 (flat 또는 maxHp %)
  hotType?: 'flat' | 'percent'; // HoT 힐 타입
  // AoE (범위) 설정
  aoeTargetCount?: number;  // 범위 스킬 대상 수 (기본: 전체)
  aoeTargetMode?: 'all' | 'random' | 'lowest_hp' | 'highest_hp'; // 범위 대상 선택 방식
}

// 스킬 타입
export type SkillType =
  | 'damage'     // 데미지 스킬
  | 'heal'       // 즉시 힐 스킬
  | 'hot'        // Heal Over Time (지속 힐)
  | 'invincible' // 무적 스킬
  | 'revive'     // 부활 스킬
  | 'aoe_damage' // 범위 데미지 스킬
  | 'aoe_heal';  // 범위 힐 스킬

// 무적 트레이드오프 설정
export interface InvincibleTradeoff {
  cannotAttack?: boolean;      // 무적 중 공격 불가
  cannotUseSkills?: boolean;   // 무적 중 스킬 사용 불가
  reducedSpeedPercent?: number; // 무적 중 속도 감소 (0-1)
  afterDebuff?: {              // 무적 해제 후 디버프
    stat: keyof UnitStats;
    value: number;
    isPercent: boolean;
    duration: number;          // 디버프 지속 시간 (초)
  };
}

// 활성 HoT 효과 (전투 중 추적용)
export interface ActiveHoT {
  skillId: string;
  skillName: string;
  endTime: number;        // HoT 종료 시간
  nextTickTime: number;   // 다음 틱 시간
  tickInterval: number;   // 틱 간격
  healAmount: number;     // 틱당 힐량
  healType: 'flat' | 'percent';
  casterMaxHp: number;    // 캐스터의 maxHp (percent 계산용)
}

// 스킬 발동 조건
export interface SkillTrigger {
  type: 'hp_below' | 'hp_above' | 'turn' | 'on_hit' | 'on_crit' | 'always';
  value?: number;  // HP% 또는 턴 수
  chance?: number; // 발동 확률 (0-1)
}

// 버프/디버프
export interface Buff {
  id: string;
  name: string;
  stat: keyof UnitStats;
  value: number;
  isPercent: boolean;
  duration: number;  // 지속 시간 (초) 또는 턴
  stackable?: boolean;
  maxStacks?: number;
}

// 시너지 효과
export interface Synergy {
  id: string;
  name: string;
  requiredUnits: string[];  // 필요한 유닛 ID 목록
  effect: Buff[];
}

// 전투 설정
export interface BattleConfig {
  maxDuration: number;      // 최대 전투 시간 (초)
  timeStep: number;         // 시뮬레이션 시간 단위 (초, 기본 0.1)
  damageFormula?: DamageFormulaType;  // 데미지 공식
  defenseFormula?: DefenseFormulaType; // 방어 공식
  allowOverkill?: boolean;  // 오버킬 허용 여부
  armorPenetration?: ArmorPenetrationConfig; // 방어관통 설정
}

// 데미지 공식 타입
export type DamageFormulaType =
  | 'simple'      // ATK - DEF
  | 'mmorpg'      // ATK * (100 / (100 + DEF))
  | 'percentage'  // ATK * (1 - DEF/100)
  | 'random'      // ATK * random(0.9~1.1) - DEF
  | 'multiplicative'; // ATK * DEF_REDUCTION

// 방어 공식 타입
export type DefenseFormulaType =
  | 'subtractive'    // damage = ATK - DEF (빼기식)
  | 'divisive'       // reduction = DEF / (DEF + C) (나누기식, LoL/WoW)
  | 'multiplicative' // damage = ATK * (1 - DEF%) (곱셈식)
  | 'logarithmic';   // reduction = log(DEF) based (로그식)

// 방어관통 설정
export interface ArmorPenetrationConfig {
  flatPenetration?: number;    // 고정 관통 (Lethality)
  percentPenetration?: number; // 퍼센트 관통 (0-1)
  flatReduction?: number;      // 고정 방어 감소
  percentReduction?: number;   // 퍼센트 방어 감소 (0-1)
}

// 전투 로그 엔트리
export interface BattleLogEntry {
  time: number;
  actor: string;
  action: 'attack' | 'skill' | 'buff' | 'debuff' | 'heal' | 'hot_tick' | 'hot_end' | 'death' | 'invincible' | 'invincible_end' | 'revive';
  target?: string;
  damage?: number;
  healAmount?: number;
  isCrit?: boolean;
  isMiss?: boolean;
  skillName?: string;
  remainingHp?: number;
}

// 단일 시뮬레이션 결과
export interface BattleResult {
  winner: 'unit1' | 'unit2' | 'draw';
  duration: number;         // 전투 시간 (초)
  unit1FinalHp: number;
  unit2FinalHp: number;
  unit1TotalDamage: number;
  unit2TotalDamage: number;
  unit1Hits: number;
  unit2Hits: number;
  unit1Crits: number;
  unit2Crits: number;
  log: BattleLogEntry[];
}

// 몬테카를로 시뮬레이션 결과
export interface SimulationResult {
  totalRuns: number;
  unit1Wins: number;
  unit2Wins: number;
  draws: number;
  unit1WinRate: number;      // 0-1
  unit2WinRate: number;      // 0-1

  // 통계
  avgDuration: number;
  minDuration: number;
  maxDuration: number;

  // 유닛1 통계
  unit1AvgDamage: number;
  unit1AvgDps: number;
  unit1AvgSurvivalHp: number;  // 승리 시 남은 HP

  // 유닛2 통계
  unit2AvgDamage: number;
  unit2AvgDps: number;
  unit2AvgSurvivalHp: number;

  // 분포 데이터 (히스토그램용)
  durationDistribution: number[];
  damageDistribution: {
    unit1: number[];
    unit2: number[];
    unit1Range: { min: number; max: number };
    unit2Range: { min: number; max: number };
  };

  // 신뢰 구간
  winRateConfidence: {
    unit1: { lower: number; upper: number };
    unit2: { lower: number; upper: number };
  };

  // TTK (Time To Kill) 분포
  ttkDistribution: {
    unit1: number[];  // unit1이 unit2를 죽이는 데 걸린 시간
    unit2: number[];  // unit2가 unit1을 죽이는 데 걸린 시간
  };

  // TTK 통계 (평균, 최소, 최대)
  ttkStats: {
    unit1: { avg: number; min: number; max: number; median: number };
    unit2: { avg: number; min: number; max: number; median: number };
  };

  // 이론적 DPS (스탯 기반 계산)
  theoreticalDps: {
    unit1: number;
    unit2: number;
  };

  // 샘플 전투 로그 (분석용)
  sampleBattles: BattleResult[];

  // 치명타 통계
  critStats: {
    unit1: {
      totalCrits: number;       // 총 크리티컬 횟수
      totalHits: number;        // 총 공격 횟수
      avgCritRate: number;      // 평균 크리티컬 발동률
      critDamageTotal: number;  // 크리티컬로 입힌 총 데미지
      reversalsByByCrit: number; // 크리티컬로 역전한 횟수
    };
    unit2: {
      totalCrits: number;
      totalHits: number;
      avgCritRate: number;
      critDamageTotal: number;
      reversalsByByCrit: number;
    };
  };

  // 역전 분석
  reversalAnalysis: {
    unit1Reversals: number;  // unit1이 역전승한 횟수
    unit2Reversals: number;  // unit2가 역전승한 횟수
    critCausedReversals: number;  // 크리티컬로 인한 역전 횟수
    closeMatches: number;    // 박빙 승부 횟수 (HP 10% 이내 차이)
  };

  // 스킬 통계
  skillStats?: {
    unit1: SkillUsageStats[];
    unit2: SkillUsageStats[];
  };

  // 힐 통계
  healingStats?: {
    unit1TotalHealing: number;
    unit2TotalHealing: number;
    unit1HPS: number;  // Healing Per Second
    unit2HPS: number;
  };
}

// 스킬 사용 통계
export interface SkillUsageStats {
  skillId: string;
  skillName: string;
  totalUses: number;
  totalDamage: number;
  totalHealing: number;
  avgDamagePerUse: number;
  dpsContribution: number;  // 전체 DPS 중 비율 (0-1)
}

// 팀 전투 설정
export interface TeamBattleConfig extends BattleConfig {
  teamSize: number;
  targetingMode: 'random' | 'lowest_hp' | 'highest_atk' | 'focused';
  allowSynergies?: boolean;
}

// 팀 전투 결과
export interface TeamBattleResult {
  winner: 'team1' | 'team2' | 'draw';
  duration: number;
  team1Survivors: number;
  team2Survivors: number;
  team1TotalDamage: number;
  team2TotalDamage: number;
  unitResults: {
    unit: UnitStats;
    team: 'team1' | 'team2';
    survived: boolean;
    damageDealt: number;
    damageTaken: number;
    kills: number;
  }[];
}

// 시뮬레이션 옵션
export interface SimulationOptions {
  runs: number;             // 반복 횟수 (기본 10000)
  config: BattleConfig;
  saveSampleBattles?: number;  // 저장할 샘플 전투 수
  onProgress?: (progress: number) => void;  // 진행률 콜백
}
