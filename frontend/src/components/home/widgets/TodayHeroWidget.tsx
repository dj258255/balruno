'use client';

/**
 * Today Hero — Home 의 주인공 위젯.
 *
 * 내 작업 우선 (Linear Focus 그룹 패턴):
 *   1. 내 Sprint (현재 유저 assigned + 활성)
 *   2. 내 버그 (assigned + open)
 *   3. Playtest 대기 (피드백 쌓인 세션)
 *   4. 전체 활성 Sprint (팀 뷰 fallback)
 *
 * PM 시트 없으면 "팀 PM 템플릿 시작" CTA.
 */

import { Zap, Bug, Gamepad2, ArrowRight, Sparkles } from 'lucide-react';
import type { TodaysWork, RowWithContext } from '@/hooks/useTodaysWork';
import { useProjectStore } from '@/stores/projectStore';

interface Props {
  work: TodaysWork;
}

export default function TodayHeroWidget({ work }: Props) {
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const setCurrentSheet = useProjectStore((s) => s.setCurrentSheet);

  const jumpToRow = (ctx: RowWithContext) => {
    setCurrentProject(ctx.projectId);
    setCurrentSheet(ctx.sheet.id);
    // 셀 포커스 이벤트 — 첫 일반 컬럼
    const firstCol = ctx.sheet.columns.find((c) => c.type === 'general');
    if (firstCol) {
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('balruno:focus-cell', {
            detail: { sheetId: ctx.sheet.id, rowId: ctx.row.id, columnId: firstCol.id },
          })
        );
      }, 50);
    }
  };

  const jumpToSheet = (projectId: string, sheetId: string) => {
    setCurrentProject(projectId);
    setCurrentSheet(sheetId);
  };

  const hasPmSheet = work.pmSheets.length > 0;

  if (!hasPmSheet) {
    return (
      <div
        className="glass-card p-6"
        style={{ borderLeft: '3px solid #8b5cf6' }}
      >
        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}
          >
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              팀 PM 템플릿으로 시작하세요
            </h3>
            <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
              Sprint 보드 · 버그 트래커 · 플레이테스트 세션을 템플릿으로 추가하면
              여기에 오늘의 작업이 자동으로 뜹니다.
            </p>
            <button
              onClick={() => window.dispatchEvent(new Event('balruno:open-gallery'))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
              style={{ background: '#8b5cf6', color: 'white' }}
            >
              팀 PM 템플릿 보기
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section>
      <h2
        className="text-xs font-semibold uppercase tracking-wider mb-3"
        style={{ color: 'var(--text-tertiary)' }}
      >
        오늘의 작업
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* 내 Sprint */}
        <HeroCard
          icon={Zap}
          color="#3b82f6"
          label="내 Sprint"
          count={work.mySprint.length}
          total={work.activeSprint.length}
          totalLabel="활성"
          rows={work.mySprint}
          onRowClick={jumpToRow}
          emptyText={work.activeSprint.length > 0 ? '내게 할당된 게 없습니다' : '활성 태스크 없음'}
        />

        {/* 내 버그 */}
        <HeroCard
          icon={Bug}
          color="#ef4444"
          label="내 버그"
          count={work.myBugs.length}
          total={work.openBugs.length}
          totalLabel="열린"
          rows={work.myBugs}
          onRowClick={jumpToRow}
          emptyText={work.openBugs.length > 0 ? '내게 할당된 버그 없음' : '오픈 버그 없음'}
        />

        {/* Playtest */}
        <PlaytestCard work={work} onSheetClick={jumpToSheet} />
      </div>
    </section>
  );
}

function HeroCard({
  icon: Icon,
  color,
  label,
  count,
  total,
  totalLabel,
  rows,
  onRowClick,
  emptyText,
}: {
  icon: typeof Zap;
  color: string;
  label: string;
  count: number;
  total: number;
  totalLabel: string;
  rows: RowWithContext[];
  onRowClick: (ctx: RowWithContext) => void;
  emptyText: string;
}) {
  const preview = rows.slice(0, 3);

  const getTitle = (ctx: RowWithContext): string => {
    const titleCol = ctx.sheet.columns.find(
      (c) => c.name.toLowerCase() === 'title' || c.name.toLowerCase() === 'name' || c.type === 'general'
    );
    if (!titleCol) return '(제목 없음)';
    const v = ctx.row.cells[titleCol.id];
    return v ? String(v) : '(제목 없음)';
  };

  return (
    <div
      className="glass-card p-4 flex flex-col"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" style={{ color }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {label}
          </span>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold leading-none" style={{ color }}>
            {count}
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
            / {total} {totalLabel}
          </div>
        </div>
      </div>

      {preview.length === 0 ? (
        <p className="text-xs italic" style={{ color: 'var(--text-tertiary)' }}>
          {emptyText}
        </p>
      ) : (
        <div className="space-y-1 flex-1">
          {preview.map((ctx, i) => (
            <button
              key={i}
              onClick={() => onRowClick(ctx)}
              className="w-full text-left px-2 py-1 rounded text-xs truncate hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              title={getTitle(ctx)}
            >
              • {getTitle(ctx)}
            </button>
          ))}
          {rows.length > 3 && (
            <div className="text-[10px] px-2" style={{ color: 'var(--text-tertiary)' }}>
              + {rows.length - 3}개 더
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PlaytestCard({
  work,
  onSheetClick,
}: {
  work: TodaysWork;
  onSheetClick: (projectId: string, sheetId: string) => void;
}) {
  const playtests = work.pmSheets.filter((s) => s.type === 'playtest');
  const totalSessions = playtests.reduce((acc, p) => acc + p.sheet.rows.length, 0);

  return (
    <div
      className="glass-card p-4 flex flex-col"
      style={{ borderLeft: '3px solid #10b981' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Gamepad2 className="w-4 h-4" style={{ color: '#10b981' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Playtest
          </span>
        </div>
        <div className="text-2xl font-bold leading-none" style={{ color: '#10b981' }}>
          {totalSessions}
        </div>
      </div>

      {playtests.length === 0 ? (
        <p className="text-xs italic" style={{ color: 'var(--text-tertiary)' }}>
          Playtest 시트 없음
        </p>
      ) : (
        <div className="space-y-1 flex-1">
          {playtests.slice(0, 3).map((p, i) => (
            <button
              key={i}
              onClick={() => onSheetClick(p.projectId, p.sheet.id)}
              className="w-full text-left px-2 py-1 rounded text-xs truncate hover:bg-black/5 dark:hover:bg-white/5"
              style={{ color: 'var(--text-secondary)' }}
            >
              • {p.sheet.name} ({p.sheet.rows.length})
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
