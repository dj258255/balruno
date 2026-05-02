import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { Sheet, CellValue } from '@/types';
import { useProjectStore } from '@/stores/projectStore';
import type { CellPosition, ColBounds, RowBounds } from '../types';
import { rafThrottle, cellKey } from '../utils';

interface UseSheetDragProps {
  projectId: string;
  sheet: Sheet;
  selectedCell: CellPosition | null;
  selectedCells: CellPosition[];
  setSelectedCell: (cell: CellPosition | null) => void;
  setSelectedCells: (cells: CellPosition[]) => void;
  setFormulaBarValue: (value: string) => void;
  calculateDragSelection: (start: CellPosition, end: CellPosition) => CellPosition[];
  tableContainerRef: React.RefObject<HTMLDivElement | null>;
  columnWidths: Record<string, number>;
  rowHeights: Record<string, number>;
  headerHeight: number;
}

export function useSheetDrag({
  projectId,
  sheet,
  selectedCell,
  selectedCells,
  setSelectedCell,
  setSelectedCells,
  setFormulaBarValue,
  calculateDragSelection,
  tableContainerRef,
  columnWidths,
  rowHeights,
  headerHeight,
}: UseSheetDragProps) {
  const { updateCell } = useProjectStore();

  // 채우기 핸들 상태
  const [isFillDragging, setIsFillDragging] = useState(false);
  const [fillPreviewCells, setFillPreviewCells] = useState<CellPosition[]>([]);
  const fillStartCellRef = useRef<CellPosition | null>(null);

  // 성능 최적화: O(1) 조회를 위한 Set
  const fillPreviewCellsSet = useMemo(
    () => new Set(fillPreviewCells.map(c => cellKey(c.rowId, c.columnId))),
    [fillPreviewCells]
  );

  // 셀 이동/복사 드래그 상태
  const [isMoveDragging, setIsMoveDragging] = useState(false);
  const [moveTargetCell, setMoveTargetCell] = useState<CellPosition | null>(null);
  const moveStartCellRef = useRef<{ rowId: string; columnId: string; value: CellValue } | null>(null);
  const [isCopyMode, setIsCopyMode] = useState(false);

  // 체크박스 드래그 선택 상태
  const [isCheckboxDragging, setIsCheckboxDragging] = useState(false);
  const checkboxDragModeRef = useRef<'select' | 'deselect' | null>(null);
  const lastDragRowIndexRef = useRef<number | null>(null);

  // 외부 드래그 선택 상태
  const [isExternalDragging, setIsExternalDragging] = useState(false);
  const externalDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const externalDragBoxRef = useRef<HTMLDivElement | null>(null);
  const pendingExternalSelectionRef = useRef<CellPosition[]>([]);
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const colBoundsRef = useRef<ColBounds[]>([]);
  const rowBoundsRef = useRef<RowBounds[]>([]);

  // 수식 내 행 참조 조정
  const adjustFormulaForRow = useCallback((formula: string, sourceRowIdx: number, targetRowIdx: number): string => {
    return formula;
  }, []);

  /**
   * 채우기 핸들 Pointer Down - 드래그 시작
   * Pointer Events로 마우스/터치/펜 통합 처리
   * 참고: https://javascript.info/pointer-events
   */
  const handleFillHandlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!selectedCell) return;

    // 터치 디바이스에서 포인터 캡처 (드래그 지원)
    if (e.pointerType === 'touch') {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }

    setIsFillDragging(true);
    fillStartCellRef.current = selectedCell;
    setFillPreviewCells([]);
  }, [selectedCell]);

  // 채우기 핸들 드래그 중
  const handleFillDragEnterThrottled = useMemo(
    () => rafThrottle((rowId: string, columnId: string) => {
      if (!fillStartCellRef.current) return;

      const startCell = fillStartCellRef.current;
      const startRowIdx = sheet.rows.findIndex(r => r.id === startCell.rowId);
      const startColIdx = sheet.columns.findIndex(c => c.id === startCell.columnId);
      const endRowIdx = sheet.rows.findIndex(r => r.id === rowId);
      const endColIdx = sheet.columns.findIndex(c => c.id === columnId);

      const previewCells: CellPosition[] = [];

      if (startColIdx === endColIdx) {
        const minRow = Math.min(startRowIdx, endRowIdx);
        const maxRow = Math.max(startRowIdx, endRowIdx);
        for (let ri = minRow; ri <= maxRow; ri++) {
          if (ri !== startRowIdx) {
            previewCells.push({
              rowId: sheet.rows[ri].id,
              columnId: startCell.columnId,
            });
          }
        }
      } else if (startRowIdx === endRowIdx) {
        const minCol = Math.min(startColIdx, endColIdx);
        const maxCol = Math.max(startColIdx, endColIdx);
        for (let ci = minCol; ci <= maxCol; ci++) {
          if (ci !== startColIdx) {
            previewCells.push({
              rowId: startCell.rowId,
              columnId: sheet.columns[ci].id,
            });
          }
        }
      } else {
        const minRow = Math.min(startRowIdx, endRowIdx);
        const maxRow = Math.max(startRowIdx, endRowIdx);
        const minCol = Math.min(startColIdx, endColIdx);
        const maxCol = Math.max(startColIdx, endColIdx);
        for (let ri = minRow; ri <= maxRow; ri++) {
          for (let ci = minCol; ci <= maxCol; ci++) {
            if (ri !== startRowIdx || ci !== startColIdx) {
              previewCells.push({
                rowId: sheet.rows[ri].id,
                columnId: sheet.columns[ci].id,
              });
            }
          }
        }
      }

      setFillPreviewCells(previewCells);
    }),
    [sheet.rows, sheet.columns]
  );

  const handleFillDragEnter = useCallback((rowId: string, columnId: string) => {
    if (!isFillDragging) return;
    handleFillDragEnterThrottled(rowId, columnId);
  }, [isFillDragging, handleFillDragEnterThrottled]);

  // 채우기 핸들 드래그 종료
  const handleFillDragEnd = useCallback(() => {
    if (!isFillDragging || !fillStartCellRef.current || fillPreviewCells.length === 0) {
      setIsFillDragging(false);
      setFillPreviewCells([]);
      fillStartCellRef.current = null;
      return;
    }

    const startCell = fillStartCellRef.current;
    const startRow = sheet.rows.find(r => r.id === startCell.rowId);
    const startRowIdx = sheet.rows.findIndex(r => r.id === startCell.rowId);

    if (!startRow) {
      setIsFillDragging(false);
      setFillPreviewCells([]);
      fillStartCellRef.current = null;
      return;
    }

    const sourceValue = startRow.cells[startCell.columnId];

    for (const targetCell of fillPreviewCells) {
      const targetRow = sheet.rows.find(r => r.id === targetCell.rowId);
      const targetCol = sheet.columns.find(c => c.id === targetCell.columnId);
      const targetRowIdx = sheet.rows.findIndex(r => r.id === targetCell.rowId);

      if (!targetRow || !targetCol) continue;
      if (targetCol.locked || targetRow.locked) continue;

      let valueToSet: CellValue = sourceValue;

      if (typeof sourceValue === 'string' && sourceValue.startsWith('=')) {
        valueToSet = adjustFormulaForRow(sourceValue, startRowIdx, targetRowIdx);
      }

      updateCell(projectId, sheet.id, targetCell.rowId, targetCell.columnId, valueToSet);
    }

    setSelectedCells([{ rowId: startCell.rowId, columnId: startCell.columnId }, ...fillPreviewCells]);
    setIsFillDragging(false);
    setFillPreviewCells([]);
    fillStartCellRef.current = null;
  }, [isFillDragging, fillPreviewCells, sheet.rows, sheet.columns, projectId, sheet.id, updateCell, adjustFormulaForRow, setSelectedCells]);

  /**
   * 채우기 드래그 전역 이벤트
   * Pointer Events로 마우스/터치/펜 통합 처리
   * 편집 중에는 CellEditor가 셀을 덮어서 onPointerEnter가 발생하지 않으므로
   * 전역 pointermove로 포인터 아래 셀을 찾아서 처리
   */
  useEffect(() => {
    if (!isFillDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!tableContainerRef.current) return;

      // 포인터 위치에서 셀 요소 찾기
      const elementsUnderPointer = document.elementsFromPoint(e.clientX, e.clientY);
      const cellElement = elementsUnderPointer.find(el => el.hasAttribute('data-cell-id'));

      if (cellElement) {
        const cellId = cellElement.getAttribute('data-cell-id');
        if (cellId) {
          // cellKey 형식: "rowId:columnId"
          const [rowId, columnId] = cellId.split(':');
          if (rowId && columnId) {
            handleFillDragEnterThrottled(rowId, columnId);
          }
        }
      }
    };

    const handlePointerUp = () => {
      handleFillDragEnd();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isFillDragging, handleFillDragEnd, handleFillDragEnterThrottled, tableContainerRef]);

  // 셀 이동 드래그 시작
  const handleMoveStart = useCallback((rowId: string, columnId: string, e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if (isFillDragging) return;

    const row = sheet.rows.find(r => r.id === rowId);
    const col = sheet.columns.find(c => c.id === columnId);
    if (!row || !col) return;
    if (col.locked || row.locked) return;

    const value = row.cells[columnId];

    setIsMoveDragging(true);
    moveStartCellRef.current = { rowId, columnId, value };
    setMoveTargetCell(null);
  }, [isFillDragging, sheet.rows, sheet.columns]);

  // 셀 이동 드래그 중
  const handleMoveDragEnter = useCallback((rowId: string, columnId: string) => {
    if (!isMoveDragging || !moveStartCellRef.current) return;

    if (rowId === moveStartCellRef.current.rowId && columnId === moveStartCellRef.current.columnId) {
      setMoveTargetCell(null);
      return;
    }

    const targetRow = sheet.rows.find(r => r.id === rowId);
    const targetCol = sheet.columns.find(c => c.id === columnId);

    if (!targetRow || !targetCol || targetCol.locked || targetRow.locked) {
      setMoveTargetCell(null);
      return;
    }

    setMoveTargetCell({ rowId, columnId });
  }, [isMoveDragging, sheet.rows, sheet.columns]);

  // 셀 이동/복사 드래그 완료
  // Handsontable 패턴: 드래그가 같은 셀에서 끝나거나 타겟이 없으면 아무것도 하지 않음
  const handleMoveDragEnd = useCallback((ctrlKey: boolean = false) => {
    if (!isMoveDragging || !moveStartCellRef.current) {
      setIsMoveDragging(false);
      setMoveTargetCell(null);
      setIsCopyMode(false);
      moveStartCellRef.current = null;
      return;
    }

    // 타겟 셀이 있고, 시작 셀과 다른 경우에만 이동/복사 수행
    if (moveTargetCell) {
      const startCell = moveStartCellRef.current;

      updateCell(projectId, sheet.id, moveTargetCell.rowId, moveTargetCell.columnId, startCell.value);

      if (!ctrlKey && !isCopyMode) {
        updateCell(projectId, sheet.id, startCell.rowId, startCell.columnId, '');
      }

      setSelectedCell({ rowId: moveTargetCell.rowId, columnId: moveTargetCell.columnId });
      setSelectedCells([{ rowId: moveTargetCell.rowId, columnId: moveTargetCell.columnId }]);
    }
    // 타겟이 없으면 (같은 셀에서 끝났거나 드래그가 취소됨) 기존 선택 유지
    // 선택 해제하지 않음 - Google Sheets/Handsontable 동작과 일치

    setIsMoveDragging(false);
    setMoveTargetCell(null);
    setIsCopyMode(false);
    moveStartCellRef.current = null;
  }, [isMoveDragging, moveTargetCell, isCopyMode, projectId, sheet.id, updateCell, setSelectedCell, setSelectedCells]);

  /**
   * 이동/복사 드래그 전역 이벤트
   * Pointer Events로 마우스/터치/펜 통합 처리
   */
  useEffect(() => {
    const handlePointerUp = (e: PointerEvent) => {
      if (isMoveDragging) {
        handleMoveDragEnd(e.ctrlKey || e.metaKey);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isMoveDragging && (e.key === 'Control' || e.key === 'Meta')) {
        setIsCopyMode(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (isMoveDragging && (e.key === 'Control' || e.key === 'Meta')) {
        setIsCopyMode(false);
      }
    };

    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isMoveDragging, handleMoveDragEnd]);

  /**
   * 체크박스 드래그 종료
   * Pointer Events로 마우스/터치/펜 통합 처리
   */
  useEffect(() => {
    if (!isCheckboxDragging) return;

    const handlePointerUp = () => {
      setIsCheckboxDragging(false);
      checkboxDragModeRef.current = null;
      lastDragRowIndexRef.current = null;
    };

    document.addEventListener('pointerup', handlePointerUp);
    return () => document.removeEventListener('pointerup', handlePointerUp);
  }, [isCheckboxDragging]);

  return {
    // 채우기 상태
    isFillDragging,
    fillPreviewCells,
    fillPreviewCellsSet,
    handleFillHandlePointerDown,
    handleFillDragEnter,

    // 이동 상태
    isMoveDragging,
    moveTargetCell,
    moveStartCellRef,
    isCopyMode,
    handleMoveStart,
    handleMoveDragEnter,

    // 체크박스 드래그 상태
    isCheckboxDragging,
    setIsCheckboxDragging,
    checkboxDragModeRef,
    lastDragRowIndexRef,

    // 외부 드래그 상태
    isExternalDragging,
    setIsExternalDragging,
    externalDragStartRef,
    externalDragBoxRef,
    pendingExternalSelectionRef,
    lastMousePosRef,
    rafIdRef,
    colBoundsRef,
    rowBoundsRef,
  };
}
