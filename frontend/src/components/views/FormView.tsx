'use client';

/**
 * Track 4 MVP — Form 뷰.
 *
 * 컬럼 순서대로 입력 필드 + "추가" 버튼. 제출 시 addRow 호출.
 * Field 타입 (Track 1) 반영 — checkbox/select/date/url 등.
 */

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Sheet, CellValue } from '@/types';
import { useProjectStore } from '@/stores/projectStore';

interface FormViewProps {
  projectId: string;
  sheet: Sheet;
}

export default function FormView({ projectId, sheet }: FormViewProps) {
  const t = useTranslations();
  const addRow = useProjectStore((s) => s.addRow);
  const [draft, setDraft] = useState<Record<string, CellValue>>({});
  const [submitting, setSubmitting] = useState(false);

  // 수식 컬럼은 폼에서 제외 (자동 계산)
  const editableColumns = sheet.columns.filter(
    (c) => c.type !== 'formula' && c.type !== 'lookup' && c.type !== 'rollup'
  );

  const handleSubmit = () => {
    setSubmitting(true);
    try {
      addRow(projectId, sheet.id, draft);
      setDraft({});
    } finally {
      setSubmitting(false);
    }
  };

  const renderInput = (columnId: string, colType: string, col: typeof editableColumns[number]) => {
    const value = draft[columnId];
    const setValue = (v: CellValue) => setDraft({ ...draft, [columnId]: v });

    switch (colType) {
      case 'checkbox':
        return (
          <input
            type="checkbox"
            checked={value === 'true' || value === 1}
            onChange={(e) => setValue(e.target.checked ? 'true' : '')}
            className="w-5 h-5"
          />
        );
      case 'date':
        return (
          <input
            type="date"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => setValue(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
          />
        );
      case 'url':
        return (
          <input
            type="url"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => setValue(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
          />
        );
      case 'select':
        return (
          <select
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => setValue(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
          >
            <option value="">—</option>
            {col.selectOptions?.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        );
      case 'rating':
      case 'currency':
        return (
          <input
            type="number"
            value={typeof value === 'number' ? value : typeof value === 'string' ? value : ''}
            onChange={(e) => {
              const n = parseFloat(e.target.value);
              setValue(isNaN(n) ? '' : n);
            }}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
          />
        );
      default:
        return (
          <input
            type="text"
            value={value === null || value === undefined ? '' : String(value)}
            onChange={(e) => setValue(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
          />
        );
    }
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-md mx-auto space-y-4">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          {t('views.formHeading', { name: sheet.name })}
        </h2>
        {editableColumns.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {t('views.formEmpty')}
          </p>
        ) : (
          <>
            {editableColumns.map((col) => (
              <div key={col.id}>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  {col.name}
                </label>
                {renderInput(col.id, col.type, col)}
              </div>
            ))}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ background: '#10b981', color: 'white' }}
            >
              <Plus className="w-4 h-4" />
              {t('views.formAdd')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
