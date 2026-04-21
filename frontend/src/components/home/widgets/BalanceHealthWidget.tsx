'use client';

import { TrendingUp, FileSpreadsheet } from 'lucide-react';
import type { TodaysWork } from '@/hooks/useTodaysWork';
import { useProjectStore } from '@/stores/projectStore';
import { detectPmSheet } from '@/lib/pmSheetDetection';

/**
 * 밸런스 상태 — 프로젝트별 non-PM 시트 개수 및 행 수.
 * "PM 이 아닌" 시트 = 밸런싱 데이터로 간주.
 */
export default function BalanceHealthWidget({ work }: { work: TodaysWork }) {
  const projects = useProjectStore((s) => s.projects);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const setCurrentSheet = useProjectStore((s) => s.setCurrentSheet);

  const stats = projects.map((p) => {
    const balanceSheets = p.sheets.filter((s) => detectPmSheet(s).type === null);
    const totalRows = balanceSheets.reduce((acc, s) => acc + s.rows.length, 0);
    return {
      id: p.id,
      name: p.name,
      sheetCount: balanceSheets.length,
      rowCount: totalRows,
      firstSheetId: balanceSheets[0]?.id,
    };
  }).filter((s) => s.sheetCount > 0);

  return (
    <div className="glass-card p-4" style={{ borderLeft: '3px solid #f59e0b' }}>
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4" style={{ color: '#f59e0b' }} />
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          밸런스 상태
        </h3>
        <span className="ml-auto text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
          {work.projectCount} 프로젝트
        </span>
      </div>

      {stats.length === 0 ? (
        <p className="text-xs italic" style={{ color: 'var(--text-tertiary)' }}>
          밸런싱 시트 없음
        </p>
      ) : (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {stats.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setCurrentProject(s.id);
                if (s.firstSheetId) setCurrentSheet(s.firstSheetId);
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-black/5 dark:hover:bg-white/5"
            >
              <FileSpreadsheet className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
              <span className="truncate flex-1 text-left" style={{ color: 'var(--text-primary)' }}>
                {s.name}
              </span>
              <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                {s.sheetCount} 시트 · {s.rowCount} 행
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
