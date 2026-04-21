'use client';

/**
 * Track 13 — stat-snapshot 셀 인라인.
 *
 * 값이 없으면 "Capture" 버튼, 있으면 미니 테이블로 stats 표시.
 * Capture 클릭 → 모달에서 entity row 선택 → JSON 저장.
 */

import { useState } from 'react';
import { Camera, X } from 'lucide-react';
import type { Column, Sheet, CellValue, StatSnapshotValue } from '@/types';

export interface InlineStatSnapshotProps {
  value: CellValue;
  column: Column;
  sourceSheet?: Sheet;
  /** 캡처 커밋 콜백 — JSON string 을 cell 에 저장 */
  onCapture: (jsonValue: string) => void;
}

export default function InlineStatSnapshot({
  value,
  column,
  sourceSheet,
  onCapture,
}: InlineStatSnapshotProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  // 기존 snapshot 파싱
  const snapshot: StatSnapshotValue | null = (() => {
    if (!value || typeof value !== 'string') return null;
    try {
      const parsed = JSON.parse(value);
      if (parsed?.capturedAt && parsed?.stats) return parsed as StatSnapshotValue;
      return null;
    } catch {
      return null;
    }
  })();

  const captureColumnIds = column.snapshotColumnIds ?? [];
  const captureColumns = sourceSheet?.columns.filter((c) => captureColumnIds.includes(c.id)) ?? [];

  const performCapture = (row: Sheet['rows'][number]) => {
    const stats: Record<string, string | number> = {};
    for (const col of captureColumns) {
      const v = row.cells[col.id];
      if (typeof v === 'number' || typeof v === 'string') stats[col.id] = v;
    }
    const payload: StatSnapshotValue = {
      capturedAt: Date.now(),
      sourceRowId: row.id,
      stats,
      label: new Date().toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    };
    onCapture(JSON.stringify(payload));
    setPickerOpen(false);
  };

  const clearSnapshot = () => {
    onCapture('');
  };

  if (!sourceSheet) {
    return (
      <span className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
        (소스 시트 미지정)
      </span>
    );
  }

  return (
    <>
      {snapshot ? (
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-1">
            <Camera className="w-3 h-3 shrink-0" style={{ color: 'var(--accent)' }} />
            <span className="text-caption truncate" style={{ color: 'var(--text-secondary)' }}>
              {snapshot.label ?? 'Snapshot'}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearSnapshot();
              }}
              className="ml-auto p-0.5 rounded hover:bg-[var(--bg-hover)]"
              aria-label="Clear"
            >
              <X className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
            </button>
          </div>
          <div
            className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-caption font-mono p-1.5 rounded"
            style={{ background: 'var(--bg-tertiary)' }}
          >
            {Object.entries(snapshot.stats)
              .slice(0, 8)
              .map(([colId, v]) => {
                const col = sourceSheet.columns.find((c) => c.id === colId);
                return (
                  <div key={colId} className="flex justify-between gap-1 min-w-0">
                    <span className="truncate" style={{ color: 'var(--text-tertiary)' }}>
                      {col?.name ?? colId.slice(0, 6)}
                    </span>
                    <span style={{ color: 'var(--text-primary)' }}>{String(v)}</span>
                  </div>
                );
              })}
          </div>
        </div>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setPickerOpen(true);
          }}
          className="inline-flex items-center gap-1 text-caption px-2 py-1 rounded border transition-colors"
          style={{
            borderColor: 'var(--border-primary)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-secondary)',
          }}
        >
          <Camera className="w-3 h-3" />
          Capture
        </button>
      )}

      {/* Entity row picker */}
      {pickerOpen && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={(e) => {
            e.stopPropagation();
            setPickerOpen(false);
          }}
        >
          <div
            className="w-full max-w-md max-h-[70vh] rounded-xl shadow-2xl overflow-hidden flex flex-col"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="px-4 py-3 border-b"
              style={{ borderColor: 'var(--border-primary)' }}
            >
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Snapshot 대상 선택
              </h3>
              <p className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
                {sourceSheet.name} 에서 {captureColumns.length}개 stats 캡처:{' '}
                {captureColumns.map((c) => c.name).join(', ')}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {sourceSheet.rows.length === 0 ? (
                <div className="text-xs text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
                  소스 시트에 row 가 없습니다.
                </div>
              ) : (
                sourceSheet.rows.slice(0, 100).map((row, idx) => {
                  const firstText = sourceSheet.columns
                    .map((c) => row.cells[c.id])
                    .find((v) => typeof v === 'string') as string | undefined;
                  return (
                    <button
                      key={row.id}
                      onClick={() => performCapture(row)}
                      className="w-full text-left px-3 py-2 rounded text-xs hover:bg-[var(--bg-hover)]"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      <div className="font-medium">Row {idx + 1}{firstText ? ` — ${firstText}` : ''}</div>
                      <div
                        className="text-caption font-mono mt-0.5"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        {captureColumns
                          .slice(0, 4)
                          .map((c) => `${c.name}=${row.cells[c.id] ?? '—'}`)
                          .join(' · ')}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
