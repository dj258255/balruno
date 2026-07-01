/**
 * 공용 레코드 편집 패널 — Kanban 카드 / Calendar 이벤트 / Gallery / Gantt / 그리드 에서 재사용.
 *
 * UX 개선 (Airtable/Linear 벤치마크):
 *  - 헤더: ID/제목 + 상태 뱃지 + 복제/삭제 액션
 *  - 필드 그룹화: 메타 (ID/제목/상태) → 속성 → 날짜
 *  - 타입별 전용 입력 (checkbox 토글, rating 별, multiSelect pill, select 색상, longText 마크다운)
 *  - 자동저장 + Esc 힌트 footer (기존 유지)
 */

import { useState } from 'react';
import { X, Check, Copy, Trash2, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useProjectStore } from '@/stores/projectStore';
import { toast } from '@/components/ui/Toast';
import Select from '@/components/ui/Select';
import { MiniMarkdown } from '@/lib/miniMarkdown';
import type { Sheet, Row, Column, CellValue } from '@/types';

interface RecordEditorProps {
  projectId: string;
  sheet: Sheet;
  row: Row;
  onClose: () => void;
  /** 사이드 패널 스타일 (기본) vs 모달 스타일 선택 */
  variant?: 'side' | 'modal';
}

function TypedInput({
  column, value, onChange,
}: {
  column: Column;
  value: CellValue | undefined;
  onChange: (v: CellValue) => void;
}) {
  const t = useTranslations();
  const [preview, setPreview] = useState(false);
  const inputClass = 'w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition';
  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-primary)',
    borderColor: 'var(--border-primary)',
    color: 'var(--text-primary)',
  };

  switch (column.type) {
    case 'checkbox': {
      const checked = value === 'true' || value === 1 || value === '1';
      return (
        <button
          type="button"
          onClick={() => onChange(checked ? '' : 'true')}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors"
          style={{
            background: checked ? 'var(--accent-light)' : 'var(--bg-primary)',
            borderColor: checked ? 'var(--accent)' : 'var(--border-primary)',
            color: checked ? 'var(--accent)' : 'var(--text-secondary)',
          }}
          aria-pressed={checked}
        >
          <span
            className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
            style={{
              background: checked ? 'var(--accent)' : 'transparent',
              border: `1.5px solid ${checked ? 'var(--accent)' : 'var(--border-primary)'}`,
            }}
          >
            {checked && <Check size={11} color="white" strokeWidth={3} />}
          </span>
          <span className="text-xs">{checked ? t('recordEditor.yes') : t('recordEditor.no')}</span>
        </button>
      );
    }

    case 'longText': {
      const text = typeof value === 'string' ? value : value == null ? '' : String(value);
      return (
        <div className="space-y-1.5">
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setPreview((p) => !p)}
              className="text-caption px-2 py-0.5 rounded border transition-colors hover:bg-[var(--bg-tertiary)]"
              style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
              aria-pressed={preview}
            >
              {preview ? t('recordEditor.edit') : t('recordEditor.preview')}
            </button>
          </div>
          {preview ? (
            <div
              className="px-3 py-2 border rounded-lg text-sm min-h-[8rem] overflow-y-auto"
              style={{ ...inputStyle, borderColor: 'var(--border-primary)' }}
            >
              {text.trim()
                ? <MiniMarkdown source={text} />
                : <span style={{ color: 'var(--text-tertiary)' }}>{t('recordEditor.longTextEmpty')}</span>}
            </div>
          ) : (
            <textarea
              rows={8}
              placeholder={t('recordEditor.longTextPlaceholder')}
              value={text}
              onChange={(e) => onChange(e.target.value)}
              className={inputClass + ' resize-y min-h-[8rem] font-mono leading-relaxed'}
              style={inputStyle}
            />
          )}
        </div>
      );
    }

    case 'date':
      return (
        <input
          type="date"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
          style={inputStyle}
        />
      );

    case 'url':
      return (
        <input
          type="url"
          placeholder="https://..."
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
          style={inputStyle}
        />
      );

    case 'select':
      return (
        <Select
          value={typeof value === 'string' ? value : ''}
          onChange={onChange}
          placeholder="—"
          options={(column.selectOptions ?? []).map((opt) => ({
            value: opt.id, label: opt.label, color: opt.color,
          }))}
        />
      );

    case 'multiSelect': {
      const ids = typeof value === 'string' ? value.split(',').map((s) => s.trim()).filter(Boolean) : [];
      return (
        <div className="flex flex-wrap gap-1">
          {column.selectOptions?.map((opt) => {
            const active = ids.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  const next = active ? ids.filter((i) => i !== opt.id) : [...ids, opt.id];
                  onChange(next.join(','));
                }}
                className="text-xs px-2 py-1 rounded-full transition-colors"
                style={{
                  background: active ? (opt.color ?? 'var(--accent)') : 'var(--bg-tertiary)',
                  color: active ? 'white' : 'var(--text-secondary)',
                }}
              >
                {opt.label}
              </button>
            );
          })}
          {(column.selectOptions?.length ?? 0) === 0 && (
            <span className="text-caption" style={{ color: 'var(--text-tertiary)' }}>{t('recordEditor.noOptions')}</span>
          )}
        </div>
      );
    }

    case 'rating': {
      const max = column.ratingMax ?? 5;
      const n = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
      return (
        <div className="flex items-center gap-0.5" role="radiogroup">
          {Array.from({ length: max }).map((_, i) => {
            const idx = i + 1;
            const active = idx <= n;
            return (
              <button
                key={i}
                type="button"
                onClick={() => onChange(idx === n ? 0 : idx)}
                className="p-0.5 transition-transform hover:scale-110"
                aria-checked={active}
                role="radio"
              >
                <Star
                  size={18}
                  fill={active ? '#f59e0b' : 'transparent'}
                  stroke={active ? '#f59e0b' : 'var(--border-primary)'}
                  strokeWidth={1.5}
                />
              </button>
            );
          })}
        </div>
      );
    }

    case 'currency':
      return (
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {column.currencyFormat?.symbol ?? '₩'}
          </span>
          <input
            type="number"
            value={typeof value === 'number' ? value : typeof value === 'string' ? value : ''}
            onChange={(e) => {
              const n = parseFloat(e.target.value);
              onChange(isNaN(n) ? '' : n);
            }}
            className={inputClass + ' pl-7'}
            style={inputStyle}
          />
        </div>
      );

    case 'formula':
    case 'lookup':
    case 'rollup':
      return (
        <div
          className="px-3 py-2 rounded-lg text-sm flex items-center gap-2"
          style={{
            background: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
            border: '1px dashed var(--border-primary)',
          }}
        >
          <span className="text-overline px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-primary)', color: 'var(--text-tertiary)' }}>
            {column.type === 'formula' ? 'ƒx' : column.type}
          </span>
          <span className="truncate">{String(value ?? '')}</span>
        </div>
      );

    default:
      return (
        <input
          type="text"
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
          style={inputStyle}
        />
      );
  }
}

export default function RecordEditor({ projectId, sheet, row, onClose, variant = 'side' }: RecordEditorProps) {
  const t = useTranslations();
  const updateCell = useProjectStore((s) => s.updateCell);
  const deleteRow = useProjectStore((s) => s.deleteRow);
  const addRow = useProjectStore((s) => s.addRow);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleChange = (colId: string, value: CellValue) => {
    updateCell(projectId, sheet.id, row.id, colId, value);
  };

  const handleDuplicate = () => {
    addRow(projectId, sheet.id, { ...row.cells });
    toast.success(t('recordEditor.recordDuplicated'));
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    deleteRow(projectId, sheet.id, row.id);
    toast.info(t('recordEditor.recordDeleted'));
    onClose();
  };

  // 제목 후보 (첫 general/formula 컬럼 값)
  const titleCol = sheet.columns.find((c) => c.type === 'general' || c.type === 'formula');
  const idCol = sheet.columns.find((c) => c.name.toLowerCase() === 'id' || c.name.toLowerCase().endsWith('id'));
  const statusCol = sheet.columns.find((c) => c.type === 'select');

  const titleValue = titleCol ? String(row.cells[titleCol.id] ?? '') : '';
  const idValue = idCol ? String(row.cells[idCol.id] ?? '') : '';
  const statusOption = statusCol
    ? statusCol.selectOptions?.find((o) => o.id === row.cells[statusCol.id])
    : null;

  // 필드 그룹핑 — 메타(ID/제목/select), 속성(나머지), 날짜(date)
  const metaColIds = new Set([idCol?.id, titleCol?.id, statusCol?.id].filter(Boolean) as string[]);
  const dateCols = sheet.columns.filter((c) => c.type === 'date');
  const metaCols = sheet.columns.filter((c) => metaColIds.has(c.id));
  const otherCols = sheet.columns.filter(
    (c) => !metaColIds.has(c.id) && c.type !== 'date'
  );

  // variant='side': fixed floating panel — Kanban 컬럼 / DockedToolbox 와 공간 경쟁 X.
  // 위/아래/오른쪽 고정, z-40 으로 DockedToolbox(z-10) 위 오버레이. 모바일은 전체 너비.
  const containerClass =
    variant === 'side'
      ? 'fixed right-0 top-0 bottom-0 w-full sm:w-[400px] max-w-full border-l flex flex-col overflow-hidden z-40 shadow-2xl'
      : 'w-full max-w-md rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[80vh]';

  return (
    <aside
      className={containerClass}
      style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
    >
      {/* 헤더: 제목/ID + 상태 + 액션 */}
      <div
        className="px-4 py-3 border-b flex-shrink-0 space-y-2"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
              {t('recordEditor.title')}
            </h3>
            {idValue && (
              <span
                className="text-caption font-mono px-1.5 py-0.5 rounded"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
              >
                {idValue}
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <button
              onClick={handleDuplicate}
              className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] transition-colors"
              title={t('recordEditor.duplicate')}
              aria-label={t('recordEditor.duplicateAria')}
            >
              <Copy className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
            </button>
            <button
              onClick={handleDelete}
              className="p-1.5 rounded transition-colors"
              style={{
                background: confirmDelete ? 'rgba(239,68,68,0.15)' : 'transparent',
                color: confirmDelete ? '#ef4444' : 'var(--text-secondary)',
              }}
              title={confirmDelete ? t('recordEditor.clickAgainToConfirm') : t('recordEditor.delete')}
              aria-label={t('recordEditor.deleteAria')}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-4 mx-0.5" style={{ background: 'var(--border-primary)' }} />
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] transition-colors"
              aria-label={t('common.close')}
            >
              <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>
        </div>

        {titleValue && (
          <div className="flex items-start gap-2">
            <h2
              className="text-base font-semibold leading-snug break-words flex-1"
              style={{ color: 'var(--text-primary)' }}
            >
              {titleValue}
            </h2>
            {statusOption && (
              <span
                className="text-caption font-medium px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5"
                style={{
                  background: statusOption.color ? `${statusOption.color}20` : 'var(--bg-tertiary)',
                  color: statusOption.color ?? 'var(--text-secondary)',
                }}
              >
                {statusOption.label}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 본문 — 그룹별 필드. RecordEditor 는 fixed top-0 bottom-0 라 dock 과 z-index 로 겹침, pb 로 여유 */}
      <div className="flex-1 overflow-y-auto pb-20 md:pb-24">
        {sheet.columns.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
            {t('views.formEmpty')}
          </p>
        ) : (
          <>
            {metaCols.length > 0 && (
              <FieldGroup label={t('recordEditor.groupBasic')} columns={metaCols} row={row} onChange={handleChange} />
            )}
            {otherCols.length > 0 && (
              <FieldGroup label={t('recordEditor.groupProperties')} columns={otherCols} row={row} onChange={handleChange} />
            )}
            {dateCols.length > 0 && (
              <FieldGroup label={t('recordEditor.groupSchedule')} columns={dateCols} row={row} onChange={handleChange} />
            )}
          </>
        )}
      </div>

      {/* 하단 footer — 자동 저장 + Esc */}
      <div
        className="flex-shrink-0 border-t px-4 py-2.5 flex items-center justify-between text-caption"
        style={{
          borderColor: 'var(--border-primary)',
          background: 'var(--bg-secondary)',
          color: 'var(--text-tertiary)',
        }}
      >
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          {t('recordEditor.autoSaved')}
        </span>
        <kbd
          className="px-1.5 py-0.5 rounded border font-mono"
          style={{
            borderColor: 'var(--border-primary)',
            background: 'var(--bg-primary)',
            color: 'var(--text-secondary)',
          }}
        >
          {t('recordEditor.closeWithEsc')}
        </kbd>
      </div>
    </aside>
  );
}

function FieldGroup({
  label, columns, row, onChange,
}: {
  label: string;
  columns: Column[];
  row: Row;
  onChange: (colId: string, value: CellValue) => void;
}) {
  return (
    <div className="p-4 space-y-3 border-b last:border-b-0" style={{ borderColor: 'var(--border-primary)' }}>
      <div className="text-overline" style={{ color: 'var(--text-tertiary)' }}>
        {label}
      </div>
      {columns.map((col) => (
        <div key={col.id}>
          <label
            className="block text-xs font-medium mb-1"
            style={{ color: 'var(--text-secondary)' }}
          >
            {col.name}
          </label>
          <TypedInput
            column={col}
            value={row.cells[col.id]}
            onChange={(v) => onChange(col.id, v)}
          />
        </div>
      ))}
    </div>
  );
}
