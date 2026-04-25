'use client';

/**
 * CellEditor - 인라인 셀 에디터 (Google Sheets 스타일)
 *
 * Google Sheets 편집 모드 스타일:
 * - 셀 외곽에 파란색 테두리가 **추가로** 씌워지는 형태
 * - 에디터가 셀보다 테두리 두께만큼 약간 크게 표시됨
 * - 셀 위를 완전히 덮으면서 테두리가 바깥으로 확장
 */

import React, { forwardRef, useEffect, useRef, useState, useMemo } from 'react';
import type { CellStyle, ColumnType, SelectOption, Sheet } from '@/types';
import { availableFunctions } from '@/lib/formulaEngine';

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
  /** 컬럼 타입에 따라 input type 분기 */
  columnType?: ColumnType;
  /** select / multiSelect 의 옵션 목록 */
  selectOptions?: SelectOption[];
  /** link 타입 — 대상 시트의 row 목록을 드롭다운으로 */
  linkedSheet?: Sheet | null;
  /** link 타입 — 표시 컬럼 id (없으면 row.id) */
  linkedDisplayColumnId?: string;
  /** link 타입 — 다중 선택 허용 */
  linkedMultiple?: boolean;
}

export const CellEditor = forwardRef<HTMLInputElement, CellEditorProps>(
  ({ value, onChange, onKeyDown, onBlur, isFormula = false, position, cellStyle, columnType, selectOptions, linkedSheet, linkedDisplayColumnId, linkedMultiple }, ref) => {
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

    // 컬럼 타입에 따른 input type
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

    // multiSelect — 체크박스 팝업
    if (columnType === 'multiSelect' && selectOptions && !isFormula) {
      const selected = new Set(
        String(value || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      );
      const toggle = (id: string) => {
        if (selected.has(id)) selected.delete(id);
        else selected.add(id);
        onChange(Array.from(selected).join(','));
      };
      return (
        <div
          className="absolute z-50 rounded shadow-lg overflow-y-auto"
          style={{
            top: position.top,
            left: position.left,
            width: Math.max(position.width, 180),
            maxHeight: 240,
            background: 'var(--bg-primary)',
            border: `${borderWidth}px solid var(--editor-border-focus)`,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
          onBlur={onBlur as React.FocusEventHandler<HTMLDivElement>}
          tabIndex={-1}
        >
          {selectOptions.length === 0 ? (
            <div className="p-2 text-xs" style={{ color: 'var(--text-secondary)' }}>옵션 없음 — 컬럼 설정에서 추가</div>
          ) : (
            selectOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggle(opt.id)}
                className="w-full text-left px-2 py-1 text-xs flex items-center gap-2 hover:bg-[var(--bg-tertiary)]"
                style={{ color: 'var(--text-primary)' }}
              >
                <span
                  className="w-3 h-3 rounded flex items-center justify-center flex-shrink-0"
                  style={{
                    background: selected.has(opt.id) ? 'var(--accent)' : 'transparent',
                    border: `1.5px solid ${selected.has(opt.id) ? 'var(--accent)' : 'var(--border-primary)'}`,
                  }}
                >
                  {selected.has(opt.id) && <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 4 L3 6 L7 1.5" stroke="white" strokeWidth="1.5" fill="none" /></svg>}
                </span>
                <span className="truncate">{opt.label}</span>
              </button>
            ))
          )}
          <div className="border-t p-1.5 flex justify-end" style={{ borderColor: 'var(--border-primary)' }}>
            <button
              type="button"
              onClick={() => onBlur?.()}
              className="text-caption px-2 py-0.5 rounded"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              완료 (Esc)
            </button>
          </div>
        </div>
      );
    }

    // select 는 <select> 드롭다운
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

    // link — 검색 가능한 레코드 피커 (단일/다중 모드)
    if (columnType === 'link' && linkedSheet && !isFormula) {
      return (
        <LinkRecordPicker
          value={value}
          linkedSheet={linkedSheet}
          linkedDisplayColumnId={linkedDisplayColumnId}
          multiple={linkedMultiple ?? false}
          position={position}
          borderWidth={borderWidth}
          onChange={onChange}
          onClose={() => onBlur?.()}
        />
      );
    }

    return (
      <SmartInput
        innerRef={(node) => {
          internalInputRef.current = node;
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        inputType={inputType}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        baseStyle={baseStyle}
        position={position}
        isFormula={isFormula}
      />
    );
  }
);

CellEditor.displayName = 'CellEditor';

// ============================================================================
// SmartInput — 일반 input + 두 가지 popover
//   1. formula 모드: caret 직전 단어로 함수 자동완성
//   2. 일반 모드: '/' 시작 시 quick command (today/now/uuid)
// ============================================================================

interface SlashCommand {
  name: string;
  label: string;
  hint: string;
  resolve: () => string;
}

const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: 'today',
    label: '오늘 날짜',
    hint: 'YYYY-MM-DD',
    resolve: () => new Date().toISOString().slice(0, 10),
  },
  {
    name: 'now',
    label: '현재 시간',
    hint: 'ISO timestamp',
    resolve: () => new Date().toISOString(),
  },
  {
    name: 'uuid',
    label: 'UUID 8자리',
    hint: '랜덤 식별자',
    resolve: () => {
      try {
        return crypto.randomUUID().slice(0, 8);
      } catch {
        return Math.random().toString(36).slice(2, 10);
      }
    },
  },
  {
    name: 'random',
    label: '랜덤 정수 0-99',
    hint: 'Math.floor(random×100)',
    resolve: () => String(Math.floor(Math.random() * 100)),
  },
  {
    name: 'clear',
    label: '셀 비우기',
    hint: '빈 값',
    resolve: () => '',
  },
];

function SmartInput({
  innerRef,
  inputType,
  value,
  onChange,
  onKeyDown,
  onBlur,
  baseStyle,
  position,
  isFormula,
}: {
  innerRef: (node: HTMLInputElement | null) => void;
  inputType: string;
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onBlur?: (e?: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => void;
  baseStyle: React.CSSProperties;
  position: { top: number; left: number; width: number; height: number };
  isFormula: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [caretPos, setCaretPos] = useState<number | null>(null);
  const [acIndex, setAcIndex] = useState(0);
  const [slashIndex, setSlashIndex] = useState(0);
  const [suppressUntilWord, setSuppressUntilWord] = useState<string | null>(null);

  // Formula 자동완성 — caret 직전 단어 추출
  const acState = useMemo(() => {
    if (!isFormula) return null;
    const v = String(value ?? '');
    if (!v.startsWith('=')) return null;
    const pos = caretPos ?? v.length;
    const before = v.slice(0, pos);
    const m = before.match(/[A-Za-z_]+$/);
    if (!m || !m[0]) return null;
    const word = m[0];
    if (word.length < 1) return null;
    if (suppressUntilWord === word) return null;
    const upper = word.toUpperCase();
    const items = availableFunctions
      .filter((f) => f.name.toUpperCase().startsWith(upper))
      .slice(0, 8);
    if (items.length === 0) return null;
    return { word, start: pos - word.length, pos, items };
  }, [value, caretPos, isFormula, suppressUntilWord]);

  useEffect(() => {
    setAcIndex(0);
  }, [acState?.word]);
  useEffect(() => {
    if (suppressUntilWord && acState?.word !== suppressUntilWord) setSuppressUntilWord(null);
  }, [acState?.word, suppressUntilWord]);

  // 슬래시 명령 — formula 아닐 때, '/' 시작이면 popover
  const slashState = useMemo(() => {
    if (isFormula) return null;
    const v = String(value ?? '');
    if (!v.startsWith('/')) return null;
    const q = v.slice(1).toLowerCase();
    const matched = SLASH_COMMANDS.filter(
      (c) => q === '' || c.name.toLowerCase().includes(q) || c.label.toLowerCase().includes(q),
    );
    if (matched.length === 0) return null;
    return { items: matched };
  }, [value, isFormula]);
  useEffect(() => {
    setSlashIndex(0);
  }, [slashState?.items.length]);

  const insertFunc = (name: string) => {
    if (!acState) return;
    const v = String(value ?? '');
    const newValue = v.slice(0, acState.start) + name + '(' + v.slice(acState.pos);
    const newCaret = acState.start + name.length + 1;
    onChange(newValue);
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (input) {
        input.setSelectionRange(newCaret, newCaret);
        input.focus();
      }
      setCaretPos(newCaret);
    });
  };

  const applySlash = (cmd: SlashCommand) => {
    const next = cmd.resolve();
    onChange(next);
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (input) {
        input.setSelectionRange(next.length, next.length);
        input.focus();
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (acState && acState.items.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAcIndex((i) => Math.min(i + 1, acState.items.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAcIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        insertFunc(acState.items[acIndex].name);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSuppressUntilWord(acState.word);
        return;
      }
    }
    if (slashState && slashState.items.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex((i) => Math.min(i + 1, slashState.items.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        applySlash(slashState.items[slashIndex]);
        return;
      }
    }
    onKeyDown(e);
  };

  return (
    <>
      <input
        ref={(node) => {
          inputRef.current = node;
          innerRef(node);
        }}
        type={inputType}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setCaretPos(e.target.selectionStart);
        }}
        onSelect={(e) => setCaretPos((e.target as HTMLInputElement).selectionStart)}
        onKeyDown={handleKeyDown}
        onBlur={onBlur}
        className="absolute z-50"
        style={baseStyle}
        autoComplete="off"
        spellCheck={false}
      />
      {acState && acState.items.length > 0 && (
        <div
          className="absolute z-[100] rounded-md shadow-xl border overflow-hidden"
          style={{
            top: position.top + position.height + 4,
            left: position.left,
            minWidth: Math.max(280, position.width),
            background: 'var(--bg-primary)',
            borderColor: 'var(--border-primary)',
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {acState.items.map((f, idx) => (
            <button
              key={f.name}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                insertFunc(f.name);
              }}
              onMouseEnter={() => setAcIndex(idx)}
              className="w-full text-left px-2 py-1.5 flex flex-col gap-0.5 transition-colors"
              style={{
                background: idx === acIndex ? 'var(--bg-tertiary)' : 'transparent',
                borderTop: idx > 0 ? '1px solid var(--border-primary)' : 'none',
              }}
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold" style={{ color: 'var(--accent)' }}>
                  {f.name}
                </span>
                <span className="text-caption truncate" style={{ color: 'var(--text-secondary)' }}>
                  {f.description}
                </span>
              </div>
              <div className="text-caption font-mono" style={{ color: 'var(--text-tertiary)' }}>
                {f.syntax}
              </div>
            </button>
          ))}
          <div
            className="px-2 py-1 text-caption"
            style={{
              borderTop: '1px solid var(--border-primary)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-tertiary)',
            }}
          >
            ↑↓ 선택 · Tab/Enter 삽입 · Esc 닫기
          </div>
        </div>
      )}
      {slashState && slashState.items.length > 0 && (
        <div
          className="absolute z-[100] rounded-md shadow-xl border overflow-hidden"
          style={{
            top: position.top + position.height + 4,
            left: position.left,
            minWidth: Math.max(220, position.width),
            background: 'var(--bg-primary)',
            borderColor: 'var(--border-primary)',
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {slashState.items.map((c, idx) => (
            <button
              key={c.name}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                applySlash(c);
              }}
              onMouseEnter={() => setSlashIndex(idx)}
              className="w-full text-left px-2 py-1.5 flex items-center gap-2 transition-colors"
              style={{
                background: idx === slashIndex ? 'var(--bg-tertiary)' : 'transparent',
                borderTop: idx > 0 ? '1px solid var(--border-primary)' : 'none',
              }}
            >
              <span className="font-mono text-xs font-semibold" style={{ color: 'var(--accent)' }}>
                /{c.name}
              </span>
              <span className="text-xs flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                {c.label}
              </span>
              <span className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
                {c.hint}
              </span>
            </button>
          ))}
          <div
            className="px-2 py-1 text-caption"
            style={{
              borderTop: '1px solid var(--border-primary)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-tertiary)',
            }}
          >
            ↑↓ 선택 · Tab/Enter 삽입
          </div>
        </div>
      )}
    </>
  );
}

/** 링크 레코드 피커 — 검색 + 단일/다중 선택. */
function LinkRecordPicker({
  value,
  linkedSheet,
  linkedDisplayColumnId,
  multiple,
  position,
  borderWidth,
  onChange,
  onClose,
}: {
  value: string;
  linkedSheet: Sheet;
  linkedDisplayColumnId?: string;
  multiple: boolean;
  position: { top: number; left: number; width: number; height: number };
  borderWidth: number;
  onChange: (next: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const selected = useMemo(() => new Set(
    String(value || '').split(',').map((s) => s.trim()).filter(Boolean)
  ), [value]);

  const labelOf = (row: typeof linkedSheet.rows[number]): string => {
    if (linkedDisplayColumnId && row.cells[linkedDisplayColumnId] !== undefined) {
      return String(row.cells[linkedDisplayColumnId]);
    }
    return row.id.slice(0, 8);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return linkedSheet.rows;
    return linkedSheet.rows.filter((row) => {
      const label = labelOf(row).toLowerCase();
      if (label.includes(q)) return true;
      // 모든 셀 값에서도 검색
      return Object.values(row.cells).some((v) => String(v ?? '').toLowerCase().includes(q));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, linkedSheet]);

  const toggle = (rowId: string) => {
    if (multiple) {
      const next = new Set(selected);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      onChange(Array.from(next).join(','));
    } else {
      onChange(rowId);
      onClose();
    }
  };

  const clear = () => {
    onChange('');
    if (!multiple) onClose();
  };

  return (
    <div
      className="absolute z-50 rounded shadow-lg flex flex-col"
      style={{
        top: position.top,
        left: position.left,
        width: Math.max(position.width, 220),
        maxHeight: 320,
        background: 'var(--bg-primary)',
        border: `${borderWidth}px solid var(--editor-border-focus)`,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <div className="p-1.5 border-b" style={{ borderColor: 'var(--border-primary)' }}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`${linkedSheet.name} 검색...`}
          className="w-full px-2 py-1 text-xs rounded bg-transparent border"
          style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-2 text-xs text-center" style={{ color: 'var(--text-secondary)' }}>일치하는 레코드 없음</div>
        ) : (
          filtered.slice(0, 100).map((row) => {
            const isSel = selected.has(row.id);
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => toggle(row.id)}
                className="w-full text-left px-2 py-1 text-xs flex items-center gap-2 hover:bg-[var(--bg-tertiary)]"
                style={{ color: 'var(--text-primary)' }}
              >
                {multiple && (
                  <span
                    className="w-3 h-3 rounded flex items-center justify-center flex-shrink-0"
                    style={{
                      background: isSel ? 'var(--accent)' : 'transparent',
                      border: `1.5px solid ${isSel ? 'var(--accent)' : 'var(--border-primary)'}`,
                    }}
                  >
                    {isSel && <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 4 L3 6 L7 1.5" stroke="white" strokeWidth="1.5" fill="none" /></svg>}
                  </span>
                )}
                {!multiple && isSel && <span style={{ color: 'var(--accent)' }}>●</span>}
                <span className="truncate">{labelOf(row) || '(빈 값)'}</span>
              </button>
            );
          })
        )}
      </div>
      <div className="border-t p-1.5 flex items-center justify-between" style={{ borderColor: 'var(--border-primary)' }}>
        <button
          type="button"
          onClick={clear}
          className="text-caption px-1.5 py-0.5 rounded hover:bg-[var(--bg-tertiary)]"
          style={{ color: 'var(--text-secondary)' }}
        >
          선택 해제
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-caption px-2 py-0.5 rounded"
          style={{ background: 'var(--accent)', color: 'white' }}
        >
          {multiple ? '완료' : '닫기'}
        </button>
      </div>
    </div>
  );
}
