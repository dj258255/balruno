'use client';

/**
 * Track 4 MVP — Kanban 뷰.
 * select 타입 컬럼 기준 그룹핑. 드래그로 카드 이동 (updateCell 로 status 전환).
 */

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Settings2, Check } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import CustomSelect from '@/components/ui/CustomSelect';
import { formatDisplayValue } from '@/components/sheet/utils';
import type { Sheet, Row, CellValue } from '@/types';
import RecordEditor from './RecordEditor';
import RecordContextMenu, { type RecordContextMenuState } from './RecordContextMenu';

interface KanbanViewProps {
  projectId: string;
  sheet: Sheet;
}

export default function KanbanView({ projectId, sheet }: KanbanViewProps) {
  const t = useTranslations();
  const updateSheet = useProjectStore((s) => s.updateSheet);
  const updateCell = useProjectStore((s) => s.updateCell);
  const addRow = useProjectStore((s) => s.addRow);
  const deleteRow = useProjectStore((s) => s.deleteRow);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<RecordContextMenuState | null>(null);

  const urlColumns = sheet.columns.filter((c) => c.type === 'url');
  const coverColId = sheet.viewKanbanCoverColumnId;

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

  // 카드에 표시할 컬럼 (사용자 지정 우선 → 자동 앞 4개 fallback)
  const cardColumns = useMemo(() => {
    const userIds = sheet.viewKanbanFieldIds ?? [];
    if (userIds.length > 0) {
      return userIds
        .map((id) => sheet.columns.find((c) => c.id === id))
        .filter((c): c is typeof sheet.columns[number] => !!c && c.id !== groupColId && c.id !== coverColId);
    }
    return sheet.columns.filter((c) => c.id !== groupColId && c.id !== coverColId).slice(0, 4);
  }, [sheet.columns, sheet.viewKanbanFieldIds, groupColId, coverColId]);

  const toggleField = (id: string) => {
    const current = sheet.viewKanbanFieldIds ?? sheet.columns.filter((c) => c.id !== groupColId && c.id !== coverColId).slice(0, 4).map((c) => c.id);
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    updateSheet(projectId, sheet.id, { viewKanbanFieldIds: next });
  };

  const moveCard = (rowId: string, targetOptionId: string) => {
    if (!groupCol) return;
    const newValue: CellValue = targetOptionId === '_ungrouped' ? '' : targetOptionId;
    updateCell(projectId, sheet.id, rowId, groupCol.id, newValue);
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
      {/* 상단 설정: 그룹 컬럼 선택 + 설정 팝오버 */}
      <div className="px-4 py-2 border-b flex items-center gap-2 relative" style={{ borderColor: 'var(--border-primary)' }}>
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
        <button
          onClick={() => setShowSettings((v) => !v)}
          className="ml-auto p-1.5 rounded hover:bg-[var(--bg-tertiary)]"
          aria-label="카드 설정"
          title="카드 설정"
        >
          <Settings2 size={14} style={{ color: 'var(--text-secondary)' }} />
        </button>
        {showSettings && (
          <div
            className="absolute right-2 top-full mt-2 z-30 w-72 rounded-xl shadow-xl border overflow-hidden"
            style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}
          >
            {/* 커버 이미지 섹션 */}
            <div className="p-3 border-b" style={{ borderColor: 'var(--border-primary)' }}>
              <div className="text-overline mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
                커버 이미지
              </div>
              <select
                value={coverColId ?? ''}
                onChange={(e) => updateSheet(projectId, sheet.id, { viewKanbanCoverColumnId: e.target.value || undefined })}
                className="w-full px-2.5 py-1.5 text-xs rounded-md border bg-transparent outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition"
                style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
              >
                <option value="">없음</option>
                {urlColumns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {urlColumns.length === 0 && (
                <p className="text-caption mt-1" style={{ color: 'var(--text-tertiary)' }}>
                  url 타입 컬럼을 먼저 만들어주세요
                </p>
              )}
            </div>

            {/* 표시 필드 섹션 */}
            <div className="p-3">
              <div className="text-overline mb-1.5" style={{ color: 'var(--text-tertiary)' }}>
                카드에 표시할 필드
              </div>
              <div className="max-h-52 overflow-y-auto -mx-1">
                {sheet.columns
                  .filter((c) => c.id !== groupColId && c.id !== coverColId)
                  .map((c) => {
                    const visible = (sheet.viewKanbanFieldIds ?? cardColumns.map((cc) => cc.id)).includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleField(c.id)}
                        className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-md hover:bg-[var(--bg-tertiary)] transition-colors"
                        aria-pressed={visible}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 transition-colors"
                          style={{
                            background: visible ? 'var(--accent)' : 'transparent',
                            border: `1.5px solid ${visible ? 'var(--accent)' : 'var(--border-secondary, var(--border-primary))'}`,
                          }}
                        >
                          {visible && <Check size={10} color="white" strokeWidth={3} />}
                        </span>
                        <span className="flex-1 text-left" style={{ color: 'var(--text-primary)' }}>{c.name}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 칸반 보드 */}
      <div
        className="flex-1 overflow-x-auto overflow-y-hidden p-4"
        role="region"
        aria-label={`${sheet.name} 칸반 보드`}
      >
        <div className="flex gap-3 h-full">
          {columns.map((col) => {
            const rows = grouped.get(col.id) ?? [];
            return (
              <div
                key={col.id}
                className="flex flex-col w-72 flex-shrink-0 rounded-lg"
                style={{ background: 'var(--bg-secondary)' }}
                role="group"
                aria-label={`${col.label} · ${rows.length}개`}
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
                <div className="flex-1 overflow-y-auto p-2 space-y-2" role="list">
                  {rows.map((row) => {
                    const coverUrl = coverColId ? String(row.cells[coverColId] ?? '') : '';
                    const titleVal = cardColumns[0]
                      ? String(row.cells[cardColumns[0].id] ?? '').trim()
                      : '';
                    return (
                      <div
                        key={row.id}
                        draggable
                        role="button"
                        tabIndex={0}
                        aria-label={titleVal || `${col.label} 카드`}
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', row.id)}
                        onClick={() => setSelectedRowId(row.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedRowId(row.id);
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setCtxMenu({ x: e.clientX, y: e.clientY, rowId: row.id });
                        }}
                        className="rounded-lg cursor-pointer hover:ring-2 hover:ring-[var(--accent)]/30 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none transition-all relative overflow-hidden"
                        style={{
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border-primary)',
                          outline: selectedRowId === row.id ? '2px solid var(--accent)' : 'none',
                        }}
                      >
                        {/* 좌측 색상 바 — select option color 반영 */}
                        {col.color && (
                          <div
                            className="absolute left-0 top-0 bottom-0 w-1 z-10"
                            style={{ background: col.color }}
                          />
                        )}
                        {/* 커버 이미지 */}
                        {coverUrl && /^https?:\/\/.+/.test(coverUrl) && (
                          <div
                            className="w-full h-24 bg-center bg-cover"
                            style={{
                              backgroundImage: `url("${coverUrl.replace(/"/g, '\\"')}")`,
                              background: `url("${coverUrl.replace(/"/g, '\\"')}") center/cover, var(--bg-tertiary)`,
                            }}
                          />
                        )}
                        <div className="p-3">
                          {cardColumns.map((c) => (
                            <div key={c.id} className="mb-1 last:mb-0">
                              <div className="text-overline" style={{ color: 'var(--text-tertiary)' }}>
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
                      </div>
                    );
                  })}
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
