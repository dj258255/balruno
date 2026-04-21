'use client';

/**
 * SheetBody - 테이블 본문 컴포넌트 (가상화 포함)
 *
 * TanStack Virtual을 사용한 행 가상화로 대량 데이터 렌더링 최적화
 *
 * 출처:
 * - TanStack Virtual: https://tanstack.com/virtual/latest/docs/framework/react/examples/table
 * - Handsontable 가상화: https://handsontable.com/docs/javascript-data-grid/row-virtualization/
 * - x-spreadsheet: https://github.com/myliang/x-spreadsheet
 */

import React, { memo } from 'react';
import { flexRender, type Row as TableRow, type Cell } from '@tanstack/react-table';
import { VirtualItem } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import type { Row, Column, CellValue, CellStyle } from '@/types';
import SheetCell from './SheetCell';
import { InlineCheckbox, InlineRating } from './InlineCellControls';
import { cellKey, formatDisplayValue, type DisplayContext } from './utils';

interface SheetBodyProps {
  // 가상화 데이터
  virtualItems: VirtualItem[];
  totalSize: number;
  rows: TableRow<Row>[];

  // 크기 정보
  columnWidths: Record<string, number>;
  rowHeights: Record<string, number>;

  // 선택 상태
  selectedCell: { rowId: string; columnId: string } | null;
  selectedCellsSet: Set<string>;
  fillPreviewCellsSet: Set<string>;
  moveTargetCell: { rowId: string; columnId: string } | null;
  moveStartCell: { rowId: string; columnId: string } | null;
  isCopyMode: boolean;
  editingCell: { rowId: string; columnId: string } | null;

  // 계산된 값
  computedRows: Record<string, CellValue>[];
  columns: Column[];

  // Track 2/3 — link/lookup/rollup 해결용 컨텍스트
  displayContext?: DisplayContext;

  // 리사이즈 상태
  resizingColumn: string | null;
  resizingRow: string | null;

  // 기본 스타일
  defaultCellStyle: CellStyle;

  // 이벤트 핸들러 - Pointer Events (마우스/터치/펜 통합)
  onCellPointerDown: (rowId: string, columnId: string, e: React.PointerEvent) => void;
  onCellPointerEnter: (rowId: string, columnId: string, e: React.PointerEvent, memo?: string) => void;
  onCellPointerLeave: (rowId: string, columnId: string, memo?: string) => void;
  onCellDoubleClick: (rowId: string, columnId: string) => void;
  onCellContextMenu: (e: React.MouseEvent, rowId: string, columnId: string) => void;
  onFillHandlePointerDown: (e: React.PointerEvent) => void;
  onMemoClick: (rowId: string, columnId: string, memo: string) => void;
  onResizeStart: (columnId: string, e: React.PointerEvent) => void;
  onRowResizeStart: (rowId: string, e: React.PointerEvent) => void;
  onRowContextMenu?: (e: React.MouseEvent, row: Row, rowIndex: number) => void;
  onResizeContextMenu?: (e: React.MouseEvent, type: 'column' | 'row', id?: string, rowIndex?: number) => void;

  // 번역
  noDataText: string;
  dragToFillText: string;

  /** Track 1 인라인 컨트롤 — checkbox 토글, rating 별 클릭. */
  onInlineCellUpdate?: (rowId: string, columnId: string, value: CellValue) => void;
}

const SheetBody = memo(function SheetBody({
  virtualItems,
  totalSize,
  rows,
  columnWidths,
  rowHeights,
  selectedCell,
  selectedCellsSet,
  fillPreviewCellsSet,
  moveTargetCell,
  moveStartCell,
  isCopyMode,
  editingCell,
  computedRows,
  columns,
  displayContext,
  resizingColumn,
  resizingRow,
  defaultCellStyle,
  onCellPointerDown,
  onCellPointerEnter,
  onCellPointerLeave,
  onCellDoubleClick,
  onCellContextMenu,
  onFillHandlePointerDown,
  onMemoClick,
  onResizeStart,
  onRowResizeStart,
  onRowContextMenu,
  onResizeContextMenu,
  noDataText,
  dragToFillText,
  onInlineCellUpdate,
}: SheetBodyProps) {
  // 빈 데이터 표시
  if (rows.length === 0) {
    return (
      <tbody>
        <tr>
          <td
            colSpan={columns.length + 2}
            className="text-center py-12"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {noDataText}
          </td>
        </tr>
      </tbody>
    );
  }

  // 첫 번째 가상 아이템의 시작 위치 (상단 패딩)
  const topPadding = virtualItems.length > 0 ? virtualItems[0]?.start || 0 : 0;

  // 마지막 가상 아이템 이후 남은 공간 (하단 패딩)
  const lastItem = virtualItems[virtualItems.length - 1];
  const bottomPadding = lastItem ? totalSize - lastItem.end : 0;

  return (
    <tbody>
      {/* 가상화: 상단 패딩 */}
      {topPadding > 0 && <tr style={{ height: topPadding }} />}

      {virtualItems.map((virtualRow) => {
        const row = rows[virtualRow.index];
        if (!row) return null;

        const rowData = row.original;
        const rowHeight = rowHeights[rowData.id] || 36;
        const rowIndex = virtualRow.index;
        const isSelectedRow = selectedCell?.rowId === rowData.id;

        return (
          <tr
            key={row.id}
            data-index={virtualRow.index}
            className={cn('transition-colors', resizingRow && 'select-none')}
            style={{
              background: 'var(--bg-primary)',
              height: rowHeight,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-secondary)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg-primary)')}
          >
            {row.getVisibleCells().map((cell) => {
              const isRowNumber = cell.column.id === 'rowNumber';
              const isActions = cell.column.id === 'actions';
              const columnId = cell.column.id;
              const width = isActions ? 36 : (columnWidths[columnId] || (isRowNumber ? 80 : 150));

              // 행 번호/액션 셀은 기존 렌더링 사용
              if (isRowNumber || isActions) {
                return (
                  <td
                    key={cell.id}
                    className={cn(
                      'text-body relative',
                      isActions && 'px-1',
                      isRowNumber && 'text-center'
                    )}
                    style={{
                      width,
                      minWidth: isActions ? 36 : 100,
                      height: rowHeight,
                      background: isRowNumber && isSelectedRow ? 'var(--row-col-highlight)' : undefined,
                      color: isRowNumber && isSelectedRow ? 'var(--row-col-highlight-text)' : undefined,
                      fontWeight: isRowNumber && isSelectedRow ? 700 : undefined,
                      borderBottom: '1px solid var(--border-primary)',
                      borderRight: isRowNumber && isSelectedRow
                        ? '2px solid var(--row-col-highlight-border)'
                        : '1px solid var(--border-primary)',
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}

                    {/* 행 번호 셀 리사이즈 핸들 */}
                    {isRowNumber && (
                      <>
                        <div
                          className={cn(
                            'absolute top-0 bottom-0 cursor-col-resize transition-colors z-10 opacity-0 hover:opacity-100 touch-none',
                            resizingColumn === 'rowNumber' ? 'opacity-100 bg-[var(--accent)]' : 'hover:bg-[var(--accent)]'
                          )}
                          style={{ right: -2, width: 5 }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            onResizeStart('rowNumber', e);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (onRowContextMenu) {
                              onRowContextMenu(e, rowData, rowIndex);
                            }
                          }}
                        />
                        <div
                          className={cn(
                            'absolute left-0 right-0 cursor-row-resize transition-colors z-10 touch-none',
                            resizingRow === rowData.id ? 'bg-[var(--accent)]' : 'hover:bg-[var(--accent)]'
                          )}
                          style={{ bottom: -3, height: 7 }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            onRowResizeStart(rowData.id, e);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (onResizeContextMenu) {
                              onResizeContextMenu(e, 'row', rowData.id, rowIndex);
                            }
                          }}
                        />
                      </>
                    )}
                  </td>
                );
              }

              // 데이터 셀: SheetCell 컴포넌트 사용
              const column = columns.find((c) => c.id === columnId);
              if (!column) {
                return (
                  <td key={cell.id} style={{ width, height: rowHeight }} />
                );
              }

              const cellKeyStr = cellKey(rowData.id, columnId);
              const isSelected = selectedCell?.rowId === rowData.id && selectedCell?.columnId === columnId;
              const isMultiSelected = selectedCellsSet.has(cellKeyStr);
              const isFillPreview = fillPreviewCellsSet.has(cellKeyStr);
              const isMoveTarget = moveTargetCell?.rowId === rowData.id && moveTargetCell?.columnId === columnId;
              const isMoveSource = moveStartCell?.rowId === rowData.id && moveStartCell?.columnId === columnId;
              const isEditing = editingCell?.rowId === rowData.id && editingCell?.columnId === columnId;

              // 계산된 값 가져오기
              const computedValue = computedRows[rowIndex]?.[columnId];
              const rawValue = rowData.cells[columnId];
              const displayValue = computedValue ?? rawValue ?? '';

              // 셀 스타일
              const cellStyle = rowData.cellStyles?.[columnId];
              const cellMemo = rowData.cellMemos?.[columnId];

              // 수식 관련 상태
              const cellHasFormula = typeof rawValue === 'string' && rawValue.startsWith('=');
              const usesColumnFormula = !!(column.type === 'formula' && column.formula && !rawValue);
              const hasCellOverride = rawValue !== null && rawValue !== undefined && rawValue !== '';
              const isFormulaColumn = column.type === 'formula';

              // 배경색 계산
              const getBackgroundColor = () => {
                if (cellStyle?.bgColor) return cellStyle.bgColor;
                // 수식 컬럼이면 살구색 배경 (수식이 있든 없든)
                if (isFormulaColumn) {
                  return 'rgba(255, 237, 213, 0.5)'; // 살구색 (peach/apricot)
                }
                // 셀 자체에 수식이 있는 경우도 살구색
                if (cellHasFormula) {
                  return 'rgba(255, 237, 213, 0.5)';
                }
                return 'transparent';
              };

              return (
                <td
                  key={cell.id}
                  className="text-body relative group"
                  style={{
                    width,
                    minWidth: 100,
                    height: rowHeight,
                    padding: 0,
                    borderBottom: '1px solid var(--border-primary)',
                    borderRight: '1px solid var(--border-primary)',
                  }}
                >
                  <SheetCell
                    rowId={rowData.id}
                    columnId={columnId}
                    cellKey={cellKeyStr}
                    value={rawValue}
                    displayValue={formatDisplayValue(displayValue, column, displayContext, rowData)}
                    inlineControl={(() => {
                      if (!onInlineCellUpdate || column.locked || rowData.locked) return undefined;
                      if (column.type === 'checkbox') {
                        return (
                          <InlineCheckbox
                            value={rawValue}
                            onChange={(next) => onInlineCellUpdate(rowData.id, columnId, next ? 1 : 0)}
                          />
                        );
                      }
                      if (column.type === 'rating') {
                        const max = (column as { ratingMax?: number }).ratingMax ?? 5;
                        return (
                          <InlineRating
                            value={rawValue}
                            max={max}
                            onChange={(next) => onInlineCellUpdate(rowData.id, columnId, next)}
                          />
                        );
                      }
                      return undefined;
                    })()}
                    cellStyle={cellStyle}
                    cellMemo={cellMemo}
                    isSelected={isSelected}
                    isMultiSelected={isMultiSelected && !isSelected}
                    isFillPreview={isFillPreview}
                    isMoveTarget={isMoveTarget}
                    isMoveSource={isMoveSource}
                    isEditing={isEditing}
                    isLocked={column.locked || rowData.locked || false}
                    cellHasFormula={cellHasFormula}
                    usesColumnFormula={usesColumnFormula}
                    hasCellOverride={hasCellOverride}
                    isFormulaColumn={isFormulaColumn}
                    isCopyMode={isCopyMode}
                    backgroundColor={getBackgroundColor()}
                    onPointerDown={onCellPointerDown}
                    onPointerEnter={onCellPointerEnter}
                    onPointerLeave={onCellPointerLeave}
                    onDoubleClick={onCellDoubleClick}
                    onContextMenu={onCellContextMenu}
                    onFillHandlePointerDown={onFillHandlePointerDown}
                    onMemoClick={onMemoClick}
                    dragToFillText={dragToFillText}
                    defaultFontSize={defaultCellStyle.fontSize || 13}
                  />

                  {/* 열 너비 조절 핸들 - Pointer Events */}
                  <div
                    className={cn(
                      'absolute top-0 bottom-0 cursor-col-resize transition-colors z-10 opacity-0 hover:opacity-100 touch-none',
                      resizingColumn === columnId ? 'opacity-100 bg-[var(--accent)]' : 'hover:bg-[var(--accent)]'
                    )}
                    style={{ right: -2, width: 5 }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onResizeStart(columnId, e);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (onResizeContextMenu) {
                        onResizeContextMenu(e, 'column', columnId);
                      }
                    }}
                  />

                  {/* 행 높이 조절 핸들 - Pointer Events */}
                  <div
                    className={cn(
                      'absolute left-0 right-0 cursor-row-resize transition-colors z-10 touch-none',
                      resizingRow === rowData.id ? 'bg-[var(--accent)]' : 'hover:bg-[var(--accent)]'
                    )}
                    style={{ bottom: -3, height: 7 }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onRowResizeStart(rowData.id, e);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (onResizeContextMenu) {
                        onResizeContextMenu(e, 'row', rowData.id, rowIndex);
                      }
                    }}
                  />
                </td>
              );
            })}
          </tr>
        );
      })}

      {/* 가상화: 하단 패딩 */}
      {bottomPadding > 0 && <tr style={{ height: bottomPadding }} />}
    </tbody>
  );
});

export default SheetBody;
