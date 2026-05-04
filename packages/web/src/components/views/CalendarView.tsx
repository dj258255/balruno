/**
 * Calendar 뷰. 월/주/일 모드 + 드래그로 날짜 변경.
 *
 * - 월: 7×5/6 셀 그리드, 셀당 최대 3 row 미리 표시
 * - 주: 7 일 컬럼, 시간대 없는 단순 list
 * - 일: 단일 날짜의 모든 row list
 * - 카드 드래그 → 다른 날짜 셀 drop → updateCell 로 date 컬럼 갱신
 */

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useProjectStore } from '@/stores/projectStore';
import { useRecordDetail } from '@/stores/recordDetailStore';
import CustomSelect from '@/components/ui/CustomSelect';
import type { Sheet, Row } from '@/types';
import RecordContextMenu, { type RecordContextMenuState } from './RecordContextMenu';

interface CalendarViewProps {
  projectId: string;
  sheet: Sheet;
}

type CalendarMode = 'month' | 'week' | 'day';

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() - out.getDay()); // 일요일 시작
  return out;
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function addDays(d: Date, n: number): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() + n);
  return out;
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
const WEEKDAY_KEYS = ['weekday_sun', 'weekday_mon', 'weekday_tue', 'weekday_wed', 'weekday_thu', 'weekday_fri', 'weekday_sat'] as const;

function fmtHeader(d: Date, mode: CalendarMode, getWeekday: (i: number) => string): string {
  if (mode === 'day') {
    return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()} (${getWeekday(d.getDay())})`;
  }
  if (mode === 'week') {
    const wkStart = startOfWeek(d);
    const wkEnd = addDays(wkStart, 6);
    return `${wkStart.getMonth() + 1}/${wkStart.getDate()} – ${wkEnd.getMonth() + 1}/${wkEnd.getDate()}`;
  }
  return `${d.getFullYear()}. ${d.getMonth() + 1}`;
}

export default function CalendarView({ projectId, sheet }: CalendarViewProps) {
  const t = useTranslations();
  const tCal = useTranslations('calendarView');
  const getWeekday = (i: number) => tCal(WEEKDAY_KEYS[i]);
  const WEEKDAYS = WEEKDAY_KEYS.map((k) => tCal(k));
  const updateSheet = useProjectStore((s) => s.updateSheet);
  const updateCell = useProjectStore((s) => s.updateCell);
  const addRow = useProjectStore((s) => s.addRow);
  const deleteRow = useProjectStore((s) => s.deleteRow);
  const [cursor, setCursor] = useState<Date>(startOfMonth(new Date()));
  const [mode, setMode] = useState<CalendarMode>('month');
  const openedRowId = useRecordDetail((s) =>
    s.opened && s.opened.sheetId === sheet.id ? s.opened.rowId : null,
  );
  const openRecord = useRecordDetail((s) => s.openRecord);
  const closeRecord = useRecordDetail((s) => s.closeRecord);
  const selectRow = (rowId: string) => openRecord({ projectId, sheetId: sheet.id, rowId });
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<RecordContextMenuState | null>(null);

  const dateColumns = sheet.columns.filter((c) => c.type === 'date');
  const dateColId =
    (dateColumns.find((c) => c.id === sheet.viewGroupColumnId)?.id) ??
    dateColumns[0]?.id;
  const dateCol = sheet.columns.find((c) => c.id === dateColId);

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

  const createOnDate = (date: Date) => {
    if (!dateCol) return;
    const rowId = addRow(projectId, sheet.id, { [dateCol.id]: iso(date) });
    selectRow(rowId);
  };

  const handleDrop = (date: Date) => {
    const rowId = dragOverDate; // hack reuse
    setDragOverDate(null);
    void rowId;
  };

  const onDropCard = (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    if (!dateCol) return;
    const rowId = e.dataTransfer.getData('text/plain');
    if (!rowId) return;
    updateCell(projectId, sheet.id, rowId, dateCol.id, iso(date));
    setDragOverDate(null);
  };

  const stepBack = () => {
    if (mode === 'month') setCursor(addMonths(cursor, -1));
    else if (mode === 'week') setCursor(addDays(cursor, -7));
    else setCursor(addDays(cursor, -1));
  };
  const stepForward = () => {
    if (mode === 'month') setCursor(addMonths(cursor, 1));
    else if (mode === 'week') setCursor(addDays(cursor, 7));
    else setCursor(addDays(cursor, 1));
  };
  const today = () => setCursor(mode === 'month' ? startOfMonth(new Date()) : new Date());

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-2 border-b flex items-center gap-3" style={{ borderColor: 'var(--border-primary)' }}>
          <button onClick={stepBack} className="p-1 rounded hover:bg-[var(--bg-hover)]" aria-label={tCal('previousAria')}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium min-w-[140px] text-center" style={{ color: 'var(--text-primary)' }}>
            {fmtHeader(cursor, mode, getWeekday)}
          </span>
          <button onClick={stepForward} className="p-1 rounded hover:bg-[var(--bg-hover)]" aria-label={tCal('nextAria')}>
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={today}
            className="ml-1 px-2 py-1 text-xs rounded hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--text-secondary)' }}
          >
            {t('views.calendarToday')}
          </button>

          {/* 모드 토글 */}
          <div className="ml-2 flex gap-0.5 p-0.5 rounded" style={{ background: 'var(--bg-tertiary)' }}>
            {(['month', 'week', 'day'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="px-2 py-0.5 text-caption rounded"
                style={{
                  background: mode === m ? 'var(--accent)' : 'transparent',
                  color: mode === m ? 'white' : 'var(--text-secondary)',
                }}
              >
                {m === 'month' ? tCal('modeMonth') : m === 'week' ? tCal('modeWeek') : tCal('modeDay')}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('views.calendarDateColumn')}:</span>
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

        <div
          className="flex-1 overflow-auto p-3"
          role="region"
          aria-label={tCal('calendarAria', { sheet: sheet.name, label: mode === 'month' ? tCal('monthlyLabel') : mode === 'week' ? tCal('weeklyLabel') : tCal('dailyLabel') })}
        >
          {mode === 'month' && (
            <MonthGrid
              cursor={cursor}
              byDate={byDate}
              titleCol={titleCol}
              onCellClick={createOnDate}
              onCardClick={selectRow}
              onCardDragStart={(rowId, e) => e.dataTransfer.setData('text/plain', rowId)}
              onCardDrop={onDropCard}
              onCardDragOver={(date) => setDragOverDate(iso(date))}
              onCardContextMenu={(rowId, x, y) => setCtxMenu({ rowId, x, y })}
              dragOverDate={dragOverDate}
            />
          )}
          {mode === 'week' && (
            <WeekStrip
              cursor={cursor}
              byDate={byDate}
              titleCol={titleCol}
              onCellClick={createOnDate}
              onCardClick={selectRow}
              onCardDragStart={(rowId, e) => e.dataTransfer.setData('text/plain', rowId)}
              onCardDrop={onDropCard}
              onCardContextMenu={(rowId, x, y) => setCtxMenu({ rowId, x, y })}
            />
          )}
          {mode === 'day' && (
            <DayList
              date={cursor}
              rows={byDate.get(iso(cursor)) ?? []}
              titleCol={titleCol}
              sheet={sheet}
              onCardClick={selectRow}
              onAdd={() => createOnDate(cursor)}
              onCardContextMenu={(rowId, x, y) => setCtxMenu({ rowId, x, y })}
            />
          )}
          {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
          {(() => { void handleDrop; return null; })()}
        </div>
      </div>
      {/* RecordEditor 는 GlobalRecordDetail 에서 렌더 */}
      <RecordContextMenu
        state={ctxMenu}
        onClose={() => setCtxMenu(null)}
        onEdit={(rowId) => selectRow(rowId)}
        onDuplicate={(rowId) => {
          const src = sheet.rows.find((r) => r.id === rowId);
          if (src) addRow(projectId, sheet.id, { ...src.cells });
        }}
        onDelete={(rowId) => {
          deleteRow(projectId, sheet.id, rowId);
          if (openedRowId === rowId) closeRecord();
        }}
      />
    </div>
  );
}

function MonthGrid({
  cursor, byDate, titleCol, onCellClick, onCardClick, onCardDragStart, onCardDrop, onCardDragOver, onCardContextMenu, dragOverDate,
}: {
  cursor: Date;
  byDate: Map<string, Row[]>;
  titleCol: Sheet['columns'][number] | undefined;
  onCellClick: (date: Date) => void;
  onCardClick: (id: string) => void;
  onCardDragStart: (rowId: string, e: React.DragEvent) => void;
  onCardDrop: (e: React.DragEvent, date: Date) => void;
  onCardDragOver: (date: Date) => void;
  onCardContextMenu: (rowId: string, x: number, y: number) => void;
  dragOverDate: string | null;
}) {
  const tCal = useTranslations('calendarView');
  const WEEKDAYS = WEEKDAY_KEYS.map((k) => tCal(k));
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

  const todayKey = iso(new Date());

  return (
    <div
      className="grid grid-cols-7 gap-px"
      style={{ background: 'var(--border-primary)' }}
      role="grid"
    >
      {WEEKDAYS.map((w) => (
        <div
          key={w}
          role="columnheader"
          className="text-center text-xs py-1"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}
        >
          {w}
        </div>
      ))}
      {cells.map((cell, i) => {
        const key = cell.date ? iso(cell.date) : '';
        const isDragOver = dragOverDate === key;
        const isToday = key === todayKey;
        const cellLabel = cell.date
          ? tCal('cellTooltip', { m: cell.date.getMonth() + 1, d: cell.date.getDate(), today: isToday ? tCal('todayMark') : '', n: cell.rows.length })
          : '';
        return (
          <div
            key={i}
            role="gridcell"
            aria-label={cellLabel || undefined}
            aria-current={isToday ? 'date' : undefined}
            className="min-h-[80px] p-1 relative group"
            style={{
              background: !cell.date ? 'var(--bg-secondary)' : isDragOver ? 'var(--accent-light)' : 'var(--bg-primary)',
              outline: isToday ? '2px solid var(--accent)' : undefined,
              outlineOffset: '-2px',
            }}
            onDragOver={(e) => {
              if (!cell.date) return;
              e.preventDefault();
              onCardDragOver(cell.date);
            }}
            onDrop={(e) => cell.date && onCardDrop(e, cell.date)}
          >
            {cell.date && (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium" style={{ color: isToday ? 'var(--accent)' : 'var(--text-tertiary)' }}>
                    {cell.date.getDate()}
                  </span>
                  <button
                    type="button"
                    onClick={() => cell.date && onCellClick(cell.date)}
                    className="opacity-0 group-hover:opacity-100 text-xs w-4 h-4 rounded-full flex items-center justify-center transition-opacity"
                    style={{ background: 'var(--accent)', color: 'white' }}
                    aria-label={tCal('addAria')}
                  >
                    +
                  </button>
                </div>
                {cell.rows.slice(0, 3).map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    draggable
                    onDragStart={(e) => onCardDragStart(row.id, e)}
                    onClick={() => onCardClick(row.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      onCardContextMenu(row.id, e.clientX, e.clientY);
                    }}
                    className="w-full text-left text-xs px-1.5 py-0.5 rounded truncate mb-0.5 hover:ring-1 hover:ring-[var(--accent)] cursor-grab active:cursor-grabbing"
                    style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
                    title={String(row.cells[titleCol?.id ?? ''] ?? row.id)}
                  >
                    {titleCol ? String(row.cells[titleCol.id] ?? '·') : row.id.slice(0, 6)}
                  </button>
                ))}
                {cell.rows.length > 3 && (
                  <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
                    +{cell.rows.length - 3}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function WeekStrip({
  cursor, byDate, titleCol, onCellClick, onCardClick, onCardDragStart, onCardDrop, onCardContextMenu,
}: {
  cursor: Date;
  byDate: Map<string, Row[]>;
  titleCol: Sheet['columns'][number] | undefined;
  onCellClick: (date: Date) => void;
  onCardClick: (id: string) => void;
  onCardDragStart: (rowId: string, e: React.DragEvent) => void;
  onCardDrop: (e: React.DragEvent, date: Date) => void;
  onCardContextMenu: (rowId: string, x: number, y: number) => void;
}) {
  const tCal = useTranslations('calendarView');
  const getWeekday = (i: number) => tCal(WEEKDAY_KEYS[i]);
  const wkStart = startOfWeek(cursor);
  const days = Array.from({ length: 7 }).map((_, i) => addDays(wkStart, i));
  const todayKey = iso(new Date());

  return (
    <div className="grid grid-cols-7 gap-px" style={{ background: 'var(--border-primary)' }}>
      {days.map((d) => {
        const key = iso(d);
        const rows = byDate.get(key) ?? [];
        const isToday = key === todayKey;
        return (
          <div
            key={key}
            className="min-h-[300px] p-2 relative group flex flex-col"
            style={{
              background: 'var(--bg-primary)',
              outline: isToday ? '2px solid var(--accent)' : undefined,
              outlineOffset: '-2px',
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onCardDrop(e, d)}
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-overline" style={{ color: 'var(--text-tertiary)' }}>{getWeekday(d.getDay())}</div>
                <div className="text-sm font-semibold" style={{ color: isToday ? 'var(--accent)' : 'var(--text-primary)' }}>{d.getDate()}</div>
              </div>
              <button
                type="button"
                onClick={() => onCellClick(d)}
                className="opacity-0 group-hover:opacity-100 text-xs w-5 h-5 rounded-full flex items-center justify-center"
                style={{ background: 'var(--accent)', color: 'white' }}
              >
                +
              </button>
            </div>
            <div className="space-y-1 flex-1 overflow-y-auto">
              {rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  draggable
                  onDragStart={(e) => onCardDragStart(row.id, e)}
                  onClick={() => onCardClick(row.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onCardContextMenu(row.id, e.clientX, e.clientY);
                  }}
                  className="w-full text-left text-xs px-1.5 py-1 rounded truncate hover:ring-1 hover:ring-[var(--accent)] cursor-grab active:cursor-grabbing"
                  style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
                >
                  {titleCol ? String(row.cells[titleCol.id] ?? '·') : row.id.slice(0, 6)}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayList({
  date, rows, titleCol, sheet, onCardClick, onAdd, onCardContextMenu,
}: {
  date: Date;
  rows: Row[];
  titleCol: Sheet['columns'][number] | undefined;
  sheet: Sheet;
  onCardClick: (id: string) => void;
  onAdd: () => void;
  onCardContextMenu: (rowId: string, x: number, y: number) => void;
}) {
  const tCal = useTranslations('calendarView');
  const getWeekday = (i: number) => tCal(WEEKDAY_KEYS[i]);
  return (
    <div className="max-w-2xl mx-auto space-y-2">
      <div className="flex items-center justify-between px-2 py-1">
        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          {iso(date)} ({getWeekday(date.getDay())})
        </h3>
        <button
          onClick={onAdd}
          className="px-2 py-1 text-xs rounded"
          style={{ background: 'var(--accent)', color: 'white' }}
        >
          {tCal('addBtn')}
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="text-center text-xs py-12" style={{ color: 'var(--text-tertiary)' }}>{tCal('noRecords')}</p>
      ) : (
        rows.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => onCardClick(row.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              onCardContextMenu(row.id, e.clientX, e.clientY);
            }}
            className="w-full text-left p-3 rounded-lg border hover:ring-2 hover:ring-[var(--accent)]/30"
            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
          >
            <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
              {titleCol ? String(row.cells[titleCol.id] ?? '·') : row.id.slice(0, 6)}
            </div>
            <div className="text-caption mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              {sheet.columns
                .filter((c) => c.id !== titleCol?.id)
                .slice(0, 3)
                .map((c) => `${c.name}: ${row.cells[c.id] ?? '-'}`)
                .join('  ·  ')}
            </div>
          </button>
        ))
      )}
    </div>
  );
}
