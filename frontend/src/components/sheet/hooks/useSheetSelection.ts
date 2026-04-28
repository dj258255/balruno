/**
 * useSheetSelection - 셀 선택 관리 훅
 *
 * x-spreadsheet의 Selector 패턴 적용:
 * - CellRange로 범위 표현 (sri, sci, eri, eci)
 * - 필요할 때만 개별 셀 순회
 * - O(1) 범위 포함 여부 확인
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import type { Sheet, Row, CellValue } from '@/types';
import { useProjectStore, type SelectedRowData } from '@/stores/projectStore';
import type { CellPosition, ClipboardData } from '../types';
import { CellRange, Selector } from '../core';

interface UseSheetSelectionProps {
  projectId: string;
  sheet: Sheet;
  computedRows: Record<string, CellValue>[];
}

export function useSheetSelection({ projectId, sheet, computedRows }: UseSheetSelectionProps) {
  const t = useTranslations('sheet');
  const {
    toggleRowSelection,
    selectedRows,
    cellSelectionMode,
    completeCellSelection,
    updateCell,
    addMultipleRows,
    addColumn,
  } = useProjectStore();

  // x-spreadsheet 패턴: Selector로 선택 관리 (null = 선택 없음)
  const [selector, setSelector] = useState<Selector | null>(null);
  const [formulaBarValue, setFormulaBarValue] = useState<string>('');

  // 드래그 상태
  const isDraggingRef = useRef(false);
  const dragStartCellRef = useRef<CellPosition | null>(null);
  const lastSelectedCellRef = useRef<CellPosition | null>(null);

  // 클립보드 데이터
  const [clipboardData, setClipboardData] = useState<ClipboardData | null>(null);

  // 시트 변경 시 선택 초기화
  useEffect(() => {
    setSelector(null);
    setFormulaBarValue('');
    lastSelectedCellRef.current = null;
    dragStartCellRef.current = null;
  }, [sheet.id]);

  // 현재 선택된 셀 위치 (CellPosition 형태로 변환)
  const selectedCell = useMemo<CellPosition | null>(() => {
    if (!selector) return null;
    const row = sheet.rows[selector.ri];
    const column = sheet.columns[selector.ci];
    if (!row || !column) return null;
    return { rowId: row.id, columnId: column.id };
  }, [selector, sheet.rows, sheet.columns]);

  // 선택된 셀 범위를 CellPosition 배열로 변환 (필요한 경우에만)
  const selectedCells = useMemo<CellPosition[]>(() => {
    if (!selector) return [];
    const cells: CellPosition[] = [];
    selector.range.each((ri, ci) => {
      const row = sheet.rows[ri];
      const column = sheet.columns[ci];
      if (row && column) {
        cells.push({ rowId: row.id, columnId: column.id });
      }
    });
    return cells;
  }, [selector, sheet.rows, sheet.columns]);

  // 행이 선택되었는지 확인
  const isRowSelected = useCallback((rowId: string) => {
    return selectedRows.some((r) => r.rowId === rowId);
  }, [selectedRows]);

  // 행 선택 토글
  const handleRowSelect = useCallback((row: Row) => {
    const nameCol = sheet.columns.find(
      (c) => c.name === '이름' || c.name === 'name' || c.name === 'Name'
    );
    const idCol = sheet.columns.find(
      (c) => c.name === 'ID' || c.name === 'id'
    );
    const rowName = nameCol
      ? String(row.cells[nameCol.id] || '')
      : idCol
        ? String(row.cells[idCol.id] || '')
        : row.id.slice(0, 8);

    const values: Record<string, number | string> = {};
    sheet.columns.forEach((col) => {
      const val = row.cells[col.id];
      if (val !== null && val !== undefined) {
        values[col.name] = typeof val === 'number' ? val : String(val);
      }
    });

    const rowData: SelectedRowData = {
      rowId: row.id,
      sheetId: sheet.id,
      sheetName: sheet.name,
      name: rowName,
      values,
    };

    toggleRowSelection(rowData);
  }, [sheet.columns, sheet.id, sheet.name, toggleRowSelection]);

  // 전체 선택/해제 토글
  const handleSelectAll = useCallback(() => {
    const allSelected = sheet.rows.every(row => isRowSelected(row.id));

    sheet.rows.forEach(row => {
      const currentlySelected = isRowSelected(row.id);
      if (allSelected) {
        if (currentlySelected) handleRowSelect(row);
      } else {
        if (!currentlySelected) handleRowSelect(row);
      }
    });
  }, [sheet.rows, isRowSelected, handleRowSelect]);

  // 셀이 선택되었는지 확인 - CellRange.includes() 사용 O(1)
  const isCellSelected = useCallback(
    (rowId: string, columnId: string) => {
      if (!selector) return false;
      const ri = sheet.rows.findIndex(r => r.id === rowId);
      const ci = sheet.columns.findIndex(c => c.id === columnId);
      if (ri === -1 || ci === -1) return false;
      return selector.range.includes(ri, ci);
    },
    [selector, sheet.rows, sheet.columns]
  );

  // 인덱스로 셀이 선택되었는지 확인 - 더 빠름
  const isCellSelectedByIndex = useCallback(
    (ri: number, ci: number) => {
      if (!selector) return false;
      return selector.range.includes(ri, ci);
    },
    [selector]
  );

  // 열이 선택 범위에 포함되는지 확인 (헤더 하이라이트용)
  const isColumnInSelection = useCallback(
    (columnId: string) => {
      if (!selector) return false;
      const ci = sheet.columns.findIndex(c => c.id === columnId);
      if (ci === -1) return false;
      return ci >= selector.range.sci && ci <= selector.range.eci;
    },
    [selector, sheet.columns]
  );

  // 행이 선택 범위에 포함되는지 확인 (행 헤더 하이라이트용)
  const isRowInSelection = useCallback(
    (rowId: string) => {
      if (!selector) return false;
      const ri = sheet.rows.findIndex(r => r.id === rowId);
      if (ri === -1) return false;
      return ri >= selector.range.sri && ri <= selector.range.eri;
    },
    [selector, sheet.rows]
  );

  // 인덱스로 열이 선택 범위에 포함되는지 확인 (더 빠름)
  const isColumnInSelectionByIndex = useCallback(
    (ci: number) => {
      if (!selector) return false;
      return ci >= selector.range.sci && ci <= selector.range.eci;
    },
    [selector]
  );

  // 인덱스로 행이 선택 범위에 포함되는지 확인 (더 빠름)
  const isRowInSelectionByIndex = useCallback(
    (ri: number) => {
      if (!selector) return false;
      return ri >= selector.range.sri && ri <= selector.range.eri;
    },
    [selector]
  );

  // 셀 선택 (클릭 시) - 다중 선택 지원
  const selectCell = useCallback(
    (rowId: string, columnId: string, e?: React.MouseEvent) => {
      const ri = sheet.rows.findIndex((r) => r.id === rowId);
      const ci = sheet.columns.findIndex((c) => c.id === columnId);
      if (ri === -1 || ci === -1) return;

      // 계산기/밸런스분석 셀 선택 모드 처리
      if (cellSelectionMode.active) {
        const computedValue = computedRows[ri]?.[columnId];
        const rawValue = computedValue ?? sheet.rows[ri]?.cells[columnId];
        const numValue = typeof rawValue === 'number' ? rawValue : parseFloat(String(rawValue));
        // value, rowId, columnId 모두 전달
        completeCellSelection(isNaN(numValue) ? 0 : numValue, rowId, columnId);
        return;
      }

      const newCell = { rowId, columnId };

      // Shift+클릭: 범위 선택
      if (e?.shiftKey && lastSelectedCellRef.current) {
        setSelector((prev) => {
          if (!prev) return new Selector(ri, ci);
          const s = prev.clone();
          s.setEnd(ri, ci);
          return s;
        });
      }
      // Ctrl/Cmd+클릭: 현재는 범위 선택만 지원 (다중 비연속 범위는 복잡)
      // TODO: 다중 비연속 범위 지원 시 CellRange 배열로 확장
      else if (e?.ctrlKey || e?.metaKey) {
        // 토글 로직: 이미 선택된 셀이면 해제, 아니면 추가
        // 단순화: 새 셀로 단일 선택
        setSelector(new Selector(ri, ci));
        lastSelectedCellRef.current = newCell;
      }
      // 일반 클릭: 단일 선택
      else {
        setSelector(new Selector(ri, ci));
        lastSelectedCellRef.current = newCell;
      }

      // 원본 값을 수식 바에 표시
      const row = sheet.rows[ri];
      const rawValue = row?.cells[columnId];
      setFormulaBarValue(rawValue?.toString() || '');
    },
    [sheet.rows, sheet.columns, cellSelectionMode.active, completeCellSelection, computedRows, selector]
  );

  // 선택 해제
  const clearSelection = useCallback(() => {
    setSelector(null);
    setFormulaBarValue('');
    lastSelectedCellRef.current = null;
  }, []);

  // 인덱스로 셀 선택
  const selectCellByIndex = useCallback(
    (ri: number, ci: number, extend = false) => {
      if (ri < 0 || ri >= sheet.rows.length || ci < 0 || ci >= sheet.columns.length) return;

      if (extend && selector) {
        setSelector((prev) => {
          if (!prev) return new Selector(ri, ci);
          const s = prev.clone();
          s.setEnd(ri, ci);
          return s;
        });
      } else {
        setSelector(new Selector(ri, ci));
        const row = sheet.rows[ri];
        const column = sheet.columns[ci];
        if (row && column) {
          lastSelectedCellRef.current = { rowId: row.id, columnId: column.id };
          const rawValue = row.cells[column.id];
          setFormulaBarValue(rawValue?.toString() || '');
        }
      }
    },
    [sheet.rows, sheet.columns, selector]
  );

  // 드래그로 범위 선택 계산 (구 API 호환)
  const calculateDragSelection = useCallback(
    (startCell: CellPosition, endCell: CellPosition): CellPosition[] => {
      const startRowIdx = sheet.rows.findIndex((r) => r.id === startCell.rowId);
      const endRowIdx = sheet.rows.findIndex((r) => r.id === endCell.rowId);
      const startColIdx = sheet.columns.findIndex((c) => c.id === startCell.columnId);
      const endColIdx = sheet.columns.findIndex((c) => c.id === endCell.columnId);

      const range = CellRange.fromPoints(startRowIdx, startColIdx, endRowIdx, endColIdx);
      const cells: CellPosition[] = [];
      range.each((ri, ci) => {
        cells.push({
          rowId: sheet.rows[ri].id,
          columnId: sheet.columns[ci].id,
        });
      });
      return cells;
    },
    [sheet.rows, sheet.columns]
  );

  // 범위 확장 (드래그용)
  const extendSelection = useCallback(
    (ri: number, ci: number) => {
      setSelector((prev) => {
        if (!prev) return new Selector(ri, ci);
        const s = prev.clone();
        s.setEnd(ri, ci);
        return s;
      });
    },
    []
  );

  // 선택된 셀들 복사 (Ctrl+C)
  const copySelectedCells = useCallback(() => {
    if (!selector) return;
    const range = selector.range;
    if (range.size === 0) return;

    const cells: { rowId: string; columnId: string; value: CellValue }[] = [];

    range.each((ri, ci) => {
      const row = sheet.rows[ri];
      const col = sheet.columns[ci];
      if (row && col) {
        cells.push({
          rowId: row.id,
          columnId: col.id,
          value: row.cells[col.id] ?? '',
        });
      }
    });

    setClipboardData({
      cells,
      bounds: {
        minRowIdx: range.sri,
        maxRowIdx: range.eri,
        minColIdx: range.sci,
        maxColIdx: range.eci,
      },
    });

    // 시스템 클립보드에도 텍스트로 복사
    const grid: string[][] = Array(range.rows)
      .fill(null)
      .map(() => Array(range.cols).fill(''));

    for (const cell of cells) {
      const rowIdx = sheet.rows.findIndex((r) => r.id === cell.rowId) - range.sri;
      const colIdx = sheet.columns.findIndex((c) => c.id === cell.columnId) - range.sci;
      if (rowIdx >= 0 && colIdx >= 0) {
        grid[rowIdx][colIdx] = cell.value?.toString() ?? '';
      }
    }

    const text = grid.map((row) => row.join('\t')).join('\n');
    navigator.clipboard?.writeText(text).catch(() => {});
  }, [selector, sheet.rows, sheet.columns]);

  // 선택된 셀들 지우기
  const clearSelectedCells = useCallback(() => {
    if (!selector) return;
    selector.range.each((ri, ci) => {
      const row = sheet.rows[ri];
      const col = sheet.columns[ci];
      // 잠금된 열이나 행은 지우지 않음
      if (row && col && !col.locked && !row.locked) {
        updateCell(projectId, sheet.id, row.id, col.id, '');
      }
    });
    setFormulaBarValue('');
  }, [selector, sheet.rows, sheet.columns, projectId, sheet.id, updateCell]);

  // 붙여넣기 (Ctrl+V)
  const pasteToSelectedCells = useCallback(async () => {
    if (!selectedCell || !selector) return;

    let clipboardText = '';
    try {
      if (navigator.clipboard) {
        clipboardText = await navigator.clipboard.readText();
      }
    } catch {
      // 클립보드 접근 실패
    }

    const startRowIdx = selector.ri;
    const startColIdx = selector.ci;

    if (clipboardText) {
      const rows = clipboardText.split('\n').map((line) => line.split('\t'));

      // 행 부족 시 자동 추가 — 데이터가 시트 끝을 넘치면 그만큼 행 batch 생성.
      // Y.Doc 의 transact 가 동기적이라 호출 직후 store getState 로 새 sheet 가져오면 갱신된 상태 OK.
      const neededRows = startRowIdx + rows.length - sheet.rows.length;
      if (neededRows > 0) {
        addMultipleRows(projectId, sheet.id, neededRows);
      }
      // 컬럼 부족 시 자동 추가 — 데이터에 맞춰 batch 생성. type='general' 로 시작 (사용자가 후속 변환).
      const widestRow = rows.reduce((m, r) => Math.max(m, r.length), 0);
      const colOverflow = Math.max(0, widestRow + startColIdx - sheet.columns.length);
      for (let i = 0; i < colOverflow; i++) {
        addColumn(projectId, sheet.id, {
          name: `Column ${sheet.columns.length + i + 1}`,
          type: 'general',
        });
      }

      // 갱신된 sheet snapshot — 새로 추가한 row + column 모두 포함
      const refreshed = useProjectStore
        .getState()
        .projects.find((p) => p.id === projectId)
        ?.sheets.find((s) => s.id === sheet.id);
      const targetRows = refreshed?.rows ?? sheet.rows;
      const targetColumns = refreshed?.columns ?? sheet.columns;

      for (let ri = 0; ri < rows.length; ri++) {
        const targetRowIdx = startRowIdx + ri;
        if (targetRowIdx >= targetRows.length) break;

        const targetRow = targetRows[targetRowIdx];

        for (let ci = 0; ci < rows[ri].length; ci++) {
          const targetColIdx = startColIdx + ci;
          if (targetColIdx >= targetColumns.length) break;

          const targetCol = targetColumns[targetColIdx];
          if (targetCol.locked || targetRow.locked) continue;

          let value: CellValue = rows[ri][ci];
          if (!value.toString().startsWith('=')) {
            const num = parseFloat(value.toString());
            if (!isNaN(num) && value.toString().trim() !== '') {
              value = num;
            }
          }

          updateCell(projectId, sheet.id, targetRow.id, targetCol.id, value);
        }
      }
      if (colOverflow > 0 && typeof window !== 'undefined') {
        // 자동 추가된 컬럼 수 안내
        window.dispatchEvent(
          new CustomEvent('balruno:toast', {
            detail: { kind: 'info', message: t('toastColumnsAdded', { count: colOverflow }) },
          }),
        );
      }

      // 붙여넣기 후 범위 선택
      const pastedRange = CellRange.fromPoints(
        startRowIdx,
        startColIdx,
        Math.min(startRowIdx + rows.length - 1, sheet.rows.length - 1),
        Math.min(startColIdx + (rows[0]?.length || 1) - 1, sheet.columns.length - 1)
      );
      setSelector((prev) => {
        const ri = prev?.ri ?? startRowIdx;
        const ci = prev?.ci ?? startColIdx;
        const s = new Selector(ri, ci);
        s.range = pastedRange;
        return s;
      });
    } else if (clipboardData) {
      const { bounds } = clipboardData;

      for (const cell of clipboardData.cells) {
        const srcRowIdx = sheet.rows.findIndex((r) => r.id === cell.rowId);
        const srcColIdx = sheet.columns.findIndex((c) => c.id === cell.columnId);

        const offsetRow = srcRowIdx - bounds.minRowIdx;
        const offsetCol = srcColIdx - bounds.minColIdx;

        const targetRowIdx = startRowIdx + offsetRow;
        const targetColIdx = startColIdx + offsetCol;

        if (targetRowIdx >= sheet.rows.length || targetColIdx >= sheet.columns.length) continue;

        const targetRow = sheet.rows[targetRowIdx];
        const targetCol = sheet.columns[targetColIdx];

        if (targetCol.locked || targetRow.locked) continue;

        updateCell(projectId, sheet.id, targetRow.id, targetCol.id, cell.value);
      }

      // 붙여넣기 후 범위 선택
      const pastedRange = CellRange.fromPoints(
        startRowIdx,
        startColIdx,
        Math.min(startRowIdx + (bounds.maxRowIdx - bounds.minRowIdx), sheet.rows.length - 1),
        Math.min(startColIdx + (bounds.maxColIdx - bounds.minColIdx), sheet.columns.length - 1)
      );
      setSelector((prev) => {
        const ri = prev?.ri ?? startRowIdx;
        const ci = prev?.ci ?? startColIdx;
        const s = new Selector(ri, ci);
        s.range = pastedRange;
        return s;
      });
    }
  }, [selectedCell, clipboardData, sheet.rows, sheet.columns, projectId, sheet.id, updateCell, selector]);

  // 잘라내기
  const cutSelectedCells = useCallback(() => {
    copySelectedCells();
    clearSelectedCells();
  }, [copySelectedCells, clearSelectedCells]);

  // 열 전체 선택 (열 헤더 클릭 시)
  const selectColumn = useCallback(
    (columnId: string) => {
      const ci = sheet.columns.findIndex((c) => c.id === columnId);
      if (ci === -1) return;

      // 첫 번째 행부터 마지막 행까지 선택
      const range = new CellRange(0, ci, sheet.rows.length - 1, ci);
      setSelector(() => {
        const s = new Selector(0, ci);
        s.range = range;
        return s;
      });

      // 첫 번째 셀의 값을 수식 바에 표시
      const firstRow = sheet.rows[0];
      if (firstRow) {
        const rawValue = firstRow.cells[columnId];
        setFormulaBarValue(rawValue?.toString() || '');
        lastSelectedCellRef.current = { rowId: firstRow.id, columnId };
      }
    },
    [sheet.columns, sheet.rows]
  );

  // 행 전체 선택 (행 번호 클릭 시)
  const selectRow = useCallback(
    (rowId: string) => {
      const ri = sheet.rows.findIndex((r) => r.id === rowId);
      if (ri === -1) return;

      // 첫 번째 열부터 마지막 열까지 선택
      const range = new CellRange(ri, 0, ri, sheet.columns.length - 1);
      setSelector(() => {
        const s = new Selector(ri, 0);
        s.range = range;
        return s;
      });

      // 첫 번째 셀의 값을 수식 바에 표시
      const firstCol = sheet.columns[0];
      if (firstCol) {
        const row = sheet.rows[ri];
        const rawValue = row?.cells[firstCol.id];
        setFormulaBarValue(rawValue?.toString() || '');
        lastSelectedCellRef.current = { rowId, columnId: firstCol.id };
      }
    },
    [sheet.rows, sheet.columns]
  );

  // 전체 셀 선택 (Ctrl+A / Cmd+A) - 토글 방식
  const selectAllCells = useCallback(() => {
    if (sheet.rows.length === 0 || sheet.columns.length === 0) return;

    // 이미 전체 선택 상태인지 확인
    const isAllSelected = selector?.range &&
      selector.range.sri === 0 &&
      selector.range.sci === 0 &&
      selector.range.eri === sheet.rows.length - 1 &&
      selector.range.eci === sheet.columns.length - 1;

    if (isAllSelected) {
      // 전체 선택 해제
      setSelector(null);
      setFormulaBarValue('');
      lastSelectedCellRef.current = null;
      return;
    }

    const range = new CellRange(0, 0, sheet.rows.length - 1, sheet.columns.length - 1);
    setSelector(() => {
      const s = new Selector(0, 0);
      s.range = range;
      return s;
    });

    // 첫 번째 셀 값을 수식 바에 표시
    const firstRow = sheet.rows[0];
    const firstCol = sheet.columns[0];
    if (firstRow && firstCol) {
      const rawValue = firstRow.cells[firstCol.id];
      setFormulaBarValue(rawValue?.toString() || '');
      lastSelectedCellRef.current = { rowId: firstRow.id, columnId: firstCol.id };
    }
  }, [sheet.rows, sheet.columns, selector]);

  // 선택 범위 직접 설정
  const setSelectionRange = useCallback((range: CellRange, anchorRi?: number, anchorCi?: number) => {
    setSelector(() => {
      const s = new Selector(anchorRi ?? range.sri, anchorCi ?? range.sci);
      s.range = range;
      return s;
    });
  }, []);

  // 구 API 호환: selectedCells 직접 설정
  const setSelectedCells = useCallback((cells: CellPosition[]) => {
    if (cells.length === 0) {
      setSelector(null);
      return;
    }

    // CellPosition 배열에서 범위 계산
    const rowIndices = cells.map((c) => sheet.rows.findIndex((r) => r.id === c.rowId));
    const colIndices = cells.map((c) => sheet.columns.findIndex((col) => col.id === c.columnId));

    const validRowIndices = rowIndices.filter((i) => i !== -1);
    const validColIndices = colIndices.filter((i) => i !== -1);

    if (validRowIndices.length === 0 || validColIndices.length === 0) return;

    const range = new CellRange(
      Math.min(...validRowIndices),
      Math.min(...validColIndices),
      Math.max(...validRowIndices),
      Math.max(...validColIndices)
    );

    const firstCell = cells[0];
    const anchorRi = sheet.rows.findIndex((r) => r.id === firstCell.rowId);
    const anchorCi = sheet.columns.findIndex((c) => c.id === firstCell.columnId);

    setSelectionRange(range, anchorRi, anchorCi);
  }, [sheet.rows, sheet.columns, setSelectionRange]);

  // 구 API 호환: selectedCell 직접 설정
  const setSelectedCell = useCallback((cell: CellPosition | null) => {
    if (!cell) {
      setSelector(null);
      return;
    }

    const ri = sheet.rows.findIndex((r) => r.id === cell.rowId);
    const ci = sheet.columns.findIndex((c) => c.id === cell.columnId);
    if (ri === -1 || ci === -1) return;

    setSelector(new Selector(ri, ci));
  }, [sheet.rows, sheet.columns]);

  return {
    // 상태
    selectedCell,
    selectedCells,
    selector,        // x-spreadsheet 패턴: Selector 객체 직접 접근
    formulaBarValue,
    clipboardData,

    // refs
    isDraggingRef,
    dragStartCellRef,
    lastSelectedCellRef,

    // setters (구 API 호환)
    setSelectedCell,
    setSelectedCells,
    setFormulaBarValue,

    // 새 API
    setSelectionRange,
    selectCellByIndex,
    extendSelection,

    // 핸들러
    isRowSelected,
    handleRowSelect,
    handleSelectAll,
    isCellSelected,
    isCellSelectedByIndex,  // 인덱스 기반 (더 빠름)
    isColumnInSelection,
    isRowInSelection,
    isColumnInSelectionByIndex,
    isRowInSelectionByIndex,
    selectCell,
    clearSelection,
    calculateDragSelection,
    copySelectedCells,
    clearSelectedCells,
    pasteToSelectedCells,
    cutSelectedCells,
    selectColumn,
    selectRow,
    selectAllCells,
  };
}
