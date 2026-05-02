import { useCallback, useEffect, useRef } from 'react';
import type { Sheet } from '@/types';
import type { CellPosition } from '../types';

interface UseSheetKeyboardProps {
  sheet: Sheet;
  editingCell: CellPosition | null;
  selectedCell: CellPosition | null;
  selectedCells: CellPosition[];
  copySelectedCells: () => void;
  pasteToSelectedCells: () => void;
  clearSelectedCells: () => void;
  selectAllCells: () => void;
  selectColumn: (columnId: string) => void;
  selectRow: (rowId: string) => void;
  startEditing: (rowId: string, columnId: string) => void;
  setSelectedCells: (cells: CellPosition[]) => void;
  setSelectedCell: (cell: CellPosition | null) => void;
  setEditingCell: (cell: CellPosition | null) => void;
  setEditValue: (value: string) => void;
  setFormulaBarValue: (value: string) => void;
  hiddenInputRef: React.RefObject<HTMLInputElement | null>;
  selectCellByIndex: (ri: number, ci: number, extend?: boolean) => void;
  extendSelection: (ri: number, ci: number) => void;
  selector: { ri: number; ci: number; range: { eri: number; eci: number } } | null;
}

export function useSheetKeyboard({
  sheet,
  editingCell,
  selectedCell,
  selectedCells,
  copySelectedCells,
  pasteToSelectedCells,
  clearSelectedCells,
  selectAllCells,
  selectColumn,
  selectRow,
  startEditing,
  setSelectedCells,
  setSelectedCell,
  setEditingCell,
  setEditValue,
  setFormulaBarValue,
  hiddenInputRef,
  selectCellByIndex,
  extendSelection,
  selector,
}: UseSheetKeyboardProps) {
  const isComposingRef = useRef(false);

  // 데이터가 있는 셀의 경계 찾기 (Ctrl+Arrow용)
  const findEdge = useCallback((
    startRi: number,
    startCi: number,
    direction: 'up' | 'down' | 'left' | 'right'
  ): { ri: number; ci: number } => {
    const rows = sheet.rows;
    const cols = sheet.columns;
    let ri = startRi;
    let ci = startCi;

    const hasValue = (r: number, c: number) => {
      if (r < 0 || r >= rows.length || c < 0 || c >= cols.length) return false;
      const val = rows[r]?.cells[cols[c]?.id];
      return val !== null && val !== undefined && val !== '';
    };

    const currentHasValue = hasValue(ri, ci);

    switch (direction) {
      case 'up':
        if (currentHasValue) {
          // 값이 있으면 값이 없는 곳까지 이동
          while (ri > 0 && hasValue(ri - 1, ci)) ri--;
        } else {
          // 값이 없으면 다음 값이 있는 곳까지 이동
          while (ri > 0 && !hasValue(ri - 1, ci)) ri--;
        }
        if (ri === startRi && ri > 0) ri = 0;
        break;
      case 'down':
        if (currentHasValue) {
          while (ri < rows.length - 1 && hasValue(ri + 1, ci)) ri++;
        } else {
          while (ri < rows.length - 1 && !hasValue(ri + 1, ci)) ri++;
        }
        if (ri === startRi && ri < rows.length - 1) ri = rows.length - 1;
        break;
      case 'left':
        if (currentHasValue) {
          while (ci > 0 && hasValue(ri, ci - 1)) ci--;
        } else {
          while (ci > 0 && !hasValue(ri, ci - 1)) ci--;
        }
        if (ci === startCi && ci > 0) ci = 0;
        break;
      case 'right':
        if (currentHasValue) {
          while (ci < cols.length - 1 && hasValue(ri, ci + 1)) ci++;
        } else {
          while (ci < cols.length - 1 && !hasValue(ri, ci + 1)) ci++;
        }
        if (ci === startCi && ci < cols.length - 1) ci = cols.length - 1;
        break;
    }

    return { ri, ci };
  }, [sheet.rows, sheet.columns]);

  // 전역 키보드 이벤트
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.target === hiddenInputRef.current) {
        return;
      }

      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (editingCell) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl/Cmd + C: 복사
      if (ctrlOrCmd && e.key === 'c') {
        if (selectedCells.length > 0) {
          e.preventDefault();
          copySelectedCells();
        }
      }
      // Ctrl/Cmd + V: 붙여넣기
      else if (ctrlOrCmd && e.key === 'v') {
        if (selectedCell) {
          e.preventDefault();
          pasteToSelectedCells();
        }
      }
      // Ctrl/Cmd + A: 전체 선택/해제 토글
      else if (ctrlOrCmd && e.key === 'a') {
        e.preventDefault();
        const allCellsCount = sheet.rows.length * sheet.columns.length;
        const allCellsSelected = allCellsCount > 0 && selectedCells.length === allCellsCount;

        if (allCellsSelected) {
          setSelectedCells([]);
          setSelectedCell(null);
        } else {
          selectAllCells();
        }
      }
      // Ctrl + Space: 열 전체 선택 (Google Sheets)
      else if (ctrlOrCmd && e.key === ' ' && selectedCell) {
        e.preventDefault();
        selectColumn(selectedCell.columnId);
      }
      // Shift + Space: 행 전체 선택 (Google Sheets)
      else if (e.shiftKey && e.key === ' ' && selectedCell && !ctrlOrCmd) {
        e.preventDefault();
        selectRow(selectedCell.rowId);
      }
      // Delete 또는 Backspace: 선택된 셀 내용 삭제
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedCells.length > 0) {
          e.preventDefault();
          clearSelectedCells();
        }
      }
      // F2 또는 Enter: 편집 모드 진입
      else if ((e.key === 'F2' || e.key === 'Enter') && selectedCell) {
        e.preventDefault();
        startEditing(selectedCell.rowId, selectedCell.columnId);
      }
      // Tab: 오른쪽으로 이동, Shift+Tab: 왼쪽으로 이동
      else if (e.key === 'Tab' && selectedCell) {
        e.preventDefault();
        const currentRowIndex = sheet.rows.findIndex(r => r.id === selectedCell.rowId);
        const currentColIndex = sheet.columns.findIndex(c => c.id === selectedCell.columnId);

        if (e.shiftKey) {
          // Shift+Tab: 왼쪽으로
          if (currentColIndex > 0) {
            selectCellByIndex(currentRowIndex, currentColIndex - 1, false);
          } else if (currentRowIndex > 0) {
            // 이전 행의 마지막 열로
            selectCellByIndex(currentRowIndex - 1, sheet.columns.length - 1, false);
          }
        } else {
          // Tab: 오른쪽으로
          if (currentColIndex < sheet.columns.length - 1) {
            selectCellByIndex(currentRowIndex, currentColIndex + 1, false);
          } else if (currentRowIndex < sheet.rows.length - 1) {
            // 다음 행의 첫 열로
            selectCellByIndex(currentRowIndex + 1, 0, false);
          }
        }
      }
      // Home: 현재 행의 첫 번째 셀로
      else if (e.key === 'Home' && selectedCell && !ctrlOrCmd && !e.shiftKey) {
        e.preventDefault();
        const currentRowIndex = sheet.rows.findIndex(r => r.id === selectedCell.rowId);
        selectCellByIndex(currentRowIndex, 0, false);
      }
      // End: 현재 행의 마지막 셀로
      else if (e.key === 'End' && selectedCell && !ctrlOrCmd && !e.shiftKey) {
        e.preventDefault();
        const currentRowIndex = sheet.rows.findIndex(r => r.id === selectedCell.rowId);
        selectCellByIndex(currentRowIndex, sheet.columns.length - 1, false);
      }
      // Ctrl+Home: 첫 번째 셀 (A1)로
      else if (e.key === 'Home' && selectedCell && ctrlOrCmd) {
        e.preventDefault();
        if (e.shiftKey) {
          extendSelection(0, 0);
        } else {
          selectCellByIndex(0, 0, false);
        }
      }
      // Ctrl+End: 마지막 셀로
      else if (e.key === 'End' && selectedCell && ctrlOrCmd) {
        e.preventDefault();
        const lastRi = sheet.rows.length - 1;
        const lastCi = sheet.columns.length - 1;
        if (e.shiftKey) {
          extendSelection(lastRi, lastCi);
        } else {
          selectCellByIndex(lastRi, lastCi, false);
        }
      }
      // Shift+Home: 행 시작까지 선택
      else if (e.key === 'Home' && selectedCell && selector && e.shiftKey && !ctrlOrCmd) {
        e.preventDefault();
        extendSelection(selector.range.eri, 0);
      }
      // Shift+End: 행 끝까지 선택
      else if (e.key === 'End' && selectedCell && selector && e.shiftKey && !ctrlOrCmd) {
        e.preventDefault();
        extendSelection(selector.range.eri, sheet.columns.length - 1);
      }
      // 방향키: 선택 셀 이동
      else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();

        // 선택된 셀이 없으면 첫 번째 셀 선택
        if (!selectedCell || !selector) {
          selectCellByIndex(0, 0, false);
          return;
        }

        const currentRowIndex = sheet.rows.findIndex(r => r.id === selectedCell.rowId);
        const currentColIndex = sheet.columns.findIndex(c => c.id === selectedCell.columnId);
        const currentEndRi = selector.range.eri;
        const currentEndCi = selector.range.eci;

        const direction = e.key === 'ArrowUp' ? 'up'
          : e.key === 'ArrowDown' ? 'down'
          : e.key === 'ArrowLeft' ? 'left'
          : 'right';

        // Ctrl+Shift+방향키: 데이터 경계까지 선택 확장
        if (ctrlOrCmd && e.shiftKey) {
          const edge = findEdge(currentEndRi, currentEndCi, direction);
          extendSelection(edge.ri, edge.ci);
        }
        // Ctrl+방향키: 데이터 경계까지 점프
        else if (ctrlOrCmd) {
          const edge = findEdge(currentRowIndex, currentColIndex, direction);
          selectCellByIndex(edge.ri, edge.ci, false);
        }
        // Shift+방향키: 범위 확장 (현재 선택 범위의 끝점 기준)
        else if (e.shiftKey) {
          let newEndRi = currentEndRi;
          let newEndCi = currentEndCi;

          switch (e.key) {
            case 'ArrowUp':
              newEndRi = Math.max(0, currentEndRi - 1);
              break;
            case 'ArrowDown':
              newEndRi = Math.min(sheet.rows.length - 1, currentEndRi + 1);
              break;
            case 'ArrowLeft':
              newEndCi = Math.max(0, currentEndCi - 1);
              break;
            case 'ArrowRight':
              newEndCi = Math.min(sheet.columns.length - 1, currentEndCi + 1);
              break;
          }

          if (newEndRi !== currentEndRi || newEndCi !== currentEndCi) {
            extendSelection(newEndRi, newEndCi);
          }
        }
        // 일반 방향키: 단일 셀 이동
        else {
          let newRowIndex = currentRowIndex;
          let newColIndex = currentColIndex;

          switch (e.key) {
            case 'ArrowUp':
              newRowIndex = Math.max(0, currentRowIndex - 1);
              break;
            case 'ArrowDown':
              newRowIndex = Math.min(sheet.rows.length - 1, currentRowIndex + 1);
              break;
            case 'ArrowLeft':
              newColIndex = Math.max(0, currentColIndex - 1);
              break;
            case 'ArrowRight':
              newColIndex = Math.min(sheet.columns.length - 1, currentColIndex + 1);
              break;
          }

          if (newRowIndex !== currentRowIndex || newColIndex !== currentColIndex) {
            selectCellByIndex(newRowIndex, newColIndex, false);
          }
        }
      }
      // 일반 문자 입력 시 편집 모드 진입
      else if (
        selectedCell &&
        e.key.length === 1 &&
        !ctrlOrCmd &&
        !e.altKey
      ) {
        const row = sheet.rows.find((r) => r.id === selectedCell.rowId);
        const column = sheet.columns.find((c) => c.id === selectedCell.columnId);
        if (column?.locked || row?.locked) return;

        // IME가 아닌 일반 문자 입력 시 바로 편집 모드로 진입
        if (!e.isComposing && e.keyCode !== 229) {
          e.preventDefault();
          setEditingCell({ rowId: selectedCell.rowId, columnId: selectedCell.columnId });
          setEditValue(e.key);
          setFormulaBarValue(e.key);
        } else if (hiddenInputRef.current) {
          // IME 입력 시 hiddenInput 사용
          hiddenInputRef.current.value = '';
          hiddenInputRef.current.focus();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [editingCell, selectedCells, selectedCell, copySelectedCells, pasteToSelectedCells, clearSelectedCells, selectAllCells, selectColumn, selectRow, sheet.rows, sheet.columns, startEditing, setSelectedCells, setSelectedCell, hiddenInputRef, selectCellByIndex, extendSelection, selector, findEdge]);

  // 숨겨진 input 핸들러 (IME 입력 처리)
  const handleHiddenInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isComposingRef.current && selectedCell && !editingCell) {
      const value = e.target.value;
      if (value) {
        setEditingCell({ rowId: selectedCell.rowId, columnId: selectedCell.columnId });
        setEditValue(value);
        setFormulaBarValue(value);
        e.target.value = '';
      }
    }
  }, [selectedCell, editingCell, setEditingCell, setEditValue, setFormulaBarValue]);

  const handleHiddenInputCompositionStart = useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const handleHiddenInputCompositionEnd = useCallback((e: React.CompositionEvent<HTMLInputElement>) => {
    isComposingRef.current = false;
    if (selectedCell && !editingCell) {
      const value = e.currentTarget.value;
      if (value) {
        setEditingCell({ rowId: selectedCell.rowId, columnId: selectedCell.columnId });
        setEditValue(value);
        setFormulaBarValue(value);
        e.currentTarget.value = '';
      }
    }
  }, [selectedCell, editingCell, setEditingCell, setEditValue, setFormulaBarValue]);

  return {
    isComposingRef,
    handleHiddenInputChange,
    handleHiddenInputCompositionStart,
    handleHiddenInputCompositionEnd,
  };
}
