'use client';

/**
 * FormulaBar - 수식 입력 바 컴포넌트 (Slack 스타일)
 *
 * 디자인:
 * - 슬랙 스타일 테두리 경계선
 * - = 입력 시 즉시 보라색 수식 모드로 전환
 * - 부드러운 배경색
 */

import React, { memo, useRef, useEffect, useState } from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import type { Column, Sheet } from '@/types';
import type { CellPosition } from './types';
import FormulaAutocomplete, { type FormulaAutocompleteRef } from './FormulaAutocomplete';
import { AiFormulaButton } from './AiFormulaButton';

interface FormulaBarProps {
  selectedCell: CellPosition | null;
  selectedCellInfo: {
    column: Column | undefined;
    rowIndex: number;
    cellRef: string;
  } | null;
  formulaBarValue: string;
  isFormulaBarFocused: boolean;
  editingCell: CellPosition | null;
  validationError: string | null;
  isFormulaCell: boolean;
  columns?: Column[];  // 현재 시트의 컬럼들
  sheets?: Sheet[];    // 모든 시트들 (시트 참조용)
  currentSheetId?: string;  // 현재 시트 ID
  onFormulaBarChange: (value: string) => void;
  onFormulaBarFocus: () => void;
  onFormulaBarBlur: () => void;
  onFormulaBarKeyDown: (e: React.KeyboardEvent) => void;
  onCancelEdit: () => void;
  onConfirmEdit: () => void;
  t: (key: string) => string;
}

const FormulaBar = memo(function FormulaBar({
  selectedCell,
  selectedCellInfo,
  formulaBarValue,
  isFormulaBarFocused,
  editingCell,
  validationError,
  isFormulaCell,
  columns = [],
  sheets = [],
  currentSheetId,
  onFormulaBarChange,
  onFormulaBarFocus,
  onFormulaBarBlur,
  onFormulaBarKeyDown,
  onCancelEdit,
  onConfirmEdit,
  t,
}: FormulaBarProps) {
  const formulaBarRef = useRef<HTMLInputElement>(null);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const autocompleteRef = useRef<FormulaAutocompleteRef>(null);

  useEffect(() => {
    if (isFormulaBarFocused && formulaBarRef.current) {
      formulaBarRef.current.focus();
      formulaBarRef.current.setSelectionRange(
        formulaBarRef.current.value.length,
        formulaBarRef.current.value.length
      );
    }
  }, [isFormulaBarFocused]);

  // 수식 모드일 때 자동완성 표시
  useEffect(() => {
    if (formulaBarValue.startsWith('=') && formulaBarValue.length > 1 && isFormulaBarFocused) {
      setShowAutocomplete(true);
    } else {
      setShowAutocomplete(false);
    }
  }, [formulaBarValue, isFormulaBarFocused]);

  // 키보드 이벤트 핸들러 - 자동완성 먼저 처리
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 자동완성이 열려있고 아이템이 있을 때 키보드 네비게이션
    if (showAutocomplete && autocompleteRef.current && autocompleteRef.current.hasItems()) {
      const handled = autocompleteRef.current.handleKeyDown(e);
      if (handled) return;
    }
    // 자동완성에서 처리 안 된 키는 기존 핸들러로
    onFormulaBarKeyDown(e);
  };

  const columnName = selectedCellInfo?.column?.name || '-';
  const rowNumber = selectedCellInfo ? selectedCellInfo.rowIndex + 1 : '-';
  const isEditing = editingCell || isFormulaBarFocused;

  // 현재 입력값이 =로 시작하면 수식 모드 (입력 중에도 즉시 반영)
  const isFormulaMode = formulaBarValue.startsWith('=') || isFormulaCell;

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 shrink-0"
      style={{
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-primary)',
      }}
    >
      {/* Cell Reference Box */}
      <div
        className="flex items-center shrink-0"
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-secondary)',
          borderRadius: 6,
          height: 32,
          minWidth: 100,
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        }}
      >
        <div
          className="flex items-center justify-center px-3 h-full"
          style={{
            color: 'var(--text-primary)',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <span className="truncate max-w-[60px]">{columnName}</span>
        </div>
        <div
          style={{
            width: 1,
            height: 16,
            background: 'var(--border-secondary)',
          }}
        />
        <div
          className="flex items-center justify-center px-3 h-full"
          style={{
            color: 'var(--text-secondary)',
            fontSize: 13,
            fontWeight: 500,
            minWidth: 32,
          }}
        >
          {rowNumber}
        </div>
      </div>

      {/* fx 버튼 - 입력값이 =로 시작하면 즉시 보라색 */}
      <div
        className="flex items-center justify-center shrink-0 transition-all duration-150"
        style={{
          width: 32,
          height: 32,
          background: isFormulaMode ? 'var(--primary-purple)' : 'var(--bg-primary)',
          color: isFormulaMode ? 'white' : 'var(--text-tertiary)',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 600,
          fontStyle: 'italic',
          border: isFormulaMode ? 'none' : '1px solid var(--border-secondary)',
          boxShadow: isFormulaMode ? '0 2px 4px rgba(139, 92, 246, 0.3)' : '0 1px 2px rgba(0,0,0,0.04)',
        }}
      >
        fx
      </div>

      {/* 취소/확인 버튼 - 입력창 왼쪽에 배치 */}
      {isEditing && (
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onCancelEdit}
            className="flex items-center justify-center transition-all duration-150"
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              background: 'var(--bg-primary)',
              color: 'var(--text-tertiary)',
              border: '1px solid var(--border-secondary)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--error)';
              e.currentTarget.style.borderColor = 'var(--error)';
              e.currentTarget.style.color = 'white';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(239, 68, 68, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-primary)';
              e.currentTarget.style.borderColor = 'var(--border-secondary)';
              e.currentTarget.style.color = 'var(--text-tertiary)';
              e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)';
            }}
            title="Cancel (Esc)"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
          <button
            onClick={onConfirmEdit}
            className="flex items-center justify-center transition-all duration-150"
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              background: 'var(--success)',
              color: 'white',
              border: 'none',
              boxShadow: '0 2px 4px rgba(34, 197, 94, 0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--success-dark, #16a34a)';
              e.currentTarget.style.boxShadow = '0 4px 8px rgba(34, 197, 94, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--success)';
              e.currentTarget.style.boxShadow = '0 2px 4px rgba(34, 197, 94, 0.3)';
            }}
            title="Confirm (Enter)"
          >
            <Check className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* Main Input Area */}
      <div
        className="flex-1 flex items-center min-w-0 transition-all duration-150 relative"
        style={{
          background: isFormulaMode ? 'var(--editor-bg-formula)' : 'var(--bg-primary)',
          border: `1px solid ${isFormulaMode ? 'var(--editor-border-formula)' : isFormulaBarFocused ? 'var(--editor-border-focus)' : 'var(--border-secondary)'}`,
          borderRadius: 6,
          height: 32,
          boxShadow: isFormulaMode
            ? '0 0 0 3px var(--editor-shadow-formula)'
            : isFormulaBarFocused
              ? '0 0 0 3px var(--editor-shadow-focus)'
              : '0 1px 2px rgba(0,0,0,0.04)',
        }}
      >
        <input
          ref={formulaBarRef}
          type="text"
          role="combobox"
          aria-label={t('table.formulaBarPlaceholder')}
          aria-autocomplete="list"
          aria-expanded={false}
          value={formulaBarValue}
          onChange={(e) => onFormulaBarChange(e.target.value)}
          onFocus={onFormulaBarFocus}
          onBlur={(e) => {
            // 자동완성 클릭 시 blur 무시 (relatedTarget 확인)
            const relatedTarget = e.relatedTarget as HTMLElement;
            if (relatedTarget?.closest('[data-autocomplete]')) {
              return;
            }
            onFormulaBarBlur();
          }}
          onKeyDown={handleKeyDown}
          placeholder={selectedCell ? t('table.formulaBarPlaceholder') : t('table.selectCellToEdit')}
          disabled={!selectedCell}
          className="flex-1 min-w-0 h-full px-3 focus:outline-none"
          style={{
            background: 'transparent',
            color: isFormulaMode ? 'var(--editor-border-formula)' : 'var(--text-primary)',
            fontSize: 13,
            fontWeight: isFormulaMode ? 500 : 400,
            fontFamily: isFormulaMode ? 'var(--font-mono, monospace)' : 'inherit',
            border: 'none',
          }}
        />
        {/* 수식 자동완성 - 항상 렌더링하되 visible로 표시 제어 */}
        <FormulaAutocomplete
          ref={autocompleteRef}
          value={formulaBarValue}
          columns={columns.filter(c => c.id !== selectedCellInfo?.column?.id)}
          sheets={sheets}
          currentSheetId={currentSheetId}
          visible={showAutocomplete}
          onSelect={(newValue) => {
            onFormulaBarChange(newValue);
            setShowAutocomplete(false);
            formulaBarRef.current?.focus();
          }}
        />
      </div>

      {/* AI 수식 생성 — 자연어 → 수식. 응답 적용 시 = prefix 자동 */}
      <AiFormulaButton
        columns={columns}
        currentColumn={selectedCellInfo?.column ?? undefined}
        disabled={!selectedCell}
        onFormula={(f) => {
          const withEquals = f.startsWith('=') ? f : `=${f}`;
          onFormulaBarChange(withEquals);
          formulaBarRef.current?.focus();
        }}
      />

      {/* Validation Error */}
      {validationError && (
        <div
          className="flex items-center gap-1.5 shrink-0"
          style={{
            background: 'var(--error)',
            color: 'white',
            padding: '6px 10px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 500,
            boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)',
          }}
        >
          <AlertTriangle className="w-3.5 h-3.5" strokeWidth={2} />
          <span>{validationError}</span>
        </div>
      )}
    </div>
  );
});

export default FormulaBar;
