/**
 * 범용 matchup matrix 엔진 — 모든 도메인 (unit / fps weapon / deck) 공통.
 *
 * 설계:
 *  - 도메인은 MatchupRunner<T> 로 추상화. runMatch(a, b) → 'a' | 'b' | 'draw'
 *  - Monte Carlo 반복 → winRates[i][j] 집계
 *  - dominant / weak / cycle 탐지 + balanceScore 산출
 *
 * 참고:
 *  - 기존 balanceAnalysis.calculateMatchupMatrix 는 unit 전용 — 이 파일은 그 상위 제네릭 엔진.
 *  - 60% 이상 = dominant (Riot 내부 밸런싱 threshold 와 유사).
 *  - Perfect Imbalance 컨셉 (Blizzard 정재영): cycle 이 존재하면 가위바위보 = 밸런스 ↑
 */

export interface MatchupRunner<T> {
  /** 고유 식별자 — 같은 item 이 중복돼도 구분 */
  id: (item: T) => string;
  /** 표시 이름 */
  label: (item: T) => string;
  /** 단일 매치 — 각 호출은 독립적 Monte Carlo run */
  runMatch: (a: T, b: T) => 'a' | 'b' | 'draw';
}

export interface MatchupResult<T> {
  items: T[];
  labels: string[];
  /** winRates[i][j] = i vs j 에서 i 가 이긴 비율 (0-1). 자기 자신은 0.5. */
  winRates: number[][];
  /** 각 item 의 평균 승률 (자기 자신 제외) */
  avgWinRate: number[];
  /** 평균 승률 ≥ threshold (default 0.6) — 지배적 */
  dominantIdx: number[];
  /** 평균 승률 ≤ 1 - threshold — 약세 */
  weakIdx: number[];
  /** 가위바위보 3-cycle 그룹들 (인덱스 배열) */
  cycles: number[][];
  /** 가장 불균형 매치업 top N — 60%+ 쏠린 쌍 */
  topImbalances: { aIdx: number; bIdx: number; winRate: number }[];
  /** 0-100, 높을수록 균형 */
  balanceScore: number;
}

// ============================================================================
// 메인 엔진
// ============================================================================

export function runMatchupMatrix<T>(
  items: T[],
  runner: MatchupRunner<T>,
  opts: { runsPerMatch?: number; threshold?: number } = {},
): MatchupResult<T> {
  const { runsPerMatch = 100, threshold = 0.6 } = opts;
  const n = items.length;
  const winRates: number[][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => 0.5),
  );

  // 상삼각 N×(N-1)/2 매치만 실행 (대칭성 활용)
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let aWins = 0;
      let decided = 0;
      for (let k = 0; k < runsPerMatch; k++) {
        const outcome = runner.runMatch(items[i], items[j]);
        if (outcome === 'a') { aWins++; decided++; }
        else if (outcome === 'b') { decided++; }
        // draw 는 분모에서 제외 (승률 왜곡 방지)
      }
      const rate = decided > 0 ? aWins / decided : 0.5;
      winRates[i][j] = rate;
      winRates[j][i] = 1 - rate;
    }
  }

  const avgWinRate = winRates.map((row, i) => {
    const others = row.filter((_, j) => i !== j);
    return others.reduce((s, v) => s + v, 0) / others.length;
  });

  const dominantIdx: number[] = [];
  const weakIdx: number[] = [];
  avgWinRate.forEach((avg, i) => {
    if (avg >= threshold) dominantIdx.push(i);
    if (avg <= 1 - threshold) weakIdx.push(i);
  });

  const cycles = findCycles(winRates, threshold);
  const topImbalances = findTopImbalances(winRates, 6);
  const balanceScore = computeBalanceScore(winRates, dominantIdx.length, weakIdx.length, cycles.length);

  return {
    items,
    labels: items.map(runner.label),
    winRates,
    avgWinRate,
    dominantIdx,
    weakIdx,
    cycles,
    topImbalances,
    balanceScore,
  };
}

// ============================================================================
// 헬퍼들
// ============================================================================

/**
 * 3-cycle 탐지 — A > B > C > A 패턴.
 * 같은 구성원 cycle 은 한 번만 카운트.
 */
function findCycles(winRates: number[][], threshold: number): number[][] {
  const n = winRates.length;
  const seen = new Set<string>();
  const cycles: number[][] = [];

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j || winRates[i][j] < threshold) continue;
      for (let k = 0; k < n; k++) {
        if (k === i || k === j) continue;
        if (winRates[j][k] >= threshold && winRates[k][i] >= threshold) {
          const key = [i, j, k].sort((a, b) => a - b).join('-');
          if (!seen.has(key)) {
            seen.add(key);
            cycles.push([i, j, k]);
          }
        }
      }
    }
  }

  return cycles;
}

function findTopImbalances(winRates: number[][], limit: number): MatchupResult<unknown>['topImbalances'] {
  const pairs: { aIdx: number; bIdx: number; winRate: number; delta: number }[] = [];
  const n = winRates.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const delta = Math.abs(winRates[i][j] - 0.5);
      pairs.push({ aIdx: i, bIdx: j, winRate: winRates[i][j], delta });
    }
  }
  return pairs
    .sort((x, y) => y.delta - x.delta)
    .slice(0, limit)
    .map(({ aIdx, bIdx, winRate }) => ({ aIdx, bIdx, winRate }));
}

function computeBalanceScore(
  winRates: number[][],
  dominantCount: number,
  weakCount: number,
  cycleCount: number,
): number {
  const n = winRates.length;
  let score = 100;

  // dominant/weak 페널티
  score -= dominantCount * 20;
  score -= weakCount * 20;

  // 평균 변동
  let varianceSum = 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      varianceSum += Math.abs(winRates[i][j] - 0.5);
      count++;
    }
  }
  const avgVariance = count > 0 ? varianceSum / count : 0;

  if (avgVariance < 0.05) score -= 10;          // 너무 평평
  else if (avgVariance > 0.3) score -= (avgVariance - 0.3) * 100;
  else if (avgVariance >= 0.1 && avgVariance <= 0.2) score += 10;

  // cycle 보너스 (Perfect Imbalance)
  score += Math.min(20, cycleCount * 5);

  return Math.max(0, Math.min(100, score));
}

// ============================================================================
// heatmap 색상 매핑 (UI 공용)
// ============================================================================

/**
 * 승률 → heatmap 색상 (빨강=극단적 승, 파랑=극단적 패, 회색=균형)
 * Recharts/DOM inline style 에 바로 꽂는 rgba 문자열 반환.
 */
export function winRateToColor(winRate: number): string {
  // 0.5 가 neutral, 0~0.3 와 0.7~1.0 은 극단적
  const delta = winRate - 0.5; // -0.5 ~ +0.5
  const intensity = Math.min(1, Math.abs(delta) * 2.5); // 증폭

  if (delta > 0) {
    // 빨강 계열 (승)
    return `rgba(239, 68, 68, ${intensity * 0.75})`;
  } else {
    // 파랑 계열 (패)
    return `rgba(59, 130, 246, ${intensity * 0.75})`;
  }
}
