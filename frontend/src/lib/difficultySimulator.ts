/**
 * 난이도 곡선 시뮬레이터 — "가상 플레이어 N명" 이 이 곡선에서 어떻게 진행하나.
 *
 * 핵심 지표 (King 의 Candy Crush 봇 시뮬레이터 방식 경량화):
 *  - 각 스테이지별 클리어 확률 = sigmoid(playerPower / enemyPower)
 *  - 연속 실패 시 이탈 (2~5번 실패하면 drop)
 *  - 벽 스테이지는 enemyPower 가 급격히 오르는 구간 → 이탈률 증가
 *  - 휴식 포인트는 회복 (morale 리셋)
 *
 * 반환:
 *  - 이탈률 (0-1)
 *  - 평균 도달 스테이지
 *  - 스테이지별 이탈 히스토그램 (어디서 가장 많이 막히는지)
 *  - 평균 클리어 시간 (플레이타임 추정)
 */

import type { DifficultySegment, RestPoint } from '@/components/panels/difficulty-curve/hooks';

export interface DifficultySimConfig {
  segments: DifficultySegment[];
  wallStages: number[];
  restPoints: RestPoint[];
  /** 가상 플레이어 수 */
  virtualPlayers: number;
  /** 연속 실패 허용치 — 넘으면 이탈 (default 3) */
  giveUpStreak: number;
  /** 스테이지당 평균 시도 횟수 추정 (플레이타임 계산) — default 1.5 */
  attemptsPerStage: number;
  /** 1 시도 평균 시간 (초) — default 60 */
  secPerAttempt: number;
}

export interface DifficultySimResult {
  /** 전체 이탈률 (마지막 스테이지 못 도달) */
  dropoutRate: number;
  /** 평균 도달 스테이지 */
  avgReachedStage: number;
  /** 스테이지별 이탈 수 (인덱스 = stage-1) */
  dropoutByStage: number[];
  /** 가장 많이 이탈한 top 5 스테이지 */
  topDropoutStages: { stage: number; dropouts: number; dropoutRate: number }[];
  /** 평균 플레이타임 (분) — 생존자 기준 */
  avgPlaytimeMin: number;
  /** 총 가상 시도 횟수 (debugging) */
  totalAttempts: number;
}

// ============================================================================
// 시뮬 — 각 플레이어가 1 스테이지씩 시도
// ============================================================================

/**
 * 스테이지 클리어 확률 — 플레이어 파워 vs 적 파워 비율 기반 sigmoid.
 * 파워 비율 1.0 = 50%, 1.2 = 75%, 0.8 = 25% 근사.
 */
function clearProbability(segment: DifficultySegment): number {
  const enemy = Math.max(1, segment.enemyPower);
  const ratio = segment.playerPower / enemy;
  // sigmoid: f(r) = 1 / (1 + exp(-k(r-1))), k=4 로 급경사
  return 1 / (1 + Math.exp(-4 * (ratio - 1)));
}

export function simulateDifficultyCurve(cfg: DifficultySimConfig): DifficultySimResult {
  const { segments, wallStages, restPoints, virtualPlayers, giveUpStreak, attemptsPerStage, secPerAttempt } = cfg;
  if (segments.length === 0 || virtualPlayers <= 0) {
    return {
      dropoutRate: 0,
      avgReachedStage: 0,
      dropoutByStage: [],
      topDropoutStages: [],
      avgPlaytimeMin: 0,
      totalAttempts: 0,
    };
  }

  const maxStage = segments.length;
  const wallSet = new Set(wallStages);
  const restSet = new Set(restPoints.map((r) => r.stage));

  const dropoutByStage = new Array(maxStage).fill(0);
  let totalReached = 0;
  let totalAttempts = 0;
  let totalPlaytimeSec = 0;
  let survivors = 0;

  for (let p = 0; p < virtualPlayers; p++) {
    let streak = 0; // 연속 실패 카운트
    let reached = 0;
    let playerSec = 0;

    let droppedOut = false;
    for (let s = 0; s < maxStage; s++) {
      const seg = segments[s];
      if (restSet.has(s + 1)) streak = 0;

      let success = false;
      const maxAttempts = Math.ceil(attemptsPerStage * (wallSet.has(s + 1) ? 2 : 1));
      for (let a = 0; a < maxAttempts; a++) {
        totalAttempts++;
        playerSec += secPerAttempt;
        if (Math.random() < clearProbability(seg)) {
          success = true;
          break;
        }
      }

      if (!success) {
        streak++;
        if (streak >= giveUpStreak) {
          dropoutByStage[s]++;
          droppedOut = true;
          break;
        }
      } else {
        streak = 0;
        reached = s + 1;
      }
    }

    totalReached += reached;
    if (reached === maxStage) {
      survivors++;
      totalPlaytimeSec += playerSec;
    } else if (!droppedOut) {
      // 루프 끝까지 갔는데 reached < maxStage — 마지막 실패로 끝. dropout 으로 집계
      dropoutByStage[Math.min(maxStage - 1, reached)]++;
    }
  }

  const dropouts = virtualPlayers - survivors;

  // 이탈 Top 5 스테이지
  const ranked = dropoutByStage
    .map((count, idx) => ({ stage: idx + 1, dropouts: count, dropoutRate: count / virtualPlayers }))
    .filter((r) => r.dropouts > 0)
    .sort((a, b) => b.dropouts - a.dropouts)
    .slice(0, 5);

  return {
    dropoutRate: dropouts / virtualPlayers,
    avgReachedStage: totalReached / virtualPlayers,
    dropoutByStage,
    topDropoutStages: ranked,
    avgPlaytimeMin: survivors > 0 ? totalPlaytimeSec / survivors / 60 : 0,
    totalAttempts,
  };
}
