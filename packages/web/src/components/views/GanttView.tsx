/**
 * Gantt 뷰. start+end range + 의존성 화살표 + 드래그 재스케줄.
 *
 * 컬럼 매핑:
 *   - start: viewGroupColumnId (date)
 *   - end:   viewGanttEndColumnId (date, optional — 없으면 1일 막대)
 *   - depends: viewGanttDependsColumnId (link, predecessor row id 다중)
 *
 * 인터랙션:
 *   - 막대 본체 드래그 → 평행이동 (start/end 동시 시프트)
 *   - 막대 우측 끝 드래그 → end 만 늘리기/줄이기
 *   - 의존성 컬럼이 link 면 화살표 SVG overlay
 */

import { useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useProjectStore } from '@/stores/projectStore';
import { useRecordDetail } from '@/stores/recordDetailStore';
import CustomSelect from '@/components/ui/CustomSelect';
import type { Sheet, Column } from '@/types';
import RecordContextMenu, { type RecordContextMenuState } from './RecordContextMenu';

interface GanttViewProps {
  projectId: string;
  sheet: Sheet;
}

function parseDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}
function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function addDays(d: Date, n: number): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() + n);
  return out;
}

const DAY_W = 32;
const ROW_H = 40;

export default function GanttView({ projectId, sheet }: GanttViewProps) {
  const t = useTranslations();
  const updateSheet = useProjectStore((s) => s.updateSheet);
  const updateCell = useProjectStore((s) => s.updateCell);
  const addRow = useProjectStore((s) => s.addRow);
  const deleteRow = useProjectStore((s) => s.deleteRow);
  const openedRowId = useRecordDetail((s) =>
    s.opened && s.opened.sheetId === sheet.id ? s.opened.rowId : null,
  );
  const openRecord = useRecordDetail((s) => s.openRecord);
  const closeRecord = useRecordDetail((s) => s.closeRecord);
  const selectRow = (rowId: string) => openRecord({ projectId, sheetId: sheet.id, rowId });
  const [ctxMenu, setCtxMenu] = useState<RecordContextMenuState | null>(null);
  const dragState = useRef<{ rowId: string; mode: 'move' | 'resize-end'; startX: number; origStart: Date; origEnd: Date } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ rowId: string; deltaDays: number; mode: 'move' | 'resize-end' } | null>(null);

  const dateColumns = sheet.columns.filter((c) => c.type === 'date');
  const linkColumns = sheet.columns.filter((c) => c.type === 'link');
  const startColId =
    (dateColumns.find((c) => c.id === sheet.viewGroupColumnId)?.id) ??
    dateColumns[0]?.id;
  const startCol = sheet.columns.find((c) => c.id === startColId);
  const endColId = sheet.viewGanttEndColumnId;
  const endCol = sheet.columns.find((c) => c.id === endColId);
  const dependsCol = sheet.columns.find((c) => c.id === sheet.viewGanttDependsColumnId);

  const titleCol = sheet.columns.find((c) => c.type === 'general' || c.type === 'formula');

  const { items, minDate, maxDate } = useMemo(() => {
    if (!startCol) return { items: [] as Array<{ row: Sheet['rows'][number]; start: Date; end: Date }>, minDate: null, maxDate: null };
    const items: Array<{ row: Sheet['rows'][number]; start: Date; end: Date }> = [];
    for (const row of sheet.rows) {
      const start = parseDate(row.cells[startCol.id]);
      if (!start) continue;
      const end = endCol ? parseDate(row.cells[endCol.id]) ?? start : start;
      items.push({ row, start, end: end < start ? start : end });
    }
    if (items.length === 0) return { items, minDate: null, maxDate: null };
    const allTimes = items.flatMap((i) => [i.start.getTime(), i.end.getTime()]);
    const minDate = new Date(Math.min(...allTimes));
    const maxDate = new Date(Math.max(...allTimes));
    minDate.setDate(minDate.getDate() - 3);
    maxDate.setDate(maxDate.getDate() + 3);
    return { items, minDate, maxDate };
  }, [sheet.rows, startCol, endCol]);

  if (dateColumns.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-2 max-w-sm">
          <p className="text-base font-medium" style={{ color: 'var(--text-secondary)' }}>{t('views.ganttNeedDate')}</p>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{t('views.ganttNeedDateDesc')}</p>
        </div>
      </div>
    );
  }

  const totalDays = minDate && maxDate ? daysBetween(minDate, maxDate) + 1 : 1;

  const onPointerDown = (rowId: string, mode: 'move' | 'resize-end', start: Date, end: Date) => (e: React.PointerEvent) => {
    e.stopPropagation();
    dragState.current = { rowId, mode, startX: e.clientX, origStart: start, origEnd: end };
    setDragPreview({ rowId, deltaDays: 0, mode });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const deltaDays = Math.round(dx / DAY_W);
    if (dragPreview?.deltaDays !== deltaDays) {
      setDragPreview({ rowId: dragState.current.rowId, deltaDays, mode: dragState.current.mode });
    }
  };

  const onPointerUp = () => {
    if (!dragState.current || !startCol) return;
    const { rowId, mode, origStart, origEnd } = dragState.current;
    const delta = dragPreview?.deltaDays ?? 0;
    if (delta !== 0) {
      if (mode === 'move') {
        updateCell(projectId, sheet.id, rowId, startCol.id, iso(addDays(origStart, delta)));
        if (endCol) {
          updateCell(projectId, sheet.id, rowId, endCol.id, iso(addDays(origEnd, delta)));
        }
      } else if (mode === 'resize-end' && endCol) {
        const newEnd = addDays(origEnd, delta);
        if (newEnd >= origStart) {
          updateCell(projectId, sheet.id, rowId, endCol.id, iso(newEnd));
        }
      }
    }
    dragState.current = null;
    setDragPreview(null);
  };

  // 의존성 화살표 좌표 계산
  const arrows = useMemo(() => {
    if (!dependsCol || !minDate) return [];
    const itemMap = new Map(items.map((it, idx) => [it.row.id, { item: it, idx }]));
    const result: Array<{ x1: number; y1: number; x2: number; y2: number; key: string }> = [];
    items.forEach((to, toIdx) => {
      const depsRaw = to.row.cells[dependsCol.id];
      if (!depsRaw) return;
      const fromIds = String(depsRaw).split(',').map((s) => s.trim()).filter(Boolean);
      for (const fromId of fromIds) {
        const fromInfo = itemMap.get(fromId);
        if (!fromInfo) continue;
        const fromOffset = daysBetween(minDate, fromInfo.item.end) + 1;
        const toOffset = daysBetween(minDate, to.start);
        const x1 = fromOffset * DAY_W;
        const y1 = fromInfo.idx * ROW_H + 8 + ROW_H / 2 - 4;
        const x2 = toOffset * DAY_W;
        const y2 = toIdx * ROW_H + 8 + ROW_H / 2 - 4;
        result.push({ x1, y1, x2, y2, key: `${fromId}->${to.row.id}` });
      }
    });
    return result;
  }, [items, dependsCol, minDate]);

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-2 border-b flex items-center gap-3 flex-wrap" style={{ borderColor: 'var(--border-primary)' }}>
          <Field label={t('views.ganttStart')}>
            <CustomSelect
              value={startColId ?? ''}
              onChange={(v) => updateSheet(projectId, sheet.id, { viewGroupColumnId: v })}
              options={dateColumns.map((c) => ({ value: c.id, label: c.name }))}
              size="sm"
            />
          </Field>
          <Field label={t('views.ganttEnd')}>
            <select
              value={endColId ?? ''}
              onChange={(e) => updateSheet(projectId, sheet.id, { viewGanttEndColumnId: e.target.value || undefined })}
              className="px-2 py-1 text-xs rounded border bg-transparent"
              style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
            >
              <option value="">{t('views.ganttSingleDay')}</option>
              {dateColumns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label={t('views.ganttDepends')}>
            <select
              value={sheet.viewGanttDependsColumnId ?? ''}
              onChange={(e) => updateSheet(projectId, sheet.id, { viewGanttDependsColumnId: e.target.value || undefined })}
              className="px-2 py-1 text-xs rounded border bg-transparent"
              style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
            >
              <option value="">{t('views.ganttNone')}</option>
              {linkColumns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="flex-1 overflow-auto">
          {items.length === 0 ? (
            <div className="text-center py-16" style={{ color: 'var(--text-tertiary)' }}>{t('views.ganttNoData')}</div>
          ) : (
            <div
              className="flex relative"
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {/* 좌측 레코드 이름 열 */}
              <div className="flex-shrink-0 border-r" style={{ borderColor: 'var(--border-primary)', width: 200 }}>
                {/* 2 단 헤더 높이 맞춤 — 타임라인 측 (월 h-6=24px + 일/요일 h-8=32px = 56px) 과 정렬.
                    아래 row 영역이 어긋나지 않게 반드시 같은 총 높이 유지. */}
                <div className="h-6 border-b" style={{ borderColor: 'var(--border-primary)' }} />
                <div className="h-8 border-b px-3 flex items-center text-xs" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-tertiary)' }}>
                  {titleCol?.name ?? 'ID'}
                </div>
                {items.map(({ row }) => (
                  <button
                    type="button"
                    key={row.id}
                    onClick={() => selectRow(row.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setCtxMenu({ rowId: row.id, x: e.clientX, y: e.clientY });
                    }}
                    className="w-full px-3 flex items-center text-sm border-b text-left hover:bg-[var(--bg-hover)]"
                    style={{
                      height: ROW_H,
                      borderColor: 'var(--border-primary)',
                      color: 'var(--text-primary)',
                      background: openedRowId === row.id ? 'var(--bg-hover)' : 'transparent',
                    }}
                  >
                    <span className="truncate">{titleCol ? String(row.cells[titleCol.id] ?? row.id.slice(0, 6)) : row.id.slice(0, 6)}</span>
                  </button>
                ))}
              </div>

              {/* 타임라인 */}
              <div style={{ width: totalDays * DAY_W, position: 'relative' }}>
                {/* 날짜 헤더 — 2단: 월(merged) + 일/요일 */}
                {(() => {
                  // 월별 셀 병합 정보 계산
                  const monthSegments: Array<{ year: number; month: number; startIdx: number; days: number }> = [];
                  for (let i = 0; i < totalDays; i++) {
                    const d = addDays(minDate!, i);
                    const y = d.getFullYear();
                    const m = d.getMonth();
                    const last = monthSegments[monthSegments.length - 1];
                    if (last && last.year === y && last.month === m) last.days++;
                    else monthSegments.push({ year: y, month: m, startIdx: i, days: 1 });
                  }
                  return (
                    <>
                      {/* 상단: 연-월 (merged) */}
                      <div className="h-6 border-b flex sticky top-0 z-10" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-primary)' }}>
                        {monthSegments.map((seg) => (
                          <div
                            key={`${seg.year}-${seg.month}-${seg.startIdx}`}
                            className="flex-shrink-0 text-caption font-semibold border-r flex items-center justify-start px-2"
                            style={{
                              width: seg.days * DAY_W,
                              borderColor: 'var(--border-primary)',
                              color: 'var(--text-primary)',
                            }}
                          >
                            {seg.year}. {String(seg.month + 1).padStart(2, '0')}
                          </div>
                        ))}
                      </div>
                      {/* 하단: 일 + 요일 */}
                      <div className="h-8 border-b flex" style={{ borderColor: 'var(--border-primary)' }}>
                        {Array.from({ length: totalDays }).map((_, i) => {
                          const d = addDays(minDate!, i);
                          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                          const isSunday = d.getDay() === 0;
                          return (
                            <div
                              key={i}
                              className="flex-shrink-0 text-caption text-center border-r flex flex-col items-center justify-center leading-tight"
                              style={{
                                width: DAY_W,
                                borderColor: 'var(--border-primary)',
                                color: isSunday ? '#ef4444' : isWeekend ? 'var(--accent)' : 'var(--text-tertiary)',
                                background: isWeekend ? 'rgba(59,130,246,0.04)' : 'transparent',
                              }}
                            >
                              <div className="font-medium">{d.getDate()}</div>
                              <div className="text-caption opacity-70">{t('views.ganttWeekdays')[d.getDay()]}</div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}

                {/* 행별 막대 */}
                {items.map(({ row, start, end }) => {
                  const offset = daysBetween(minDate!, start);
                  const span = daysBetween(start, end) + 1;
                  const preview = dragPreview?.rowId === row.id ? dragPreview : null;
                  const dx = preview ? preview.deltaDays * DAY_W : 0;
                  const widthBoost = preview?.mode === 'resize-end' ? preview.deltaDays * DAY_W : 0;
                  return (
                    <div
                      key={row.id}
                      className="border-b relative"
                      style={{ height: ROW_H, borderColor: 'var(--border-primary)' }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setCtxMenu({ rowId: row.id, x: e.clientX, y: e.clientY });
                      }}
                    >
                      <div
                        className="absolute top-2 bottom-2 rounded select-none flex items-center group"
                        style={{
                          left: offset * DAY_W + 2 + (preview?.mode === 'move' ? dx : 0),
                          width: Math.max(DAY_W - 4, span * DAY_W - 4 + widthBoost),
                          background: 'var(--accent)',
                          outline: openedRowId === row.id ? '2px solid white' : 'none',
                          cursor: 'grab',
                        }}
                        onPointerDown={onPointerDown(row.id, 'move', start, end)}
                        onClick={(e) => { if (!preview) { e.stopPropagation(); selectRow(row.id); } }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setCtxMenu({ rowId: row.id, x: e.clientX, y: e.clientY });
                        }}
                        title={`${iso(start)} – ${iso(end)}`}
                      >
                        <div className="text-caption text-white truncate flex-1 px-1.5">
                          {titleCol ? String(row.cells[titleCol.id] ?? '·') : ''}
                        </div>
                        {/* resize-end handle */}
                        {endCol && (
                          <div
                            onPointerDown={onPointerDown(row.id, 'resize-end', start, end)}
                            className="w-1.5 h-full bg-white/40 cursor-ew-resize hover:bg-white/70"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* 의존성 화살표 SVG */}
                {arrows.length > 0 && (
                  <svg
                    className="absolute pointer-events-none"
                    style={{ top: 32, left: 0, width: totalDays * DAY_W, height: items.length * ROW_H }}
                  >
                    <defs>
                      <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                        <path d="M0,0 L6,3 L0,6 Z" fill="var(--text-secondary)" />
                      </marker>
                    </defs>
                    {arrows.map((a) => {
                      // L-shape: from (x1,y1) → 우측 5px → 아래/위 → (x2,y2)
                      const midX = a.x1 + 8;
                      return (
                        <path
                          key={a.key}
                          d={`M ${a.x1} ${a.y1} L ${midX} ${a.y1} L ${midX} ${a.y2} L ${a.x2} ${a.y2}`}
                          stroke="var(--text-secondary)"
                          strokeWidth="1.2"
                          strokeOpacity="0.6"
                          fill="none"
                          markerEnd="url(#arrowhead)"
                        />
                      );
                    })}
                  </svg>
                )}
              </div>
            </div>
          )}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{label}:</span>
      <div className="w-32">{children}</div>
    </div>
  );
}
