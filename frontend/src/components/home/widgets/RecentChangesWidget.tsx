'use client';

/**
 * 최근 변경 위젯 — 전체 프로젝트 changelog aggregation.
 * 북극성 루프 가시화: "뭐가 언제 바뀌었는지" 첫 화면 노출.
 */

import { useEffect, useRef } from 'react';
import { History, ArrowRight } from 'lucide-react';
import type { TodaysWork } from '@/hooks/useTodaysWork';
import { useProjectStore } from '@/stores/projectStore';

interface Props {
  work: TodaysWork;
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}초 전`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(ts).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  const s = String(v);
  return s.length > 16 ? s.slice(0, 14) + '…' : s;
}

export default function RecentChangesWidget({ work }: Props) {
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const setCurrentSheet = useProjectStore((s) => s.setCurrentSheet);
  const projects = useProjectStore((s) => s.projects);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Inbox 클릭 시 scroll 이벤트 리스닝 — 이 위젯으로 스크롤 + 하이라이트
  useEffect(() => {
    const handler = () => {
      if (!wrapperRef.current) return;
      wrapperRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      wrapperRef.current.animate(
        [
          { boxShadow: '0 0 0 3px var(--accent-light)' },
          { boxShadow: '0 0 0 0 transparent' },
        ],
        { duration: 1500, easing: 'ease-out' }
      );
    };
    window.addEventListener('balruno:scroll-to-inbox', handler);
    return () => window.removeEventListener('balruno:scroll-to-inbox', handler);
  }, []);

  if (work.recentChanges.length === 0) {
    return null;
  }

  const jumpToCell = (projectId: string, sheetId: string, rowId: string, columnId: string) => {
    setCurrentProject(projectId);
    setCurrentSheet(sheetId);
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('balruno:focus-cell', {
          detail: { sheetId, rowId, columnId },
        })
      );
    }, 50);
  };

  return (
    <div
      ref={wrapperRef}
      className="glass-card p-4 scroll-mt-6"
      style={{ borderLeft: '3px solid #10b981' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <History className="w-4 h-4" style={{ color: '#10b981' }} />
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          최근 변경 (Inbox)
        </h3>
        <span className="ml-auto text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
          {work.recentChanges.length}개
        </span>
      </div>

      <div className="space-y-1 max-h-64 overflow-y-auto">
        {work.recentChanges.map((item, i) => {
          const project = projects.find((p) => p.id === item.projectId);
          const sheet = project?.sheets.find((s) => s.id === item.entry.sheetId);
          const column = sheet?.columns.find((c) => c.id === item.entry.columnId);

          return (
            <button
              key={i}
              onClick={() =>
                jumpToCell(item.projectId, item.entry.sheetId, item.entry.rowId, item.entry.columnId)
              }
              className="w-full text-left px-2 py-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2 text-[10px] mb-0.5">
                <span style={{ color: 'var(--text-tertiary)' }}>
                  {formatRelative(item.entry.timestamp)}
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {item.entry.userName || item.entry.userId}
                </span>
                <span style={{ color: 'var(--text-tertiary)' }}>·</span>
                <span className="truncate" style={{ color: 'var(--text-tertiary)' }}>
                  {item.projectName}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="truncate max-w-[100px]" style={{ color: 'var(--text-primary)' }}>
                  {sheet?.name ?? '—'} / {column?.name ?? '—'}
                </span>
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono truncate"
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    textDecoration: 'line-through',
                  }}
                >
                  {formatValue(item.entry.before)}
                </span>
                <ArrowRight className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono truncate"
                  style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}
                >
                  {formatValue(item.entry.after)}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
