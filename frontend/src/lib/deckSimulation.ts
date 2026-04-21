/**
 * 덱빌더 확률 시뮬 — Slay the Spire / Inscryption / Monster Train 계열.
 *
 * 모델:
 *  - 덱: 카드 N장 (damage/block/energy/draw 속성)
 *  - 턴: 에너지 E 로 카드 플레이. hand 크기 H 로 draw
 *  - 드로우: 덱 shuffle + hand/discard/exhaust 파일 관리
 *  - 시뮬 대상: N 턴 후 평균 DPT (Damage Per Turn), 에너지 효율, deadhand 확률
 *
 * 업계 표준 지표:
 *  - Expected DPT (평균 턴당 피해)
 *  - Energy waste (미사용 에너지 / 총 에너지)
 *  - Dead hand 확률 (play 가능 카드 0장인 턴 비율)
 *  - 조합 빈도 (key card 조합 drawn together)
 */

export type CardType = 'attack' | 'skill' | 'power';

export interface Card {
  id: string;
  name: string;
  type: CardType;
  cost: number;      // 에너지 소모 (X cost 는 별도 처리)
  damage?: number;   // attack 카드 기본 피해
  block?: number;    // skill 카드 방어
  draw?: number;     // 추가 드로우
  exhaust?: boolean; // 소모 (discard 안 감)
  /** upgrade 여부 — 효과 ×1.3 적용 (단순화) */
  upgraded?: boolean;
}

export interface DeckConfig {
  cards: Card[];
  handSize: number;          // 턴당 드로우 (기본 5)
  baseEnergy: number;        // 턴당 에너지 (기본 3)
  turnsPerCombat: number;    // 전투 턴 수
  /** 상대 몹 설정 — 하나 처치시 다음 몹 등장. 여러 종류일 수 있음. */
  enemies?: EnemyMob[];
}

/**
 * 몹 정의 — Slay the Spire의 "적 순서" 개념. 실시간 웨이브 기반.
 * 예: Cultist(50hp) → Jaw Worm(44hp) → Elite(150hp)
 */
export interface EnemyMob {
  id: string;
  name: string;
  hp: number;
}

export interface DeckSimResult {
  avgDpt: number;
  medianDpt: number;
  p10Dpt: number;          // 하위 10% (가장 약한 경우)
  p90Dpt: number;          // 상위 10% (가장 센 경우)
  avgBlock: number;
  deadHandRate: number;    // 0장 플레이 턴 비율
  avgEnergyWaste: number;  // 0-1, 미사용 에너지 비율
  avgCardsPerTurn: number;
  /** 각 카드의 평균 play 횟수 (per combat) — 자주 쓰이는 카드 분석 */
  cardUsage: Record<string, number>;
  /** 몹 설정 시: 평균 처치한 몹 수 (run 당) */
  avgKills?: number;
  /** 모든 몹 클리어한 run 비율 (0-1) */
  clearRate?: number;
  /** 첫 킬까지 걸린 평균 턴 */
  avgTurnToFirstKill?: number;
  /** 각 몹별 처치율 (0-1) */
  mobKillRates?: Record<string, number>;
}

// ============================================================================
// Fisher-Yates shuffle
// ============================================================================

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ============================================================================
// 한 번의 전투 시뮬
// ============================================================================

interface PileState {
  drawPile: Card[];
  hand: Card[];
  discardPile: Card[];
  exhaustPile: Card[];
}

function draw(state: PileState, n: number): void {
  for (let i = 0; i < n; i++) {
    if (state.drawPile.length === 0) {
      if (state.discardPile.length === 0) return; // 뽑을 카드 없음
      state.drawPile = shuffle(state.discardPile);
      state.discardPile = [];
    }
    const c = state.drawPile.pop();
    if (c) state.hand.push(c);
  }
}

function simulateCombat(cfg: DeckConfig): {
  totalDamage: number;
  totalBlock: number;
  energyWasted: number;
  energyAvailable: number;
  deadHandTurns: number;
  cardsPlayed: number;
  perTurnDamage: number[];
  cardUsage: Record<string, number>;
  kills: number;
  killedMobIds: string[];
  firstKillTurn: number | null;
  allCleared: boolean;
} {
  const state: PileState = {
    drawPile: shuffle(cfg.cards),
    hand: [],
    discardPile: [],
    exhaustPile: [],
  };

  let totalDamage = 0;
  let totalBlock = 0;
  let energyWasted = 0;
  let energyAvailable = 0;
  let deadHandTurns = 0;
  let cardsPlayed = 0;
  const perTurnDamage: number[] = [];
  const cardUsage: Record<string, number> = {};

  // 몹 처치 추적
  const enemies = (cfg.enemies ?? []).map((e) => ({ ...e, remaining: e.hp }));
  let enemyIdx = 0;
  let kills = 0;
  const killedMobIds: string[] = [];
  let firstKillTurn: number | null = null;

  for (let turn = 0; turn < cfg.turnsPerCombat; turn++) {
    // 턴 시작 드로우
    draw(state, cfg.handSize);
    let energy = cfg.baseEnergy;
    energyAvailable += energy;

    let playedThisTurn = 0;
    let turnDamage = 0;

    // 가능한 카드 반복 플레이 (cost ≤ 현재 에너지, 가장 비싼 것 우선)
    let playableExists = true;
    while (playableExists) {
      playableExists = false;
      // 비싼 카드 우선 — 에너지 효율
      const sorted = [...state.hand]
        .map((c, idx) => ({ card: c, idx }))
        .filter(({ card }) => card.cost <= energy)
        .sort((a, b) => b.card.cost - a.card.cost);
      if (sorted.length === 0) break;

      const { card, idx } = sorted[0];
      energy -= card.cost;
      playedThisTurn++;
      cardsPlayed++;
      cardUsage[card.id] = (cardUsage[card.id] ?? 0) + 1;

      const upMul = card.upgraded ? 1.3 : 1;
      if (card.damage) turnDamage += card.damage * upMul;
      if (card.block) totalBlock += card.block * upMul;
      if (card.draw) draw(state, card.draw * (card.upgraded ? 2 : 1));

      // hand 에서 제거 + 파일 이동
      state.hand.splice(idx, 1);
      if (card.exhaust) state.exhaustPile.push(card);
      else state.discardPile.push(card);

      playableExists = true;
    }

    totalDamage += turnDamage;
    perTurnDamage.push(turnDamage);
    if (playedThisTurn === 0) deadHandTurns++;
    energyWasted += energy;

    // 적용: turnDamage 를 현재 몹에 순차 누적
    if (enemies.length > 0) {
      let remainingDmg = turnDamage;
      while (remainingDmg > 0 && enemyIdx < enemies.length) {
        const mob = enemies[enemyIdx];
        if (mob.remaining <= remainingDmg) {
          remainingDmg -= mob.remaining;
          mob.remaining = 0;
          kills++;
          killedMobIds.push(mob.id);
          if (firstKillTurn === null) firstKillTurn = turn + 1;
          enemyIdx++;
        } else {
          mob.remaining -= remainingDmg;
          remainingDmg = 0;
        }
      }
      // 몹 다 잡으면 조기 종료
      if (enemyIdx >= enemies.length) {
        // 턴 종료 처리 후 break
        state.discardPile.push(...state.hand);
        state.hand = [];
        break;
      }
    }

    // 턴 종료 — hand 카드 discard
    state.discardPile.push(...state.hand);
    state.hand = [];
  }

  const allCleared = enemies.length > 0 && enemyIdx >= enemies.length;

  return {
    totalDamage,
    totalBlock,
    energyWasted,
    energyAvailable,
    deadHandTurns,
    cardsPlayed,
    perTurnDamage,
    cardUsage,
    kills,
    killedMobIds,
    firstKillTurn,
    allCleared,
  };
}

// ============================================================================
// Monte Carlo 시뮬
// ============================================================================

export function simulateDeck(cfg: DeckConfig, runs = 2000): DeckSimResult {
  const perTurnDamages: number[][] = [];
  const usage: Record<string, number> = {};
  let blockSum = 0;
  let deadTurnsSum = 0;
  let wastedSum = 0;
  let availSum = 0;
  let cardsSum = 0;

  // 몹 통계
  let killsSum = 0;
  let clearedCount = 0;
  let firstKillTurnSum = 0;
  let firstKillCount = 0;
  const mobKillCounts: Record<string, number> = {};

  for (let i = 0; i < runs; i++) {
    const r = simulateCombat(cfg);
    perTurnDamages.push(r.perTurnDamage);
    for (const [id, count] of Object.entries(r.cardUsage)) {
      usage[id] = (usage[id] ?? 0) + count;
    }
    blockSum += r.totalBlock;
    deadTurnsSum += r.deadHandTurns;
    wastedSum += r.energyWasted;
    availSum += r.energyAvailable;
    cardsSum += r.cardsPlayed;

    killsSum += r.kills;
    if (r.allCleared) clearedCount++;
    for (const mobId of r.killedMobIds) {
      mobKillCounts[mobId] = (mobKillCounts[mobId] ?? 0) + 1;
    }
    if (r.firstKillTurn !== null) {
      firstKillTurnSum += r.firstKillTurn;
      firstKillCount++;
    }
  }

  // DPT 분포 (각 run 의 평균 turn damage)
  const dptSamples = perTurnDamages
    .map((arr) => arr.reduce((a, b) => a + b, 0) / arr.length)
    .sort((a, b) => a - b);

  const sum = dptSamples.reduce((a, b) => a + b, 0);
  const avgDpt = sum / dptSamples.length;
  const p10 = dptSamples[Math.floor(dptSamples.length * 0.1)] ?? 0;
  const median = dptSamples[Math.floor(dptSamples.length / 2)] ?? 0;
  const p90 = dptSamples[Math.floor(dptSamples.length * 0.9)] ?? 0;

  const totalTurns = cfg.turnsPerCombat * runs;

  const hasEnemies = (cfg.enemies?.length ?? 0) > 0;
  const mobKillRates: Record<string, number> = {};
  if (hasEnemies) {
    for (const mob of cfg.enemies!) {
      mobKillRates[mob.id] = (mobKillCounts[mob.id] ?? 0) / runs;
    }
  }

  return {
    avgDpt,
    medianDpt: median,
    p10Dpt: p10,
    p90Dpt: p90,
    avgBlock: blockSum / totalTurns,
    deadHandRate: deadTurnsSum / totalTurns,
    avgEnergyWaste: availSum > 0 ? wastedSum / availSum : 0,
    avgCardsPerTurn: cardsSum / totalTurns,
    cardUsage: Object.fromEntries(
      Object.entries(usage).map(([id, count]) => [id, count / runs]),
    ),
    ...(hasEnemies && {
      avgKills: killsSum / runs,
      clearRate: clearedCount / runs,
      avgTurnToFirstKill: firstKillCount > 0 ? firstKillTurnSum / firstKillCount : 0,
      mobKillRates,
    }),
  };
}

// ============================================================================
// 기본 카드 프리셋 (Slay the Spire Ironclad 기본 덱 모사)
// ============================================================================

export const CARD_PRESETS: Card[] = [
  { id: 'strike', name: 'Strike', type: 'attack', cost: 1, damage: 6 },
  { id: 'strike2', name: 'Strike', type: 'attack', cost: 1, damage: 6 },
  { id: 'strike3', name: 'Strike', type: 'attack', cost: 1, damage: 6 },
  { id: 'strike4', name: 'Strike', type: 'attack', cost: 1, damage: 6 },
  { id: 'strike5', name: 'Strike', type: 'attack', cost: 1, damage: 6 },
  { id: 'defend', name: 'Defend', type: 'skill', cost: 1, block: 5 },
  { id: 'defend2', name: 'Defend', type: 'skill', cost: 1, block: 5 },
  { id: 'defend3', name: 'Defend', type: 'skill', cost: 1, block: 5 },
  { id: 'defend4', name: 'Defend', type: 'skill', cost: 1, block: 5 },
  { id: 'bash', name: 'Bash', type: 'attack', cost: 2, damage: 10 },
];
