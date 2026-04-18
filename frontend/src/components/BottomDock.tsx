'use client';

/**
 * Track 6 후속 — 하단 도킹 독바 (macOS Dock 스타일).
 *
 * 9 그룹 (Track 6 toolGroups 재활용) 아이콘만 1줄로 배치.
 * 기존 BottomToolbar (15개 개별 도구) 대체 → 진입점 단일화.
 *
 * UX:
 *  - 그룹 아이콘 클릭 → 그룹 닫혀있으면 첫 도구 open, 열려있으면 그룹 전체 닫기
 *  - 그룹 활성 상태 = 해당 그룹 중 하나라도 show=true
 *  - 활성 그룹 아이콘은 색상 강조 + 하단 인디케이터 점
 *  - 좌 Sidebar 에서 도구 섹션 제거 → 좌측은 네비 전담
 *  - 모바일 숨김 (기존 동일)
 *
 * 그룹별 세부 도구 선택은 우측 DockedToolbox 의 탭에서.
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  FunctionSquare,
  Shield,
  Swords,
  BarChart3,
  Coins,
  PenTool,
  Users,
  TrendingUp,
  Target,
  type LucideIcon,
} from 'lucide-react';
import { TOOL_GROUPS, type ToolGroupId, type ToolId } from '@/config/toolGroups';
import { useToolLayoutStore } from '@/stores/toolLayoutStore';

const GROUP_ICONS: Record<ToolGroupId, LucideIcon> = {
  'formula-workbench': FunctionSquare,
  'balance-insights': Shield,
  simulation: Swords,
  charts: BarChart3,
  economy: Coins,
  'curve-fitting': PenTool,
  'entity-generator': Users,
  'difficulty-curve': TrendingUp,
  'goal-solver': Target,
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

export default function BottomDock({ panels, isModalOpen }: BottomDockProps) {
  const t = useTranslations();
  const sidebarWidth = useToolLayoutStore((s) => s.sidebarWidth);
  const [mounted, setMounted] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isMobile = useIsMobile();
  const leftOffset = isMobile ? 0 : mounted ? sidebarWidth : 256;

  const handleGroupClick = (groupId: ToolGroupId) => {
    if (isModalOpen) return;
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
      className="fixed bottom-3 z-[45] hidden md:flex items-end justify-center pointer-events-none"
      style={{ left: `${leftOffset}px`, right: 0, paddingTop: 32 }}
    >
      <div className="liquid-glass-dock flex items-center gap-0.5 px-1.5 py-1.5 pointer-events-auto transition-all duration-200">
        {TOOL_GROUPS.map((group, idx) => {
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
                className={`dock-item ${isActive ? 'active' : ''}`}
                aria-label={t(group.titleKey as 'toolGroups.formulaWorkbench')}
                aria-pressed={isActive}
                onClick={() => handleGroupClick(group.id)}
                style={{
                  transform: `scale(${scale}) translateY(${isHovered ? -8 : 0}px)`,
                  zIndex: isHovered ? 100 : 1,
                  transition:
                    'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.15s ease',
                }}
              >
                <div className="dock-tooltip">
                  {t(group.titleKey as 'toolGroups.formulaWorkbench')}
                </div>
                <Icon
                  className="w-6 h-6 pointer-events-none"
                  style={{
                    color: group.color,
                    filter: isActive ? `drop-shadow(0 0 8px ${group.color}60)` : undefined,
                  }}
                />
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
