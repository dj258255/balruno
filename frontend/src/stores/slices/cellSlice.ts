/**
 * Column + Row + Cell + Sticker actions slice.
 *
 * 시트 내부의 스키마(Column)와 데이터(Row, Cell), 서식(CellStyle),
 * 시각 보조(Sticker) 수준의 모든 변경 액션을 담당.
 */

import { v4 as uuidv4 } from 'uuid';
import type { StoreApi } from 'zustand';
import type { Column, Row, CellValue, CellStyle, Sticker } from '@/types';
import type { ProjectState } from '../projectStore';

type SetFn = StoreApi<ProjectState>['setState'];
type GetFn = StoreApi<ProjectState>['getState'];

// 기본 셀 스타일 — 스타일이 없는 셀에 적용되는 디폴트
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

export const createCellActions = (set: SetFn, get: GetFn) => ({
  // ==== 컬럼 ====

  addColumn: (projectId: string, sheetId: string, column: Omit<Column, 'id'>): string => {
    const id = uuidv4();
    const now = Date.now();

    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              sheets: p.sheets.map((s) =>
                s.id === sheetId
                  ? {
                      ...s,
                      columns: [...s.columns, { ...column, id }],
                      updatedAt: now,
                    }
                  : s
              ),
              updatedAt: now,
            }
          : p
      ),
    }));

    return id;
  },

  insertColumn: (
    projectId: string,
    sheetId: string,
    column: Omit<Column, 'id'>,
    atIndex: number
  ): string => {
    const id = uuidv4();
    const now = Date.now();

    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              sheets: p.sheets.map((s) =>
                s.id === sheetId
                  ? {
                      ...s,
                      columns: [
                        ...s.columns.slice(0, atIndex),
                        { ...column, id },
                        ...s.columns.slice(atIndex),
                      ],
                      updatedAt: now,
                    }
                  : s
              ),
              updatedAt: now,
            }
          : p
      ),
    }));

    return id;
  },

  updateColumn: (
    projectId: string,
    sheetId: string,
    columnId: string,
    updates: Partial<Column>
  ) => {
    const now = Date.now();
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              sheets: p.sheets.map((s) =>
                s.id === sheetId
                  ? {
                      ...s,
                      columns: s.columns.map((c) =>
                        c.id === columnId ? { ...c, ...updates } : c
                      ),
                      updatedAt: now,
                    }
                  : s
              ),
              updatedAt: now,
            }
          : p
      ),
    }));
  },

  deleteColumn: (projectId: string, sheetId: string, columnId: string) => {
    const now = Date.now();
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              sheets: p.sheets.map((s) =>
                s.id === sheetId
                  ? {
                      ...s,
                      columns: s.columns.filter((c) => c.id !== columnId),
                      rows: s.rows.map((r) => {
                        const newCells = { ...r.cells };
                        delete newCells[columnId];
                        return { ...r, cells: newCells };
                      }),
                      updatedAt: now,
                    }
                  : s
              ),
              updatedAt: now,
            }
          : p
      ),
    }));
  },

  reorderColumns: (projectId: string, sheetId: string, columnIds: string[]) => {
    const now = Date.now();
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              sheets: p.sheets.map((s) => {
                if (s.id !== sheetId) return s;
                const columnMap = new Map(s.columns.map((c) => [c.id, c]));
                const reorderedColumns = columnIds
                  .map((id) => columnMap.get(id))
                  .filter((c): c is Column => c !== undefined);
                return { ...s, columns: reorderedColumns, updatedAt: now };
              }),
              updatedAt: now,
            }
          : p
      ),
    }));
  },

  // ==== 행 ====

  addRow: (
    projectId: string,
    sheetId: string,
    cells: Record<string, CellValue> = {}
  ): string => {
    const id = uuidv4();
    const now = Date.now();

    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id !== projectId) return p;

        return {
          ...p,
          sheets: p.sheets.map((s) => {
            if (s.id !== sheetId) return s;

            // 수식 컬럼의 formula 자동 prefill
            const formulaCells: Record<string, CellValue> = {};
            s.columns.forEach((col) => {
              if (col.type === 'formula' && col.formula) {
                formulaCells[col.id] = col.formula;
              }
            });

            return {
              ...s,
              rows: [...s.rows, { id, cells: { ...formulaCells, ...cells } }],
              updatedAt: now,
            };
          }),
          updatedAt: now,
        };
      }),
    }));

    return id;
  },

  insertRow: (
    projectId: string,
    sheetId: string,
    atIndex: number,
    cells: Record<string, CellValue> = {}
  ): string => {
    const id = uuidv4();
    const now = Date.now();

    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id !== projectId) return p;

        return {
          ...p,
          sheets: p.sheets.map((s) => {
            if (s.id !== sheetId) return s;

            const formulaCells: Record<string, CellValue> = {};
            s.columns.forEach((col) => {
              if (col.type === 'formula' && col.formula) {
                formulaCells[col.id] = col.formula;
              }
            });

            return {
              ...s,
              rows: [
                ...s.rows.slice(0, atIndex),
                { id, cells: { ...formulaCells, ...cells } },
                ...s.rows.slice(atIndex),
              ],
              updatedAt: now,
            };
          }),
          updatedAt: now,
        };
      }),
    }));

    return id;
  },

  updateRow: (
    projectId: string,
    sheetId: string,
    rowId: string,
    updates: Partial<Row>
  ) => {
    const now = Date.now();
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              sheets: p.sheets.map((s) =>
                s.id === sheetId
                  ? {
                      ...s,
                      rows: s.rows.map((r) =>
                        r.id === rowId ? { ...r, ...updates } : r
                      ),
                      updatedAt: now,
                    }
                  : s
              ),
              updatedAt: now,
            }
          : p
      ),
    }));
  },

  updateCell: (
    projectId: string,
    sheetId: string,
    rowId: string,
    columnId: string,
    value: CellValue
  ) => {
    const now = Date.now();
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              sheets: p.sheets.map((s) =>
                s.id === sheetId
                  ? {
                      ...s,
                      rows: s.rows.map((r) =>
                        r.id === rowId
                          ? { ...r, cells: { ...r.cells, [columnId]: value } }
                          : r
                      ),
                      updatedAt: now,
                    }
                  : s
              ),
              updatedAt: now,
            }
          : p
      ),
    }));
  },

  updateCellStyle: (
    projectId: string,
    sheetId: string,
    rowId: string,
    columnId: string,
    style: Partial<CellStyle>
  ) => {
    const now = Date.now();
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              sheets: p.sheets.map((s) =>
                s.id === sheetId
                  ? {
                      ...s,
                      rows: s.rows.map((r) =>
                        r.id === rowId
                          ? {
                              ...r,
                              cellStyles: {
                                ...r.cellStyles,
                                // 기존 스타일이 없으면 기본값과 병합
                                [columnId]: {
                                  ...DEFAULT_CELL_STYLE,
                                  ...r.cellStyles?.[columnId],
                                  ...style,
                                },
                              },
                            }
                          : r
                      ),
                      updatedAt: now,
                    }
                  : s
              ),
              updatedAt: now,
            }
          : p
      ),
    }));
  },

  updateCellsStyle: (
    projectId: string,
    sheetId: string,
    cells: Array<{ rowId: string; columnId: string }>,
    style: Partial<CellStyle>
  ) => {
    const now = Date.now();
    const cellMap = new Map<string, Set<string>>();
    cells.forEach(({ rowId, columnId }) => {
      if (!cellMap.has(rowId)) cellMap.set(rowId, new Set());
      cellMap.get(rowId)!.add(columnId);
    });

    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              sheets: p.sheets.map((s) =>
                s.id === sheetId
                  ? {
                      ...s,
                      rows: s.rows.map((r) => {
                        const columnIds = cellMap.get(r.id);
                        if (!columnIds) return r;
                        const newCellStyles = { ...r.cellStyles };
                        columnIds.forEach((colId) => {
                          const existingStyle = newCellStyles[colId] || {};
                          newCellStyles[colId] = {
                            ...DEFAULT_CELL_STYLE,
                            ...existingStyle,
                            ...style,
                          };
                        });
                        return { ...r, cellStyles: newCellStyles };
                      }),
                      updatedAt: now,
                    }
                  : s
              ),
              updatedAt: now,
            }
          : p
      ),
    }));
  },

  getCellStyle: (
    projectId: string,
    sheetId: string,
    rowId: string,
    columnId: string
  ): CellStyle | undefined => {
    const state = get();
    const project = state.projects.find((p) => p.id === projectId);
    if (!project) return undefined;
    const sheet = project.sheets.find((s) => s.id === sheetId);
    if (!sheet) return undefined;
    const row = sheet.rows.find((r) => r.id === rowId);
    if (!row) return undefined;
    return row.cellStyles?.[columnId];
  },

  deleteRow: (projectId: string, sheetId: string, rowId: string) => {
    const now = Date.now();
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              sheets: p.sheets.map((s) =>
                s.id === sheetId
                  ? {
                      ...s,
                      rows: s.rows.filter((r) => r.id !== rowId),
                      updatedAt: now,
                    }
                  : s
              ),
              updatedAt: now,
            }
          : p
      ),
    }));
  },

  addMultipleRows: (projectId: string, sheetId: string, count: number) => {
    const now = Date.now();

    set((state) => ({
      projects: state.projects.map((p) => {
        if (p.id !== projectId) return p;

        return {
          ...p,
          sheets: p.sheets.map((s) => {
            if (s.id !== sheetId) return s;

            const formulaCells: Record<string, CellValue> = {};
            s.columns.forEach((col) => {
              if (col.type === 'formula' && col.formula) {
                formulaCells[col.id] = col.formula;
              }
            });

            const newRows: Row[] = Array.from({ length: count }, () => ({
              id: uuidv4(),
              cells: { ...formulaCells },
            }));

            return {
              ...s,
              rows: [...s.rows, ...newRows],
              updatedAt: now,
            };
          }),
          updatedAt: now,
        };
      }),
    }));
  },

  // ==== 스티커 ====

  addSticker: (
    projectId: string,
    sheetId: string,
    sticker: Omit<Sticker, 'id' | 'createdAt'>
  ): string => {
    const id = uuidv4();
    const now = Date.now();
    const newSticker = { ...sticker, id, createdAt: now };

    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              sheets: p.sheets.map((s) =>
                s.id === sheetId
                  ? {
                      ...s,
                      stickers: [...(s.stickers || []), newSticker],
                      updatedAt: now,
                    }
                  : s
              ),
              updatedAt: now,
            }
          : p
      ),
    }));

    return id;
  },

  updateSticker: (
    projectId: string,
    sheetId: string,
    stickerId: string,
    updates: Partial<Sticker>
  ) => {
    const now = Date.now();
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              sheets: p.sheets.map((s) =>
                s.id === sheetId
                  ? {
                      ...s,
                      stickers: (s.stickers || []).map((st) =>
                        st.id === stickerId ? { ...st, ...updates } : st
                      ),
                      updatedAt: now,
                    }
                  : s
              ),
              updatedAt: now,
            }
          : p
      ),
    }));
  },

  deleteSticker: (projectId: string, sheetId: string, stickerId: string) => {
    const now = Date.now();
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              sheets: p.sheets.map((s) =>
                s.id === sheetId
                  ? {
                      ...s,
                      stickers: (s.stickers || []).filter((st) => st.id !== stickerId),
                      updatedAt: now,
                    }
                  : s
              ),
              updatedAt: now,
            }
          : p
      ),
    }));
  },
});
