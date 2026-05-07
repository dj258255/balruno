/**
 * Sheet selection / tab actions slice.
 *
 * The sheet CRUD path lives on the server-canonical wire (sheet
 * tree ops in /lib/tree). This slice retains only the local UI
 * state for the active-sheet selection + the open-tabs strip.
 */

import type { StoreApi } from 'zustand';
import type { Sheet } from '@/types';
import type { ProjectState, TabEntry } from '../projectStore';

type SetFn = StoreApi<ProjectState>['setState'];
type GetFn = StoreApi<ProjectState>['getState'];

const hasTab = (tabs: TabEntry[], kind: TabEntry['kind'], id: string) =>
  tabs.some((t) => t.kind === kind && t.id === id);

const withTab = (tabs: TabEntry[], kind: TabEntry['kind'], id: string): TabEntry[] =>
  hasTab(tabs, kind, id) ? tabs : [...tabs, { kind, id }];

export const createSheetActions = (set: SetFn, get: GetFn) => ({
  setCurrentSheet: (id: string | null) => {
    if (id) {
      set((state) => {
        const project = state.projects.find((p) => p.sheets.some((s) => s.id === id));
        return {
          currentSheetId: id,
          currentDocId: null,
          currentProjectId: project?.id ?? state.currentProjectId,
          openTabs: withTab(state.openTabs, 'sheet', id),
        };
      });
    } else {
      set({ currentSheetId: id });
    }
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
