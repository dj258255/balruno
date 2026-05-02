import { describe, it, expect } from 'vitest';
import { simulateDeck, resolveIntent, CARD_PRESETS, type EnemyMob } from './deckSimulation';

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

  it('생존 모드: 플레이어 HP 낮고 몹 공격 세면 사망률 높음', () => {
    const result = simulateDeck({
      cards: CARD_PRESETS,
      handSize: 5,
      baseEnergy: 3,
      turnsPerCombat: 10,
      enemies: [{ id: 'big', name: 'Boss', hp: 500, attackDamage: 50, attackInterval: 1 }],
      player: { maxHp: 50 },
    }, 500);

    expect(result.survivalRate).toBeDefined();
    expect(result.survivalRate!).toBeLessThan(0.2); // HP 50 에 atk 50 맞으면 금방 죽음
    expect(result.avgDamageTaken!).toBeGreaterThan(0);
  });

  it('생존 모드: 강한 덱 + 약한 몹 → 거의 전부 생존', () => {
    const result = simulateDeck({
      cards: CARD_PRESETS,
      handSize: 5,
      baseEnergy: 3,
      turnsPerCombat: 10,
      enemies: [{ id: 'weak', name: 'Weak', hp: 20, attackDamage: 2, attackInterval: 2 }],
      player: { maxHp: 80 },
    }, 500);

    expect(result.survivalRate!).toBeGreaterThan(0.8);
  });

  it('intent 패턴: Cultist (buff→attack) — buff 턴은 공격 없음', () => {
    const mob: EnemyMob = {
      id: 'cultist',
      name: 'Cultist',
      hp: 9999, // 안 죽음 — 턴마다 공격 여부만 보고 싶음
      intentPattern: [
        { kind: 'buff', strength: 3 },
        { kind: 'attack', damage: 6 },
      ],
    };
    expect(resolveIntent(mob, 0)?.kind).toBe('buff');
    expect(resolveIntent(mob, 1)?.kind).toBe('attack');
    expect(resolveIntent(mob, 2)?.kind).toBe('buff'); // cycle
  });

  it('intent 패턴: 공격 intent 없는 턴(buff) 는 피해 0', () => {
    const result = simulateDeck({
      cards: Array.from({ length: 10 }, (_, i) => ({
        id: `c${i}`, name: 'Nop', type: 'skill' as const, cost: 3, damage: 0,
      })), // 공격력 0 덱 → 몹 안 죽음
      handSize: 5,
      baseEnergy: 3,
      turnsPerCombat: 2,
      enemies: [{
        id: 'noa',
        name: 'Nop',
        hp: 9999,
        intentPattern: [
          { kind: 'buff', strength: 3 },
          { kind: 'buff', strength: 3 },
        ],
      }],
      player: { maxHp: 50 },
    }, 200);
    // 공격 intent 0회 → damageTaken 0
    expect(result.avgDamageTaken).toBe(0);
    expect(result.survivalRate).toBe(1);
  });

  it('intent 패턴: defend 턴은 몹이 block 획득 → 플레이어 피해 감소', () => {
    // 공격 강한 덱, 몹은 방어만 — block 5 intent 매턴
    const withDefend = simulateDeck({
      cards: CARD_PRESETS,
      handSize: 5,
      baseEnergy: 3,
      turnsPerCombat: 5,
      enemies: [{
        id: 'turtle', name: 'Turtle', hp: 60,
        intentPattern: [{ kind: 'defend', block: 10 }],
      }],
    }, 300);
    const noDefend = simulateDeck({
      cards: CARD_PRESETS,
      handSize: 5,
      baseEnergy: 3,
      turnsPerCombat: 5,
      enemies: [{ id: 'sitting', name: 'Sitting', hp: 60 }],
    }, 300);
    // defend 있는 쪽이 킬율 낮음 (block 이 피해를 흡수)
    expect(withDefend.clearRate!).toBeLessThan(noDefend.clearRate!);
  });

  it('intent 패턴: buff (strength) 누적 → 이후 attack intent damage 증가', () => {
    // buff→attack 반복. attack intent damage 작아도 누적 strength 때문에 누적 피해 증가
    const result = simulateDeck({
      cards: Array.from({ length: 10 }, (_, i) => ({
        id: `c${i}`, name: 'Nop', type: 'skill' as const, cost: 3, damage: 0,
      })),
      handSize: 5,
      baseEnergy: 3,
      turnsPerCombat: 6,
      enemies: [{
        id: 'stacker',
        name: 'Stacker',
        hp: 9999,
        intentPattern: [
          { kind: 'buff', strength: 5 },
          { kind: 'attack', damage: 3 }, // 처음 8, 두 번째 13...
        ],
      }],
      player: { maxHp: 200 },
    }, 500);
    // 6 턴 중 3 번 공격 (turn 1,3,5). strength 누적: 5,10,15 → 피해 8,13,18 → 39
    // block 없음 가정 (Nop 카드는 block 0)
    expect(result.avgDamageTaken!).toBeCloseTo(39, 0);
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
