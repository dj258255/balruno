'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { FunctionSquare, Shield, TrendingUp, Swords, Calculator, PieChart, BarChart3, GitCompare, AlertTriangle, Target, Coins, BarChart2, PenTool, Activity, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useToolLayoutStore, AllToolId, PanelToolId } from '@/stores/toolLayoutStore';
import { cn } from '@/lib/utils';

// 모바일 감지 훅
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

interface BottomToolbarProps {
  show: {
    formulaHelper: boolean;
    balanceValidator: boolean;
    difficultyCurve: boolean;
    simulation: boolean;
    entityDefinition: boolean;
  };
  setShow: {
    formulaHelper: (value: boolean) => void;
    balanceValidator: (value: boolean) => void;
    difficultyCurve: (value: boolean) => void;
    simulation: (value: boolean) => void;
    entityDefinition: (value: boolean) => void;
  };
  // 모든 도구의 활성 상태 (점 표시용)
  activeTools?: {
    calculator?: boolean;
    comparison?: boolean;
    chart?: boolean;
    presetComparison?: boolean;
    imbalanceDetector?: boolean;
    goalSolver?: boolean;
    balanceAnalysis?: boolean;
    economy?: boolean;
    dpsVariance?: boolean;
    curveFitting?: boolean;
  };
  onShowCalculator?: () => void;
  onShowComparison?: () => void;
  onShowChart?: () => void;
  onShowPresetComparison?: () => void;
  onShowImbalanceDetector?: () => void;
  onShowGoalSolver?: () => void;
  onShowBalanceAnalysis?: () => void;
  onShowEconomy?: () => void;
  onShowDpsVariance?: () => void;
  onShowCurveFitting?: () => void;
  isModalOpen: boolean;
}

const TOOL_CONFIG: Record<AllToolId, { icon: typeof FunctionSquare; color: string; labelKey: string }> = {
  formulaHelper: { icon: FunctionSquare, color: '#3b82f6', labelKey: 'bottomTabs.formulaHelper' },
  balanceValidator: { icon: Shield, color: '#22c55e', labelKey: 'bottomTabs.balanceValidator' },
  difficultyCurve: { icon: TrendingUp, color: '#8b5cf6', labelKey: 'bottomTabs.difficultyCurve' },
  simulation: { icon: Swords, color: '#ef4444', labelKey: 'bottomTabs.simulation' },
  entityDefinition: { icon: Users, color: '#06b6d4', labelKey: 'bottomTabs.entityDefinition' },
  calculator: { icon: Calculator, color: '#8b5cf6', labelKey: 'sidebar.calculator' },
  comparison: { icon: PieChart, color: '#3b82f6', labelKey: 'sidebar.comparison' },
  chart: { icon: BarChart3, color: '#22c55e', labelKey: 'sidebar.chart' },
  presetComparison: { icon: GitCompare, color: '#f97316', labelKey: 'sidebar.presetComparison' },
  imbalanceDetector: { icon: AlertTriangle, color: '#eab308', labelKey: 'sidebar.imbalanceDetector' },
  goalSolver: { icon: Target, color: '#14b8a6', labelKey: 'sidebar.goalSolver' },
  balanceAnalysis: { icon: Activity, color: '#ec4899', labelKey: 'sidebar.balanceAnalysis' },
  economy: { icon: Coins, color: '#f59e0b', labelKey: 'sidebar.economy' },
  dpsVariance: { icon: BarChart2, color: '#f97316', labelKey: 'sidebar.dpsVariance' },
  curveFitting: { icon: PenTool, color: '#6366f1', labelKey: 'sidebar.curveFitting' },
};

const isPanelTool = (toolId: AllToolId): toolId is PanelToolId => {
  return ['formulaHelper', 'balanceValidator', 'difficultyCurve', 'simulation', 'entityDefinition'].includes(toolId);
};

// 인접 아이템 스케일 계산 (macOS Dock 효과)
function calculateAdjacentScale(itemIndex: number, hoveredIndex: number | null, isDragging: boolean): number {
  if (isDragging) return 1; // 드래그 중에는 스케일 효과 없음
  if (hoveredIndex === null) return 1;
  const distance = Math.abs(itemIndex - hoveredIndex);
  if (distance === 0) return 1.4;
  if (distance === 1) return 1.2;
  if (distance === 2) return 1.08;
  return 1;
}

export default function BottomToolbar({
  show,
  setShow,
  activeTools = {},
  onShowCalculator,
  onShowComparison,
  onShowChart,
  onShowPresetComparison,
  onShowImbalanceDetector,
  onShowGoalSolver,
  onShowBalanceAnalysis,
  onShowEconomy,
  onShowDpsVariance,
  onShowCurveFitting,
  isModalOpen
}: BottomToolbarProps) {
  const t = useTranslations();
  const {
    toolLocations,
    moveToolToLocation,
    getBottomTools,
    bringToolToFront,
    reorderBottomTools,
    sidebarWidth
  } = useToolLayoutStore();

  // 클라이언트 마운트 후에만 저장된 너비 사용
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // 드래그 상태 - 단순화
  const [dragState, setDragState] = useState<{
    draggedToolId: AllToolId | null;
    draggedFromDock: boolean;
    dropTargetIndex: number | null;
    isOverDock: boolean;
  }>({
    draggedToolId: null,
    draggedFromDock: false,
    dropTargetIndex: null,
    isOverDock: false,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const bottomTools = getBottomTools();

  // 최신 props를 ref로 저장해서 stale closure 방지
  const propsRef = useRef({
    isModalOpen,
    show,
    setShow,
    onShowCalculator,
    onShowComparison,
    onShowChart,
    onShowPresetComparison,
    onShowImbalanceDetector,
    onShowGoalSolver,
    onShowBalanceAnalysis,
    onShowEconomy,
    onShowDpsVariance,
    onShowCurveFitting,
  });

  // 매 렌더링마다 ref 업데이트
  propsRef.current = {
    isModalOpen,
    show,
    setShow,
    onShowCalculator,
    onShowComparison,
    onShowChart,
    onShowPresetComparison,
    onShowImbalanceDetector,
    onShowGoalSolver,
    onShowBalanceAnalysis,
    onShowEconomy,
    onShowDpsVariance,
    onShowCurveFitting,
  };

  const handleToolClick = useCallback((toolId: AllToolId) => {
    const {
      isModalOpen: modalOpen,
      show: currentShow,
      setShow: currentSetShow,
      onShowCalculator: calcHandler,
      onShowComparison: compHandler,
      onShowChart: chartHandler,
      onShowPresetComparison: presetHandler,
      onShowImbalanceDetector: imbalanceHandler,
      onShowGoalSolver: goalHandler,
      onShowBalanceAnalysis: balanceHandler,
      onShowEconomy: economyHandler,
      onShowDpsVariance: dpsVarianceHandler,
      onShowCurveFitting: curveFittingHandler,
    } = propsRef.current;

    if (modalOpen) return;

    // 클릭 시 맨 앞으로 가져오기
    bringToolToFront(toolId);

    if (isPanelTool(toolId)) {
      currentSetShow[toolId](!currentShow[toolId]);
    } else {
      switch (toolId) {
        case 'calculator': calcHandler?.(); break;
        case 'comparison': compHandler?.(); break;
        case 'chart': chartHandler?.(); break;
        case 'presetComparison': presetHandler?.(); break;
        case 'imbalanceDetector': imbalanceHandler?.(); break;
        case 'goalSolver': goalHandler?.(); break;
        case 'balanceAnalysis': balanceHandler?.(); break;
        case 'economy': economyHandler?.(); break;
        case 'dpsVariance': dpsVarianceHandler?.(); break;
        case 'curveFitting': curveFittingHandler?.(); break;
      }
    }
  }, [bringToolToFront]);

  // 유효한 도구 ID 목록
  const validToolIds = Object.keys(TOOL_CONFIG);

  // 전역 드래그 이벤트 감지
  useEffect(() => {
    const handleGlobalDragStart = (e: DragEvent) => {
      const toolId = e.dataTransfer?.getData('text/plain') as AllToolId;
      const isFromDock = e.dataTransfer?.types.includes('application/x-from-dock');

      if (e.dataTransfer?.types.includes('application/x-tool-id')) {
        setDragState(prev => ({
          ...prev,
          draggedToolId: toolId || null,
          draggedFromDock: !!isFromDock,
        }));
      }
    };

    const handleGlobalDragEnd = () => {
      setDragState({
        draggedToolId: null,
        draggedFromDock: false,
        dropTargetIndex: null,
        isOverDock: false,
      });
    };

    document.addEventListener('dragstart', handleGlobalDragStart);
    document.addEventListener('dragend', handleGlobalDragEnd);

    return () => {
      document.removeEventListener('dragstart', handleGlobalDragStart);
      document.removeEventListener('dragend', handleGlobalDragEnd);
    };
  }, []);

  // 독 아이템 드래그 시작
  const handleDragStart = (e: React.DragEvent, toolId: AllToolId) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', toolId);
    e.dataTransfer.setData('application/x-tool-id', toolId);
    e.dataTransfer.setData('application/x-from-dock', 'true');

    setDragState({
      draggedToolId: toolId,
      draggedFromDock: true,
      dropTargetIndex: null,
      isOverDock: false,
    });

    // 드래그 이미지 설정
    const config = TOOL_CONFIG[toolId];
    const dragIcon = document.createElement('div');
    dragIcon.innerHTML = `
      <div style="
        width: 56px;
        height: 56px;
        background: ${config.color}20;
        border: 2px solid ${config.color};
        border-radius: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 8px 32px ${config.color}40;
      ">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="${config.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${getIconPath(toolId)}
        </svg>
      </div>
    `;
    dragIcon.style.position = 'absolute';
    dragIcon.style.top = '-1000px';
    document.body.appendChild(dragIcon);
    e.dataTransfer.setDragImage(dragIcon, 28, 28);
    setTimeout(() => document.body.removeChild(dragIcon), 0);
  };

  // 독 컨테이너 드래그 오버
  const handleContainerDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (!e.dataTransfer.types.includes('application/x-tool-id')) return;

    setDragState(prev => ({ ...prev, isOverDock: true }));

    // 드롭 위치 계산 - 실제 아이템 위치 기반
    if (containerRef.current) {
      const x = e.clientX;

      // 각 아이템의 실제 위치를 기반으로 드롭 인덱스 계산
      const items = containerRef.current.querySelectorAll('.dock-item-wrapper');
      let targetIndex = bottomTools.length; // 기본값: 맨 끝

      for (let i = 0; i < items.length; i++) {
        const item = items[i] as HTMLElement;
        const itemRect = item.getBoundingClientRect();
        // 아이템 중심보다 왼쪽이면 이 위치에 삽입
        if (x < itemRect.left + itemRect.width / 2) {
          targetIndex = i;
          break;
        }
      }

      setDragState(prev => ({ ...prev, dropTargetIndex: targetIndex }));
    }
  };

  // 독 컨테이너 드래그 리브
  const handleContainerDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragState(prev => ({ ...prev, isOverDock: false, dropTargetIndex: null }));
  };

  // 드롭 처리
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const toolId = e.dataTransfer.getData('text/plain') as AllToolId;
    const isFromDock = e.dataTransfer.types.includes('application/x-from-dock');

    if (!toolId || !validToolIds.includes(toolId)) {
      setDragState({
        draggedToolId: null,
        draggedFromDock: false,
        dropTargetIndex: null,
        isOverDock: false,
      });
      return;
    }

    const { dropTargetIndex } = dragState;

    if (isFromDock) {
      // 독 내에서 순서 변경
      const fromIndex = bottomTools.indexOf(toolId);
      if (fromIndex !== -1 && dropTargetIndex !== null && fromIndex !== dropTargetIndex) {
        // dropTargetIndex는 "이 위치 앞에 삽입" 의미
        // reorderBottomTools는 fromIndex를 제거한 후 toIndex에 삽입
        // 따라서 fromIndex가 dropTargetIndex보다 작으면 (앞에서 뒤로 이동)
        // 제거 후 인덱스가 1 줄어들므로 -1 필요
        let toIndex = dropTargetIndex;
        if (fromIndex < dropTargetIndex) {
          toIndex = dropTargetIndex - 1;
        }
        reorderBottomTools(fromIndex, toIndex);
      }
    } else if (toolLocations[toolId] === 'sidebar') {
      // 사이드바에서 독으로 이동
      moveToolToLocation(toolId, 'bottom', dropTargetIndex ?? undefined);
    }

    setDragState({
      draggedToolId: null,
      draggedFromDock: false,
      dropTargetIndex: null,
      isOverDock: false,
    });
  };

  const isMobile = useIsMobile();
  const effectiveSidebarWidth = mounted ? sidebarWidth : 256;
  const responsiveLeftOffset = isMobile ? 0 : effectiveSidebarWidth;

  // 하단 도구가 없고 드래그 중이 아니면 표시하지 않음
  const isAnyDragging = dragState.draggedToolId !== null;

  if (bottomTools.length === 0 && !isAnyDragging) {
    return null;
  }

  // 하단 도구가 없지만 드래그 중이면 드롭 영역만 표시
  if (bottomTools.length === 0) {
    return (
      <div
        ref={containerRef}
        className="fixed bottom-3 z-[45] hidden md:flex items-end justify-center pointer-events-auto"
        style={{
          left: `${responsiveLeftOffset}px`,
          right: '0',
        }}
        onDragOver={handleContainerDragOver}
        onDragLeave={handleContainerDragLeave}
        onDrop={handleDrop}
      >
        <div
          className="liquid-glass-dock flex items-center justify-center px-6 py-4 transition-all duration-200"
        >
          <div className="text-sm font-medium text-[var(--text-secondary)]">
            {t('sidebar.dropHere')}
          </div>
        </div>
      </div>
    );
  }

  // 밀림 효과 계산 (macOS Dock 스타일)
  // 삽입 위치 기준으로 자연스럽게 공간 생성
  const getItemTransform = (index: number, toolId: AllToolId) => {
    const { draggedToolId, draggedFromDock, dropTargetIndex, isOverDock } = dragState;

    if (!draggedToolId || dropTargetIndex === null) return 0;

    const itemWidth = 52; // 아이템 너비 + 간격

    if (draggedFromDock) {
      // 독 내에서 드래그 중 (재정렬)
      const draggedIndex = bottomTools.indexOf(draggedToolId);
      if (draggedIndex === -1) return 0;
      if (draggedToolId === toolId) return 0; // 드래그 중인 아이템 자체

      if (draggedIndex < dropTargetIndex) {
        // 오른쪽으로 이동: draggedIndex와 dropTargetIndex 사이 아이템들이 왼쪽으로
        if (index > draggedIndex && index < dropTargetIndex) {
          return -itemWidth;
        }
      } else if (draggedIndex > dropTargetIndex) {
        // 왼쪽으로 이동: dropTargetIndex와 draggedIndex 사이 아이템들이 오른쪽으로
        if (index >= dropTargetIndex && index < draggedIndex) {
          return itemWidth;
        }
      }
    } else if (isOverDock) {
      // 사이드바에서 독으로 드래그 중 (새 아이템 삽입)
      // macOS Dock처럼 삽입 위치 이후의 아이템들만 오른쪽으로 밀림
      if (index >= dropTargetIndex) {
        return itemWidth;
      }
    }

    return 0;
  };

  return (
    <>
      {/* macOS Dock 스타일 Liquid Glass 탭 바 */}
      <div
        className="fixed bottom-3 z-[45] hidden md:flex items-end justify-center pointer-events-none"
        style={{
          left: `${responsiveLeftOffset}px`,
          right: '0',
          paddingTop: '32px',
        }}
      >
        <div
          ref={containerRef}
          className="liquid-glass-dock flex items-center gap-0.5 px-1.5 py-1.5 pointer-events-auto transition-all duration-200"
          onDragOver={handleContainerDragOver}
          onDragLeave={handleContainerDragLeave}
          onDrop={handleDrop}
        >
          {/* 도구 버튼들 */}
          {bottomTools.map((toolId, index) => {
            const config = TOOL_CONFIG[toolId];
            if (!config) return null;

            const Icon = config.icon;
            const isActive = isPanelTool(toolId)
              ? show[toolId]
              : (() => {
                  const toolActiveMap: Record<string, boolean | undefined> = {
                    calculator: activeTools.calculator,
                    comparison: activeTools.comparison,
                    chart: activeTools.chart,
                    presetComparison: activeTools.presetComparison,
                    imbalanceDetector: activeTools.imbalanceDetector,
                    goalSolver: activeTools.goalSolver,
                    balanceAnalysis: activeTools.balanceAnalysis,
                    economy: activeTools.economy,
                    dpsVariance: activeTools.dpsVariance,
                    curveFitting: activeTools.curveFitting,
                  };
                  return toolActiveMap[toolId] ?? false;
                })();

            const isDragging = dragState.draggedToolId === toolId && dragState.draggedFromDock;
            const isHovered = hoveredIndex === index && !dragState.draggedToolId;
            const scale = calculateAdjacentScale(index, hoveredIndex, !!dragState.draggedToolId);
            const translateX = getItemTransform(index, toolId);

            return (
              <div
                key={toolId}
                className={cn(
                  "dock-item-wrapper relative",
                  isDragging && "opacity-30"
                )}
                style={{
                  transform: `translateX(${translateX}px)`,
                  transition: 'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div
                  className={cn(
                    "dock-item",
                    isActive && "active"
                  )}
                  style={{
                    transform: isDragging
                      ? 'scale(1.05)'
                      : `scale(${scale}) translateY(${isHovered ? -8 : 0}px)`,
                    zIndex: isDragging ? 200 : isHovered ? 100 : 1,
                    transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.15s ease, box-shadow 0.2s ease',
                    boxShadow: isDragging ? `0 8px 24px ${config.color}40` : undefined,
                  }}
                  draggable
                  role="button"
                  tabIndex={0}
                  aria-label={t(config.labelKey)}
                  aria-pressed={isActive}
                  onKeyDown={(e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && !dragState.draggedToolId) {
                      e.preventDefault();
                      handleToolClick(toolId);
                    }
                  }}
                  onDragStart={(e) => handleDragStart(e, toolId)}
                  onClick={() => {
                    if (!dragState.draggedToolId) {
                      handleToolClick(toolId);
                    }
                  }}
                >
                  {/* 툴팁 */}
                  <div className="dock-tooltip">
                    {t(config.labelKey)}
                  </div>

                  {/* 아이콘 */}
                  <Icon
                    className="w-6 h-6 pointer-events-none"
                    style={{
                      color: config.color,
                      filter: isActive ? `drop-shadow(0 0 8px ${config.color}60)` : undefined,
                    }}
                  />

                  {/* 활성화 표시 점 */}
                  <div
                    className="dock-item-indicator"
                    style={{ background: config.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 모바일에서는 하단 독바 숨김 - 사이드바 메뉴 사용 */}
    </>
  );
}

// 아이콘 SVG path 가져오기 (드래그 이미지용)
function getIconPath(toolId: AllToolId): string {
  const paths: Record<AllToolId, string> = {
    formulaHelper: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    balanceValidator: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    difficultyCurve: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>',
    simulation: '<path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/><path d="M19 21l2-2"/>',
    calculator: '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8" y2="10"/><line x1="12" y1="10" x2="12" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="8" y2="18"/><line x1="12" y1="18" x2="12" y2="18"/><line x1="16" y1="18" x2="16" y2="18"/>',
    comparison: '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
    chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    presetComparison: '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><path d="M11 18H8a2 2 0 0 1-2-2V9"/>',
    imbalanceDetector: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    goalSolver: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    balanceAnalysis: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    economy: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
    dpsVariance: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    curveFitting: '<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>',
    entityDefinition: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  };
  return paths[toolId] || '';
}
