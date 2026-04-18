'use client';

/**
 * CellEditor - 인라인 셀 에디터 (Google Sheets 스타일)
 *
 * Google Sheets 편집 모드 스타일:
 * - 셀 외곽에 파란색 테두리가 **추가로** 씌워지는 형태
 * - 에디터가 셀보다 테두리 두께만큼 약간 크게 표시됨
 * - 셀 위를 완전히 덮으면서 테두리가 바깥으로 확장
 */

import React, { forwardRef, useEffect, useRef } from 'react';
import type { CellStyle, ColumnType, SelectOption } from '@/types';

interface CellEditorProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onBlur?: (e?: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => void;
  isFormula?: boolean;
  position: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
  cellStyle?: CellStyle;
  /** Track 1: 컬럼 타입에 따라 input type 분기 */
  columnType?: ColumnType;
  /** Track 1: select / multiSelect 의 옵션 목록 */
  selectOptions?: SelectOption[];
}

export const CellEditor = forwardRef<HTMLInputElement, CellEditorProps>(
  ({ value, onChange, onKeyDown, onBlur, isFormula = false, position, cellStyle, columnType, selectOptions }, ref) => {
    const internalInputRef = useRef<HTMLInputElement>(null);

    // 값이 변경될 때마다 커서가 보이도록 스크롤
    useEffect(() => {
      const input = internalInputRef.current;
      if (input) {
        requestAnimationFrame(() => {
          input.scrollLeft = input.scrollWidth;
        });
      }
    }, [value]);

    // 테두리 두께 - 셀 외곽에 추가되는 테두리
    const borderWidth = 2;

    // Track 1: 컬럼 타입에 따른 input type
    const inputType = (() => {
      if (isFormula) return 'text';
      switch (columnType) {
        case 'date':
          return 'date';
        case 'url':
          return 'url';
        case 'currency':
          return 'number';
        default:
          return 'text';
      }
    })();

    const baseStyle: React.CSSProperties = {
      top: position.top - borderWidth,
      left: position.left - borderWidth,
      width: position.width + borderWidth * 2,
      height: position.height + borderWidth * 2,
      padding: '0 8px',
      border: `${borderWidth}px solid ${isFormula ? 'var(--editor-border-formula)' : 'var(--editor-border-focus)'}`,
      borderRadius: '0',
      outline: 'none',
      background: isFormula ? 'var(--editor-bg-formula)' : 'var(--editor-bg)',
      boxShadow: isFormula
        ? '0 0 0 3px var(--editor-shadow-formula)'
        : '0 0 0 3px var(--editor-shadow-focus)',
      color: cellStyle?.fontColor || 'var(--text-primary)',
      fontSize: cellStyle?.fontSize ? `${cellStyle.fontSize}px` : '13px',
      fontFamily: isFormula ? 'var(--font-mono, monospace)' : 'inherit',
      fontWeight: cellStyle?.bold ? 'bold' : 'normal',
      fontStyle: cellStyle?.italic ? 'italic' : 'normal',
      textDecoration: [
        cellStyle?.underline ? 'underline' : '',
        cellStyle?.strikethrough ? 'line-through' : '',
      ].filter(Boolean).join(' ') || 'none',
      boxSizing: 'border-box',
      caretColor: isFormula ? 'var(--editor-border-formula)' : 'var(--editor-border-focus)',
    };

    // Track 1: select 는 <select> 드롭다운
    if (columnType === 'select' && selectOptions && !isFormula) {
      return (
        <select
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            // 선택 즉시 편집 종료
            onBlur?.(e as unknown as React.FocusEvent<HTMLSelectElement>);
          }}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          autoFocus
          className="absolute z-50"
          style={baseStyle}
        >
          <option value="">—</option>
          {selectOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        ref={(node) => {
          internalInputRef.current = node;
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        type={inputType}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        className="absolute z-50"
        style={baseStyle}
        autoComplete="off"
        spellCheck={false}
      />
    );
  }
);

CellEditor.displayName = 'CellEditor';
