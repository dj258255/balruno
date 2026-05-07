/**
 * History store — no-op stub during the v0.6 → ADR 0021 transition.
 *
 * Earlier shape: a Y.UndoManager adapter that tracked CRDT
 * transactions per active project. v0.6 cleanup retired Y.Doc on
 * the sheet path, so the underlying UndoManager is gone — this
 * store now exposes the same API surface (pushState / undo / redo /
 * canUndo / canRedo / getHistory / jumpTo / deleteEntry / clear) but
 * every operation is a no-op. UI buttons stay rendered but disabled
 * (canUndo / canRedo always return false).
 *
 * Real undo/redo lands with ADR 0021 — inverse-op stack per user.
 * That phase will replace the stub with the real implementation
 * without changing any call site.
 */

import { create } from 'zustand';
import type { Project } from '@/types';

export interface HistoryEntry {
  state: unknown;
  label: string;
  timestamp: number;
}

interface HistoryState {
  /** Reserved — bumps on undo/redo so selectors re-evaluate when the
   *  ADR 0021 implementation lands. Stays at 0 in the stub. */
  tick: number;

  pushState: (projects: Project[], label?: string) => void;
  undo: () => Project[] | null;
  redo: () => Project[] | null;
  clear: () => void;
  jumpTo: (index: number) => Project[] | null;
  deleteEntry: (type: 'past' | 'future', index: number) => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  getHistory: () => { past: HistoryEntry[]; future: HistoryEntry[]; currentIndex: number };
}

export const useHistoryStore = create<HistoryState>(() => ({
  tick: 0,
  pushState: () => {},
  undo: () => null,
  redo: () => null,
  clear: () => {},
  jumpTo: () => null,
  deleteEntry: () => {},
  canUndo: () => false,
  canRedo: () => false,
  getHistory: () => ({ past: [], future: [], currentIndex: -1 }),
}));
