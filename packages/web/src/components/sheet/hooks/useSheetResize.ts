import { useState, useCallback, useEffect } from 'react';
import type { Sheet } from '@/types';
import { useProjectStore } from '@/stores/projectStore';
import { useSheetUIStore } from '@/stores/sheetUIStore';

interface UseSheetResizeProps {
  projectId: string;
  sheet: Sheet;
}

interface UseSheetResizeReturn {
  // 상태
  columnWidths: Record<string, number>;
  rowHeights: Record<string, number>;
  headerHeight: number;
  resizingColumn: string | null;
  resizingRow: string | null;
  resizingHeader: boolean;
  tableWidth: number;

  // 핸들러 - Pointer Events (마우스/터치/펜 통합)
  handleResizeStart: (columnId: string, e: React.PointerEvent) => void;
  handleRowResizeStart: (rowId: string, e: React.PointerEvent) => void;
  handleHeaderResizeStart: (e: React.PointerEvent) => void;
  setColumnWidths: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setRowHeights: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}

export function useSheetResize({ projectId, sheet }: UseSheetResizeProps): UseSheetResizeReturn {
  const { updateColumn, updateRow } = useProjectStore();
  const { columnHeaderHeight, setColumnHeaderHeight, rowHeaderWidth, columnHeaderFontSize } = useSheetUIStore();

  // 열 헤더 폰트 크기에 따른 최소 높이 계산
  // exportName이 있는 열을 기준으로: 컬럼명 + exportName + 구분선 + 패딩
  const calculateMinHeaderHeight = (fontSize: number): number => {
    // 기본 높이 (exportName 없는 경우): 컬럼명 + 패딩
    const baseHeight = fontSize * 1.8 + 16;
    // exportName 있는 경우: 컬럼명 + exportName + 구분선 + 패딩
    const withExportName = fontSize * 1.8 + Math.max(10, fontSize - 2) * 1.5 + 6 + 20;
    // 더 큰 값 사용
    return Math.ceil(Math.max(baseHeight, withExportName));
  };

  // 폰트 크기가 기본(12px)일 때는 store 값 그대로, 커지면 자동 계산
  const minHeaderHeight = calculateMinHeaderHeight(columnHeaderFontSize);
  // 기본 폰트 크기(12px)일 때 최소 높이를 32px로 제한
  const effectiveMinHeight = columnHeaderFontSize <= 12 ? Math.max(32, columnHeaderHeight) : minHeaderHeight;
  const effectiveHeaderHeight = Math.max(columnHeaderHeight, effectiveMinHeight);

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({});
  const [resizingColumn, setResizingColumn] = useState<string | null>(null);
  const [resizingRow, setResizingRow] = useState<string | null>(null);
  const [resizingHeader, setResizingHeader] = useState(false);

  // 행 헤더 너비 계산 (행 개수 자릿수에 따라 동적)
  // 체크박스(20px) + 구분선+마진(12px) + 숫자너비(자릿수*8px) + 패딩(16px)
  const calculateRowNumberWidth = (rowCount: number): number => {
    const digits = Math.max(1, String(rowCount).length);
    const checkboxWidth = 20;
    const separatorWidth = 12;
    const digitWidth = digits * 8;
    const padding = 16;
    return Math.max(60, checkboxWidth + separatorWidth + digitWidth + padding);
  };

  // 컬럼 너비 초기화
  useEffect(() => {
    // rowHeaderWidth가 설정되어 있으면 사용, 아니면 동적 계산
    const rowNumberWidth = rowHeaderWidth || calculateRowNumberWidth(sheet.rows.length);
    const widths: Record<string, number> = { rowNumber: rowNumberWidth };
    sheet.columns.forEach((col) => {
      widths[col.id] = col.width || 150;
    });
    setColumnWidths(widths);
  }, [sheet.columns, sheet.rows.length, rowHeaderWidth]);

  // 행 높이 초기화
  useEffect(() => {
    const heights: Record<string, number> = {};
    sheet.rows.forEach((row) => {
      heights[row.id] = row.height || 36;
    });
    setRowHeights(heights);
  }, [sheet.rows]);

  // 테이블 전체 너비 계산
  // 각 열의 최소 너비(minWidth)를 고려하여 계산
  const tableWidth = (() => {
    const rowNumberWidth = Math.max(columnWidths['rowNumber'] || 80, 100);
    const dataColumnsWidth = sheet.columns.reduce((sum, col) => {
      const colWidth = columnWidths[col.id] || col.width || 150;
      return sum + Math.max(colWidth, 100); // minWidth: 100 반영
    }, 0);
    const actionsWidth = 36;
    return rowNumberWidth + dataColumnsWidth + actionsWidth;
  })();

  /**
   * 컬럼 리사이즈 핸들러
   * Pointer Events로 마우스/터치/펜 통합 처리
   * 참고: https://javascript.info/pointer-events
   */
  const handleResizeStart = useCallback((columnId: string, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn(columnId);

    // 터치 디바이스에서 포인터 캡처
    if (e.pointerType === 'touch') {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }

    const startX = e.clientX;
    const startWidth = columnWidths[columnId] || 150;
    let finalWidth = startWidth;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const diff = moveEvent.clientX - startX;
      // 최소 너비 100px로 제한 (헤더에 exportName도 표시되므로)
      finalWidth = Math.max(100, startWidth + diff);
      setColumnWidths((prev) => ({ ...prev, [columnId]: finalWidth }));
    };

    const handlePointerUp = () => {
      setResizingColumn(null);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);

      if (columnId !== 'rowNumber') {
        setTimeout(() => {
          updateColumn(projectId, sheet.id, columnId, { width: finalWidth });
        }, 0);
      }
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  }, [columnWidths, projectId, sheet.id, updateColumn]);

  /**
   * 행 리사이즈 핸들러
   * Pointer Events로 마우스/터치/펜 통합 처리
   */
  const handleRowResizeStart = useCallback((rowId: string, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingRow(rowId);

    // 터치 디바이스에서 포인터 캡처
    if (e.pointerType === 'touch') {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }

    const startY = e.clientY;
    const startHeight = rowHeights[rowId] || 36;
    let finalHeight = startHeight;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const diff = moveEvent.clientY - startY;
      finalHeight = Math.max(24, Math.min(200, startHeight + diff));
      setRowHeights((prev) => ({ ...prev, [rowId]: finalHeight }));
    };

    const handlePointerUp = () => {
      setResizingRow(null);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);

      setTimeout(() => {
        updateRow(projectId, sheet.id, rowId, { height: finalHeight });
      }, 0);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  }, [rowHeights, projectId, sheet.id, updateRow]);

  /**
   * 헤더 높이 조절 핸들러
   * Pointer Events로 마우스/터치/펜 통합 처리
   */
  const handleHeaderResizeStart = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingHeader(true);

    // 터치 디바이스에서 포인터 캡처
    if (e.pointerType === 'touch') {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }

    const startY = e.clientY;
    const startHeight = columnHeaderHeight;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const diff = moveEvent.clientY - startY;
      // 최소 높이 32px, 최대 120px (store에서 clamp)
      const newHeight = startHeight + diff;
      setColumnHeaderHeight(newHeight);
    };

    const handlePointerUp = () => {
      setResizingHeader(false);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  }, [columnHeaderHeight, setColumnHeaderHeight]);

  return {
    columnWidths,
    rowHeights,
    headerHeight: effectiveHeaderHeight,
    resizingColumn,
    resizingRow,
    resizingHeader,
    tableWidth,
    handleResizeStart,
    handleRowResizeStart,
    handleHeaderResizeStart,
    setColumnWidths,
    setRowHeights,
  };
}
