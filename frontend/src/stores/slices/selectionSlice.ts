/**
 * Row selection + Cell selection mode slice.
 *
 * 다중 행 선택(`selectedRows`)과 외부에서 셀을 "고르게 하는" 모달 셀 선택 모드
 * (`cellSelectionMode`) 를 담당. 서로 다른 UX이지만 선택이라는 개념을 공유.
 */

import type { StoreApi } from 'zustand';
import type { SelectedRowData, CellSelectionMode, ProjectState } from '../projectStore';

type SetFn = StoreApi<ProjectState>['setState'];
type GetFn = StoreApi<ProjectState>['getState'];

export const createSelectionActions = (set: SetFn, get: GetFn) => ({
  // ==== 행 선택 ====

  selectRow: (data: SelectedRowData) => {
    set((state) => {
      if (state.selectedRows.some((r) => r.rowId === data.rowId)) {
        return state;
      }
      return { selectedRows: [...state.selectedRows, data] };
    });
  },

  deselectRow: (rowId: string) => {
    set((state) => ({
      selectedRows: state.selectedRows.filter((r) => r.rowId !== rowId),
    }));
  },

  clearSelectedRows: () => {
    set({ selectedRows: [] });
  },

  toggleRowSelection: (data: SelectedRowData) => {
    set((state) => {
      const isSelected = state.selectedRows.some((r) => r.rowId === data.rowId);
      if (isSelected) {
        return { selectedRows: state.selectedRows.filter((r) => r.rowId !== data.rowId) };
      }
      return { selectedRows: [...state.selectedRows, data] };
    });
  },

  // ==== 셀 선택 모드 (외부 피커 패턴) ====

  startCellSelection: (
    fieldLabel: string,
    callback: (value: number, rowId?: string, columnId?: string) => void
  ) => {
    set({
      cellSelectionMode: { active: true, fieldLabel, callback },
    });
  },

  completeCellSelection: (value: number, rowId?: string, columnId?: string) => {
    const { cellSelectionMode } = get();
    if (cellSelectionMode.callback) {
      cellSelectionMode.callback(value, rowId, columnId);
    }
    set({
      cellSelectionMode: { active: false, fieldLabel: '', callback: null },
    });
  },

  cancelCellSelection: () => {
    set({
      cellSelectionMode: { active: false, fieldLabel: '', callback: null },
    });
  },
});
