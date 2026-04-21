/**
 * Sheet actions slice.
 *
 * 시트 수준 CRUD 는 Y.Doc 에 직접 기록. UI state (currentSheetId, openSheetTabs)
 * 는 Zustand 에 유지.
 */

import { v4 as uuidv4 } from 'uuid';
import type { StoreApi } from 'zustand';
import type { Sheet, Column, Row, CellValue } from '@/types';
import type { ProjectState } from '../projectStore';
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

export const createSheetActions = (set: SetFn, get: GetFn) => ({
  createSheet: (projectId: string, name: string, exportClassName?: string): string => {
    const id = uuidv4();
    const now = Date.now();

    const col1 = uuidv4();
    const col2 = uuidv4();
    const newSheet: Sheet = {
      id,
      name,
      columns: [
        { id: col1, name: 'Column1', type: 'general', width: 120 },
        { id: col2, name: 'Column2', type: 'general', width: 120 },
      ],
      rows: [
        { id: uuidv4(), cells: { [col1]: '', [col2]: '' } },
        { id: uuidv4(), cells: { [col1]: '', [col2]: '' } },
      ],
      exportClassName: exportClassName || undefined,
      createdAt: now,
      updatedAt: now,
    };

    addSheetInDoc(getProjectDoc(projectId), newSheet);

    // UI 상태는 Zustand
    set((state) => ({
      currentSheetId: id,
      openSheetTabs: [...state.openSheetTabs, id],
    }));

    return id;
  },

  updateSheet: (
    projectId: string,
    sheetId: string,
    updates: Partial<Pick<Sheet,
      | 'name'
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
    >>
  ) => {
    updateSheetInDoc(getProjectDoc(projectId), sheetId, updates);
  },

  deleteSheet: (projectId: string, sheetId: string) => {
    deleteSheetInDoc(getProjectDoc(projectId), sheetId);

    set((state) => {
      const newOpenTabs = state.openSheetTabs.filter((id) => id !== sheetId);
      return {
        openSheetTabs: newOpenTabs,
        currentSheetId:
          state.currentSheetId === sheetId
            ? newOpenTabs.length > 0
              ? newOpenTabs[newOpenTabs.length - 1]
              : null
            : state.currentSheetId,
      };
    });
  },

  setCurrentSheet: (id: string | null) => {
    if (id) {
      // 시트 선택 → 탭 자동 열기 + 소속 프로젝트도 활성화 + 문서 비활성화
      set((state) => {
        const project = state.projects.find((p) => p.sheets.some((s) => s.id === id));
        return {
          currentSheetId: id,
          currentDocId: null,
          currentProjectId: project?.id ?? state.currentProjectId,
          openSheetTabs: state.openSheetTabs.includes(id)
            ? state.openSheetTabs
            : [...state.openSheetTabs, id],
        };
      });
    } else {
      set({ currentSheetId: id });
    }
  },

  openSheetTab: (sheetId: string) => {
    set((state) => ({
      openSheetTabs: state.openSheetTabs.includes(sheetId)
        ? state.openSheetTabs
        : [...state.openSheetTabs, sheetId],
      currentSheetId: sheetId,
      currentDocId: null,
    }));
  },

  closeSheetTab: (sheetId: string) => {
    set((state) => {
      const newTabs = state.openSheetTabs.filter((id) => id !== sheetId);
      const needNewSelection = state.currentSheetId === sheetId;
      return {
        openSheetTabs: newTabs,
        currentSheetId: needNewSelection
          ? newTabs.length > 0
            ? newTabs[newTabs.length - 1]
            : null
          : state.currentSheetId,
      };
    });
  },

  reorderOpenTabs: (fromIndex: number, toIndex: number) => {
    set((state) => {
      const tabs = [...state.openSheetTabs];
      const [removed] = tabs.splice(fromIndex, 1);
      tabs.splice(toIndex, 0, removed);
      return { openSheetTabs: tabs };
    });
  },

  duplicateSheet: (projectId: string, sheetId: string): string => {
    const project = get().projects.find((p) => p.id === projectId);
    const sheet = project?.sheets.find((s) => s.id === sheetId);
    if (!sheet) return '';

    const newId = uuidv4();
    const now = Date.now();

    // 컬럼 ID 재생성 + cells 매핑 갱신
    const columnIdMap: Record<string, string> = {};
    const newColumns: Column[] = sheet.columns.map((col) => {
      const newColId = uuidv4();
      columnIdMap[col.id] = newColId;
      return { ...col, id: newColId };
    });

    const newRows: Row[] = sheet.rows.map((row) => {
      const newCells: Record<string, CellValue> = {};
      Object.entries(row.cells).forEach(([oldColId, value]) => {
        const newColId = columnIdMap[oldColId];
        if (newColId) newCells[newColId] = value;
      });
      return { ...row, id: uuidv4(), cells: newCells };
    });

    const newSheet: Sheet = {
      ...sheet,
      id: newId,
      name: `${sheet.name} (복사본)`,
      columns: newColumns,
      rows: newRows,
      stickers: sheet.stickers?.map((st) => ({ ...st, id: uuidv4(), createdAt: now })),
      createdAt: now,
      updatedAt: now,
    };

    duplicateSheetInDoc(getProjectDoc(projectId), newSheet);

    set((state) => ({
      openSheetTabs: [...state.openSheetTabs, newId],
      currentSheetId: newId,
    }));

    return newId;
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
      const newOpenTabs = state.openSheetTabs.filter((id) => id !== sheetId);
      return {
        currentProjectId: toProjectId,
        currentSheetId: sheetId,
        openSheetTabs: [...newOpenTabs, sheetId],
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
