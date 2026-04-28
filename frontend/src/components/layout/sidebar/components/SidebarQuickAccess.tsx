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

import { useState, useRef, useEffect } from 'react';
import {
  Home, Inbox, Zap, Bug, Gamepad2, Clock,
  ChevronDown, ChevronRight, Check, CheckCheck, Plus, LayoutTemplate, Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTodaysWork, type RowWithContext } from '@/hooks/useTodaysWork';
import { useProjectStore } from '@/stores/projectStore';
import { useInbox } from '@/stores/inboxStore';

type QuickLinkKind = 'home' | 'inbox' | 'sprint' | 'bug' | 'playtest' | 'recent' | 'section-header';

export default function SidebarQuickAccess() {
  const t = useTranslations();
  const work = useTodaysWork();
  const [expanded, setExpanded] = useState(true);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const setCurrentSheet = useProjectStore((s) => s.setCurrentSheet);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const currentSheetId = useProjectStore((s) => s.currentSheetId);
  const openInbox = useInbox((s) => s.openInbox);
  const markAllInboxRead = useInbox((s) => s.markAllRead);

  // 우클릭 컨텍스트 메뉴 — kind 별로 다른 액션
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; kind: QuickLinkKind } | null>(null);
  const ctxMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ctxMenu) return;
    const onDown = (e: MouseEvent) => {
      if (ctxMenuRef.current && !ctxMenuRef.current.contains(e.target as Node)) {
        setCtxMenu(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [ctxMenu]);

  const openCtx = (kind: QuickLinkKind) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, kind });
  };

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
        onContextMenu={openCtx('section-header')}
        className="w-full flex items-center gap-1 px-3 py-1.5 text-overline hover:bg-[var(--bg-hover)] transition-colors"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {t('sidebar.myStuff')}
      </button>

      {expanded && (
        <div className="px-2 pb-2 space-y-0.5">
          {/* 개인 워크스페이스 — Linear My Issues 패턴 */}
          <QuickLink
            icon={Home}
            label="Home"
            onClick={goHome}
            onContextMenu={openCtx('home')}
            active={isHomeActive}
          />

          {work.recentChanges.length > 0 && (
            <QuickLink
              icon={Inbox}
              label="Inbox"
              count={work.recentChanges.length}
              onClick={openInbox}
              onContextMenu={openCtx('inbox')}
              hint={t('sidebar.qaRecentHint')}
            />
          )}

          {hasSprintSheet && (
            <QuickLink
              icon={Zap}
              label={t('sidebar.qaMySprint')}
              count={work.mySprint.length}
              totalCount={work.activeSprint.length}
              onClick={() => {
                if (work.mySprint[0]) jumpToRow(work.mySprint[0]);
                else jumpToFirstOfType('sprint');
              }}
              onContextMenu={openCtx('sprint')}
            />
          )}

          {hasBugSheet && (
            <QuickLink
              icon={Bug}
              label={t('sidebar.qaMyBugs')}
              count={work.myBugs.length}
              totalCount={work.openBugs.length}
              onClick={() => {
                if (work.myBugs[0]) jumpToRow(work.myBugs[0]);
                else jumpToFirstOfType('bug');
              }}
              onContextMenu={openCtx('bug')}
            />
          )}

          {hasPlaytestSheet && (
            <QuickLink
              icon={Gamepad2}
              label="Playtest"
              count={work.pmSheets.filter((p) => p.type === 'playtest').length}
              onClick={() => jumpToFirstOfType('playtest')}
              onContextMenu={openCtx('playtest')}
            />
          )}

          {hasRecent && (
            <>
              <div className="h-px my-1 mx-2" style={{ background: 'var(--border-primary)' }} />
              <QuickLink
                icon={Clock}
                label={t('sidebar.qaRecentEdits')}
                onClick={jumpToRecentEdit}
                onContextMenu={openCtx('recent')}
                hint={work.recentSheets[0]?.sheet.name}
              />
            </>
          )}
        </div>
      )}

      {ctxMenu && (
        <div
          ref={ctxMenuRef}
          className="fixed z-50 min-w-[180px] py-1 rounded-lg shadow-lg border"
          style={{
            left: ctxMenu.x,
            top: ctxMenu.y,
            background: 'var(--bg-primary)',
            borderColor: 'var(--border-primary)',
          }}
        >
          {ctxMenu.kind === 'home' && (
            <>
              <CtxItem
                icon={Plus}
                label={t('sidebar.qaNewProject')}
                onClick={() => { window.dispatchEvent(new Event('balruno:open-new-project')); setCtxMenu(null); }}
              />
              <CtxItem
                icon={LayoutTemplate}
                label={t('sidebar.qaTemplateGallery')}
                onClick={() => { window.dispatchEvent(new Event('balruno:open-gallery')); setCtxMenu(null); }}
              />
            </>
          )}
          {ctxMenu.kind === 'inbox' && (
            <>
              <CtxItem
                icon={Inbox}
                label={t('sidebar.qaOpenInbox')}
                onClick={() => { openInbox(); setCtxMenu(null); }}
              />
              <CtxItem
                icon={CheckCheck}
                label={t('sidebar.qaMarkAllRead')}
                onClick={() => {
                  markAllInboxRead(work.recentChanges.map((c) => c.entry.id));
                  setCtxMenu(null);
                }}
              />
            </>
          )}
          {(ctxMenu.kind === 'sprint' || ctxMenu.kind === 'bug' || ctxMenu.kind === 'playtest') && (
            <CtxItem
              icon={Plus}
              label={t('sidebar.qaAddItem')}
              onClick={() => {
                const kind = ctxMenu.kind as 'sprint' | 'bug' | 'playtest';
                const match = work.pmSheets.find((p) => p.type === kind || (kind === 'sprint' && p.type === 'generic-pm'));
                if (match) {
                  setCurrentProject(match.projectId);
                  setCurrentSheet(match.sheet.id);
                  useProjectStore.getState().addRow(match.projectId, match.sheet.id);
                }
                setCtxMenu(null);
              }}
            />
          )}
          {ctxMenu.kind === 'recent' && (
            <CtxItem
              icon={Trash2}
              label={t('sidebar.qaClearRecent')}
              danger
              onClick={() => {
                // recentSheets 는 localStorage 기반 — 관련 키 clear (recentSheets.ts 참조)
                if (typeof window !== 'undefined') {
                  window.localStorage.removeItem('balruno:recent-sheets');
                }
                setCtxMenu(null);
                // 리프레시 필요
                window.dispatchEvent(new Event('balruno:recent-cleared'));
              }}
            />
          )}
          {ctxMenu.kind === 'section-header' && (
            <>
              <CtxItem
                icon={expanded ? ChevronRight : ChevronDown}
                label={expanded ? t('sidebar.qaCollapse') : t('sidebar.qaExpand')}
                onClick={() => { setExpanded((v) => !v); setCtxMenu(null); }}
              />
              <CtxItem
                icon={Home}
                label={t('sidebar.qaGoHome')}
                onClick={() => { goHome(); setCtxMenu(null); }}
              />
              <CtxItem
                icon={Inbox}
                label={t('sidebar.qaOpenInbox')}
                onClick={() => { openInbox(); setCtxMenu(null); }}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CtxItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--bg-hover)]"
      style={{ color: danger ? 'var(--danger)' : 'var(--text-primary)' }}
    >
      <Icon className="w-4 h-4" style={{ color: danger ? 'var(--danger)' : 'var(--text-secondary)' }} />
      {label}
    </button>
  );
}

function QuickLink({
  icon: Icon,
  label,
  count,
  totalCount,
  onClick,
  onContextMenu,
  active,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  count?: number;
  totalCount?: number;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  active?: boolean;
  hint?: string;
}) {
  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
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
