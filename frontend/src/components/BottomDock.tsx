'use client';

/**
 * 하단 도킹 독바 (macOS Dock 스타일) — 6 그룹 (동사형 · 유저 목적 기반).
 *
 * UX:
 *  - 그룹 아이콘 클릭 → 닫혀있으면 첫 도구 open, 열려있으면 그룹 전체 닫기
 *  - 한 번에 하나의 그룹만 활성 (다른 그룹 클릭 시 기존 그룹 닫음)
 *  - 활성 그룹 아이콘은 색상 강조 + 하단 인디케이터 점
 *  - 그룹별 세부 도구 선택은 우측 DockedToolbox 의 탭에서
 *  - 좌 Sidebar 에서 도구 섹션 제거 → 좌측은 네비 전담
 *
 * 선두의 AI 버튼은 그룹 시스템 밖 — "새 프로젝트 생성" quick action.
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Hammer,
  ShieldCheck,
  Swords,
  BarChart3,
  Bot,
  Share2,
  Wand2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { TOOL_GROUPS, type ToolGroupId, type ToolId } from '@/config/toolGroups';
import { useToolLayoutStore } from '@/stores/toolLayoutStore';

const GROUP_ICONS: Record<ToolGroupId, LucideIcon> = {
  build: Hammer,
  check: ShieldCheck,
  simulate: Swords,
  compare: BarChart3,
  auto: Bot,
  share: Share2,
};

interface PanelState {
  show: boolean;
  setShow: (v: boolean) => void;
}

export interface BottomDockProps {
  panels: Record<ToolId, PanelState>;
  isModalOpen: boolean;
}

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}

function calculateAdjacentScale(idx: number, hovered: number | null): number {
  if (hovered === null) return 1;
  const d = Math.abs(idx - hovered);
  if (d === 0) return 1.4;
  if (d === 1) return 1.2;
  if (d === 2) return 1.08;
  return 1;
}

const DOCK_HINT_KEY = 'balruno:dock-hint-seen';

export default function BottomDock({ panels, isModalOpen }: BottomDockProps) {
  const t = useTranslations();
  const sidebarWidth = useToolLayoutStore((s) => s.sidebarWidth);
  const [mounted, setMounted] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const visibleGroups = TOOL_GROUPS;

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined' && !window.localStorage.getItem(DOCK_HINT_KEY)) {
      // 첫 진입 시 약간 늦게 (1.5s) — 다른 UI 가 자리잡은 후 자연스럽게 등장
      const t = setTimeout(() => setShowHint(true), 1500);
      return () => clearTimeout(t);
    }
  }, []);

  const dismissHint = () => {
    setShowHint(false);
    if (typeof window !== 'undefined') window.localStorage.setItem(DOCK_HINT_KEY, '1');
  };

  const isMobile = useIsMobile();
  const leftOffset = isMobile ? 0 : mounted ? sidebarWidth : 256;

  const handleGroupClick = (groupId: ToolGroupId) => {
    if (isModalOpen) return;
    // 첫 그룹 클릭 시 hint 자동 dismiss
    if (showHint) dismissHint();
    const group = TOOL_GROUPS.find((g) => g.id === groupId);
    if (!group) return;
    const anyOpen = group.tools.some((tid) => panels[tid].show);
    if (anyOpen) {
      // 현재 그룹이 활성 → 전부 닫기 (독바 토글 off)
      group.tools.forEach((tid) => {
        if (panels[tid].show) panels[tid].setShow(false);
      });
    } else {
      // 다른 그룹이 열려있으면 먼저 닫기 — 한 번에 하나의 그룹만 활성
      TOOL_GROUPS.forEach((otherGroup) => {
        if (otherGroup.id === groupId) return;
        otherGroup.tools.forEach((tid) => {
          if (panels[tid].show) panels[tid].setShow(false);
        });
      });
      // 선택된 그룹의 첫 도구 열기
      panels[group.tools[0]].setShow(true);
    }
  };

  return (
    <div
      className="fixed bottom-3 z-[45] flex items-end justify-center pointer-events-none"
      style={{ left: `${leftOffset}px`, right: 0, paddingTop: 32 }}
    >
      {/* 첫 사용자 hint — 독바 위에 떠 있는 풍선. 1회 표시. */}
      {showHint && !isModalOpen && (
        <div
          className="absolute bottom-full mb-3 max-w-[calc(100vw-2rem)] w-[420px] rounded-xl shadow-2xl border pointer-events-auto animate-slideUp"
          style={{
            background: 'var(--bg-primary)',
            borderColor: 'var(--accent)',
          }}
          role="dialog"
          aria-label="하단 도구바 안내"
        >
          <div className="flex items-start gap-2 p-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'var(--accent)15', color: 'var(--accent)' }}
            >
              <Hammer className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                여기가 도구 모음이에요
              </div>
              <p className="text-caption mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                6 그룹 — <span style={{ color: 'var(--text-primary)' }}>만들기 · 점검 · 시뮬 · 비교 · 자동 · 공유</span>. 아이콘을 클릭하면 우측에 도구 패널이 열려요. 한 번에 한 그룹만 활성.
              </p>
              <div className="text-caption mt-1.5" style={{ color: 'var(--text-tertiary)' }}>
                팁: <code style={{ color: 'var(--accent)' }}>⌘K</code> 로 모든 도구 빠른 검색.
              </div>
            </div>
            <button
              type="button"
              onClick={dismissHint}
              className="p-1 rounded hover:bg-[var(--bg-hover)] transition-colors shrink-0"
              aria-label="안내 닫기"
            >
              <X className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
            </button>
          </div>
          {/* 아래쪽 꼬리 — 도크 가리키는 삼각형 */}
          <div
            className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-3 h-3 rotate-45 border-r border-b"
            style={{ background: 'var(--bg-primary)', borderColor: 'var(--accent)' }}
            aria-hidden
          />
        </div>
      )}

      <div className="liquid-glass-dock flex items-center gap-1 px-2 py-1.5 pointer-events-auto transition-all duration-200 max-w-[92vw] overflow-x-auto touch-pan-x">
        {/* AI 로 시작 — 상시 접근 Quick Action */}
        <div
          className="dock-item-wrapper relative"
          onMouseEnter={() => setHoveredIdx(-1)}
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <button
            type="button"
            className="dock-item flex flex-col items-center gap-0.5"
            aria-label="AI 로 시작"
            title="AI 로 새 프로젝트 생성"
            onClick={() => {
              if (isModalOpen) return;
              window.dispatchEvent(new Event('balruno:open-ai-setup'));
            }}
            style={{
              transform: `scale(${hoveredIdx === -1 ? 1.4 : 1}) translateY(${hoveredIdx === -1 ? -8 : 0}px)`,
              zIndex: hoveredIdx === -1 ? 100 : 1,
              transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            <Wand2
              className="w-5 h-5 pointer-events-none"
              style={{ color: '#8b5cf6' }}
            />
            <span
              className="text-caption font-medium pointer-events-none leading-tight whitespace-nowrap mt-0.5"
              style={{ color: 'var(--text-secondary)' }}
            >
              AI 시작
            </span>
          </button>
        </div>

        {/* 구분선 */}
        <div
          className="w-px self-stretch mx-0.5"
          style={{ background: 'var(--border-primary)', opacity: 0.5 }}
          aria-hidden
        />

        {visibleGroups.map((group, idx) => {
          const Icon = GROUP_ICONS[group.id];
          const isActive = group.tools.some((tid) => panels[tid].show);
          const isHovered = hoveredIdx === idx;
          const scale = calculateAdjacentScale(idx, hoveredIdx);
          return (
            <div
              key={group.id}
              className="dock-item-wrapper relative"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <button
                type="button"
                className={`dock-item flex flex-col items-center gap-0.5 ${isActive ? 'active' : ''}`}
                aria-label={t(group.titleKey as 'toolGroups.build')}
                aria-pressed={isActive}
                onClick={() => handleGroupClick(group.id)}
                style={{
                  transform: `scale(${scale}) translateY(${isHovered ? -8 : 0}px)`,
                  zIndex: isHovered ? 100 : 1,
                  transition:
                    'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.15s ease',
                }}
              >
                <Icon
                  className="w-5 h-5 pointer-events-none"
                  style={{
                    color: group.color,
                    filter: isActive ? `drop-shadow(0 0 8px ${group.color}60)` : undefined,
                  }}
                />
                <span
                  className="text-caption font-medium pointer-events-none leading-tight whitespace-nowrap mt-0.5"
                  style={{
                    color: isActive ? group.color : 'var(--text-secondary)',
                    opacity: isActive ? 1 : 0.85,
                  }}
                >
                  {t(group.titleKey as 'toolGroups.build')}
                </span>
                <div
                  className="dock-item-indicator"
                  style={{ background: group.color }}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
