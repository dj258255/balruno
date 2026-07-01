/**
 * Tracks the cell location the user wants to attach a comment to.
 * Updated by SheetTable's selectedCell effect.
 *
 * The project page reads this + a toggle "show comments" flag to
 * decide whether to render CellCommentPanel as a right-side sidebar.
 */

import { create } from 'zustand';

export type CommentSelection =
  | { kind: 'sheet-cell'; sheetId: string; rowId: string; columnId: string }
  | { kind: 'sheet-row'; sheetId: string; rowId: string }
  | null;

interface CommentSelectionState {
  selection: CommentSelection;
  panelOpen: boolean;
  setSelection: (sel: CommentSelection) => void;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
}

export const useCommentSelectionStore = create<CommentSelectionState>((set) => ({
  selection: null,
  panelOpen: false,
  setSelection: (sel) => set({ selection: sel }),
  setPanelOpen: (open) => set({ panelOpen: open }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
}));
