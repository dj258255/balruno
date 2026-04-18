'use client';

/**
 * Track 4 MVP — Gantt 뷰.
 * 단일 date 컬럼 기준 수평 타임라인. SVAR Gantt 통합은 다음 세션.
 * 각 레코드 = 해당 날짜 하루짜리 막대. duration 컬럼은 다음 버전.
 */

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useProjectStore } from '@/stores/projectStore';
import CustomSelect from '@/components/ui/CustomSelect';
import type { Sheet } from '@/types';
import RecordEditor from './RecordEditor';

interface GanttViewProps {
  projectId: string;
  sheet: Sheet;
}

function parseDate(v: unknown): Date | null {
  if (!v) return null;
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

export default function GanttView({ projectId, sheet }: GanttViewProps) {
  const t = useTranslations();
  const updateSheet = useProjectStore((s) => s.updateSheet);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const selectedRow = selectedRowId ? sheet.rows.find((r) => r.id === selectedRowId) : null;

  const dateColumns = sheet.columns.filter((c) => c.type === 'date');
  const dateColId =
    (dateColumns.find((c) => c.id === sheet.viewGroupColumnId)?.id) ??
    dateColumns[0]?.id;
  const dateCol = sheet.columns.find((c) => c.id === dateColId);

  const titleCol = sheet.columns.find(
    (c) => c.type === 'general' || c.type === 'formula'
  );

  const { rowsWithDate, minDate, maxDate } = useMemo(() => {
    if (!dateCol) return { rowsWithDate: [], minDate: null, maxDate: null };
    const rowsWithDate = sheet.rows
      .map((row) => ({ row, date: parseDate(row.cells[dateCol.id]) }))
      .filter((r): r is { row: typeof r.row; date: Date } => r.date !== null);
    if (rowsWithDate.length === 0) return { rowsWithDate, minDate: null, maxDate: null };
    const times = rowsWithDate.map((r) => r.date.getTime());
    const minDate = new Date(Math.min(...times));
    const maxDate = new Date(Math.max(...times));
    // 여유 3일 padding
    minDate.setDate(minDate.getDate() - 3);
    maxDate.setDate(maxDate.getDate() + 3);
    return { rowsWithDate, minDate, maxDate };
  }, [sheet.rows, dateCol]);

  if (dateColumns.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-2 max-w-sm">
          <p className="text-base font-medium" style={{ color: 'var(--text-secondary)' }}>
            {t('views.ganttNeedDate')}
          </p>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {t('views.ganttNeedDateDesc')}
          </p>
        </div>
      </div>
    );
  }

  const totalDays = minDate && maxDate ? daysBetween(minDate, maxDate) + 1 : 1;
  const DAY_W = 32;

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
      <div
        className="px-4 py-2 border-b flex items-center gap-3"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {t('views.ganttDateColumn')}:
        </span>
        <div className="w-40">
          <CustomSelect
            value={dateColId ?? ''}
            onChange={(v) => updateSheet(projectId, sheet.id, { viewGroupColumnId: v })}
            options={dateColumns.map((c) => ({ value: c.id, label: c.name }))}
            size="sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {rowsWithDate.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--text-tertiary)' }}>
            유효한 날짜 데이터가 없습니다.
          </div>
        ) : (
          <div className="flex">
            {/* 좌측 레코드 이름 열 */}
            <div
              className="flex-shrink-0 border-r"
              style={{ borderColor: 'var(--border-primary)', width: 200 }}
            >
              <div
                className="h-8 border-b px-3 flex items-center text-xs"
                style={{ borderColor: 'var(--border-primary)', color: 'var(--text-tertiary)' }}
              >
                {titleCol?.name ?? 'ID'}
              </div>
              {rowsWithDate.map(({ row }) => (
                <button
                  type="button"
                  key={row.id}
                  onClick={() => setSelectedRowId(row.id)}
                  className="w-full h-10 px-3 flex items-center text-sm border-b text-left hover:bg-[var(--bg-hover)]"
                  style={{
                    borderColor: 'var(--border-primary)',
                    color: 'var(--text-primary)',
                    background: selectedRowId === row.id ? 'var(--bg-hover)' : 'transparent',
                  }}
                >
                  <span className="truncate">
                    {titleCol ? String(row.cells[titleCol.id] ?? row.id.slice(0, 6)) : row.id.slice(0, 6)}
                  </span>
                </button>
              ))}
            </div>

            {/* 타임라인 */}
            <div style={{ width: totalDays * DAY_W }}>
              {/* 날짜 헤더 */}
              <div
                className="h-8 border-b flex"
                style={{ borderColor: 'var(--border-primary)' }}
              >
                {Array.from({ length: totalDays }).map((_, i) => {
                  const d = new Date(minDate!);
                  d.setDate(d.getDate() + i);
                  return (
                    <div
                      key={i}
                      className="flex-shrink-0 text-[10px] text-center border-r flex flex-col items-center justify-center"
                      style={{
                        width: DAY_W,
                        borderColor: 'var(--border-primary)',
                        color: 'var(--text-tertiary)',
                      }}
                    >
                      <div>{d.getMonth() + 1}/{d.getDate()}</div>
                    </div>
                  );
                })}
              </div>
              {/* 행별 막대 */}
              {rowsWithDate.map(({ row, date }) => {
                const offset = daysBetween(minDate!, date);
                return (
                  <div
                    key={row.id}
                    className="h-10 border-b relative"
                    style={{ borderColor: 'var(--border-primary)' }}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedRowId(row.id)}
                      className="absolute top-2 bottom-2 rounded hover:brightness-110"
                      style={{
                        left: offset * DAY_W + 2,
                        width: DAY_W - 4,
                        background: 'var(--accent)',
                        outline: selectedRowId === row.id ? '2px solid white' : 'none',
                      }}
                      title={date.toISOString().slice(0, 10)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      </div>
      {selectedRow && (
        <RecordEditor
          projectId={projectId}
          sheet={sheet}
          row={selectedRow}
          onClose={() => setSelectedRowId(null)}
        />
      )}
    </div>
  );
}
