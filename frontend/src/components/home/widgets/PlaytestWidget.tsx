'use client';

import { Gamepad2 } from 'lucide-react';
import type { TodaysWork } from '@/hooks/useTodaysWork';
import { useProjectStore } from '@/stores/projectStore';

export default function PlaytestWidget({ work }: { work: TodaysWork }) {
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const setCurrentSheet = useProjectStore((s) => s.setCurrentSheet);

  const playtests = work.pmSheets.filter((s) => s.type === 'playtest');
  const totalSessions = playtests.reduce((acc, p) => acc + p.sheet.rows.length, 0);

  return (
    <div className="glass-card p-4" style={{ borderLeft: '3px solid #10b981' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Gamepad2 className="w-4 h-4" style={{ color: '#10b981' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Playtest 세션
          </h3>
        </div>
        <div className="text-2xl font-bold" style={{ color: '#10b981' }}>
          {totalSessions}
        </div>
      </div>
      {playtests.length === 0 ? (
        <p className="text-xs italic" style={{ color: 'var(--text-tertiary)' }}>
          Playtest 시트 없음
        </p>
      ) : (
        <div className="space-y-0.5 max-h-48 overflow-y-auto">
          {playtests.map((p, i) => (
            <button
              key={i}
              onClick={() => {
                setCurrentProject(p.projectId);
                setCurrentSheet(p.sheet.id);
              }}
              className="w-full text-left px-2 py-1 rounded text-xs truncate hover:bg-black/5 dark:hover:bg-white/5"
              style={{ color: 'var(--text-primary)' }}
            >
              • {p.sheet.name} ({p.sheet.rows.length}) <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{p.projectName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
