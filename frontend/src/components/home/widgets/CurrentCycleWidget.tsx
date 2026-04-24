'use client';

/**
 * 현재 Cycle 위젯 — Linear 의 Active Cycle · Jira 의 Active Sprint 대응.
 *
 * 동작:
 *  - 프로젝트에서 Cycles 시트 자동 감지 (findCyclesSheet)
 *  - 오늘 날짜 기준 current / previous / next cycle 분류
 *  - current 가 있으면 이름·남은 일수·연결 이슈 수·완료 비율 표시
 *  - previous 의 미완료 이슈가 있으면 "current 로 이관" 액션 버튼
 */

import { useMemo } from 'react';
import { CalendarDays, ArrowRightLeft } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { toast } from '@/components/ui/Toast';
import {
  findCyclesSheet,
  detectCurrent,
  findIssuesForCycle,
  isIssueDone,
  carryOverUnfinished,
} from '@/lib/cycleDetection';

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / 86400000);
}

export default function CurrentCycleWidget() {
  const projects = useProjectStore((s) => s.projects);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const setCurrentSheet = useProjectStore((s) => s.setCurrentSheet);
  const updateCell = useProjectStore((s) => s.updateCell);

  const data = useMemo(() => {
    const project = projects.find((p) => p.id === currentProjectId);
    if (!project) return null;
    const ctx = findCyclesSheet(project);
    if (!ctx) return null;
    const detected = detectCurrent(ctx);

    const summarize = (rowId: string | undefined) => {
      if (!rowId) return null;
      const issues = findIssuesForCycle(project, rowId);
      const total = issues.length;
      const done = issues.filter((i) => {
        const statusCol = i.sheet.columns.find((c) => c.id === i.statusColumnId);
        return isIssueDone(i.row, i.statusColumnId, statusCol);
      }).length;
      return { total, done, rate: total > 0 ? done / total : 0, unfinished: total - done };
    };

    const nameCol = ctx.nameCol;
    const getName = (row: import('@/types').Row | undefined) => {
      if (!row) return '—';
      if (nameCol) return String(row.cells[nameCol.id] ?? row.id.slice(0, 8));
      // first general 컬럼 fallback
      const first = ctx.sheet.columns.find((c) => c.type === 'general');
      return first ? String(row.cells[first.id] ?? row.id.slice(0, 8)) : row.id.slice(0, 8);
    };

    const currentSummary = summarize(detected.current?.id);
    const previousSummary = summarize(detected.previous?.id);

    return {
      project,
      ctx,
      detected,
      currentName: getName(detected.current),
      previousName: getName(detected.previous),
      nextName: getName(detected.next),
      currentSummary,
      previousSummary,
    };
  }, [projects, currentProjectId]);

  if (!data) return null;
  const { project, ctx, detected, currentName, previousName, currentSummary, previousSummary } = data;

  // current 없고 next 도 없으면 위젯 의미 없음
  if (!detected.current && !detected.next && !detected.previous) return null;

  const startDate = detected.current
    ? new Date(String(detected.current.cells[ctx.startCol.id]))
    : null;
  const endDate = detected.current
    ? new Date(String(detected.current.cells[ctx.endCol.id]))
    : null;
  const daysLeft =
    endDate && !isNaN(endDate.getTime())
      ? Math.max(0, daysBetween(new Date(), endDate))
      : null;

  const handleCarryOver = () => {
    if (!detected.previous || !detected.current) return;
    const moved = carryOverUnfinished(
      project,
      detected.previous.id,
      detected.current.id,
      (pid, sid, rid, cid, val) => updateCell(pid, sid, rid, cid, val),
    );
    if (moved > 0) {
      toast.success(`${previousName} → ${currentName}: ${moved}개 이관됨`);
    } else {
      toast.info('이관할 미완료 이슈가 없습니다');
    }
  };

  return (
    <div className="glass-card p-4" style={{ borderLeft: '3px solid #3b82f6' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4" style={{ color: '#3b82f6' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            현재 Cycle
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setCurrentSheet(ctx.sheet.id)}
          className="text-caption px-2 py-0.5 rounded hover:bg-[var(--bg-hover)] transition-colors"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {ctx.sheet.name}
        </button>
      </div>

      {detected.current ? (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-base font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              {currentName}
            </span>
            {daysLeft !== null && (
              <span className="text-xs shrink-0" style={{ color: daysLeft <= 3 ? '#ef4444' : 'var(--text-secondary)' }}>
                {daysLeft === 0 ? '오늘 마감' : `${daysLeft}일 남음`}
              </span>
            )}
          </div>
          {startDate && endDate && (
            <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
              {startDate.toISOString().slice(0, 10)} — {endDate.toISOString().slice(0, 10)}
            </div>
          )}
          {currentSummary && currentSummary.total > 0 && (
            <>
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--text-secondary)' }}>
                  완료 {currentSummary.done} / {currentSummary.total}
                </span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  {Math.round(currentSummary.rate * 100)}%
                </span>
              </div>
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ background: 'var(--bg-tertiary)' }}
              >
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${currentSummary.rate * 100}%`,
                    background: currentSummary.rate >= 0.8 ? '#10b981' : currentSummary.rate >= 0.5 ? '#f59e0b' : '#ef4444',
                  }}
                />
              </div>
            </>
          )}
          {previousSummary && previousSummary.unfinished > 0 && (
            <button
              type="button"
              onClick={handleCarryOver}
              className="w-full flex items-center justify-center gap-1.5 mt-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              style={{
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-primary)',
              }}
              title={`${previousName} 의 미완료 ${previousSummary.unfinished}개 를 ${currentName} 로 이관`}
            >
              <ArrowRightLeft className="w-3 h-3" />
              {previousSummary.unfinished}개 미완료 이관
            </button>
          )}
        </div>
      ) : detected.next ? (
        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
            {data.nextName}
          </span>
          <span className="ml-2 opacity-70">시작 예정</span>
        </div>
      ) : (
        <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          활성 cycle 없음 · 예정된 cycle 없음
        </div>
      )}
    </div>
  );
}
