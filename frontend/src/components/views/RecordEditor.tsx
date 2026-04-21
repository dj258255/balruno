'use client';

/**
 * 공용 레코드 편집 패널 — Kanban 카드 / Calendar 이벤트 / Gallery / Gantt 에서 재사용.
 *
 * UX 개선 (Airtable/Linear 벤치마크):
 *  - 헤더: ID/제목 + 상태 뱃지 + 복제/삭제 액션
 *  - 필드 그룹화: 메타 (ID/제목/상태) → 속성 → 날짜
 *  - 타입별 전용 입력 (checkbox 토글, rating 별, multiSelect pill, select 색상)
 *  - 자동저장 + Esc 힌트 footer (기존 유지)
 */

import { useState, useMemo } from 'react';
import { X, Check, Copy, Trash2, Star, History, ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useProjectStore } from '@/stores/projectStore';
import { toast } from '@/components/ui/Toast';
import Select from '@/components/ui/Select';
import type { Sheet, Row, Column, CellValue, ChangeEntry } from '@/types';

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
          <span className="text-xs">{checked ? '예' : '아니오'}</span>
        </button>
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
            <span className="text-caption" style={{ color: 'var(--text-tertiary)' }}>옵션이 없습니다</span>
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
  const setCurrentSheet = useProjectStore((s) => s.setCurrentSheet);
  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));
  const [confirmDelete, setConfirmDelete] = useState(false);

  // North Star — 역방향 링크: 이 레코드가 task 로서 연결된 모든 셀 변경 조회.
  // task-link 컬럼이 가리키는 target row 중 하나가 이 row 이면 표시.
  const relatedChanges = useMemo<ChangeEntry[]>(() => {
    const changelog = project?.changelog ?? [];
    return changelog
      .filter((c) => c.linkedTaskIds?.includes(row.id))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20);
  }, [project?.changelog, row.id]);

  const jumpToChange = (entry: ChangeEntry) => {
    if (!project?.sheets.find((s) => s.id === entry.sheetId)) return;
    setCurrentSheet(entry.sheetId);
    window.dispatchEvent(
      new CustomEvent('balruno:focus-cell', {
        detail: { sheetId: entry.sheetId, rowId: entry.rowId, columnId: entry.columnId },
      })
    );
    onClose();
  };

  const handleChange = (colId: string, value: CellValue) => {
    updateCell(projectId, sheet.id, row.id, colId, value);
  };

  const handleDuplicate = () => {
    addRow(projectId, sheet.id, { ...row.cells });
    toast.success('레코드를 복제했습니다');
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    deleteRow(projectId, sheet.id, row.id);
    toast.info('레코드를 삭제했습니다');
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
              title="복제"
              aria-label="레코드 복제"
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
              title={confirmDelete ? '다시 클릭해 확인' : '삭제'}
              aria-label="레코드 삭제"
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
              <FieldGroup label="기본" columns={metaCols} row={row} onChange={handleChange} />
            )}
            {otherCols.length > 0 && (
              <FieldGroup label="속성" columns={otherCols} row={row} onChange={handleChange} />
            )}
            {dateCols.length > 0 && (
              <FieldGroup label="일정" columns={dateCols} row={row} onChange={handleChange} />
            )}
            {/* 역방향 링크 — 이 task 가 연결된 셀 변경 history */}
            {relatedChanges.length > 0 && (
              <RelatedChangesSection
                changes={relatedChanges}
                sheets={project?.sheets ?? []}
                onJump={jumpToChange}
              />
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
          자동 저장됨
        </span>
        <kbd
          className="px-1.5 py-0.5 rounded border font-mono"
          style={{
            borderColor: 'var(--border-primary)',
            background: 'var(--bg-primary)',
            color: 'var(--text-secondary)',
          }}
        >
          Esc 로 닫기
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

/**
 * 역방향 링크 섹션 — 이 task 레코드와 연결된 셀 변경 history.
 * North Star 완성: "셀 → task" (task-link 필드) 와 "task → 셀 변경" (여기) 양방향 조회.
 */
function RelatedChangesSection({
  changes, sheets, onJump,
}: {
  changes: ChangeEntry[];
  sheets: Sheet[];
  onJump: (entry: ChangeEntry) => void;
}) {
  const sheetName = (id: string) =>
    sheets.find((s) => s.id === id)?.name ?? '(삭제된 시트)';
  const columnName = (sheetId: string, colId: string) =>
    sheets.find((s) => s.id === sheetId)?.columns.find((c) => c.id === colId)?.name
    ?? '(삭제된 컬럼)';

  const formatTime = (ts: number): string => {
    const diff = Date.now() - ts;
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}초 전`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}분 전`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}시간 전`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}일 전`;
    return new Date(ts).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  const formatValue = (v: unknown): string => {
    if (v === null || v === undefined || v === '') return '—';
    const s = String(v);
    return s.length > 20 ? s.slice(0, 18) + '…' : s;
  };

  return (
    <div
      className="p-4 space-y-2 border-b last:border-b-0"
      style={{ borderColor: 'var(--border-primary)' }}
    >
      <div className="flex items-center gap-1.5">
        <History className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
        <span
          className="text-overline"
          style={{ color: 'var(--text-tertiary)' }}
        >
          연결된 변경 ({changes.length})
        </span>
      </div>
      <div className="space-y-1">
        {changes.map((entry) => (
          <button
            key={entry.id}
            onClick={() => onJump(entry)}
            className="group w-full text-left p-2 rounded-lg border transition-colors hover:bg-[var(--bg-hover)]"
            style={{
              borderColor: 'var(--border-primary)',
              background: 'var(--bg-secondary)',
            }}
          >
            <div className="flex items-center justify-between text-caption mb-1">
              <span style={{ color: 'var(--text-tertiary)' }}>
                {formatTime(entry.timestamp)}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {entry.userName || entry.userId}
              </span>
            </div>
            <div className="text-caption mb-1" style={{ color: 'var(--text-primary)' }}>
              <b>{sheetName(entry.sheetId)}</b>
              <span className="mx-1" style={{ color: 'var(--text-tertiary)' }}>/</span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {columnName(entry.sheetId, entry.columnId)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-caption font-mono">
              <span
                className="px-1.5 py-0.5 rounded truncate"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  textDecoration: 'line-through',
                }}
              >
                {formatValue(entry.before)}
              </span>
              <ArrowRight className="w-3 h-3 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
              <span
                className="px-1.5 py-0.5 rounded truncate"
                style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}
              >
                {formatValue(entry.after)}
              </span>
            </div>
            {entry.reason && (
              <div
                className="text-caption mt-1 italic"
                style={{ color: 'var(--text-tertiary)' }}
              >
                &ldquo;{entry.reason}&rdquo;
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
