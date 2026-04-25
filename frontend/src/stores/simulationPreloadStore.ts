/**
 * SimulationPanel 외부 진입점 (시트 행 우클릭 등) 에서 unit 데이터를 미리 채워주는 임시 스토어.
 *
 * 흐름:
 *  1. SheetTable RowContextMenu "이 행으로 시뮬 실행" 클릭
 *  2. queueSimulationPreload(payload) 로 store 에 push
 *  3. window dispatchEvent 'balruno:open-panel' { panel: 'simulation' } 으로 패널 열기
 *  4. SimulationPanel mount/state init 단계에서 consume → 자동으로 unit1/unit2 또는 team1/team2 채움
 *  5. consume 후 store 비움 (1회성)
 */

import { create } from 'zustand';
import type { UnitStats } from '@/lib/simulation/types';

export type SimulationPreload =
  | { mode: '1v1'; unit1: UnitStats; unit2?: UnitStats; source?: string }
  | { mode: 'team'; team1: UnitStats[]; team2: UnitStats[]; source?: string };

interface PreloadStore {
  pending: SimulationPreload | null;
  /** 외부에서 push — SimulationPanel 이 열리면 consume */
  queue: (payload: SimulationPreload) => void;
  /** SimulationPanel 이 호출 — 한 번 읽고 비움 */
  consume: () => SimulationPreload | null;
}

export const useSimulationPreload = create<PreloadStore>((set, get) => ({
  pending: null,
  queue: (payload) => set({ pending: payload }),
  consume: () => {
    const value = get().pending;
    if (value) set({ pending: null });
    return value;
  },
}));
