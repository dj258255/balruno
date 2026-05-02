import { useState, useCallback } from 'react';
import type { Sheet, Row, Column } from '@/types';
import { useProjectStore } from '@/stores/projectStore';
import type {
  CellPosition,
  ContextMenuState,
  ColumnContextMenuState,
  RowContextMenuState,
  ResizeContextMenuState,
  MemoModalState,
  MemoHoverState,
  DeleteColumnConfirmState,
} from '../types';

interface UseSheetContextMenuProps {
  projectId: string;
  sheet: Sheet;
  selectedCells: CellPosition[];
  setSelectedCell: (cell: CellPosition | null) => void;
  setSelectedCells: (cells: CellPosition[]) => void;
}

export function useSheetContextMenu({
  projectId,
  sheet,
  selectedCells,
  setSelectedCell,
  setSelectedCells,
}: UseSheetContextMenuProps) {
  const { insertRow, deleteRow, insertColumn, deleteColumn, updateRow } = useProjectStore();

  // 컨텍스트 메뉴 상태
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [columnContextMenu, setColumnContextMenu] = useState<ColumnContextMenuState | null>(null);
  const [rowContextMenu, setRowContextMenu] = useState<RowContextMenuState | null>(null);
  const [resizeContextMenu, setResizeContextMenu] = useState<ResizeContextMenuState | null>(null);

  // 메모 상태
  const [memoModal, setMemoModal] = useState<MemoModalState | null>(null);
  const [memoHover, setMemoHover] = useState<MemoHoverState | null>(null);

  // 삭제 확인 상태 (열만 - 행은 바로 삭제)
  const [deleteColumnConfirm, setDeleteColumnConfirm] = useState<DeleteColumnConfirmState | null>(null);

  // 컨텍스트 메뉴 열기
  const handleContextMenu = useCallback((
    e: React.MouseEvent,
    rowId: string,
    columnId: string,
    isRowNumberCell: boolean = false,
    isHeaderCell: boolean = false
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isRowNumberCell && !isHeaderCell) {
      const isInSelection = selectedCells.some(c => c.rowId === rowId && c.columnId === columnId);
      if (!isInSelection) {
        setSelectedCell({ rowId, columnId });
        setSelectedCells([{ rowId, columnId }]);
      }
    }

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      rowId,
      columnId,
      isRowNumberCell,
      isHeaderCell,
    });
  }, [selectedCells, setSelectedCell, setSelectedCells]);

  // 행 삽입 (위)
  const insertRowAbove = useCallback(() => {
    if (!contextMenu) return;
    const rowIdx = sheet.rows.findIndex(r => r.id === contextMenu.rowId);
    if (rowIdx === -1) return;
    insertRow(projectId, sheet.id, rowIdx);
    setContextMenu(null);
  }, [contextMenu, sheet.rows, projectId, sheet.id, insertRow]);

  // 행 삽입 (아래)
  const insertRowBelow = useCallback(() => {
    if (!contextMenu) return;
    const rowIdx = sheet.rows.findIndex(r => r.id === contextMenu.rowId);
    if (rowIdx === -1) return;
    insertRow(projectId, sheet.id, rowIdx + 1);
    setContextMenu(null);
  }, [contextMenu, sheet.rows, projectId, sheet.id, insertRow]);

  // 열 삽입 (왼쪽)
  const insertColumnLeft = useCallback(() => {
    if (!contextMenu) return;
    const colIdx = sheet.columns.findIndex(c => c.id === contextMenu.columnId);
    if (colIdx === -1) return;
    insertColumn(projectId, sheet.id, {
      name: `Column ${sheet.columns.length + 1}`,
      type: 'general',
    }, colIdx);
    setContextMenu(null);
  }, [contextMenu, sheet.columns, projectId, sheet.id, insertColumn]);

  // 열 삽입 (오른쪽)
  const insertColumnRight = useCallback(() => {
    if (!contextMenu) return;
    const colIdx = sheet.columns.findIndex(c => c.id === contextMenu.columnId);
    if (colIdx === -1) return;
    insertColumn(projectId, sheet.id, {
      name: `Column ${sheet.columns.length + 1}`,
      type: 'general',
    }, colIdx + 1);
    setContextMenu(null);
  }, [contextMenu, sheet.columns, projectId, sheet.id, insertColumn]);

  // 선택된 행 삭제 (바로 삭제, 모달 없이)
  const deleteSelectedRows = useCallback(() => {
    if (selectedCells.length === 0 && !contextMenu) return;

    const rowIds = new Set<string>();
    if (selectedCells.length > 0) {
      selectedCells.forEach(c => rowIds.add(c.rowId));
    } else if (contextMenu) {
      rowIds.add(contextMenu.rowId);
    }

    // 바로 삭제
    rowIds.forEach(rowId => {
      deleteRow(projectId, sheet.id, rowId);
    });

    setSelectedCells([]);
    setSelectedCell(null);
    setContextMenu(null);
  }, [selectedCells, contextMenu, projectId, sheet.id, deleteRow, setSelectedCell, setSelectedCells]);

  // 열 삭제
  const deleteSelectedColumn = useCallback(() => {
    if (!contextMenu) return;
    deleteColumn(projectId, sheet.id, contextMenu.columnId);
    setSelectedCells([]);
    setSelectedCell(null);
    setContextMenu(null);
  }, [contextMenu, projectId, sheet.id, deleteColumn, setSelectedCell, setSelectedCells]);

  return {
    // 상태
    contextMenu,
    columnContextMenu,
    rowContextMenu,
    resizeContextMenu,
    memoModal,
    memoHover,
    deleteColumnConfirm,

    // setters
    setContextMenu,
    setColumnContextMenu,
    setRowContextMenu,
    setResizeContextMenu,
    setMemoModal,
    setMemoHover,
    setDeleteColumnConfirm,

    // 핸들러
    handleContextMenu,
    insertRowAbove,
    insertRowBelow,
    insertColumnLeft,
    insertColumnRight,
    deleteSelectedRows,
    deleteSelectedColumn,
  };
}
