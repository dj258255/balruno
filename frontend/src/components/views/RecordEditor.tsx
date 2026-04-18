'use client';

/**
 * 공용 레코드 편집 패널. Kanban 카드 클릭 / Calendar 이벤트 클릭 등에서 재사용.
 * 타입별 input (Track 1 Field 반영). updateCell 직접 호출 (autosave).
 */

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useProjectStore } from '@/stores/projectStore';
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
  column,
  value,
  onChange,
}: {
  column: Column;
  value: CellValue | undefined;
  onChange: (v: CellValue) => void;
}) {
  const inputStyle: React.CSSProperties = {
    background: 'var(--bg-primary)',
    borderColor: 'var(--border-primary)',
    color: 'var(--text-primary)',
  };

  switch (column.type) {
    case 'checkbox':
      return (
        <input
          type="checkbox"
          checked={value === 'true' || value === 1 || value === '1'}
          onChange={(e) => onChange(e.target.checked ? 'true' : '')}
          className="w-5 h-5"
        />
      );
    case 'date':
      return (
        <input
          type="date"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg text-sm"
          style={inputStyle}
        />
      );
    case 'url':
      return (
        <input
          type="url"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg text-sm"
          style={inputStyle}
        />
      );
    case 'select':
      return (
        <select
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg text-sm"
          style={inputStyle}
        >
          <option value="">—</option>
          {column.selectOptions?.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
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
                className="text-xs px-2 py-1 rounded"
                style={{
                  background: active ? (opt.color ?? 'var(--accent)') : 'var(--bg-tertiary)',
                  color: active ? 'white' : 'var(--text-secondary)',
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      );
    }
    case 'rating': {
      const max = column.ratingMax ?? 5;
      const n = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
      return (
        <div className="flex gap-1">
          {Array.from({ length: max }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onChange(i + 1 === n ? 0 : i + 1)}
              className="text-xl leading-none"
              style={{ color: i < n ? '#f59e0b' : 'var(--text-tertiary)' }}
            >
              ★
            </button>
          ))}
        </div>
      );
    }
    case 'currency':
      return (
        <input
          type="number"
          value={typeof value === 'number' ? value : typeof value === 'string' ? value : ''}
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            onChange(isNaN(n) ? '' : n);
          }}
          className="w-full px-3 py-2 border rounded-lg text-sm"
          style={inputStyle}
        />
      );
    case 'formula':
    case 'lookup':
    case 'rollup':
      return (
        <div
          className="px-3 py-2 rounded-lg text-sm"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}
        >
          {String(value ?? '(계산됨)')}
        </div>
      );
    default:
      return (
        <input
          type="text"
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg text-sm"
          style={inputStyle}
        />
      );
  }
}

export default function RecordEditor({ projectId, sheet, row, onClose, variant = 'side' }: RecordEditorProps) {
  const t = useTranslations();
  const updateCell = useProjectStore((s) => s.updateCell);

  const handleChange = (colId: string, value: CellValue) => {
    updateCell(projectId, sheet.id, row.id, colId, value);
  };

  const containerClass =
    variant === 'side'
      ? 'w-80 flex-shrink-0 border-l flex flex-col overflow-hidden'
      : 'w-full max-w-md rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[80vh]';

  return (
    <aside
      className={containerClass}
      style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {t('recordEditor.title')}
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-[var(--bg-hover)]"
          aria-label={t('common.close')}
          style={{ color: 'var(--text-tertiary)' }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {sheet.columns.map((col) => (
          <div key={col.id}>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              {col.name}
            </label>
            <TypedInput
              column={col}
              value={row.cells[col.id]}
              onChange={(v) => handleChange(col.id, v)}
            />
          </div>
        ))}
        {sheet.columns.length === 0 && (
          <p className="text-sm text-center" style={{ color: 'var(--text-tertiary)' }}>
            {t('views.formEmpty')}
          </p>
        )}
      </div>
    </aside>
  );
}
