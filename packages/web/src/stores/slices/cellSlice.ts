/**
 * Column + Row + Cell + Sticker actions slice.
 *
 * TrackPhase 2 — 모든 write 가 Y.Doc helper 로 수렴.
 * Zustand 의 `projects` 배열은 Y.Doc observer 가 자동 동기화하므로 이 slice 는
 * `set()` 을 호출하지 않는다 (UI state 만 필요하면 예외).
 */

import { v4 as uuidv4 } from 'uuid';
import type { StoreApi } from 'zustand';
import type { Column, Row, CellValue, CellStyle, Sticker, ChangeEntry } from '@/types';
import type { ProjectState } from '../projectStore';
import { wouldCreateCycle } from '@/lib/linkGraph';
import { toast } from '@/components/ui/Toast';

/** 현재 사용자 이름 읽기 (usePresence 가 쓰는 키). */
function getCurrentUserName(): string {
  if (typeof window === 'undefined') return 'local';
  return localStorage.getItem('balruno:user-name') ?? 'local';
}

/** 두 CellValue 가 실질적으로 같은지 (null/'' 취급). */
function isSameValue(a: CellValue, b: CellValue): boolean {
  if (a === b) return true;
  if ((a === null || a === '') && (b === null || b === '')) return true;
  return false;
}
import {
  getProjectDoc,
  addColumnInDoc,
  insertColumnInDoc,
  updateColumnInDoc,
  deleteColumnInDoc,
  reorderColumnsInDoc,
  addRowInDoc,
  insertRowInDoc,
  updateRowInDoc,
  updateCellInDoc,
  updateCellStyleInDoc,
  updateCellsStyleInDoc,
  deleteRowInDoc,
  reorderRowInDoc,
  addMultipleRowsInDoc,
  addStickerInDoc,
  updateStickerInDoc,
  deleteStickerInDoc,
  appendChangelogInDoc,
} from '@/lib/ydoc';

type SetFn = StoreApi<ProjectState>['setState'];
type GetFn = StoreApi<ProjectState>['getState'];

// 기본 셀 스타일 — 스타일이 없는 셀에 기본값 적용
const DEFAULT_CELL_STYLE: CellStyle = {
  fontSize: 15,
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  hAlign: 'center',
  vAlign: 'middle',
  textRotation: 0,
};

export const createCellActions = (_set: SetFn, get: GetFn) => ({
  // ==== 컬럼 ====

  addColumn: (projectId: string, sheetId: string, column: Omit<Column, 'id'>): string => {
    const id = uuidv4();
    const doc = getProjectDoc(projectId);

    // link/lookup/rollup 사이클 사전 검사. 생성 차단.
    if (column.type === 'link' || column.type === 'lookup' || column.type === 'rollup') {
      const state = get();
      const project = state.projects.find((p) => p.id === projectId);
      if (project) {
        const cycle = wouldCreateCycle(project.sheets, sheetId, { ...column, id } as Column);
        if (cycle.hasCycle) {
          toast.error(`순환 참조 감지: ${cycle.pathNames.join(' → ')}\n컬럼이 생성되지 않았습니다.`, 6000);
          return '';
        }
      }
    }

    // Track양방향 미러링: link 타입이면 대상 시트에 reverse 컬럼 자동 생성
    if (column.type === 'link' && column.linkedSheetId && !column.isReverseLink) {
      const state = get();
      const project = state.projects.find((p) => p.id === projectId);
      const sourceSheet = project?.sheets.find((s) => s.id === sheetId);
      const targetSheet = project?.sheets.find((s) => s.id === column.linkedSheetId);
      if (sourceSheet && targetSheet) {
        const reverseId = uuidv4();
        // 한 transaction 에 양쪽 컬럼 생성
        doc.transact(() => {
          addColumnInDoc(doc, sheetId, {
            ...column,
            id,
            reverseColumnId: reverseId,
          });
          addColumnInDoc(doc, column.linkedSheetId!, {
            id: reverseId,
            name: `${sourceSheet.name} (역참조)`,
            type: 'link',
            linkedSheetId: sheetId,
            linkedDisplayColumnId: undefined,
            linkedMultiple: true,
            reverseColumnId: id,
            isReverseLink: true,
            width: 160,
          });
        });
        return id;
      }
    }

    const fullColumn = { ...column, id };
    addColumnInDoc(doc, sheetId, fullColumn);

    // Trackfix: formula 타입 컬럼 추가 시 기존 행들에 formula 값 prefill
    // (addRow 에서는 이미 처리됨, addColumn 경로에서는 누락되어 있었음)
    if (fullColumn.type === 'formula' && fullColumn.formula) {
      const state = get();
      const project = state.projects.find((p) => p.id === projectId);
      const sheet = project?.sheets.find((s) => s.id === sheetId);
      if (sheet && sheet.rows.length > 0) {
        doc.transact(() => {
          for (const row of sheet.rows) {
            const existing = row.cells[id];
            // 빈 셀에만 prefill — 기존 값 덮어쓰기 방지
            if (existing === undefined || existing === null || existing === '') {
              updateCellInDoc(doc, sheetId, row.id, id, fullColumn.formula!);
            }
          }
        });
      }
    }

    return id;
  },

  insertColumn: (
    projectId: string,
    sheetId: string,
    column: Omit<Column, 'id'>,
    atIndex: number
  ): string => {
    const id = uuidv4();
    insertColumnInDoc(getProjectDoc(projectId), sheetId, { ...column, id }, atIndex);
    return id;
  },

  updateColumn: (
    projectId: string,
    sheetId: string,
    columnId: string,
    updates: Partial<Column>
  ) => {
    // link/lookup/rollup 관련 필드 변경 시 사이클 사전 검사
    const touchesLink = (
      'type' in updates || 'linkedSheetId' in updates
      || 'lookupLinkColumnId' in updates || 'lookupTargetColumnId' in updates
    );
    if (touchesLink) {
      const state = get();
      const project = state.projects.find((p) => p.id === projectId);
      const sheet = project?.sheets.find((s) => s.id === sheetId);
      const existing = sheet?.columns.find((c) => c.id === columnId);
      if (project && existing) {
        const merged = { ...existing, ...updates } as Column;
        if (merged.type === 'link' || merged.type === 'lookup' || merged.type === 'rollup') {
          const cycle = wouldCreateCycle(project.sheets, sheetId, merged);
          if (cycle.hasCycle) {
            toast.error(`순환 참조 감지: ${cycle.pathNames.join(' → ')}\n변경이 적용되지 않았습니다.`, 6000);
            return;
          }
        }
      }
    }
    updateColumnInDoc(getProjectDoc(projectId), sheetId, columnId, updates);
  },

  deleteColumn: (projectId: string, sheetId: string, columnId: string) => {
    const doc = getProjectDoc(projectId);
    const state = get();
    const project = state.projects.find((p) => p.id === projectId);
    const sourceSheet = project?.sheets.find((s) => s.id === sheetId);
    const column = sourceSheet?.columns.find((c) => c.id === columnId);

    // Trackcascade: link 컬럼 삭제 시 반대편 reverse 컬럼도 삭제
    if (column?.type === 'link' && column.linkedSheetId && column.reverseColumnId) {
      doc.transact(() => {
        deleteColumnInDoc(doc, sheetId, columnId);
        deleteColumnInDoc(doc, column.linkedSheetId!, column.reverseColumnId!);
      });
      return;
    }
    deleteColumnInDoc(doc, sheetId, columnId);
  },

  reorderColumns: (projectId: string, sheetId: string, columnIds: string[]) => {
    reorderColumnsInDoc(getProjectDoc(projectId), sheetId, columnIds);
  },

  // ==== 행 ====

  addRow: (
    projectId: string,
    sheetId: string,
    cells: Record<string, CellValue> = {}
  ): string => {
    const id = uuidv4();
    const sheet = get().getSheet(projectId, sheetId);

    // 수식 컬럼의 formula 를 새 행에 자동 prefill
    const formulaCells: Record<string, CellValue> = {};
    sheet?.columns.forEach((col) => {
      if (col.type === 'formula' && col.formula) {
        formulaCells[col.id] = col.formula;
      }
    });

    addRowInDoc(getProjectDoc(projectId), sheetId, {
      id,
      cells: { ...formulaCells, ...cells },
    });
    return id;
  },

  insertRow: (
    projectId: string,
    sheetId: string,
    atIndex: number,
    cells: Record<string, CellValue> = {}
  ): string => {
    const id = uuidv4();
    const sheet = get().getSheet(projectId, sheetId);

    const formulaCells: Record<string, CellValue> = {};
    sheet?.columns.forEach((col) => {
      if (col.type === 'formula' && col.formula) {
        formulaCells[col.id] = col.formula;
      }
    });

    insertRowInDoc(
      getProjectDoc(projectId),
      sheetId,
      { id, cells: { ...formulaCells, ...cells } },
      atIndex
    );
    return id;
  },

  updateRow: (
    projectId: string,
    sheetId: string,
    rowId: string,
    updates: Partial<Row>
  ) => {
    updateRowInDoc(getProjectDoc(projectId), sheetId, rowId, updates);
  },

  updateCell: (
    projectId: string,
    sheetId: string,
    rowId: string,
    columnId: string,
    value: CellValue
  ) => {
    const doc = getProjectDoc(projectId);
    const state = get();
    const project = state.projects.find((p) => p.id === projectId);
    const sourceSheet = project?.sheets.find((s) => s.id === sheetId);
    const column = sourceSheet?.columns.find((c) => c.id === columnId);

    // 이전 값 snapshot + changelog 기록
    // (link 양방향 미러링 분기 전에 미리 찍어둠)
    const prevValue = sourceSheet?.rows.find((r) => r.id === rowId)?.cells[columnId] ?? null;
    const recordChange = () => {
      if (isSameValue(prevValue, value)) return; // no-op 스킵

      // 역방향 링크 — 같은 row 의 task-link 셀들이 가리키는 task row IDs 를 수집.
      // 이걸 저장해두면 task 레코드 열 때 "이 task 와 연결된 변경" 을 역조회 가능.
      const linkedTaskIds: string[] = [];
      if (sourceSheet) {
        const currentRow = sourceSheet.rows.find((r) => r.id === rowId);
        if (currentRow) {
          for (const col of sourceSheet.columns) {
            if (col.type === 'task-link') {
              const v = currentRow.cells[col.id];
              if (typeof v === 'string' && v.trim()) {
                for (const tid of v.split(',').map((s) => s.trim()).filter(Boolean)) {
                  if (!linkedTaskIds.includes(tid)) linkedTaskIds.push(tid);
                }
              }
            }
          }
        }
      }

      // 수식 입력 (`=...`) 은 엔진 결과가 아니라 원본 수식이 바뀌어도 의미 있음 — 기록
      const entry: ChangeEntry = {
        id: uuidv4(),
        timestamp: Date.now(),
        userId: getCurrentUserName(),
        userName: getCurrentUserName(),
        sheetId,
        rowId,
        columnId,
        before: prevValue,
        after: value,
        ...(linkedTaskIds.length > 0 ? { linkedTaskIds } : {}),
      };
      appendChangelogInDoc(doc, entry);
    };

    // Track양방향 미러링: link 타입 셀 업데이트 시 반대쪽도 동기화
    if (
      column?.type === 'link' &&
      column.linkedSheetId &&
      column.reverseColumnId &&
      sourceSheet
    ) {
      const targetSheet = project?.sheets.find((s) => s.id === column.linkedSheetId);
      if (targetSheet) {
        const oldValue = sourceSheet.rows.find((r) => r.id === rowId)?.cells[columnId];
        const oldIds = String(oldValue ?? '').split(',').map((s) => s.trim()).filter(Boolean);
        const newIds = String(value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
        const added = newIds.filter((x) => !oldIds.includes(x));
        const removed = oldIds.filter((x) => !newIds.includes(x));
        const reverseColId = column.reverseColumnId;
        const targetSheetId = column.linkedSheetId;

        doc.transact(() => {
          updateCellInDoc(doc, sheetId, rowId, columnId, value);
          recordChange();
          // 추가된 target row 의 reverse 컬럼에 현재 rowId 추가
          for (const targetRowId of added) {
            const targetRow = targetSheet.rows.find((r) => r.id === targetRowId);
            if (!targetRow) continue;
            const currentLinks = String(targetRow.cells[reverseColId] ?? '')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
            if (!currentLinks.includes(rowId)) {
              const next = [...currentLinks, rowId].join(',');
              updateCellInDoc(doc, targetSheetId, targetRowId, reverseColId, next);
            }
          }
          // 제거된 target row 의 reverse 컬럼에서 현재 rowId 제거
          for (const targetRowId of removed) {
            const targetRow = targetSheet.rows.find((r) => r.id === targetRowId);
            if (!targetRow) continue;
            const currentLinks = String(targetRow.cells[reverseColId] ?? '')
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
            const next = currentLinks.filter((x) => x !== rowId).join(',');
            updateCellInDoc(doc, targetSheetId, targetRowId, reverseColId, next);
          }
        });
        return;
      }
    }

    updateCellInDoc(doc, sheetId, rowId, columnId, value);
    recordChange();
  },

  updateCellStyle: (
    projectId: string,
    sheetId: string,
    rowId: string,
    columnId: string,
    style: Partial<CellStyle>
  ) => {
    // 기존 스타일과 기본값을 머지한 최종 스타일을 한 번에 Y.Doc 에 설정
    const existing =
      get().getCellStyle(projectId, sheetId, rowId, columnId) ?? {};
    const merged: CellStyle = { ...DEFAULT_CELL_STYLE, ...existing, ...style };
    updateCellStyleInDoc(getProjectDoc(projectId), sheetId, rowId, columnId, merged);
  },

  updateCellsStyle: (
    projectId: string,
    sheetId: string,
    cells: Array<{ rowId: string; columnId: string }>,
    style: Partial<CellStyle>
  ) => {
    const targets = cells.map(({ rowId, columnId }) => {
      const existing =
        get().getCellStyle(projectId, sheetId, rowId, columnId) ?? {};
      const merged: CellStyle = { ...DEFAULT_CELL_STYLE, ...existing, ...style };
      return { rowId, columnId, style: merged };
    });
    updateCellsStyleInDoc(getProjectDoc(projectId), sheetId, targets);
  },

  getCellStyle: (
    projectId: string,
    sheetId: string,
    rowId: string,
    columnId: string
  ): CellStyle | undefined => {
    const project = get().projects.find((p) => p.id === projectId);
    const sheet = project?.sheets.find((s) => s.id === sheetId);
    const row = sheet?.rows.find((r) => r.id === rowId);
    return row?.cellStyles?.[columnId];
  },

  deleteRow: (projectId: string, sheetId: string, rowId: string) => {
    deleteRowInDoc(getProjectDoc(projectId), sheetId, rowId);
  },

  reorderRow: (projectId: string, sheetId: string, rowId: string, targetIndex: number) => {
    reorderRowInDoc(getProjectDoc(projectId), sheetId, rowId, targetIndex);
  },

  addMultipleRows: (projectId: string, sheetId: string, count: number) => {
    const sheet = get().getSheet(projectId, sheetId);
    const formulaCells: Record<string, CellValue> = {};
    sheet?.columns.forEach((col) => {
      if (col.type === 'formula' && col.formula) {
        formulaCells[col.id] = col.formula;
      }
    });

    const newRows: Row[] = Array.from({ length: count }, () => ({
      id: uuidv4(),
      cells: { ...formulaCells },
    }));

    addMultipleRowsInDoc(getProjectDoc(projectId), sheetId, newRows);
  },

  // ==== 스티커 ====

  addSticker: (
    projectId: string,
    sheetId: string,
    sticker: Omit<Sticker, 'id' | 'createdAt'>
  ): string => {
    const id = uuidv4();
    addStickerInDoc(getProjectDoc(projectId), sheetId, {
      ...sticker,
      id,
      createdAt: Date.now(),
    });
    return id;
  },

  updateSticker: (
    projectId: string,
    sheetId: string,
    stickerId: string,
    updates: Partial<Sticker>
  ) => {
    updateStickerInDoc(getProjectDoc(projectId), sheetId, stickerId, updates);
  },

  deleteSticker: (projectId: string, sheetId: string, stickerId: string) => {
    deleteStickerInDoc(getProjectDoc(projectId), sheetId, stickerId);
  },
});
