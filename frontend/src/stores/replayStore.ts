/**
 * Replay Store — 가장 최근 "의미 있는" 전투 시뮬 실행 결과를 기억.
 *
 * 목적:
 *  - SimulationPanel 등에서 시뮬 실행 → ReplayTimelinePanel 로 보내 재생
 *  - 지역 state 로 유지하기엔 여러 panel 이 서로 못 보는 문제
 *  - Zustand 전역 store 로 공유
 *
 * 저장 대상: 마지막 BattleResult + unit1/unit2 메타 (이름/maxHp) + skills
 *  - Panel 간 결합도 낮춰야 하므로 '의미 있는 전투 1건' 만 유지 (queue 아님)
 */

import { create } from 'zustand';
import type { BattleResult, UnitStats, Skill } from '@/lib/simulation/types';

interface ReplayScenario {
  unit1: UnitStats;
  unit2: UnitStats;
  skills1: Skill[];
  skills2: Skill[];
  result: BattleResult;
  /** 마지막 실행 시각 (ms) — 타임스탬프로 stale 여부 판단 */
  timestamp: number;
  /** 출처 (SimulationPanel / 수동 등) */
  source?: string;
}

interface ReplayStore {
  scenario: ReplayScenario | null;
  publish: (scenario: Omit<ReplayScenario, 'timestamp'>) => void;
  clear: () => void;
}

export const useReplayStore = create<ReplayStore>((set) => ({
  scenario: null,
  publish: (scenario) => set({ scenario: { ...scenario, timestamp: Date.now() } }),
  clear: () => set({ scenario: null }),
}));
