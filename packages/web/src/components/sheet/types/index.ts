import type { Sheet, Row, Column, CellValue, CellStyle } from '@/types';

// 셀 위치
export interface CellPosition {
  rowId: string;
  columnId: string;
}

// 셀 데이터 (복사/붙여넣기용)
export interface CellData extends CellPosition {
  value: CellValue;
}

// 클립보드 데이터
export interface ClipboardData {
  cells: CellData[];
  bounds: {
    minRowIdx: number;
    maxRowIdx: number;
    minColIdx: number;
    maxColIdx: number;
  };
}

// 컨텍스트 메뉴 상태
export interface ContextMenuState {
  x: number;
  y: number;
  rowId: string;
  columnId: string;
  isRowNumberCell: boolean;
  isHeaderCell: boolean;
}

// 컬럼 컨텍스트 메뉴 상태
export interface ColumnContextMenuState {
  x: number;
  y: number;
  column: Column;
}

// 행 컨텍스트 메뉴 상태
export interface RowContextMenuState {
  x: number;
  y: number;
  row: Row;
  rowIndex: number;
}

// 메모 모달 상태
export interface MemoModalState {
  rowId: string;
  columnId: string;
  memo: string;
}

// 메모 호버 상태
export interface MemoHoverState {
  rowId: string;
  columnId: string;
  memo: string;
  x: number;
  y: number;
}

// 삭제 확인 상태
export interface DeleteColumnConfirmState {
  columnId: string;
  columnName: string;
}

// 리사이즈 컨텍스트 메뉴 상태
export interface ResizeContextMenuState {
  x: number;
  y: number;
  type: 'column' | 'row' | 'header';
  columnId?: string;
  rowId?: string;
  rowIndex?: number;
}

// SheetTable Props
export interface SheetTableProps {
  projectId: string;
  sheet: Sheet;
  onAddMemo?: () => void;
}

// 열/행 범위 (드래그 선택용)
export interface ColBounds {
  colId: string;
  start: number;
  end: number;
}

export interface RowBounds {
  rowId: string;
  start: number;
  end: number;
}
