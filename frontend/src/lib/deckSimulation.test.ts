import { describe, it, expect } from 'vitest';
import { simulateDeck, CARD_PRESETS } from './deckSimulation';

describe('simulateDeck', () => {
  it('Ironclad 기본 덱 — 평균 DPT > 0, deadHand 낮음', () => {
    const result = simulateDeck({
      cards: CARD_PRESETS,
      handSize: 5,
      baseEnergy: 3,
      turnsPerCombat: 5,
    }, 500);

    expect(result.avgDpt).toBeGreaterThan(0);
    expect(result.deadHandRate).toBeLessThan(0.1); // 기본 덱은 거의 항상 플레이 가능
    expect(result.avgCardsPerTurn).toBeGreaterThan(2);
  });

  it('에너지 낭비율은 0-1 범위', () => {
    const result = simulateDeck({
      cards: CARD_PRESETS,
      handSize: 5,
      baseEnergy: 3,
      turnsPerCombat: 5,
    }, 500);

    expect(result.avgEnergyWaste).toBeGreaterThanOrEqual(0);
    expect(result.avgEnergyWaste).toBeLessThanOrEqual(1);
  });

  it('에너지가 많으면 더 많이 플레이', () => {
    const low = simulateDeck({
      cards: CARD_PRESETS,
      handSize: 5,
      baseEnergy: 1,
      turnsPerCombat: 5,
    }, 300);
    const high = simulateDeck({
      cards: CARD_PRESETS,
      handSize: 5,
      baseEnergy: 5,
      turnsPerCombat: 5,
    }, 300);

    expect(high.avgCardsPerTurn).toBeGreaterThan(low.avgCardsPerTurn);
  });

  it('몹 시퀀스 제공 시 킬 통계 계산', () => {
    const result = simulateDeck({
      cards: CARD_PRESETS,
      handSize: 5,
      baseEnergy: 3,
      turnsPerCombat: 10,
      enemies: [
        { id: 'weak', name: 'Weak', hp: 10 },
        { id: 'strong', name: 'Strong', hp: 200 },
      ],
    }, 500);

    expect(result.avgKills).toBeDefined();
    expect(result.avgKills!).toBeGreaterThan(0);
    expect(result.mobKillRates!.weak).toBeGreaterThan(0.8); // 10HP 는 쉽게 처치
    expect(result.clearRate).toBeDefined();
    expect(result.avgTurnToFirstKill).toBeGreaterThan(0);
  });

  it('고비용 카드만 있고 에너지 적으면 deadHand 증가', () => {
    const result = simulateDeck({
      cards: Array.from({ length: 10 }, (_, i) => ({
        id: `expensive-${i}`,
        name: 'Big',
        type: 'attack' as const,
        cost: 3,
        damage: 20,
      })),
      handSize: 5,
      baseEnergy: 1, // cost 3 카드인데 에너지 1 → 플레이 불가
      turnsPerCombat: 5,
    }, 300);

    expect(result.deadHandRate).toBeGreaterThan(0.5);
  });
});
