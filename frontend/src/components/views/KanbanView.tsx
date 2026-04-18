'use client';

/**
 * Track 4 MVP — Kanban 뷰.
 * select 타입 컬럼 기준 그룹핑. 드래그로 카드 이동은 다음 세션 (updateCell 만으로 전환).
 */

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useProjectStore } from '@/stores/projectStore';
import CustomSelect from '@/components/ui/CustomSelect';
import { formatDisplayValue } from '@/components/sheet/utils';
import type { Sheet, Row, CellValue } from '@/types';
import RecordEditor from './RecordEditor';

interface KanbanViewProps {
  projectId: string;
  sheet: Sheet;
}

export default function KanbanView({ projectId, sheet }: KanbanViewProps) {
  const t = useTranslations();
  const updateSheet = useProjectStore((s) => s.updateSheet);
  const updateCell = useProjectStore((s) => s.updateCell);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

  const selectedRow = selectedRowId
    ? sheet.rows.find((r) => r.id === selectedRowId)
    : null;

  // select 타입 컬럼만 그룹핑 대상
  const selectColumns = sheet.columns.filter((c) => c.type === 'select');
  const groupColId =
    (selectColumns.find((c) => c.id === sheet.viewGroupColumnId)?.id) ??
    selectColumns[0]?.id;
  const groupCol = sheet.columns.find((c) => c.id === groupColId);

  // 옵션별 행 그룹화
  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    map.set('_ungrouped', []);
    const options = groupCol?.selectOptions ?? [];
    options.forEach((opt) => map.set(opt.id, []));
    if (!groupCol) return map;
    sheet.rows.forEach((row) => {
      const val = row.cells[groupCol.id];
      const key = val === null || val === undefined || val === '' ? '_ungrouped' : String(val);
      if (!map.has(key)) map.set('_ungrouped', [...(map.get('_ungrouped') ?? []), row]);
      else map.get(key)!.push(row);
    });
    return map;
  }, [sheet.rows, groupCol]);

  if (selectColumns.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-2 max-w-sm">
          <p className="text-base font-medium" style={{ color: 'var(--text-secondary)' }}>
            {t('views.kanbanNeedSelect')}
          </p>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {t('views.kanbanNeedSelectDesc')}
          </p>
        </div>
      </div>
    );
  }

  const options = groupCol?.selectOptions ?? [];
  const columns: Array<{ id: string; label: string; color?: string }> = [
    ...options.map((o) => ({ id: o.id, label: o.label, color: o.color })),
    { id: '_ungrouped', label: t('views.kanbanUngrouped') },
  ];

  // 카드에 표시할 컬럼 (그룹 컬럼 제외, 최대 4개)
  const cardColumns = sheet.columns.filter((c) => c.id !== groupColId).slice(0, 4);

  const moveCard = (rowId: string, targetOptionId: string) => {
    if (!groupCol) return;
    const newValue: CellValue = targetOptionId === '_ungrouped' ? '' : targetOptionId;
    updateCell(projectId, sheet.id, rowId, groupCol.id, newValue);
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
      {/* 상단 설정: 그룹 컬럼 선택 */}
      <div className="px-4 py-2 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-primary)' }}>
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {t('views.kanbanGroupBy')}:
        </span>
        <div className="w-48">
          <CustomSelect
            value={groupColId ?? ''}
            onChange={(v) =>
              updateSheet(projectId, sheet.id, { viewGroupColumnId: v })
            }
            options={selectColumns.map((c) => ({ value: c.id, label: c.name }))}
            size="sm"
          />
        </div>
      </div>

      {/* 칸반 보드 */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
        <div className="flex gap-3 h-full">
          {columns.map((col) => {
            const rows = grouped.get(col.id) ?? [];
            return (
              <div
                key={col.id}
                className="flex flex-col w-72 flex-shrink-0 rounded-lg"
                style={{ background: 'var(--bg-secondary)' }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const rowId = e.dataTransfer.getData('text/plain');
                  if (rowId) moveCard(rowId, col.id);
                }}
              >
                <div
                  className="px-3 py-2 border-b flex items-center justify-between"
                  style={{ borderColor: 'var(--border-primary)' }}
                >
                  <div className="flex items-center gap-2">
                    {col.color && (
                      <div className="w-2 h-2 rounded-full" style={{ background: col.color }} />
                    )}
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {col.label}
                    </span>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {rows.length}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {rows.map((row) => (
                    <div
                      key={row.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', row.id)}
                      onClick={() => setSelectedRowId(row.id)}
                      className="p-3 rounded-lg cursor-pointer hover:ring-2 hover:ring-[var(--accent)]/30 transition-all relative overflow-hidden"
                      style={{
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-primary)',
                        outline: selectedRowId === row.id ? '2px solid var(--accent)' : 'none',
                      }}
                    >
                      {/* 좌측 색상 바 — select option color 반영 */}
                      {col.color && (
                        <div
                          className="absolute left-0 top-0 bottom-0 w-1"
                          style={{ background: col.color }}
                        />
                      )}
                      {cardColumns.map((c) => (
                        <div key={c.id} className="mb-1 last:mb-0">
                          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                            {c.name}
                          </div>
                          <div className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                            {formatDisplayValue(
                              row.cells[c.id] ?? '',
                              c,
                              { sheets: [sheet], currentSheet: sheet },
                              row
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </div>
      {/* Track 4: 카드 편집 사이드 패널 */}
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
