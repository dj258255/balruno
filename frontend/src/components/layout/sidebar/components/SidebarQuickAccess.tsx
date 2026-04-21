'use client';

/**
 * 사이드바 상단 Quick Access — Linear 식 "개인 작업 우선" 패턴.
 *
 * Linear 구조:
 *   Inbox (알림)
 *   My Issues (내게 assigned)
 *   ───
 *   Teams (각 team 의 Issues/Cycles/Projects)
 *
 * 우리 버전:
 *   Home (대시보드)
 *   Inbox (최근 변경 · 피드백 대기)
 *   My Sprint (내게 assigned 활성)
 *   My Bugs (내게 assigned 오픈)
 *   Playtest
 *   ───
 *   최근 편집
 *
 * useTodaysWork 훅 재사용.
 */

import { useState } from 'react';
import {
  Home, Inbox, Zap, Bug, Gamepad2, Clock,
  ChevronDown, ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { useTodaysWork, type RowWithContext } from '@/hooks/useTodaysWork';
import { useProjectStore } from '@/stores/projectStore';

export default function SidebarQuickAccess() {
  const work = useTodaysWork();
  const [expanded, setExpanded] = useState(true);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const setCurrentSheet = useProjectStore((s) => s.setCurrentSheet);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const currentSheetId = useProjectStore((s) => s.currentSheetId);

  const goHome = () => {
    setCurrentProject(null);
    setCurrentSheet(null);
  };

  const jumpToRow = (ctx: RowWithContext) => {
    setCurrentProject(ctx.projectId);
    setCurrentSheet(ctx.sheet.id);
  };

  const jumpToFirstOfType = (type: 'sprint' | 'bug' | 'playtest') => {
    const match = work.pmSheets.find((p) => p.type === type || (type === 'sprint' && p.type === 'generic-pm'));
    if (!match) return;
    setCurrentProject(match.projectId);
    setCurrentSheet(match.sheet.id);
  };

  const jumpToRecentEdit = () => {
    const first = work.recentSheets[0];
    if (!first) return;
    setCurrentProject(first.projectId);
    setCurrentSheet(first.sheet.id);
  };

  const hasSprintSheet = work.pmSheets.some((p) => p.type === 'sprint' || p.type === 'generic-pm');
  const hasBugSheet = work.pmSheets.some((p) => p.type === 'bug');
  const hasPlaytestSheet = work.pmSheets.some((p) => p.type === 'playtest');
  const hasRecent = work.recentSheets.length > 0;
  const isHomeActive = !currentProjectId && !currentSheetId;

  // 아무것도 없으면 Home 버튼만 렌더
  const hasAnyQuickAccess = hasSprintSheet || hasBugSheet || hasPlaytestSheet || hasRecent
    || work.recentChanges.length > 0;

  if (!hasAnyQuickAccess) {
    return (
      <div className="px-2 py-2 border-b" style={{ borderColor: 'var(--border-primary)' }}>
        <QuickLink icon={Home} label="Home" onClick={goHome} active={isHomeActive} />
      </div>
    );
  }

  return (
    <div className="border-b" style={{ borderColor: 'var(--border-primary)' }}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-1 px-3 py-1.5 text-overline hover:bg-[var(--bg-hover)] transition-colors"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        빠른 접근
      </button>

      {expanded && (
        <div className="px-2 pb-2 space-y-0.5">
          {/* 개인 워크스페이스 — Linear My Issues 패턴 */}
          <QuickLink
            icon={Home}
            label="Home"
            onClick={goHome}
            active={isHomeActive}
          />

          {work.recentChanges.length > 0 && (
            <QuickLink
              icon={Inbox}
              label="Inbox"
              count={work.recentChanges.length}
              onClick={() => {
                // Home 으로 이동 + changelog 위젯 스크롤
                setCurrentProject(null);
                setCurrentSheet(null);
                setTimeout(() => {
                  window.dispatchEvent(new Event('balruno:scroll-to-inbox'));
                }, 100);
              }}
              hint="최근 변경 · 피드백"
            />
          )}

          {hasSprintSheet && (
            <QuickLink
              icon={Zap}
              label="내 Sprint"
              count={work.mySprint.length}
              totalCount={work.activeSprint.length}
              onClick={() => {
                if (work.mySprint[0]) jumpToRow(work.mySprint[0]);
                else jumpToFirstOfType('sprint');
              }}
            />
          )}

          {hasBugSheet && (
            <QuickLink
              icon={Bug}
              label="내 버그"
              count={work.myBugs.length}
              totalCount={work.openBugs.length}
              onClick={() => {
                if (work.myBugs[0]) jumpToRow(work.myBugs[0]);
                else jumpToFirstOfType('bug');
              }}
            />
          )}

          {hasPlaytestSheet && (
            <QuickLink
              icon={Gamepad2}
              label="Playtest"
              count={work.pmSheets.filter((p) => p.type === 'playtest').length}
              onClick={() => jumpToFirstOfType('playtest')}
            />
          )}

          {hasRecent && (
            <>
              <div className="h-px my-1 mx-2" style={{ background: 'var(--border-primary)' }} />
              <QuickLink
                icon={Clock}
                label="최근 편집"
                onClick={jumpToRecentEdit}
                hint={work.recentSheets[0]?.sheet.name}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function QuickLink({
  icon: Icon,
  label,
  count,
  totalCount,
  onClick,
  active,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  count?: number;
  totalCount?: number;
  onClick: () => void;
  active?: boolean;
  hint?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left transition-colors"
      style={{
        background: active ? 'var(--bg-tertiary)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-primary)',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = 'var(--bg-hover)';
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent';
      }}
      title={hint}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: active ? 'var(--accent)' : 'var(--text-secondary)' }} />
      <span className="flex-1 truncate" style={{ fontWeight: active ? 600 : 400 }}>
        {label}
      </span>
      {count !== undefined && count > 0 && (
        <span
          className="text-caption font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
          style={{
            background: 'var(--bg-tertiary)',
            color: 'var(--text-secondary)',
          }}
        >
          {totalCount !== undefined && totalCount !== count ? `${count}/${totalCount}` : count}
        </span>
      )}
    </button>
  );
}
