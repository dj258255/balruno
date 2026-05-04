/**
 * SheetCell - 메모이제이션된 셀 컴포넌트
 *
 * 성능 최적화 패턴:
 * - React.memo로 불필요한 리렌더링 방지
 * - 커스텀 비교 함수로 필요한 props만 비교
 *
 * 터치/모바일 지원:
 * - Pointer Events로 마우스/터치/펜 통합 처리
 * - 참고: https://javascript.info/pointer-events
 *
 * 출처:
 * - React.memo 공식 문서: https://react.dev/reference/react/memo
 * - Handsontable 렌더링 최적화: https://handsontable.com/docs/javascript-data-grid/row-virtualization/
 */

import React, { memo, useCallback } from 'react';
import { Lock } from 'lucide-react';
import type { CellValue, CellStyle, Column, Row } from '@/types';
import { DEFAULT_CELL_STYLE } from '@/stores/sheetUIStore';

export interface SheetCellProps {
  // 식별자
  rowId: string;
  columnId: string;
  cellKey: string;

  // 데이터
  value: CellValue;
  displayValue: string | number;
  cellStyle?: CellStyle;
  cellMemo?: string;

  // 상태
  isSelected: boolean;
  isMultiSelected: boolean;
  isFillPreview: boolean;
  isMoveTarget: boolean;
  isMoveSource: boolean;
  isEditing: boolean;
  isLocked: boolean;
  cellHasFormula: boolean;
  usesColumnFormula: boolean;
  hasCellOverride: boolean;
  isFormulaColumn: boolean;
  isCopyMode: boolean;

  // 배경색 (계산된 값)
  backgroundColor: string;

  // 이벤트 핸들러 - Pointer Events (마우스/터치/펜 통합)
  onPointerDown: (rowId: string, columnId: string, e: React.PointerEvent) => void;
  onPointerEnter: (rowId: string, columnId: string, e: React.PointerEvent, memo?: string) => void;
  onPointerLeave: (rowId: string, columnId: string, memo?: string) => void;
  onDoubleClick: (rowId: string, columnId: string) => void;
  onContextMenu: (e: React.MouseEvent, rowId: string, columnId: string) => void;
  onFillHandlePointerDown: (e: React.PointerEvent) => void;
  onMemoClick: (rowId: string, columnId: string, memo: string) => void;

  // 번역
  dragToFillText: string;

  // 기본 스타일
  defaultFontSize: number;

  /** checkbox/rating 등 display 모드에서 클릭 가능한 인라인 컨트롤. 제공 시 displayValue 텍스트 대체 */
  inlineControl?: React.ReactNode;

  /** peer cursor 색상 (다른 유저가 현재 이 셀 선택 중). undefined = 없음. */
  peerCursorColor?: string;
  /** peer 이름 (툴팁) */
  peerCursorName?: string;
  /** P9a — peer 가 이 셀을 편집 중이면 true (typing indicator) */
  peerIsEditing?: boolean;
  /** P9a — peer 의 drag selection 범위 안에 이 셀이 있으면 색상 — 파스텔 처리 */
  peerRangeColor?: string;
}

// 커스텀 비교 함수 - 필요한 props만 비교하여 리렌더링 최소화
// 출처: https://react.dev/reference/react/memo#specifying-a-custom-comparison-function
function arePropsEqual(prevProps: SheetCellProps, nextProps: SheetCellProps): boolean {
  // 값 변경
  if (prevProps.value !== nextProps.value) return false;
  if (prevProps.displayValue !== nextProps.displayValue) return false;

  // 선택 상태 변경
  if (prevProps.isSelected !== nextProps.isSelected) return false;
  if (prevProps.isMultiSelected !== nextProps.isMultiSelected) return false;
  if (prevProps.isFillPreview !== nextProps.isFillPreview) return false;
  if (prevProps.isMoveTarget !== nextProps.isMoveTarget) return false;
  if (prevProps.isMoveSource !== nextProps.isMoveSource) return false;
  if (prevProps.isEditing !== nextProps.isEditing) return false;

  // 스타일 변경
  if (prevProps.backgroundColor !== nextProps.backgroundColor) return false;
  if (prevProps.cellStyle !== nextProps.cellStyle) return false;

  // 상태 플래그 변경
  if (prevProps.isLocked !== nextProps.isLocked) return false;
  if (prevProps.cellHasFormula !== nextProps.cellHasFormula) return false;
  if (prevProps.cellMemo !== nextProps.cellMemo) return false;
  if (prevProps.isCopyMode !== nextProps.isCopyMode) return false;

  // Peer cursor / range / typing
  if (prevProps.peerCursorColor !== nextProps.peerCursorColor) return false;
  if (prevProps.peerCursorName !== nextProps.peerCursorName) return false;
  if (prevProps.peerIsEditing !== nextProps.peerIsEditing) return false;
  if (prevProps.peerRangeColor !== nextProps.peerRangeColor) return false;

  // 인라인 컨트롤 — value 변경 시 자동 재계산되므로 별도 비교 X
  // (inlineControl 은 매 렌더 새 ReactNode 라 비교가 무의미)

  return true;
}

const SheetCell = memo(function SheetCell({
  rowId,
  columnId,
  cellKey,
  value,
  displayValue,
  cellStyle,
  cellMemo,
  isSelected,
  isMultiSelected,
  isFillPreview,
  isMoveTarget,
  isMoveSource,
  isEditing,
  isLocked,
  cellHasFormula,
  usesColumnFormula,
  hasCellOverride,
  isFormulaColumn,
  isCopyMode,
  backgroundColor,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  onDoubleClick,
  onContextMenu,
  onFillHandlePointerDown,
  onMemoClick,
  dragToFillText,
  defaultFontSize,
  inlineControl,
  peerCursorColor,
  peerCursorName,
  peerIsEditing,
  peerRangeColor,
}: SheetCellProps) {
  /**
   * Pointer Events 핸들러
   * - 마우스, 터치, 펜 입력을 통합 처리
   * - e.pointerType으로 입력 유형 구분 가능: "mouse" | "touch" | "pen"
   * - 참고: https://javascript.info/pointer-events
   */
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // 터치 디바이스에서 포인터 캡처 (드래그 선택 지원)
    if (e.pointerType === 'touch') {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
    onPointerDown(rowId, columnId, e);
  }, [onPointerDown, rowId, columnId]);

  const handlePointerEnter = useCallback((e: React.PointerEvent) => {
    onPointerEnter(rowId, columnId, e, cellMemo);
  }, [onPointerEnter, rowId, columnId, cellMemo]);

  const handlePointerLeave = useCallback(() => {
    onPointerLeave(rowId, columnId, cellMemo);
  }, [onPointerLeave, rowId, columnId, cellMemo]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onDoubleClick(rowId, columnId);
  }, [onDoubleClick, rowId, columnId]);

  const handleContextMenuClick = useCallback((e: React.MouseEvent) => {
    onContextMenu(e, rowId, columnId);
  }, [onContextMenu, rowId, columnId]);

  const handleMemoClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (cellMemo) {
      onMemoClick(rowId, columnId, cellMemo);
    }
  }, [onMemoClick, rowId, columnId, cellMemo]);

  // outline 스타일 계산
  // isEditing일 때는 CellEditor가 테두리를 그리므로 여기선 숨김
  const getOutline = () => {
    if (isEditing) return 'none';
    if (isMoveTarget) {
      return isCopyMode ? '2px dashed var(--accent)' : '2px solid var(--accent)';
    }
    if (isFillPreview) return '2px dashed var(--primary-green)';
    if (isSelected) return '2px solid var(--primary-blue)';
    if (isMultiSelected) return '1px solid var(--primary-blue)';
    // peer cursor (로컬 선택 없을 때만)
    if (peerCursorColor) return `2px solid ${peerCursorColor}`;
    return 'none';
  };

  // 배경색 계산
  const getBackground = () => {
    if (isMoveTarget) return 'var(--accent-light)';
    if (isFillPreview) return 'var(--primary-green-light)';
    if (isMultiSelected && !isSelected) return 'var(--primary-blue-light)';
    // P9a — peer 드래그 범위 (로컬 선택 없을 때만, 15% 투명도)
    if (peerRangeColor && !isSelected && !isMultiSelected) {
      return `${peerRangeColor}26`; // hex 26 ≈ 15%
    }
    return backgroundColor;
  };

  return (
    <div
      data-cell-id={cellKey}
      role="gridcell"
      aria-selected={isSelected}
      aria-readonly={isLocked}
      tabIndex={isSelected ? 0 : -1}
      onPointerDown={handlePointerDown}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenuClick}
      className={`sheet-cell px-2 sm:px-2 py-1.5 sm:py-1 h-full w-full absolute inset-0 overflow-hidden select-none flex ${
        (cellStyle?.vAlign || DEFAULT_CELL_STYLE.vAlign) === 'top' ? 'items-start' : (cellStyle?.vAlign || DEFAULT_CELL_STYLE.vAlign) === 'bottom' ? 'items-end' : 'items-center'
      } ${isSelected && !isEditing ? 'cursor-move' : 'cursor-cell'} ${isMoveSource && !isCopyMode ? 'opacity-50' : ''}`}
      style={{
        background: getBackground(),
        color: typeof value === 'string' && value.startsWith('#ERR') ? 'var(--error)' : 'var(--text-primary)',
        outline: getOutline(),
        outlineOffset: '-2px',
        // 테마 전환 성능 최적화: contain으로 리플로우 범위 제한
        // https://developer.mozilla.org/en-US/docs/Web/CSS/contain
        contain: 'strict',
        // 터치 동작 방지 (드래그 선택 시 스크롤 방지)
        touchAction: 'none',
      }}
    >
      {inlineControl ? (
        <div
          className="flex-1 min-w-0 flex items-center"
          style={{ justifyContent: cellStyle?.hAlign === 'right' ? 'flex-end' : cellStyle?.hAlign === 'center' ? 'center' : 'flex-start' }}
          // 컨트롤 클릭이 셀 selection 으로 새지 않게
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {inlineControl}
        </div>
      ) : (
        <span
          className="truncate flex-1 min-w-0"
          style={{
            display: 'block',
            fontWeight: cellStyle?.bold ? 700 : undefined,
            fontStyle: cellStyle?.italic ? 'italic' : undefined,
            textDecoration: [
              cellStyle?.underline ? 'underline' : '',
              cellStyle?.strikethrough ? 'line-through' : '',
            ].filter(Boolean).join(' ') || undefined,
            fontSize: `${cellStyle?.fontSize || defaultFontSize}px`,
            color: cellStyle?.fontColor || undefined,
            textAlign: cellStyle?.hAlign || DEFAULT_CELL_STYLE.hAlign,
            transform: cellStyle?.textRotation ? `rotate(${cellStyle.textRotation}deg)` : undefined,
          }}
        >
          {displayValue}
        </span>
      )}

      {/* 잠금 표시 아이콘 */}
      {isLocked && (
        <Lock
          className="absolute right-1 top-1 w-3 h-3"
          style={{ color: 'var(--primary-red)' }}
        />
      )}

      {/* 수식 표시 아이콘 */}
      {!isLocked && (cellHasFormula || usesColumnFormula) && (
        <span
          className="absolute right-1 top-1 text-xs opacity-0 group-hover:opacity-100"
          style={{ color: usesColumnFormula ? 'var(--primary-purple)' : 'var(--primary-blue)' }}
        >
          ƒ
        </span>
      )}

      {/* 오버라이드 표시 */}
      {!isLocked && hasCellOverride && isFormulaColumn && !cellHasFormula && (
        <span className="absolute right-1 top-1 text-xs opacity-0 group-hover:opacity-100" style={{ color: 'var(--warning)' }}>
          ✎
        </span>
      )}

      {/* peer cursor 뱃지 (이름 + typing indicator) */}
      {peerCursorColor && peerCursorName && !isSelected && (
        <span
          className="absolute -top-4 left-0 px-1 rounded text-caption font-semibold text-white z-30 whitespace-nowrap pointer-events-none inline-flex items-center gap-1"
          style={{ background: peerCursorColor }}
        >
          {peerCursorName}
          {peerIsEditing && (
            <span
              className="inline-block w-1.5 h-1.5 rounded-full bg-white"
              style={{ animation: 'balruno-typing-pulse 1s ease-in-out infinite' }}
              aria-label="typing"
            />
          )}
        </span>
      )}

      {/* 메모 표시 (삼각형) */}
      {cellMemo && (
        <div
          className="absolute top-0 right-0 w-0 h-0 cursor-pointer"
          style={{
            borderLeft: '12px solid transparent',
            borderTop: '12px solid var(--warning)',
          }}
          onClick={handleMemoClick}
        />
      )}

      {/* 채우기 핸들 (선택된 셀의 오른쪽 하단) - 편집 중에도 표시 */}
      {/* 모바일에서 터치하기 쉽게 크기 확대 (sm: 이상에서는 기존 크기) */}
      {isSelected && !isLocked && (
        <div
          onPointerDown={onFillHandlePointerDown}
          className="absolute bottom-0 right-0 w-4 h-4 sm:w-3 sm:h-3 cursor-crosshair touch-none"
          style={{
            background: 'var(--primary-blue)',
            border: '2px solid white',
            borderRadius: '2px',
            // 편집 중에도 CellEditor(z-50) 위에 표시되도록 z-index 높임
            zIndex: isEditing ? 60 : 10,
            // 모바일에서 터치 영역 확대
            touchAction: 'none',
          }}
          title={dragToFillText}
        />
      )}
    </div>
  );
}, arePropsEqual);

export default SheetCell;
