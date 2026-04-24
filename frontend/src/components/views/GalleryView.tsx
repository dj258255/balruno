'use client';

/**
 * Gallery 뷰.
 * 각 행을 카드 그리드로 표시. 첫 url 컬럼 값이 있으면 이미지로 렌더(attachment 는 다음 세션).
 * 제목 = 첫 일반 컬럼, 나머지 컬럼은 메타 데이터로.
 */

import { useState } from 'react';
import { ImageIcon, Plus } from 'lucide-react';
import { formatDisplayValue } from '@/components/sheet/utils';
import { useProjectStore } from '@/stores/projectStore';
import { useRecordDetail } from '@/stores/recordDetailStore';
import type { Sheet } from '@/types';
import RecordContextMenu, { type RecordContextMenuState } from './RecordContextMenu';

interface GalleryViewProps {
  projectId: string;
  sheet: Sheet;
}

export default function GalleryView({ projectId, sheet }: GalleryViewProps) {
  const openedRowId = useRecordDetail((s) =>
    s.opened && s.opened.sheetId === sheet.id ? s.opened.rowId : null,
  );
  const openRecord = useRecordDetail((s) => s.openRecord);
  const closeRecord = useRecordDetail((s) => s.closeRecord);
  const selectRow = (rowId: string) => openRecord({ projectId, sheetId: sheet.id, rowId });
  const [ctxMenu, setCtxMenu] = useState<RecordContextMenuState | null>(null);
  const addRow = useProjectStore((s) => s.addRow);
  const deleteRow = useProjectStore((s) => s.deleteRow);

  const handleAddRow = () => {
    const rowId = addRow(projectId, sheet.id);
    selectRow(rowId);
  };
  const titleCol = sheet.columns.find(
    (c) => c.type === 'general' || c.type === 'formula'
  );
  const urlCol = sheet.columns.find((c) => c.type === 'url');
  const metaCols = sheet.columns
    .filter((c) => c.id !== titleCol?.id && c.id !== urlCol?.id)
    .slice(0, 4);

  return (
    <div className="flex-1 flex overflow-hidden">
    <div className="flex-1 overflow-auto p-4">
      <div
        className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]"
        role="list"
        aria-label={`${sheet.name} 갤러리`}
      >
        {sheet.rows.map((row) => {
          const imgSrc = urlCol ? row.cells[urlCol.id] : null;
          const isImage =
            typeof imgSrc === 'string' && /\.(png|jpe?g|gif|webp|svg)$/i.test(imgSrc);
          const titleRaw = titleCol ? String(row.cells[titleCol.id] ?? '').trim() : '';
          return (
            <button
              type="button"
              key={row.id}
              role="listitem"
              aria-label={titleRaw || '레코드'}
              onClick={() => selectRow(row.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                setCtxMenu({ rowId: row.id, x: e.clientX, y: e.clientY });
              }}
              className="rounded-lg overflow-hidden text-left hover:ring-2 hover:ring-[var(--accent)]/40 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none transition-all"
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-primary)',
                outline: openedRowId === row.id ? '2px solid var(--accent)' : 'none',
              }}
            >
              <div
                className="aspect-video flex items-center justify-center"
                style={{ background: 'var(--bg-tertiary)' }}
              >
                {isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imgSrc as string}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-2xl" style={{ color: 'var(--text-tertiary)' }}>
                    ◌
                  </span>
                )}
              </div>
              <div className="p-3">
                {titleCol && (
                  <div
                    className="text-sm font-semibold mb-1 truncate"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {formatDisplayValue(
                      row.cells[titleCol.id] ?? '',
                      titleCol,
                      { sheets: [sheet], currentSheet: sheet },
                      row
                    ) || '—'}
                  </div>
                )}
                {metaCols.map((c) => {
                  const v = formatDisplayValue(
                    row.cells[c.id] ?? '',
                    c,
                    { sheets: [sheet], currentSheet: sheet },
                    row
                  );
                  if (!v) return null;
                  return (
                    <div key={c.id} className="flex gap-1 text-xs">
                      <span style={{ color: 'var(--text-tertiary)' }}>{c.name}:</span>
                      <span className="truncate" style={{ color: 'var(--text-secondary)' }}>
                        {v}
                      </span>
                    </div>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>
      {sheet.rows.length === 0 && (
        <div className="flex flex-col items-center py-16 gap-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--bg-tertiary)' }}
          >
            <ImageIcon className="w-7 h-7" style={{ color: 'var(--text-tertiary)' }} />
          </div>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            표시할 레코드가 없습니다
          </p>
          <button
            type="button"
            onClick={handleAddRow}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            <Plus className="w-4 h-4" /> 첫 레코드 추가
          </button>
        </div>
      )}
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
