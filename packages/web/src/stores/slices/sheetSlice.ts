/**
 * Sheet actions slice.
 *
 * 시트 수준 CRUD 는 Y.Doc 에 직접 기록. UI state (currentSheetId, openSheetTabs)
 * 는 Zustand 에 유지.
 */

import { newId } from '@/lib/uuid';
import type { StoreApi } from 'zustand';
import type { Sheet, SheetKind, Column, Row, CellValue } from '@/types';
import type { ProjectState, TabEntry } from '../projectStore';
import {
  getProjectDoc,
  addSheetInDoc,
  updateSheetInDoc,
  deleteSheetInDoc,
  duplicateSheetInDoc,
  reorderSheetsInDoc,
} from '@/lib/ydoc';

type SetFn = StoreApi<ProjectState>['setState'];
type GetFn = StoreApi<ProjectState>['getState'];

// --- Tab 유틸 (시트/문서 통합 배열 조작) ---
const hasTab = (tabs: TabEntry[], kind: TabEntry['kind'], id: string) =>
  tabs.some((t) => t.kind === kind && t.id === id);

const withTab = (tabs: TabEntry[], kind: TabEntry['kind'], id: string): TabEntry[] =>
  hasTab(tabs, kind, id) ? tabs : [...tabs, { kind, id }];

const withoutTab = (tabs: TabEntry[], kind: TabEntry['kind'], id: string): TabEntry[] =>
  tabs.filter((t) => !(t.kind === kind && t.id === id));

/** 탭 닫은 뒤 남은 배열에서 "다음 활성" entry 결정 (바로 전에 있던 것 우선). */
const nextActiveAfterClose = (tabs: TabEntry[]): TabEntry | null => {
  return tabs.length > 0 ? tabs[tabs.length - 1] : null;
};

export const createSheetActions = (set: SetFn, get: GetFn) => ({
  createSheet: (
    projectId: string,
    name: string,
    exportClassName?: string,
    kind?: SheetKind,
  ): string => {
    const id = newId();
    const now = Date.now();

    const col1 = newId();
    const col2 = newId();
    const newSheet: Sheet = {
      id,
      name,
      kind,
      columns: [
        { id: col1, name: 'Column1', type: 'general', width: 120 },
        { id: col2, name: 'Column2', type: 'general', width: 120 },
      ],
      rows: [
        { id: newId(), cells: { [col1]: '', [col2]: '' } },
        { id: newId(), cells: { [col1]: '', [col2]: '' } },
      ],
      exportClassName: exportClassName || undefined,
      createdAt: now,
      updatedAt: now,
    };

    addSheetInDoc(getProjectDoc(projectId), newSheet);

    // UI 상태는 Zustand
    set((state) => ({
      currentSheetId: id,
      currentDocId: null,
      openTabs: withTab(state.openTabs, 'sheet', id),
    }));

    return id;
  },

  updateSheet: (
    projectId: string,
    sheetId: string,
    updates: Partial<Pick<Sheet,
      | 'name'
      | 'icon'
      | 'kind'
      | 'exportClassName'
      | 'activeView'
      | 'viewGroupColumnId'
      | 'viewKanbanCoverColumnId'
      | 'viewKanbanFieldIds'
      | 'viewCalendarEndColumnId'
      | 'viewGanttEndColumnId'
      | 'viewGanttDependsColumnId'
      | 'savedViews'
      | 'activeSavedViewId'
      | 'tags'
    >>
  ) => {
    updateSheetInDoc(getProjectDoc(projectId), sheetId, updates);
  },

  deleteSheet: (projectId: string, sheetId: string) => {
    deleteSheetInDoc(getProjectDoc(projectId), sheetId);

    set((state) => {
      const newTabs = withoutTab(state.openTabs, 'sheet', sheetId);
      if (state.currentSheetId !== sheetId) {
        return { openTabs: newTabs };
      }
      const next = nextActiveAfterClose(newTabs);
      return {
        openTabs: newTabs,
        currentSheetId: next?.kind === 'sheet' ? next.id : null,
        currentDocId: next?.kind === 'doc' ? next.id : null,
      };
    });
  },

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

  openSheetTab: (sheetId: string) => {
    set((state) => ({
      openTabs: withTab(state.openTabs, 'sheet', sheetId),
      currentSheetId: sheetId,
      currentDocId: null,
    }));
  },

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
        currentDocId: next?.kind === 'doc' ? next.id : null,
      };
    });
  },

  reorderOpenTabs: (fromIndex: number, toIndex: number) => {
    set((state) => {
      const tabs = [...state.openTabs];
      const [removed] = tabs.splice(fromIndex, 1);
      tabs.splice(toIndex, 0, removed);
      return { openTabs: tabs };
    });
  },

  duplicateSheet: (projectId: string, sheetId: string): string => {
    const project = get().projects.find((p) => p.id === projectId);
    const sheet = project?.sheets.find((s) => s.id === sheetId);
    if (!sheet) return '';

    const newSheetId = newId();
    const now = Date.now();

    // 컬럼 ID 재생성 + cells 매핑 갱신
    const columnIdMap: Record<string, string> = {};
    const newColumns: Column[] = sheet.columns.map((col) => {
      const newColId = newId();
      columnIdMap[col.id] = newColId;
      return { ...col, id: newColId };
    });

    const newRows: Row[] = sheet.rows.map((row) => {
      const newCells: Record<string, CellValue> = {};
      Object.entries(row.cells).forEach(([oldColId, value]) => {
        const newColId = columnIdMap[oldColId];
        if (newColId) newCells[newColId] = value;
      });
      return { ...row, id: newId(), cells: newCells };
    });

    const newSheet: Sheet = {
      ...sheet,
      id: newSheetId,
      name: `${sheet.name} (복사본)`,
      columns: newColumns,
      rows: newRows,
      stickers: sheet.stickers?.map((st) => ({ ...st, id: newId(), createdAt: now })),
      createdAt: now,
      updatedAt: now,
    };

    duplicateSheetInDoc(getProjectDoc(projectId), newSheet);

    set((state) => ({
      openTabs: withTab(state.openTabs, 'sheet', newSheetId),
      currentSheetId: newSheetId,
      currentDocId: null,
    }));

    return newSheetId;
  },

  reorderSheets: (projectId: string, fromIndex: number, toIndex: number) => {
    reorderSheetsInDoc(getProjectDoc(projectId), fromIndex, toIndex);
  },

  moveSheetToProject: (fromProjectId: string, toProjectId: string, sheetId: string) => {
    // 2개 Y.Doc 사이 이동: source 에서 snapshot 후 destination 에 push, source 삭제
    const state = get();
    const fromProject = state.projects.find((p) => p.id === fromProjectId);
    const sheet = fromProject?.sheets.find((s) => s.id === sheetId);
    if (!sheet) return;

    const now = Date.now();
    addSheetInDoc(getProjectDoc(toProjectId), { ...sheet, updatedAt: now });
    deleteSheetInDoc(getProjectDoc(fromProjectId), sheetId);

    set((state) => {
      const without = withoutTab(state.openTabs, 'sheet', sheetId);
      return {
        currentProjectId: toProjectId,
        currentSheetId: sheetId,
        currentDocId: null,
        openTabs: withTab(without, 'sheet', sheetId),
      };
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
