/**
 * History store — delegates to lib/undo/undoStack (ADR 0021).
 *
 * Earlier shape: a Y.UndoManager adapter (v0.6 cleanup retired it
 * to a no-op stub). This is the *real* implementation — backed by
 * the inverse-op stack module. API surface unchanged so existing
 * call sites (SheetTable / SheetToolbar / useSheetEditing /
 * useHistory) keep compiling.
 *
 * Reactivity: subscribe to undoStack changes, bump tick so zustand
 * selectors re-evaluate (canUndo / canRedo on every push).
 */

import { create } from 'zustand';
import type { Project } from '@/types';
import {
  canUndo as stackCanUndo,
  canRedo as stackCanRedo,
  popUndo,
  popRedo,
  subscribe as subscribeStack,
} from '@/lib/undo/undoStack';
import { applyUndoableOps } from '@/lib/undo/applyUndoable';

export interface HistoryEntry {
  state: unknown;
  label: string;
  timestamp: number;
}

interface HistoryState {
  /** Bumps every time undoStack changes — selectors re-evaluate. */
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

export const useHistoryStore = create<HistoryState>((_set, get) => {
  // Subscribe once at store creation; the cleanup is implicit because
  // the store outlives any component.
  if (typeof window !== 'undefined') {
    subscribeStack(() => {
      _set((s) => ({ tick: s.tick + 1 }));
    });
  }

  return {
    tick: 0,
    /** Reserved for snapshot-based undo. The inverse-op stack
     *  records on emit, so push from outside the action is a no-op. */
    pushState: () => {},
    undo: () => {
      const entry = popUndo();
      if (!entry) return null;
      applyUndoableOps(entry.inverse);
      return null;
    },
    redo: () => {
      const entry = popRedo();
      if (!entry) return null;
      applyUndoableOps(entry.forward);
      return null;
    },
    clear: () => {
      // No global clear — resetting is per-project via undoStack.clearActiveStack
      // at unmount. Calling clear from a UI action is intentionally a no-op.
    },
    jumpTo: () => null,
    deleteEntry: () => {},
    canUndo: () => {
      void get().tick;
      return stackCanUndo();
    },
    canRedo: () => {
      void get().tick;
      return stackCanRedo();
    },
    getHistory: () => ({ past: [], future: [], currentIndex: -1 }),
  };
});
