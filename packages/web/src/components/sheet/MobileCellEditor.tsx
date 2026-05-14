'use client';

/**
 * Bottom-sheet cell editor for mobile (ADR 0022 v1.2 stage B').
 *
 * Replaces the absolutely-positioned inline {@link CellEditor} on
 * viewports < 768px. Reasons:
 *   - The inline editor sits on top of a 2044-line virtualized
 *     SheetTable rendered with display:flex. Touch keyboards on
 *     iOS/Android shift the viewport, which the absolute-position
 *     calculation can't track.
 *   - Tap targets on a 32-px-tall cell are below the 44px Apple HIG
 *     minimum.
 *   - Long values overflow horizontally — the inline editor scrolls
 *     within the cell width, hiding the user's input mid-edit.
 *
 * Notion / Airtable / Baserow mobile all do the same — tap a cell
 * and a half-screen sheet rises from the bottom with a normal full-
 * width input. Cancel / Save buttons at 56-px tall sit inside the
 * Apple HIG comfortable range.
 *
 * Reuses the same finishEditing / setEditValue / cancelEditing
 * contract the desktop CellEditor consumes, so the SheetTable
 * state machine treats both editors identically.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ColumnType, SelectOption, Sheet } from '@/types';

interface MobileCellEditorProps {
  /** The cell label shown in the header — typically `${column.name}` or
   *  `${column.name} · Row N`. The sheet's column metadata can be
   *  passed in directly, but we keep this as a string so the caller
   *  builds whatever phrasing fits. */
  cellLabel: string;
  value: string;
  columnType?: ColumnType;
  selectOptions?: SelectOption[];
  linkedSheet?: Sheet | null;
  linkedDisplayColumnId?: string;
  linkedMultiple?: boolean;
  /** Commit + close. */
  onCommit: (value: string) => void;
  /** Dismiss without saving. */
  onCancel: () => void;
  /** Live value sync — used by formula bar mirroring + autocomplete. */
  onChange?: (value: string) => void;
}

export function MobileCellEditor({
  cellLabel,
  value,
  columnType,
  selectOptions,
  linkedSheet,
  linkedDisplayColumnId,
  linkedMultiple,
  onCommit,
  onCancel,
  onChange,
}: MobileCellEditorProps) {
  const t = useTranslations('common');
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  // Link picker search — typing here filters the row list. The
  // displayed slice is hard-capped at 100 (mobile viewport renders
  // ~20 rows visible), so without filtering the user can't see
  // anything past row 100 in a 1k+ row sheet. This input solves
  // the correctness gap — empty query keeps the original slice.
  const [linkSearch, setLinkSearch] = useState('');

  // Focus on mount + scroll the input into view above the keyboard.
  // iOS Safari needs the focus call inside a microtask after the
  // portal mounts, otherwise the keyboard pops without the page
  // adjusting and the input ends up under the keyboard.
  useEffect(() => {
    const handle = setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => clearTimeout(handle);
  }, []);

  // Close on Escape (rarely used on mobile but cheap).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  // Render the body based on column type. select / multiSelect render
  // a button list; link delegates to a simple typeahead; everything
  // else is a textarea (multi-line input fits long values better than
  // single-line input on mobile).
  const renderBody = () => {
    if (columnType === 'checkbox') {
      const isOn = value === 'true' || value === '1';
      return (
        <button
          type="button"
          onClick={() => onCommit(isOn ? 'false' : 'true')}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-md border-2"
          style={{
            borderColor: isOn ? 'var(--accent)' : 'var(--border-primary)',
            background: isOn ? 'var(--accent)' : 'transparent',
            color: isOn ? 'white' : 'var(--text-primary)',
          }}
        >
          <Check className="h-5 w-5" />
          {isOn ? '체크됨' : '체크 안 됨'}
        </button>
      );
    }
    if (columnType === 'select' && selectOptions) {
      return (
        <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto">
          {selectOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onCommit(opt.id)}
              className="flex items-center gap-3 rounded-md border px-4 py-3 text-left text-base"
              style={{
                borderColor:
                  value === opt.id ? 'var(--accent)' : 'var(--border-primary)',
                background:
                  value === opt.id ? 'var(--accent-light)' : 'transparent',
                color: 'var(--text-primary)',
              }}
            >
              <span
                className="h-3 w-3 rounded-full flex-shrink-0"
                style={{ background: opt.color ?? '#94a3b8' }}
              />
              <span className="flex-1">{opt.label}</span>
              {value === opt.id && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      );
    }
    if (columnType === 'multiSelect' && selectOptions) {
      const selected = new Set(
        String(value || '').split(',').map((s) => s.trim()).filter(Boolean),
      );
      return (
        <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto">
          {selectOptions.map((opt) => {
            const isOn = selected.has(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  if (isOn) selected.delete(opt.id);
                  else selected.add(opt.id);
                  onChange?.(Array.from(selected).join(','));
                }}
                className="flex items-center gap-3 rounded-md border px-4 py-3 text-left text-base"
                style={{
                  borderColor: isOn ? 'var(--accent)' : 'var(--border-primary)',
                  background: isOn ? 'var(--accent-light)' : 'transparent',
                  color: 'var(--text-primary)',
                }}
              >
                <span
                  className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border"
                  style={{
                    borderColor: isOn ? 'var(--accent)' : 'var(--border-primary)',
                    background: isOn ? 'var(--accent)' : 'transparent',
                  }}
                >
                  {isOn && <Check className="h-3 w-3 text-white" />}
                </span>
                <span
                  className="h-3 w-3 rounded-full flex-shrink-0"
                  style={{ background: opt.color ?? '#94a3b8' }}
                />
                <span className="flex-1">{opt.label}</span>
              </button>
            );
          })}
        </div>
      );
    }
    if (columnType === 'link' && linkedSheet) {
      return (
        <LinkPickerBody
          linkedSheet={linkedSheet}
          linkedDisplayColumnId={linkedDisplayColumnId}
          linkedMultiple={linkedMultiple}
          value={value}
          search={linkSearch}
          setSearch={setLinkSearch}
          onCommit={onCommit}
          onChange={onChange}
        />
      );
    }

    // Default: textarea (multi-line input). Better than single-line on
    // mobile — long values stay visible without horizontal scroll.
    return (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        rows={4}
        autoFocus
        className="w-full rounded-md border px-3 py-3 text-base"
        style={{
          borderColor: 'var(--border-primary)',
          background: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          fontSize: '16px', // iOS Safari zoom prevention
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onCommit(value);
          }
        }}
      />
    );
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      {/* Backdrop dims everything behind the sheet. Tap to dismiss. */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onCancel}
      />
      {/* Sheet itself — slides up from the bottom. fixed bottom-0 with
          rounded top corners gives the iOS UISheetPresentationController
          look without animation framework dependency. */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t shadow-2xl"
        style={{
          borderColor: 'var(--border-primary)',
          background: 'var(--bg-primary)',
          maxHeight: '70vh',
        }}
      >
        {/* Drag handle visual — purely decorative, not interactive */}
        <div className="mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-neutral-300 dark:bg-neutral-600" />
        <div
          className="flex items-center justify-between border-b px-4 py-2"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <span
            className="text-sm font-medium"
            style={{ color: 'var(--text-primary)' }}
          >
            {cellLabel}
          </span>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-11 w-11 items-center justify-center rounded hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--text-secondary)' }}
            aria-label={t('cancel')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[55vh] overflow-y-auto px-4 py-3">
          {renderBody()}
        </div>
        <div
          className="flex gap-2 border-t px-4 py-3"
          style={{ borderColor: 'var(--border-primary)' }}
        >
          <button
            type="button"
            onClick={onCancel}
            className="h-12 flex-1 rounded-md border text-base"
            style={{
              borderColor: 'var(--border-primary)',
              color: 'var(--text-secondary)',
            }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => onCommit(value)}
            className="h-12 flex-1 rounded-md bg-neutral-900 text-base text-white dark:bg-neutral-100 dark:text-neutral-900"
          >
            저장
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}

interface LinkPickerBodyProps {
  linkedSheet: Sheet;
  linkedDisplayColumnId?: string;
  linkedMultiple?: boolean;
  value: string;
  search: string;
  setSearch: (next: string) => void;
  onCommit: (next: string) => void;
  onChange?: (next: string) => void;
}

function LinkPickerBody({
  linkedSheet,
  linkedDisplayColumnId,
  linkedMultiple,
  value,
  search,
  setSearch,
  onCommit,
  onChange,
}: LinkPickerBodyProps) {
  const t = useTranslations('common');
  const labelOf = (row: typeof linkedSheet.rows[number]) =>
    linkedDisplayColumnId
      ? String(row.cells[linkedDisplayColumnId] ?? row.id.slice(0, 8))
      : row.id.slice(0, 8);

  // Filter rows by case-insensitive substring on the display label.
  // Hard-cap the rendered slice at 100 to keep the touch list snappy
  // on mid-range Android (frame budget ~16ms, button rendering past
  // 100 entries blows it). When a user has > 100 matching rows and
  // the target isn't in the slice, the search input narrows it down.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return linkedSheet.rows.slice(0, 100);
    return linkedSheet.rows
      .filter((r) => labelOf(r).toLowerCase().includes(q))
      .slice(0, 100);
    // labelOf depends on linkedDisplayColumnId only — listing it
    // separately keeps the dep array stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedSheet.rows, linkedDisplayColumnId, search]);

  const truncated = !search.trim() && linkedSheet.rows.length > 100;

  return (
    <div className="flex flex-col gap-2">
      <div
        className="flex items-center gap-2 rounded-md border px-3"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <Search className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('search')}
          className="h-11 flex-1 bg-transparent outline-none text-base"
          style={{ color: 'var(--text-primary)', fontSize: '16px' }}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-[var(--bg-hover)]"
            aria-label={t('close')}
          >
            <X className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
          </button>
        )}
      </div>
      {truncated && (
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {linkedSheet.rows.length.toLocaleString()}개 중 100개 표시 — 검색으로 좁히세요
        </p>
      )}
      {filtered.length === 0 && (
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          {search.trim() ? '일치하는 행이 없습니다' : '연결할 행이 없습니다'}
        </p>
      )}
      <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto">
        {filtered.map((row) => {
          const isSelected = linkedMultiple
            ? new Set(
                String(value || '').split(',').map((s) => s.trim()).filter(Boolean),
              ).has(row.id)
            : value === row.id;
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => {
                if (linkedMultiple) {
                  const selected = new Set(
                    String(value || '').split(',').map((s) => s.trim()).filter(Boolean),
                  );
                  if (selected.has(row.id)) selected.delete(row.id);
                  else selected.add(row.id);
                  onChange?.(Array.from(selected).join(','));
                } else {
                  onCommit(row.id);
                }
              }}
              className="flex items-center gap-2 rounded-md border px-4 py-3 text-left text-base"
              style={{
                borderColor: isSelected ? 'var(--accent)' : 'var(--border-primary)',
                background: isSelected ? 'var(--accent-light)' : 'transparent',
                color: 'var(--text-primary)',
              }}
            >
              <span className="flex-1">{labelOf(row) || '(빈 값)'}</span>
              {isSelected && <Check className="h-4 w-4" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
