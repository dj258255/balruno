'use client';

/**
 * Track 4 MVP — Calendar 뷰.
 * date 타입 컬럼 기준 월 뷰. 네비게이션(이전/다음 달), 날짜별 레코드 표시.
 */

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useProjectStore } from '@/stores/projectStore';
import CustomSelect from '@/components/ui/CustomSelect';
import type { Sheet, Row } from '@/types';

interface CalendarViewProps {
  projectId: string;
  sheet: Sheet;
}

const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}
function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function CalendarView({ projectId, sheet }: CalendarViewProps) {
  const t = useTranslations();
  const updateSheet = useProjectStore((s) => s.updateSheet);
  const [cursor, setCursor] = useState<Date>(startOfMonth(new Date()));

  const dateColumns = sheet.columns.filter((c) => c.type === 'date');
  const dateColId =
    (dateColumns.find((c) => c.id === sheet.viewGroupColumnId)?.id) ??
    dateColumns[0]?.id;
  const dateCol = sheet.columns.find((c) => c.id === dateColId);

  // 제목 컬럼 (보통 첫 일반 컬럼)
  const titleCol = sheet.columns.find(
    (c) => c.type === 'general' || c.type === 'formula'
  );

  // 날짜별 행 매핑
  const byDate = useMemo(() => {
    const map = new Map<string, Row[]>();
    if (!dateCol) return map;
    sheet.rows.forEach((row) => {
      const v = row.cells[dateCol.id];
      if (!v) return;
      const key = typeof v === 'string' ? v.slice(0, 10) : String(v).slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    });
    return map;
  }, [sheet.rows, dateCol]);

  if (dateColumns.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-2 max-w-sm">
          <p className="text-base font-medium" style={{ color: 'var(--text-secondary)' }}>
            {t('views.calendarNeedDate')}
          </p>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {t('views.calendarNeedDateDesc')}
          </p>
        </div>
      </div>
    );
  }

  const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const firstDayOfWeek = firstDay.getDay();
  const numDays = daysInMonth(cursor);
  const cells: Array<{ date: Date | null; rows: Row[] }> = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push({ date: null, rows: [] });
  for (let d = 1; d <= numDays; d++) {
    const date = new Date(cursor.getFullYear(), cursor.getMonth(), d);
    cells.push({ date, rows: byDate.get(iso(date)) ?? [] });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, rows: [] });

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div
        className="px-4 py-2 border-b flex items-center gap-3"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <button
          onClick={() => setCursor(addMonths(cursor, -1))}
          className="p-1 rounded hover:bg-[var(--bg-hover)]"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-medium min-w-[100px] text-center" style={{ color: 'var(--text-primary)' }}>
          {cursor.getFullYear()}. {cursor.getMonth() + 1}
        </span>
        <button
          onClick={() => setCursor(addMonths(cursor, 1))}
          className="p-1 rounded hover:bg-[var(--bg-hover)]"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => setCursor(startOfMonth(new Date()))}
          className="ml-2 px-2 py-1 text-xs rounded hover:bg-[var(--bg-hover)]"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('views.calendarToday')}
        </button>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {t('views.calendarDateColumn')}:
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
      </div>

      <div className="flex-1 overflow-auto p-3">
        <div className="grid grid-cols-7 gap-px" style={{ background: 'var(--border-primary)' }}>
          {WEEKDAYS_KO.map((w) => (
            <div
              key={w}
              className="text-center text-xs py-1"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}
            >
              {w}
            </div>
          ))}
          {cells.map((cell, i) => (
            <div
              key={i}
              className="min-h-[80px] p-1"
              style={{
                background: cell.date ? 'var(--bg-primary)' : 'var(--bg-secondary)',
              }}
            >
              {cell.date && (
                <>
                  <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>
                    {cell.date.getDate()}
                  </div>
                  {cell.rows.slice(0, 3).map((row) => (
                    <div
                      key={row.id}
                      className="text-xs px-1.5 py-0.5 rounded truncate mb-0.5"
                      style={{
                        background: 'var(--accent-light)',
                        color: 'var(--accent)',
                      }}
                      title={String(row.cells[titleCol?.id ?? ''] ?? row.id)}
                    >
                      {titleCol ? String(row.cells[titleCol.id] ?? '·') : row.id.slice(0, 6)}
                    </div>
                  ))}
                  {cell.rows.length > 3 && (
                    <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                      +{cell.rows.length - 3}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
