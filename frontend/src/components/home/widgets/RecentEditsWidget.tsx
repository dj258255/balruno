'use client';

/**
 * 최근 편집 시트 위젯 — 7일 이내 수정된 시트.
 * 클릭 시 해당 프로젝트/시트로 점프.
 */

import { Clock, FileSpreadsheet } from 'lucide-react';
import type { TodaysWork } from '@/hooks/useTodaysWork';
import { useProjectStore } from '@/stores/projectStore';

interface Props {
  work: TodaysWork;
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  return `${d}일 전`;
}

export default function RecentEditsWidget({ work }: Props) {
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const setCurrentSheet = useProjectStore((s) => s.setCurrentSheet);

  const jump = (projectId: string, sheetId: string) => {
    setCurrentProject(projectId);
    setCurrentSheet(sheetId);
  };

  return (
    <div
      className="glass-card p-4"
      style={{ borderLeft: '3px solid #6366f1' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4" style={{ color: '#6366f1' }} />
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          최근 편집
        </h3>
        <span className="ml-auto text-caption" style={{ color: 'var(--text-tertiary)' }}>
          7일 이내
        </span>
      </div>

      {work.recentSheets.length === 0 ? (
        <p className="text-xs italic py-4 text-center" style={{ color: 'var(--text-tertiary)' }}>
          최근 편집된 시트가 없습니다
        </p>
      ) : (
        <div className="space-y-0.5 max-h-56 overflow-y-auto">
          {work.recentSheets.map((item, i) => (
            <button
              key={i}
              onClick={() => jump(item.projectId, item.sheet.id)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <FileSpreadsheet className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
              <span className="truncate flex-1" style={{ color: 'var(--text-primary)' }}>
                {item.sheet.name}
              </span>
              <span className="text-caption truncate" style={{ color: 'var(--text-tertiary)' }}>
                {item.projectName}
              </span>
              <span className="text-caption flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                {formatRelative(item.updatedAt)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
