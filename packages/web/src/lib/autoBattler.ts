/**
 * Auto Battler 시뮬 — TFT / Hearthstone Battlegrounds / Dota Underlords.
 *
 * 핵심 지표:
 *  - Economy vs Tempo trade-off — 이자 쌓고 level-up 미룰 지 vs 즉시 강화
 *  - Power spike timing — 특정 라운드에 파워 최대화
 *  - 골드 이자 (TFT: 10g max, 10g마다 +1 이자)
 *  - Level-up cost (TFT 2024 기준 Level 4→5=10xp · 9→10=76xp 누적)
 *  - 리롤 비용 2g/회
 *  - HP bleed: 5-20 per loss (스테이지 따라 증가)
 *
 * 모델:
 *  - 각 라운드: start_gold → buy/roll 결정 → level-up 선택 → 전투 승/패
 *  - 상대 플레이어 전력과 비교 → 승/패 확률 (team power ratio)
 *  - 전략 3개 내장: GREEDY_ECON (이자 쌓기) · FAST_LEVEL (빠른 5~6렙) · BALANCED
 */

export type AutoBattlerStrategy = 'greedy-econ' | 'fast-level' | 'balanced';

export interface AutoBattlerConfig {
  /** 전략 */
  strategy: AutoBattlerStrategy;
  /** 플레이어 수 (TFT = 8, HSBG = 8) */
  playerCount: number;
  /** 시뮬 라운드 수 (TFT 1 게임 ~30라운드) */
  rounds: number;
  /** 시작 HP (TFT = 100) */
  startingHp: number;
  /** 시작 골드 (TFT = 0) */
  startingGold: number;
  /** 라운드당 기본 수입 */
  baseIncomePerRound: number;
  /** 리롤 비용 (gold) */
  rerollCost: number;
  /** 유닛 구매 비용 평균 (1~5 tier mix) */
  avgUnitCost: number;
  /** 연패/연승 bonus (streak 3+ → +1, 5+ → +2) */
  streakBonusEnabled: boolean;
  /** 이자 한계 (TFT = 5g per 10g, max 5) */
  interestCap: number;
}

export interface AutoBattlerRound {
  round: number;
  gold: number;
  level: number;
  hp: number;
  teamPower: number;
  won: boolean;
  damageDealt: number;
  interestEarned: number;
  rerolls: number;
}

export interface AutoBattlerResult {
  rounds: AutoBattlerRound[];
  /** 최종 placement (1~8) */
  placement: number;
  /** 살아남았나 (TFT = HP > 0) */
  survived: boolean;
  /** 파워 스파이크 라운드 (teamPower 최대 지점) */
  peakPowerRound: number;
  /** 평균 teamPower */
  avgPower: number;
  /** 총 리롤 비용 */
  totalRerollSpent: number;
  /** 총 이자 수입 */
  totalInterestEarned: number;
  /** 생존 라운드 수 */
  survivedRounds: number;
}

// ============================================================================
// Level-up 경험치 테이블 (TFT 2024)
// ============================================================================

const LEVEL_XP_COST = [0, 0, 2, 6, 10, 20, 36, 48, 76, 84]; // 1→2, 2→3, ..., 9→10

/** 라운드 자동 수입 XP (TFT: 2/round) */
const XP_PER_ROUND = 2;

/** 라운드별 기본 수입 증가 (TFT 2024: 2-1 부터 +1, 3-1 +1, 4-1 +1, 5-1 +1 까지) */
function baseIncomeAtRound(round: number): number {
  if (round < 3) return 2;
  if (round < 9) return 3;
  if (round < 16) return 4;
  if (round < 24) return 5;
  return 5;
}

/** 이자 (gold / 10, max cap) */
function interest(gold: number, cap: number): number {
  return Math.min(cap, Math.floor(gold / 10));
}

/** 라운드의 "스테이지" — TFT 는 1-4 라운드 후 2-1 로 넘어감 */
function stageOfRound(round: number): number {
  if (round <= 3) return 1;
  return 1 + Math.floor((round - 3 + 6) / 7);
}

/** 패배 시 HP 감소 (스테이지 × 2 + level) */
function hpDamagePerLoss(stage: number, enemyLevel: number): number {
  return stage * 2 + Math.max(0, enemyLevel - 4);
}

// ============================================================================
// 전략별 의사결정
// ============================================================================

interface DecisionContext {
  round: number;
  gold: number;
  level: number;
  targetLevel: number;
  xpProgress: number;
  hp: number;
  strategy: AutoBattlerStrategy;
}

interface Decision {
  rerolls: number;
  spendOnXp: number;  // gold 소모해서 경험치 추가 (TFT: 4g → 4xp)
  spendOnUnits: number;
}

function makeDecision(ctx: DecisionContext, cfg: AutoBattlerConfig): Decision {
  const d: Decision = { rerolls: 0, spendOnXp: 0, spendOnUnits: 0 };

  if (ctx.strategy === 'greedy-econ') {
    // 10g+ 유지 — 이자 극대화, level-up 미룸
    if (ctx.gold < 10) return d;
    // 10+ gold 남겨놓고 나머지만 소모
    const surplus = ctx.gold - 10;
    if (ctx.round > 10 && surplus >= 4 && ctx.level < ctx.targetLevel) {
      d.spendOnXp = 4; // 레벨업 4g 한번
    }
    if (surplus - d.spendOnXp >= cfg.avgUnitCost) {
      d.spendOnUnits = Math.min(surplus - d.spendOnXp, cfg.avgUnitCost * 2);
    }
  } else if (ctx.strategy === 'fast-level') {
    // 빠르게 level-up — 이자 무시
    if (ctx.level < ctx.targetLevel && ctx.gold >= 4) {
      d.spendOnXp = 4;
    }
    // 남은 gold 유닛에
    const remaining = ctx.gold - d.spendOnXp;
    if (remaining >= cfg.avgUnitCost) {
      d.spendOnUnits = remaining;
    }
    // HP 위험 시 리롤
    if (ctx.hp < 30 && ctx.gold > 10) d.rerolls = Math.floor((ctx.gold - 10) / cfg.rerollCost);
  } else {
    // balanced — stage 에 따라 스위치
    const stage = stageOfRound(ctx.round);
    if (stage <= 2) {
      // 초반: 경제 유지
      if (ctx.gold >= 10 + 4 && ctx.level < ctx.targetLevel) d.spendOnXp = 4;
      if (ctx.gold >= 14) d.spendOnUnits = cfg.avgUnitCost;
    } else if (stage <= 3) {
      // 중반: 레벨업 힘주기
      if (ctx.level < ctx.targetLevel && ctx.gold >= 4) d.spendOnXp = 4;
      if (ctx.gold - d.spendOnXp >= cfg.avgUnitCost) {
        d.spendOnUnits = Math.min(ctx.gold - d.spendOnXp - 10, cfg.avgUnitCost * 2);
      }
    } else {
      // 후반: 올인
      if (ctx.level < ctx.targetLevel && ctx.gold >= 4) d.spendOnXp = 4;
      d.spendOnUnits = Math.max(0, ctx.gold - d.spendOnXp);
      if (ctx.hp < 50) {
        d.rerolls = Math.floor(d.spendOnUnits / cfg.rerollCost / 2);
        d.spendOnUnits -= d.rerolls * cfg.rerollCost;
      }
    }
  }

  return d;
}

// ============================================================================
// 메인 시뮬
// ============================================================================

export function simulateAutoBattler(cfg: AutoBattlerConfig): AutoBattlerResult {
  const rounds: AutoBattlerRound[] = [];
  let gold = cfg.startingGold;
  let hp = cfg.startingHp;
  let level = 1;
  let xp = 0;
  let streak = 0; // positive = 연승, negative = 연패
  let survivedRounds = 0;
  let totalRerollSpent = 0;
  let totalInterestEarned = 0;

  // 대략 목표 level — greedy-econ 은 8, fast-level 은 6, balanced 7
  const targetLevel = cfg.strategy === 'greedy-econ' ? 8
    : cfg.strategy === 'fast-level' ? 6
    : 7;

  let peakPower = 0;
  let peakPowerRound = 0;

  for (let round = 1; round <= cfg.rounds; round++) {
    if (hp <= 0) break;
    survivedRounds = round;

    // 라운드 시작 수입
    const baseIncome = baseIncomeAtRound(round);
    const streakBonus = cfg.streakBonusEnabled
      ? Math.abs(streak) >= 5 ? 3
      : Math.abs(streak) >= 4 ? 2
      : Math.abs(streak) >= 3 ? 1
      : 0
      : 0;
    const earnedInterest = interest(gold, cfg.interestCap);
    gold += baseIncome + streakBonus + earnedInterest;
    totalInterestEarned += earnedInterest;
    xp += XP_PER_ROUND;

    // 자동 레벨업 (누적 XP 도달 시)
    while (level < 9 && xp >= LEVEL_XP_COST[level + 1]) {
      xp -= LEVEL_XP_COST[level + 1];
      level++;
    }

    // 의사결정
    const decision = makeDecision({ round, gold, level, targetLevel, xpProgress: xp, hp, strategy: cfg.strategy }, cfg);
    gold -= decision.spendOnXp;
    gold -= decision.spendOnUnits;
    gold -= decision.rerolls * cfg.rerollCost;
    totalRerollSpent += decision.rerolls * cfg.rerollCost;
    if (decision.spendOnXp > 0) {
      xp += decision.spendOnXp;
      while (level < 9 && xp >= LEVEL_XP_COST[level + 1]) {
        xp -= LEVEL_XP_COST[level + 1];
        level++;
      }
    }

    // Team power — level × 10 + (유닛 투자 누적 / 2) + 리롤 덕분에 +5/리롤
    const teamPower = level * 10 + decision.spendOnUnits * 0.4 + decision.rerolls * 3;
    if (teamPower > peakPower) { peakPower = teamPower; peakPowerRound = round; }

    // 상대 평균 파워 추정: round 기반 — stage 1=15, 2=30, 3=50, 4=75, 5=100, 6=130
    const stage = stageOfRound(round);
    const avgEnemyPower = 10 + stage * 18;
    // 라운드 승패 확률
    const winChance = teamPower / (teamPower + avgEnemyPower);
    const won = Math.random() < winChance;
    const damageDealt = won ? Math.round(teamPower / 10) : 0;

    if (!won) {
      const dmg = hpDamagePerLoss(stage, 5 + Math.floor(round / 5));
      hp -= dmg;
      streak = streak > 0 ? -1 : streak - 1;
    } else {
      streak = streak < 0 ? 1 : streak + 1;
    }

    rounds.push({
      round,
      gold,
      level,
      hp: Math.max(0, hp),
      teamPower: Math.round(teamPower),
      won,
      damageDealt,
      interestEarned: earnedInterest,
      rerolls: decision.rerolls,
    });
  }

  // Placement: HP 기반 상대 순위 근사 — 내 HP 로 0~7 위 선형 배치
  const hpRatio = Math.max(0, hp / cfg.startingHp);
  const placement = hp <= 0 ? Math.min(cfg.playerCount, Math.ceil(cfg.playerCount - survivedRounds / cfg.rounds * cfg.playerCount))
    : Math.max(1, Math.round(cfg.playerCount - hpRatio * (cfg.playerCount - 1)));

  const avgPower = rounds.length > 0
    ? rounds.reduce((s, r) => s + r.teamPower, 0) / rounds.length
    : 0;

  return {
    rounds,
    placement,
    survived: hp > 0,
    peakPowerRound,
    avgPower,
    totalRerollSpent,
    totalInterestEarned,
    survivedRounds,
  };
}

// ============================================================================
// 기본 config
// ============================================================================

export function defaultAutoBattlerConfig(strategy: AutoBattlerStrategy = 'balanced'): AutoBattlerConfig {
  return {
    strategy,
    playerCount: 8,
    rounds: 30,
    startingHp: 100,
    startingGold: 0,
    baseIncomePerRound: 3,
    rerollCost: 2,
    avgUnitCost: 3,
    streakBonusEnabled: true,
    interestCap: 5,
  };
}

// ============================================================================
// Monte Carlo — 전략 비교
// ============================================================================

export interface StrategyComparisonResult {
  strategy: AutoBattlerStrategy;
  avgPlacement: number;
  winRate: number;  // 1st place 비율
  top4Rate: number;
  avgHp: number;
  avgPeakPower: number;
}

export function compareStrategies(baseCfg: Omit<AutoBattlerConfig, 'strategy'>, runs = 200): StrategyComparisonResult[] {
  const strategies: AutoBattlerStrategy[] = ['greedy-econ', 'fast-level', 'balanced'];
  return strategies.map((strategy) => {
    let totalPlacement = 0;
    let wins = 0;
    let top4 = 0;
    let hpSum = 0;
    let peakSum = 0;
    for (let i = 0; i < runs; i++) {
      const r = simulateAutoBattler({ ...baseCfg, strategy });
      totalPlacement += r.placement;
      if (r.placement === 1) wins++;
      if (r.placement <= 4) top4++;
      hpSum += r.rounds[r.rounds.length - 1]?.hp ?? 0;
      peakSum += r.rounds.reduce((mx, rnd) => Math.max(mx, rnd.teamPower), 0);
    }
    return {
      strategy,
      avgPlacement: totalPlacement / runs,
      winRate: wins / runs,
      top4Rate: top4 / runs,
      avgHp: hpSum / runs,
      avgPeakPower: peakSum / runs,
    };
  });
}
