/**
 * Goal Solver History — 최근 역산 결과 스택.
 * Calculator Undo 와 별개 — Solver 는 공식별로 다양한 param set 을 시도하는
 * 워크플로우라 단순 stack 이 더 맞음.
 *
 * localStorage 에 영구 저장 (최대 20개).
 */
import { create } from 'zustand';
import type { SolverFormula } from '@/lib/goalSolver';

export interface GoalSolverHistoryEntry {
  id: string;
  formula: SolverFormula;
  formulaName: string;
  targetValue: number;
  params: Record<string, number>;
  resultValue: number | string | undefined;
  success: boolean;
  timestamp: number;
}

const STORAGE_KEY = 'balruno:goalSolver:history:v1';
const MAX = 20;

function loadInitial(): GoalSolverHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as GoalSolverHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

interface HistoryStore {
  entries: GoalSolverHistoryEntry[];
  push: (entry: Omit<GoalSolverHistoryEntry, 'id' | 'timestamp'>) => void;
  clear: () => void;
  remove: (id: string) => void;
}

export const useGoalSolverHistory = create<HistoryStore>((set, get) => ({
  entries: loadInitial(),
  push: (partial) => {
    const entry: GoalSolverHistoryEntry = {
      ...partial,
      id: `gs_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
    };
    const next = [entry, ...get().entries].slice(0, MAX);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    set({ entries: next });
  },
  clear: () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    set({ entries: [] });
  },
  remove: (id) => {
    const next = get().entries.filter((e) => e.id !== id);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
    set({ entries: next });
  },
}));
