/**
 * Loot / Gacha Simulator — drop table + pity (천장) 시스템.
 *
 * 입력:
 *   - items: { name, weight, rarity }[]   — weight 합 = 100% 또는 임의
 *   - pity: { rarity, threshold }[]       — 해당 등급이 N 회 안 뽑히면 강제로 등장
 *   - pulls: 시뮬할 뽑기 횟수
 *   - simulations: 반복 횟수 (Monte Carlo)
 *
 * 출력:
 *   - 등급별 평균 획득 횟수, 분포(P5/P50/P95)
 *   - 첫 SSR 까지의 평균 뽑기 횟수
 *   - 천장 발동 비율
 *   - 누적 분포 곡선 (가챠 비용 분석용)
 */

export interface LootItem {
  id: string;
  name: string;
  /** 등장 가중치 (절대값, 합산해서 정규화) */
  weight: number;
  /** 등급 (예: 'N', 'R', 'SR', 'SSR'). pity 와 매칭. */
  rarity: string;
}

export interface PityRule {
  /** 어느 등급에 천장 적용 */
  rarity: string;
  /** N 회 연속 안 나오면 다음 뽑기에서 보장 */
  threshold: number;
  /** soft pity: 임계 이전부터 확률 부스트 (선택) */
  softFromPull?: number;
  softMultiplier?: number;
}

export interface FeaturedBanner {
  /** 피쳐드 아이템 id 목록 (일반적으로 rareRarity 풀 중 일부) */
  itemIds: string[];
  /** 피쳐드 당첨 기본 확률 (호요버스 5★ = 0.5) */
  featuredRate: number;
  /** 직전 비-피쳐드였으면 다음 번엔 피쳐드 확정 (Genshin) */
  guaranteeAfterLoss: boolean;
}

export interface LootSimInput {
  items: LootItem[];
  pity?: PityRule[];
  /** 한 시나리오당 뽑기 횟수 */
  pulls: number;
  /** 시뮬레이션 반복 횟수 (default 5000) */
  simulations?: number;
  /** 결과 분포 binning */
  bins?: number;
  /** 시드 (재현용, 미지정 시 Math.random) */
  seed?: number;
  /** 피쳐드 배너 설정 (50/50 등) */
  banner?: FeaturedBanner;
  /** 컴플리트 분석 대상 등급 (모두 모으기 확률 측정) */
  collectRarity?: string;
  /** 진행률 콜백 (0~1) — async 버전에서만 호출 */
  onProgress?: (pct: number) => void;
}

export interface RarityStats {
  rarity: string;
  /** 평균 획득 횟수 */
  avgCount: number;
  /** P5 / P50 / P95 */
  p5: number;
  p50: number;
  p95: number;
  /** 한 번이라도 얻을 확률 */
  atLeastOneRate: number;
}

export interface LootSimResult {
  rarityStats: RarityStats[];
  /** 첫 SSR (=가장 희귀 등급) 까지의 평균 뽑기 횟수. -1 이면 못 얻음 */
  avgFirstRarePull: number;
  /** 천장 (pity) 발동 비율 — pity rule 별 */
  pityActivationRate: Record<string, number>;
  /** 가장 많이 뽑힌 아이템 top 5 */
  topItems: { name: string; count: number; rate: number }[];
  /** 누적 분포 (각 시뮬레이션의 SSR 누적 횟수) — 그래프용 */
  cumulativeRareDistribution: number[];
  /** 피쳐드 50/50 통계 — banner 설정 시에만 */
  featuredStats?: {
    avgFeaturedCount: number;
    avgNonFeaturedCount: number;
    avgFirstFeaturedPull: number;    // 첫 피쳐드까지 평균 뽑기
    winRateAtFirstSSR: number;       // 첫 SSR이 피쳐드일 확률
  };
  /** 컴플리트 — 대상 등급의 모든 아이템 수집 확률 */
  completeRate?: number;
  /** 컴플리트 평균 소요 뽑기 (이론 관점: 못 모은 시뮬 제외) */
  avgPullsToComplete?: number;
  totalSimulations: number;
  totalPulls: number;
}

/** 간단한 seedable PRNG (xorshift32). */
function createRng(seed?: number): () => number {
  if (seed === undefined) return Math.random;
  let state = seed | 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) / 4294967296);
  };
}

/** 가중치 기반 단일 추첨. items 의 누적 weight 와 rng 값으로 인덱스 반환. */
function pickWeighted(items: LootItem[], totalWeight: number, rng: () => number): LootItem {
  const r = rng() * totalWeight;
  let acc = 0;
  for (const item of items) {
    acc += item.weight;
    if (r < acc) return item;
  }
  return items[items.length - 1];
}

/** 한 시나리오 (pulls 회 뽑기) 시뮬. */
function simulateOne(
  items: LootItem[],
  pity: PityRule[],
  pulls: number,
  rng: () => number,
  banner?: FeaturedBanner,
): {
  rarityCounts: Map<string, number>;
  itemCounts: Map<string, number>;
  firstRarePull: number;
  pityActivations: Map<string, number>;
  featuredCount: number;
  nonFeaturedCount: number;
  firstFeaturedPull: number;
  firstSSRIsFeatured: boolean | null;
} {
  const totalWeight = items.reduce((sum, it) => sum + it.weight, 0);
  const rarityCounts = new Map<string, number>();
  const itemCounts = new Map<string, number>();
  const pityActivations = new Map<string, number>();
  // 등급별 마지막 등장 이후 카운터
  const sinceLast = new Map<string, number>();
  for (const rule of pity) sinceLast.set(rule.rarity, 0);

  // 가장 희귀 등급 = pity 임계가 가장 큰 것 또는 weight 가 가장 작은 것
  const rareRarity = pity.length > 0
    ? pity.reduce((a, b) => (a.threshold > b.threshold ? a : b)).rarity
    : items.reduce((a, b) => (a.weight < b.weight ? a : b)).rarity;

  let firstRarePull = -1;
  let featuredCount = 0;
  let nonFeaturedCount = 0;
  let firstFeaturedPull = -1;
  let firstSSRIsFeatured: boolean | null = null;
  let lostLast5050 = false; // banner 50/50 loss flag

  for (let i = 0; i < pulls; i++) {
    let dropped: LootItem | null = null;

    // pity check — 임계 도달 시 해당 등급 풀에서 강제 추첨
    for (const rule of pity) {
      const since = sinceLast.get(rule.rarity) ?? 0;
      if (since + 1 >= rule.threshold) {
        const pool = items.filter((it) => it.rarity === rule.rarity);
        if (pool.length > 0) {
          const poolWeight = pool.reduce((sum, it) => sum + it.weight, 0);
          dropped = pickWeighted(pool, poolWeight, rng);
          pityActivations.set(rule.rarity, (pityActivations.get(rule.rarity) ?? 0) + 1);
          break;
        }
      }
    }

    // soft pity: 임계 가까이에서 확률 부스트
    if (!dropped) {
      const boostedItems: LootItem[] = items.map((it) => {
        const rule = pity.find((r) => r.rarity === it.rarity);
        if (!rule || !rule.softFromPull || !rule.softMultiplier) return it;
        const since = sinceLast.get(rule.rarity) ?? 0;
        if (since >= rule.softFromPull) {
          return { ...it, weight: it.weight * rule.softMultiplier };
        }
        return it;
      });
      const boostedTotal = boostedItems.reduce((sum, it) => sum + it.weight, 0);
      dropped = pickWeighted(boostedItems, boostedTotal, rng);
    }

    // 카운트 업데이트
    rarityCounts.set(dropped.rarity, (rarityCounts.get(dropped.rarity) ?? 0) + 1);
    itemCounts.set(dropped.name, (itemCounts.get(dropped.name) ?? 0) + 1);

    // sinceLast 갱신
    for (const rule of pity) {
      if (dropped.rarity === rule.rarity) {
        sinceLast.set(rule.rarity, 0);
      } else {
        sinceLast.set(rule.rarity, (sinceLast.get(rule.rarity) ?? 0) + 1);
      }
    }

    // 첫 SSR 기록
    if (firstRarePull === -1 && dropped.rarity === rareRarity) {
      firstRarePull = i + 1;
    }

    // Featured 50/50 처리 — rareRarity 가 떨어졌을 때만 적용
    if (banner && dropped.rarity === rareRarity) {
      const isFeatured = banner.itemIds.includes(dropped.id);
      const guaranteeTrigger = banner.guaranteeAfterLoss && lostLast5050;

      if (isFeatured) {
        featuredCount++;
        lostLast5050 = false;
        if (firstFeaturedPull === -1) firstFeaturedPull = i + 1;
        if (firstSSRIsFeatured === null) firstSSRIsFeatured = true;
      } else if (guaranteeTrigger) {
        // 강제로 피쳐드로 교체 (50/50 패배 후 보장)
        const featuredPool = items.filter(
          (it) => it.rarity === rareRarity && banner.itemIds.includes(it.id)
        );
        if (featuredPool.length > 0) {
          const fpWeight = featuredPool.reduce((s, it) => s + it.weight, 0);
          const forced = pickWeighted(featuredPool, fpWeight, rng);
          // 원래 dropped 롤백 — 카운트 재계산
          const oldRarCount = rarityCounts.get(dropped.rarity) ?? 0;
          rarityCounts.set(dropped.rarity, Math.max(0, oldRarCount - 1));
          const oldItCount = itemCounts.get(dropped.name) ?? 0;
          itemCounts.set(dropped.name, Math.max(0, oldItCount - 1));
          // 새 forced 로
          rarityCounts.set(forced.rarity, (rarityCounts.get(forced.rarity) ?? 0) + 1);
          itemCounts.set(forced.name, (itemCounts.get(forced.name) ?? 0) + 1);
          featuredCount++;
          lostLast5050 = false;
          if (firstFeaturedPull === -1) firstFeaturedPull = i + 1;
          if (firstSSRIsFeatured === null) firstSSRIsFeatured = true;
        }
      } else {
        // 피쳐드 확률 미달 → 비피쳐드
        // banner.featuredRate 에 따라 추가 샘플링
        if (rng() < banner.featuredRate) {
          // featuredRate 미달이라도 운좋게 피쳐드 풀로 이동시킴
          const featuredPool = items.filter(
            (it) => it.rarity === rareRarity && banner.itemIds.includes(it.id)
          );
          if (featuredPool.length > 0) {
            const fpWeight = featuredPool.reduce((s, it) => s + it.weight, 0);
            const forced = pickWeighted(featuredPool, fpWeight, rng);
            rarityCounts.set(dropped.rarity, (rarityCounts.get(dropped.rarity) ?? 0) - 1);
            itemCounts.set(dropped.name, (itemCounts.get(dropped.name) ?? 0) - 1);
            rarityCounts.set(forced.rarity, (rarityCounts.get(forced.rarity) ?? 0) + 1);
            itemCounts.set(forced.name, (itemCounts.get(forced.name) ?? 0) + 1);
            featuredCount++;
            lostLast5050 = false;
            if (firstFeaturedPull === -1) firstFeaturedPull = i + 1;
            if (firstSSRIsFeatured === null) firstSSRIsFeatured = true;
          } else {
            nonFeaturedCount++;
            lostLast5050 = true;
            if (firstSSRIsFeatured === null) firstSSRIsFeatured = false;
          }
        } else {
          nonFeaturedCount++;
          lostLast5050 = true;
          if (firstSSRIsFeatured === null) firstSSRIsFeatured = false;
        }
      }
    }

    void totalWeight; // satisfy lint
  }

  return {
    rarityCounts, itemCounts, firstRarePull, pityActivations,
    featuredCount, nonFeaturedCount, firstFeaturedPull, firstSSRIsFeatured,
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}

export function runLootSimulation(input: LootSimInput): LootSimResult {
  const {
    items,
    pity = [],
    pulls,
    simulations = 5000,
    seed,
    banner,
    collectRarity,
  } = input;

  if (items.length === 0 || pulls <= 0) {
    return {
      rarityStats: [],
      avgFirstRarePull: -1,
      pityActivationRate: {},
      topItems: [],
      cumulativeRareDistribution: [],
      totalSimulations: 0,
      totalPulls: 0,
    };
  }

  const rng = createRng(seed);

  const rarityCountsAll = new Map<string, number[]>();
  const itemCountsAggregate = new Map<string, number>();
  const firstRarePulls: number[] = [];
  const pityActivationsAll = new Map<string, number>();
  const cumulativeRareDistribution: number[] = [];

  let featuredCountSum = 0;
  let nonFeaturedCountSum = 0;
  const firstFeaturedPulls: number[] = [];
  let firstSSRFeaturedWins = 0;
  let firstSSRFeaturedTotal = 0;

  let completeCount = 0;
  const completePullsList: number[] = [];

  const rareRarity = pity.length > 0
    ? pity.reduce((a, b) => (a.threshold > b.threshold ? a : b)).rarity
    : items.reduce((a, b) => (a.weight < b.weight ? a : b)).rarity;

  const collectItems = collectRarity
    ? items.filter((i) => i.rarity === collectRarity).map((i) => i.name)
    : [];

  for (let s = 0; s < simulations; s++) {
    const sim = simulateOne(items, pity, pulls, rng, banner);
    sim.rarityCounts.forEach((count, rarity) => {
      if (!rarityCountsAll.has(rarity)) rarityCountsAll.set(rarity, []);
      rarityCountsAll.get(rarity)!.push(count);
    });
    sim.itemCounts.forEach((count, name) => {
      itemCountsAggregate.set(name, (itemCountsAggregate.get(name) ?? 0) + count);
    });
    if (sim.firstRarePull > 0) firstRarePulls.push(sim.firstRarePull);
    sim.pityActivations.forEach((count, rarity) => {
      pityActivationsAll.set(rarity, (pityActivationsAll.get(rarity) ?? 0) + count);
    });
    cumulativeRareDistribution.push(sim.rarityCounts.get(rareRarity) ?? 0);

    featuredCountSum += sim.featuredCount;
    nonFeaturedCountSum += sim.nonFeaturedCount;
    if (sim.firstFeaturedPull > 0) firstFeaturedPulls.push(sim.firstFeaturedPull);
    if (sim.firstSSRIsFeatured !== null) {
      firstSSRFeaturedTotal++;
      if (sim.firstSSRIsFeatured) firstSSRFeaturedWins++;
    }

    if (collectRarity && collectItems.length > 0) {
      const collected = collectItems.every((name) => (sim.itemCounts.get(name) ?? 0) > 0);
      if (collected) {
        completeCount++;
        completePullsList.push(pulls);
      }
    }
  }

  // 통계 정리
  const rarityStats: RarityStats[] = [];
  rarityCountsAll.forEach((counts, rarity) => {
    const sorted = [...counts].sort((a, b) => a - b);
    const filled = simulations - counts.length;
    // 한 번도 안 나온 시뮬레이션은 0 으로 채움
    const fullSorted = [
      ...new Array(filled).fill(0),
      ...sorted,
    ].sort((a, b) => a - b);
    const sum = fullSorted.reduce((a, b) => a + b, 0);
    rarityStats.push({
      rarity,
      avgCount: sum / simulations,
      p5: percentile(fullSorted, 0.05),
      p50: percentile(fullSorted, 0.5),
      p95: percentile(fullSorted, 0.95),
      atLeastOneRate: counts.filter((c) => c > 0).length / simulations,
    });
  });

  // 등급 정렬 — 빈도 적은 (희귀) 순으로
  rarityStats.sort((a, b) => a.avgCount - b.avgCount);

  // top items
  const topItems = Array.from(itemCountsAggregate.entries())
    .map(([name, count]) => ({
      name,
      count,
      rate: count / (simulations * pulls),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // pity activation rate (시뮬당 평균)
  const pityActivationRate: Record<string, number> = {};
  pityActivationsAll.forEach((total, rarity) => {
    pityActivationRate[rarity] = total / simulations;
  });

  const featuredStats = banner
    ? {
        avgFeaturedCount: featuredCountSum / simulations,
        avgNonFeaturedCount: nonFeaturedCountSum / simulations,
        avgFirstFeaturedPull:
          firstFeaturedPulls.length > 0
            ? firstFeaturedPulls.reduce((a, b) => a + b, 0) / firstFeaturedPulls.length
            : -1,
        winRateAtFirstSSR:
          firstSSRFeaturedTotal > 0 ? firstSSRFeaturedWins / firstSSRFeaturedTotal : 0,
      }
    : undefined;

  const completeRate = collectRarity ? completeCount / simulations : undefined;
  const avgPullsToComplete =
    collectRarity && completePullsList.length > 0
      ? completePullsList.reduce((a, b) => a + b, 0) / completePullsList.length
      : undefined;

  return {
    rarityStats,
    avgFirstRarePull: firstRarePulls.length > 0
      ? firstRarePulls.reduce((a, b) => a + b, 0) / firstRarePulls.length
      : -1,
    pityActivationRate,
    topItems,
    cumulativeRareDistribution,
    featuredStats,
    completeRate,
    avgPullsToComplete,
    totalSimulations: simulations,
    totalPulls: pulls,
  };
}

/** runLootSimulation 의 async 버전 — UI 블로킹 방지 + progress 콜백. */
export async function runLootSimulationAsync(input: LootSimInput): Promise<LootSimResult> {
  const { items, pity = [], pulls, simulations = 5000, seed, onProgress, banner, collectRarity } = input;
  if (items.length === 0 || pulls <= 0) {
    return {
      rarityStats: [], avgFirstRarePull: -1, pityActivationRate: {},
      topItems: [], cumulativeRareDistribution: [], totalSimulations: 0, totalPulls: 0,
    };
  }
  const rng = createRng(seed);

  const rarityCountsAll = new Map<string, number[]>();
  const itemCountsAggregate = new Map<string, number>();
  const firstRarePulls: number[] = [];
  const pityActivationsAll = new Map<string, number>();
  const cumulativeRareDistribution: number[] = [];
  const rareRarity = pity.length > 0
    ? pity.reduce((a, b) => (a.threshold > b.threshold ? a : b)).rarity
    : items.reduce((a, b) => (a.weight < b.weight ? a : b)).rarity;

  let featuredCountSum = 0;
  let nonFeaturedCountSum = 0;
  const firstFeaturedPulls: number[] = [];
  let firstSSRFeaturedWins = 0;
  let firstSSRFeaturedTotal = 0;
  let completeCount = 0;
  const completePullsList: number[] = [];
  const collectItems = collectRarity
    ? items.filter((i) => i.rarity === collectRarity).map((i) => i.name)
    : [];

  const CHUNK = 500;
  for (let s = 0; s < simulations; s++) {
    const sim = simulateOne(items, pity, pulls, rng, banner);
    sim.rarityCounts.forEach((count, rarity) => {
      if (!rarityCountsAll.has(rarity)) rarityCountsAll.set(rarity, []);
      rarityCountsAll.get(rarity)!.push(count);
    });
    sim.itemCounts.forEach((count, name) => {
      itemCountsAggregate.set(name, (itemCountsAggregate.get(name) ?? 0) + count);
    });
    if (sim.firstRarePull > 0) firstRarePulls.push(sim.firstRarePull);
    sim.pityActivations.forEach((count, rarity) => {
      pityActivationsAll.set(rarity, (pityActivationsAll.get(rarity) ?? 0) + count);
    });
    cumulativeRareDistribution.push(sim.rarityCounts.get(rareRarity) ?? 0);

    featuredCountSum += sim.featuredCount;
    nonFeaturedCountSum += sim.nonFeaturedCount;
    if (sim.firstFeaturedPull > 0) firstFeaturedPulls.push(sim.firstFeaturedPull);
    if (sim.firstSSRIsFeatured !== null) {
      firstSSRFeaturedTotal++;
      if (sim.firstSSRIsFeatured) firstSSRFeaturedWins++;
    }
    if (collectRarity && collectItems.length > 0) {
      const collected = collectItems.every((name) => (sim.itemCounts.get(name) ?? 0) > 0);
      if (collected) {
        completeCount++;
        completePullsList.push(pulls);
      }
    }

    if ((s + 1) % CHUNK === 0) {
      onProgress?.((s + 1) / simulations);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  onProgress?.(1);

  // 통계 집계 (동기 버전과 동일)
  const rarityStats: RarityStats[] = [];
  rarityCountsAll.forEach((counts, rarity) => {
    const sorted = [...counts].sort((a, b) => a - b);
    const filled = simulations - counts.length;
    const fullSorted = [...new Array(filled).fill(0), ...sorted].sort((a, b) => a - b);
    const sum = fullSorted.reduce((a, b) => a + b, 0);
    rarityStats.push({
      rarity,
      avgCount: sum / simulations,
      p5: percentile(fullSorted, 0.05),
      p50: percentile(fullSorted, 0.5),
      p95: percentile(fullSorted, 0.95),
      atLeastOneRate: counts.filter((c) => c > 0).length / simulations,
    });
  });
  rarityStats.sort((a, b) => a.avgCount - b.avgCount);

  const topItems = Array.from(itemCountsAggregate.entries())
    .map(([name, count]) => ({ name, count, rate: count / (simulations * pulls) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const pityActivationRate: Record<string, number> = {};
  pityActivationsAll.forEach((total, rarity) => {
    pityActivationRate[rarity] = total / simulations;
  });

  const featuredStats = banner
    ? {
        avgFeaturedCount: featuredCountSum / simulations,
        avgNonFeaturedCount: nonFeaturedCountSum / simulations,
        avgFirstFeaturedPull:
          firstFeaturedPulls.length > 0
            ? firstFeaturedPulls.reduce((a, b) => a + b, 0) / firstFeaturedPulls.length
            : -1,
        winRateAtFirstSSR:
          firstSSRFeaturedTotal > 0 ? firstSSRFeaturedWins / firstSSRFeaturedTotal : 0,
      }
    : undefined;
  const completeRate = collectRarity ? completeCount / simulations : undefined;
  const avgPullsToComplete =
    collectRarity && completePullsList.length > 0
      ? completePullsList.reduce((a, b) => a + b, 0) / completePullsList.length
      : undefined;

  return {
    rarityStats,
    avgFirstRarePull: firstRarePulls.length > 0
      ? firstRarePulls.reduce((a, b) => a + b, 0) / firstRarePulls.length
      : -1,
    pityActivationRate,
    topItems,
    cumulativeRareDistribution,
    featuredStats,
    completeRate,
    avgPullsToComplete,
    totalSimulations: simulations,
    totalPulls: pulls,
  };
}

/** 데모용 기본 가챠 테이블 (호요버스 5★ 시스템 풍). */
export const DEFAULT_GACHA_TABLE: LootItem[] = [
  { id: 'n1', name: 'Common Item A', weight: 79.4, rarity: 'N' },
  { id: 'n2', name: 'Common Item B', weight: 79.4, rarity: 'N' },
  { id: 'r1', name: 'Rare Sword', weight: 5.5, rarity: 'R' },
  { id: 'r2', name: 'Rare Potion', weight: 5.5, rarity: 'R' },
  { id: 'sr1', name: 'Epic Bow', weight: 2.5, rarity: 'SR' },
  { id: 'sr2', name: 'Epic Staff', weight: 2.5, rarity: 'SR' },
  { id: 'ssr1', name: 'Legendary Hero', weight: 0.6, rarity: 'SSR' },
  { id: 'ssr2', name: 'Legendary Mount', weight: 0.6, rarity: 'SSR' },
];

export const DEFAULT_PITY: PityRule[] = [
  { rarity: 'SSR', threshold: 90, softFromPull: 75, softMultiplier: 6 },
  { rarity: 'SR', threshold: 10 },
];
