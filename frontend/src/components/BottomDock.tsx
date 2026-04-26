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
import { ChevronRight, Check } from 'lucide-react';

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

/** 그룹별 사용법 단계 — 도크의 해당 그룹을 pulse 강조 + 카드에 설명 */
interface DockHintStep {
  groupId: ToolGroupId | null; // null = intro (전체 안내)
  title: string;
  body: string;
}
const DOCK_HINT_STEPS: DockHintStep[] = [
  {
    groupId: null,
    title: '여기가 도구 모음이에요',
    body: '6 그룹으로 묶여 있어요. 한 번에 한 그룹만 활성. 각 그룹마다 어떤 도구가 있는지 한 번씩 둘러볼게요.',
  },
  {
    groupId: 'build',
    title: '만들기',
    body: '데이터를 처음 설계할 때 — 수식 헬퍼 (90+ 함수 카탈로그), 엔티티 정의 (1-200렙 자동 생성), 계산기, 목표 역산 등.',
  },
  {
    groupId: 'check',
    title: '점검',
    body: '데이터 입력 후 균형 확인 — 밸런스 분석, 불균형 감지, 민감도, 매치업 매트릭스, AI Playtest.',
  },
  {
    groupId: 'simulate',
    title: '시뮬',
    body: '실제 게임 상황 시뮬레이션 — 1v1/팀 전투, FPS, MOBA 라이닝, 가챠, 경제 설계 (수익/지출 + 자원 흐름).',
  },
  {
    groupId: 'compare',
    title: '비교',
    body: '여러 엔티티/시트 시각 비교 — 레이더 차트, 성장 곡선 라인, 곡선 피팅 (회귀).',
  },
  {
    groupId: 'auto',
    title: '자동',
    body: 'AI 가 대신 — Auto-Balancer (자동 밸런싱), Automations (트리거-액션), AI Behavior (행동 규칙).',
  },
  {
    groupId: 'share',
    title: '공유',
    body: '협업과 이력 — Comments, 변경 히스토리, 스냅샷 비교, 인터페이스 디자이너.',
  },
];

export default function BottomDock({ panels, isModalOpen }: BottomDockProps) {
  const t = useTranslations();
  const sidebarWidth = useToolLayoutStore((s) => s.sidebarWidth);
  const [mounted, setMounted] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [hintStep, setHintStep] = useState(0);
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

  const nextHintStep = () => {
    if (hintStep < DOCK_HINT_STEPS.length - 1) setHintStep(hintStep + 1);
    else dismissHint();
  };

  const currentHintGroupId = showHint ? DOCK_HINT_STEPS[hintStep].groupId : null;

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
      {/* 첫 사용자 hint — 도크 위 floating card + 단계별 그룹 pulse 강조 */}
      {showHint && !isModalOpen && (() => {
        const cur = DOCK_HINT_STEPS[hintStep];
        const StepIcon = cur.groupId ? GROUP_ICONS[cur.groupId] : Hammer;
        const stepGroup = cur.groupId ? TOOL_GROUPS.find((g) => g.id === cur.groupId) : null;
        const accentColor = stepGroup?.color ?? 'var(--accent)';
        const isLast = hintStep === DOCK_HINT_STEPS.length - 1;
        return (
          <div
            className="absolute bottom-full mb-3 max-w-[calc(100vw-2rem)] w-[440px] rounded-xl shadow-2xl pointer-events-auto animate-slideUp overflow-hidden"
            style={{
              background: 'var(--bg-primary)',
              border: `1.5px solid ${accentColor}`,
            }}
            role="dialog"
            aria-label="하단 도구바 안내"
          >
            <div className="flex items-start gap-3 p-4">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${accentColor}1a`, color: accentColor }}
              >
                <StepIcon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {cur.title}
                  </div>
                  <span
                    className="text-caption px-1.5 py-0.5 rounded"
                    style={{ background: `${accentColor}15`, color: accentColor }}
                  >
                    {hintStep + 1} / {DOCK_HINT_STEPS.length}
                  </span>
                </div>
                <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {cur.body}
                </p>
              </div>
              <button
                type="button"
                onClick={dismissHint}
                className="p-1 -mt-1 -mr-1 rounded hover:bg-[var(--bg-hover)] transition-colors shrink-0"
                aria-label="안내 닫기"
              >
                <X className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
              </button>
            </div>
            {/* Footer — 점 indicator + 이전/다음. 카드 본체와 동일 배경으로 모서리 끊김 방지 */}
            <div className="flex items-center justify-between gap-2 px-4 pb-3">
              <button
                type="button"
                onClick={() => hintStep > 0 && setHintStep(hintStep - 1)}
                disabled={hintStep === 0}
                className="text-caption px-2 py-1 rounded transition-colors disabled:opacity-30 hover:bg-[var(--bg-hover)]"
                style={{ color: 'var(--text-secondary)' }}
              >
                이전
              </button>
              {/* 단계 점 indicator — 7 dots */}
              <div className="flex items-center gap-1.5">
                {DOCK_HINT_STEPS.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setHintStep(i)}
                    className="rounded-full transition-all"
                    style={{
                      width: i === hintStep ? 14 : 6,
                      height: 6,
                      background: i <= hintStep ? accentColor : 'var(--border-primary)',
                    }}
                    aria-label={`${i + 1} 단계로`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={nextHintStep}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
                style={{ background: accentColor, color: 'white' }}
              >
                {isLast ? (
                  <>
                    <Check className="w-3 h-3" /> 완료
                  </>
                ) : (
                  <>
                    다음 <ChevronRight className="w-3 h-3" />
                  </>
                )}
              </button>
            </div>
            {/* 아래쪽 꼬리 — 도크 가리키는 삼각형. border 와 배경 매끄럽게 */}
            <div
              className="absolute left-1/2 -translate-x-1/2 -bottom-[7px] w-3 h-3 rotate-45"
              style={{
                background: 'var(--bg-primary)',
                borderRight: `1.5px solid ${accentColor}`,
                borderBottom: `1.5px solid ${accentColor}`,
              }}
              aria-hidden
            />
          </div>
        );
      })()}

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
          const isHinted = currentHintGroupId === group.id;
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
                  transform: `scale(${isHinted ? Math.max(scale, 1.2) : scale}) translateY(${isHovered || isHinted ? -8 : 0}px)`,
                  zIndex: isHovered || isHinted ? 100 : 1,
                  transition:
                    'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.15s ease, box-shadow 0.2s ease',
                  boxShadow: isHinted ? `0 0 0 3px ${group.color}, 0 0 16px ${group.color}80` : undefined,
                  borderRadius: isHinted ? 12 : undefined,
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
