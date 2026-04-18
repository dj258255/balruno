/**
 * Sheet actions slice.
 *
 * currentSheetId / openSheetTabs 상태와 시트 수준 액션(create/update/delete/duplicate/reorder)
 * 및 탭 관리(openTab/closeTab/reorderOpenTabs) 를 담당.
 */

import { v4 as uuidv4 } from 'uuid';
import type { StoreApi } from 'zustand';
import type { Sheet, Column, Row, CellValue } from '@/types';
import type { ProjectState } from '../projectStore';

type SetFn = StoreApi<ProjectState>['setState'];
type GetFn = StoreApi<ProjectState>['getState'];

export const createSheetActions = (set: SetFn, get: GetFn) => ({
  createSheet: (projectId: string, name: string, exportClassName?: string): string => {
    const id = uuidv4();
    const now = Date.now();

    // 기본 2열 × 2행
    const defaultColumns = [
      { id: uuidv4(), name: 'Column1', type: 'general' as const, width: 120 },
      { id: uuidv4(), name: 'Column2', type: 'general' as const, width: 120 },
    ];

    const defaultRows = [
      { id: uuidv4(), cells: { [defaultColumns[0].id]: '', [defaultColumns[1].id]: '' } },
      { id: uuidv4(), cells: { [defaultColumns[0].id]: '', [defaultColumns[1].id]: '' } },
    ];

    const newSheet: Sheet = {
      id,
      name,
      columns: defaultColumns,
      rows: defaultRows,
      exportClassName: exportClassName || undefined,
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? { ...p, sheets: [...p.sheets, newSheet], updatedAt: now }
          : p
      ),
      currentSheetId: id,
      openSheetTabs: [...state.openSheetTabs, id],
    }));

    return id;
  },

  updateSheet: (
    projectId: string,
    sheetId: string,
    updates: Partial<Pick<Sheet, 'name' | 'exportClassName'>>
  ) => {
    const now = Date.now();
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              sheets: p.sheets.map((s) =>
                s.id === sheetId ? { ...s, ...updates, updatedAt: now } : s
              ),
              updatedAt: now,
            }
          : p
      ),
    }));
  },

  deleteSheet: (projectId: string, sheetId: string) => {
    const now = Date.now();

    set((state) => {
      const newOpenTabs = state.openSheetTabs.filter((id) => id !== sheetId);
      return {
        projects: state.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                sheets: p.sheets.filter((s) => s.id !== sheetId),
                updatedAt: now,
              }
            : p
        ),
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
      // 시트 선택 → 탭 자동 열기 + 소속 프로젝트도 활성화
      set((state) => {
        const project = state.projects.find((p) => p.sheets.some((s) => s.id === id));
        return {
          currentSheetId: id,
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
    const newSheet: Sheet = {
      ...JSON.parse(JSON.stringify(sheet)),
      id: newId,
      name: `${sheet.name} (복사본)`,
      createdAt: now,
      updatedAt: now,
    };

    const columnIdMap: Record<string, string> = {};
    newSheet.columns = newSheet.columns.map((col: Column) => {
      const newColId = uuidv4();
      columnIdMap[col.id] = newColId;
      return { ...col, id: newColId };
    });

    newSheet.rows = newSheet.rows.map((row: Row) => {
      const newCells: Record<string, CellValue> = {};
      Object.entries(row.cells).forEach(([oldColId, value]) => {
        const newColId = columnIdMap[oldColId];
        if (newColId) {
          newCells[newColId] = value;
        }
      });
      return { ...row, id: uuidv4(), cells: newCells };
    });

    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? { ...p, sheets: [...p.sheets, newSheet], updatedAt: now }
          : p
      ),
      openSheetTabs: [...state.openSheetTabs, newId],
      currentSheetId: newId,
    }));

    return newId;
  },

  reorderSheets: (projectId: string, fromIndex: number, toIndex: number) => {
    const now = Date.now();
    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id !== projectId) return p;
        const sheets = [...p.sheets];
        const [removed] = sheets.splice(fromIndex, 1);
        sheets.splice(toIndex, 0, removed);
        return { ...p, sheets, updatedAt: now };
      }),
    }));
  },

  moveSheetToProject: (fromProjectId: string, toProjectId: string, sheetId: string) => {
    const now = Date.now();
    const state = get();
    const fromProject = state.projects.find((p) => p.id === fromProjectId);
    const sheet = fromProject?.sheets.find((s) => s.id === sheetId);
    if (!sheet) return;

    set((state) => {
      const newOpenTabs = state.openSheetTabs.filter((id) => id !== sheetId);
      return {
        projects: state.projects.map((p) => {
          if (p.id === fromProjectId) {
            return {
              ...p,
              sheets: p.sheets.filter((s) => s.id !== sheetId),
              updatedAt: now,
            };
          }
          if (p.id === toProjectId) {
            return {
              ...p,
              sheets: [...p.sheets, { ...sheet, updatedAt: now }],
              updatedAt: now,
            };
          }
          return p;
        }),
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
