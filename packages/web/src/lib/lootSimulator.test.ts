import { describe, it, expect } from 'vitest';
import { runLootSimulation, DEFAULT_GACHA_TABLE, DEFAULT_PITY } from './lootSimulator';

describe('runLootSimulation', () => {
  it('returns empty result for empty table', () => {
    const result = runLootSimulation({ items: [], pulls: 100 });
    expect(result.totalSimulations).toBe(0);
    expect(result.rarityStats).toHaveLength(0);
  });

  it('produces rarity distribution matching input weights (large N)', () => {
    const items = [
      { id: 'a', name: 'A', weight: 70, rarity: 'N' },
      { id: 'b', name: 'B', weight: 30, rarity: 'R' },
    ];
    const result = runLootSimulation({ items, pulls: 1000, simulations: 10, seed: 42 });
    const n = result.rarityStats.find((r) => r.rarity === 'N');
    const r = result.rarityStats.find((r) => r.rarity === 'R');
    expect(n).toBeDefined();
    expect(r).toBeDefined();
    // weight 비율 70:30 → 평균 700:300 (±10% 허용)
    expect(Math.abs(n!.avgCount / 1000 - 0.7)).toBeLessThan(0.1);
    expect(Math.abs(r!.avgCount / 1000 - 0.3)).toBeLessThan(0.1);
  });

  it('hard pity 가 발동해야 SSR 이 최소 1회 보장', () => {
    const result = runLootSimulation({
      items: DEFAULT_GACHA_TABLE,
      pity: DEFAULT_PITY,
      pulls: 200,
      simulations: 10,
      seed: 1,
    });
    const ssr = result.rarityStats.find((r) => r.rarity === 'SSR');
    expect(ssr).toBeDefined();
    // 200 회 면 hard pity 90 두 번 = 최소 평균 2 SSR
    expect(ssr!.avgCount).toBeGreaterThan(1.5);
  });

  it('seed 동일하면 결과 재현 가능', () => {
    const a = runLootSimulation({ items: DEFAULT_GACHA_TABLE, pity: DEFAULT_PITY, pulls: 50, simulations: 5, seed: 100 });
    const b = runLootSimulation({ items: DEFAULT_GACHA_TABLE, pity: DEFAULT_PITY, pulls: 50, simulations: 5, seed: 100 });
    expect(a.rarityStats).toEqual(b.rarityStats);
  });

  it('topItems 가 등장 빈도 내림차순', () => {
    const result = runLootSimulation({ items: DEFAULT_GACHA_TABLE, pulls: 100, simulations: 20 });
    for (let i = 1; i < result.topItems.length; i++) {
      expect(result.topItems[i - 1].count).toBeGreaterThanOrEqual(result.topItems[i].count);
    }
  });
});
