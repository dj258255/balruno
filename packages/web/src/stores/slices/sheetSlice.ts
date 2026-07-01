/**
 * Sheet selection / tab actions slice + sheet metadata update.
 *
 * Sheet CRUD lives on the server-canonical sheet tree wire ops
 * (/lib/tree). View metadata (activeView, viewGroupColumnId, ...)
 * uses the sheet.metadata.update wire op so view switches and
 * grouping picks broadcast to peers.
 */

import type { StoreApi } from 'zustand';
import type { Sheet } from '@/types';
import type { ProjectState, TabEntry } from '../projectStore';
import { emitOp } from '@/lib/sync/writeQueue';
import type { SheetMetadataPatch } from '@/lib/sync/opMapper';

type SetFn = StoreApi<ProjectState>['setState'];
type GetFn = StoreApi<ProjectState>['getState'];

const hasTab = (tabs: TabEntry[], kind: TabEntry['kind'], id: string) =>
  tabs.some((t) => t.kind === kind && t.id === id);

const withTab = (tabs: TabEntry[], kind: TabEntry['kind'], id: string): TabEntry[] =>
  hasTab(tabs, kind, id) ? tabs : [...tabs, { kind, id }];

const withoutTab = (tabs: TabEntry[], kind: TabEntry['kind'], id: string): TabEntry[] =>
  tabs.filter((t) => !(t.kind === kind && t.id === id));

/** Pick the next neighbour to focus after closing a tab — last is fine because
 *  insertion is append-only, so the rightmost remaining tab is the one the
 *  user most recently visited (browser convention). */
const nextActiveAfterClose = (tabs: TabEntry[]): TabEntry | null =>
  tabs.length > 0 ? tabs[tabs.length - 1] : null;

export const createSheetActions = (set: SetFn, get: GetFn) => ({
  /**
   * Patch sheet view metadata — activeView toggle, group column pick,
   * Kanban cover col, Calendar end col, Gantt depends col, etc. The
   * write goes through emitOp so peers see the same view state in
   * real time. No undo entry — view config flicks are intentionally
   * per-user ergonomics (matches Linear's view picker UX).
   */
  updateSheetMetadata: (
    projectId: string,
    sheetId: string,
    patch: SheetMetadataPatch,
    options?: { origin?: 'local' | 'remote' },
  ) => {
    const isRemote = options?.origin === 'remote';
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id !== projectId
          ? p
          : {
              ...p,
              sheets: p.sheets.map((s) =>
                s.id !== sheetId ? s : { ...s, ...patch },
              ),
            },
      ),
    }));
    if (!isRemote) {
      emitOp({ kind: 'sheet.metadata.update', sheetId, patch });
    }
  },

  setCurrentSheet: (id: string | null) => {
    if (id) {
      set((state) => {
        const project = state.projects.find((p) => p.sheets.some((s) => s.id === id));
        return {
          currentSheetId: id,
          currentProjectId: project?.id ?? state.currentProjectId,
          openTabs: withTab(state.openTabs, 'sheet', id),
        };
      });
    } else {
      set({ currentSheetId: id });
    }
  },

  /** Browser-tab close — drop the entry from openTabs only. The sheet
   *  itself stays on the server; reopening from the sidebar puts the
   *  tab back. If the closed tab was the active one, fall through to
   *  the rightmost remaining tab so the main panel never goes blank
   *  while other tabs are open. */
  closeSheetTab: (sheetId: string) => {
    set((state) => {
      const newTabs = withoutTab(state.openTabs, 'sheet', sheetId);
      if (state.currentSheetId !== sheetId) {
        return { openTabs: newTabs };
      }
      const next = nextActiveAfterClose(newTabs);
      return {
        openTabs: newTabs,
        currentSheetId: next?.kind === 'sheet' ? next.id : null,
      };
    });
  },

  /** Reorder by index — drag-and-drop on the SheetTabs strip. Pure UI
   *  state, no server round-trip (each user keeps their own tab order
   *  the same way browsers do). */
  reorderOpenTabs: (fromIndex: number, toIndex: number) => {
    set((state) => {
      if (fromIndex === toIndex) return state;
      if (fromIndex < 0 || fromIndex >= state.openTabs.length) return state;
      if (toIndex < 0 || toIndex >= state.openTabs.length) return state;
      const next = [...state.openTabs];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return { openTabs: next };
    });
  },

  getCurrentSheet: (): Sheet | null => {
    const { projects, currentProjectId, currentSheetId } = get();
    const project = projects.find((p) => p.id === currentProjectId);
    return project?.sheets.find((s) => s.id === currentSheetId) || null;
  },

  getSheet: (projectId: string, sheetId: string): Sheet | null => {
    const { projects } = get();
    const project = projects.find((p) => p.id === projectId);
    return project?.sheets.find((s) => s.id === sheetId) || null;
  },
});
