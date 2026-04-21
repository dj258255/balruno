'use client';

/**
 * Track 4 — Form 뷰 (Airtable 스타일 수집 폼).
 *
 * 목적: 외부 이해관계자/팀원이 스프레드시트 편집 없이 레코드를 "제출".
 * - 폼 설명 + 최근 제출 프리뷰 + 세션 카운터로 "수집 인터페이스" 느낌 강화
 * - Field 타입 (Track 1) 반영 — checkbox 토글, rating 별, select 드롭다운 등
 * - 제출 시 toast + 필드 리셋
 */

import { useMemo, useState } from 'react';
import { Plus, Check, Link as LinkIcon, CheckCircle2, RotateCcw, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Sheet, CellValue, Column } from '@/types';
import { useProjectStore } from '@/stores/projectStore';
import { toast } from '@/components/ui/Toast';
import Select from '@/components/ui/Select';
import RecordEditor from './RecordEditor';
import RecordContextMenu, { type RecordContextMenuState } from './RecordContextMenu';

interface FormViewProps {
  projectId: string;
  sheet: Sheet;
}

export default function FormView({ projectId, sheet }: FormViewProps) {
  const t = useTranslations();
  const addRow = useProjectStore((s) => s.addRow);
  const deleteRow = useProjectStore((s) => s.deleteRow);
  const [draft, setDraft] = useState<Record<string, CellValue>>({});
  const [submitting, setSubmitting] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<RecordContextMenuState | null>(null);
  const selectedRow = selectedRowId ? sheet.rows.find((r) => r.id === selectedRowId) : null;

  // 수식 / 자동 계산 컬럼은 폼에서 제외
  const editableColumns = useMemo(
    () => sheet.columns.filter((c) => c.type !== 'formula' && c.type !== 'lookup' && c.type !== 'rollup'),
    [sheet.columns],
  );

  // 제목 컬럼 (최근 제출 프리뷰용)
  const titleCol = useMemo(
    () => sheet.columns.find((c) => c.type === 'general' || c.type === 'formula'),
    [sheet.columns],
  );

  // 최근 3건 (뒤에서 3개 = 최근 제출 3개라 가정)
  const recentRows = useMemo(
    () => sheet.rows.slice(-3).reverse(),
    [sheet.rows],
  );

  const handleSubmit = () => {
    setSubmitting(true);
    try {
      addRow(projectId, sheet.id, draft);
      setDraft({});
      setSessionCount((c) => c + 1);
      toast.success('레코드가 추가되었습니다');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setDraft({});
  };

  const handleCopyShareHint = () => {
    // 백엔드 없이는 진짜 공유 링크 불가 — 우선 안내만
    toast.info('공유 가능한 외부 폼 링크는 백엔드 연동 후 제공됩니다');
  };

  const renderInput = (col: Column) => {
    const value = draft[col.id];
    const setValue = (v: CellValue) => setDraft({ ...draft, [col.id]: v });
    const inputClass = 'w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition';
    const inputStyle: React.CSSProperties = {
      background: 'var(--bg-primary)',
      borderColor: 'var(--border-primary)',
      color: 'var(--text-primary)',
    };

    switch (col.type) {
      case 'checkbox': {
        const checked = value === 'true' || value === 1 || value === '1';
        return (
          <button
            type="button"
            onClick={() => setValue(checked ? '' : 'true')}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors"
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
            <span className="text-sm">{checked ? '예' : '아니오'}</span>
          </button>
        );
      }

      case 'rating': {
        const max = col.ratingMax ?? 5;
        const n = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
        return (
          <div className="flex items-center gap-1" role="radiogroup" aria-label={col.name}>
            {Array.from({ length: max }).map((_, i) => {
              const idx = i + 1;
              const active = idx <= n;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setValue(idx === n ? 0 : idx)}
                  className="p-0.5 transition-transform hover:scale-110"
                  aria-checked={active}
                  role="radio"
                >
                  <Star
                    size={22}
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

      case 'date':
        return (
          <input
            type="date"
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => setValue(e.target.value)}
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
            onChange={(e) => setValue(e.target.value)}
            className={inputClass}
            style={inputStyle}
          />
        );

      case 'select':
        return (
          <Select
            value={typeof value === 'string' ? value : ''}
            onChange={setValue}
            placeholder="선택하세요"
            options={(col.selectOptions ?? []).map((opt) => ({
              value: opt.id, label: opt.label, color: opt.color,
            }))}
          />
        );

      case 'multiSelect': {
        const ids = typeof value === 'string' ? value.split(',').map((s) => s.trim()).filter(Boolean) : [];
        return (
          <div className="flex flex-wrap gap-1.5">
            {col.selectOptions?.map((opt) => {
              const active = ids.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    const next = active ? ids.filter((i) => i !== opt.id) : [...ids, opt.id];
                    setValue(next.join(','));
                  }}
                  className="text-xs px-2.5 py-1 rounded-full transition-colors"
                  style={{
                    background: active ? (opt.color ?? 'var(--accent)') : 'var(--bg-tertiary)',
                    color: active ? 'white' : 'var(--text-secondary)',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
            {(col.selectOptions?.length ?? 0) === 0 && (
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>옵션이 없습니다</span>
            )}
          </div>
        );
      }

      case 'currency':
        return (
          <div className="relative">
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
              style={{ color: 'var(--text-tertiary)' }}
            >
              {col.currencyFormat?.symbol ?? '₩'}
            </span>
            <input
              type="number"
              value={typeof value === 'number' ? value : typeof value === 'string' ? value : ''}
              onChange={(e) => {
                const n = parseFloat(e.target.value);
                setValue(isNaN(n) ? '' : n);
              }}
              className={inputClass + ' pl-7'}
              style={inputStyle}
            />
          </div>
        );

      default:
        return (
          <input
            type="text"
            value={value === null || value === undefined ? '' : String(value)}
            onChange={(e) => setValue(e.target.value)}
            className={inputClass}
            style={inputStyle}
          />
        );
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-xl mx-auto p-6 pb-16 space-y-5">
        {/* 헤더 카드 */}
        <div
          className="rounded-2xl p-5 space-y-1"
          style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(139,92,246,0.08))',
            border: '1px solid var(--border-primary)',
          }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              {t('views.formHeading', { name: sheet.name })}
            </h2>
            <button
              onClick={handleCopyShareHint}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-md hover:bg-[var(--bg-tertiary)] transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              title="외부 공유 링크 (백엔드 연동 필요)"
            >
              <LinkIcon size={12} />
              공유 링크
            </button>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            제출된 레코드는 <strong>{sheet.name}</strong> 시트에 자동으로 추가됩니다.
            {sessionCount > 0 && (
              <span className="ml-1" style={{ color: 'var(--accent)' }}>
                · 이번 세션 {sessionCount}건 제출
              </span>
            )}
          </p>
        </div>

        {/* 폼 본체 */}
        <div
          className="rounded-2xl border p-6 space-y-4"
          style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
        >
          {editableColumns.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
              {t('views.formEmpty')}
            </p>
          ) : (
            <>
              {editableColumns.map((col) => {
                const isRequired = col.validation?.required;
                return (
                  <div key={col.id}>
                    <label className="flex items-center gap-1 text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                      {col.name}
                      {isRequired && <span style={{ color: '#ef4444' }}>*</span>}
                    </label>
                    {renderInput(col)}
                  </div>
                );
              })}

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-60"
                  style={{ background: '#10b981', color: 'white' }}
                >
                  <Plus className="w-4 h-4" />
                  {t('views.formAdd')}
                </button>
                <button
                  onClick={handleReset}
                  disabled={Object.keys(draft).length === 0 || submitting}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm transition-colors hover:bg-[var(--bg-tertiary)] disabled:opacity-40"
                  style={{ color: 'var(--text-secondary)' }}
                  title="필드 초기화"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  초기화
                </button>
              </div>
            </>
          )}
        </div>

        {/* 최근 제출 프리뷰 */}
        {recentRows.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
              <CheckCircle2 size={12} />
              최근 제출 ({Math.min(recentRows.length, 3)}건)
            </div>
            <div className="space-y-1.5">
              {recentRows.map((row) => {
                const label = titleCol
                  ? String(row.cells[titleCol.id] ?? row.id.slice(0, 8))
                  : row.id.slice(0, 8);
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSelectedRowId(row.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setCtxMenu({ rowId: row.id, x: e.clientX, y: e.clientY });
                    }}
                    className="w-full px-3 py-2 rounded-lg text-xs flex items-center gap-2 hover:ring-2 hover:ring-[var(--accent)]/30 transition-all text-left cursor-pointer"
                    style={{
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                    }}
                    title="클릭: 편집  ·  우클릭: 메뉴"
                  >
                    <Check size={12} style={{ color: '#10b981', flexShrink: 0 }} />
                    <span className="flex-1 truncate">{label || '(빈 값)'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 최근 제출 항목 편집 */}
      {selectedRow && (
        <RecordEditor
          projectId={projectId}
          sheet={sheet}
          row={selectedRow}
          onClose={() => setSelectedRowId(null)}
        />
      )}

      {/* 우클릭 컨텍스트 메뉴 */}
      <RecordContextMenu
        state={ctxMenu}
        onClose={() => setCtxMenu(null)}
        onEdit={(rowId) => setSelectedRowId(rowId)}
        onDuplicate={(rowId) => {
          const src = sheet.rows.find((r) => r.id === rowId);
          if (src) addRow(projectId, sheet.id, { ...src.cells });
        }}
        onDelete={(rowId) => {
          deleteRow(projectId, sheet.id, rowId);
          if (selectedRowId === rowId) setSelectedRowId(null);
        }}
      />
    </div>
  );
}
