'use client';

/**
 * 우측 도킹 도구 박스 — 6 그룹 중 활성 그룹 하나의 탭 + 컨텐츠 렌더.
 *
 * UX:
 *  - 한 번에 하나의 그룹만 표시 (BottomDock 의 활성 그룹과 동기)
 *  - 그룹 내부 여러 도구가 열리면 탭 전환, 탭 X 로 개별 닫기
 *  - 그룹 헤더 X 로 그룹 전체 닫기 (해당 그룹 내 모든 도구 close)
 *
 * 패널 상태 (`show*`) 는 상위에서 주입된 panels prop 의 read/write 만 담당.
 */

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { X, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { TOOL_GROUPS, TOOL_DESCRIPTIONS, type ToolGroupId, type ToolId } from '@/config/toolGroups';

const WIDTH_KEY = 'balruno:docked-toolbox-width';
const MIN_W = 280;
const MAX_W = 800;
const DEFAULT_W = 420;

const Calculator = dynamic(() => import('@/components/panels/Calculator'), { ssr: false });
const ComparisonChart = dynamic(() => import('@/components/panels/ComparisonChart'), { ssr: false });
const GrowthCurveChart = dynamic(() => import('@/components/panels/GrowthCurveChart'), { ssr: false });
const BalanceAnalysisPanel = dynamic(() => import('@/components/panels/BalanceAnalysisPanel'), { ssr: false });
const ImbalanceDetectorPanel = dynamic(() => import('@/components/panels/ImbalanceDetectorPanel'), { ssr: false });
const GoalSolverPanel = dynamic(() => import('@/components/panels/GoalSolverPanel'), { ssr: false });
const FormulaHelper = dynamic(() => import('@/components/panels/FormulaHelper'), { ssr: false });
const BalanceValidator = dynamic(() => import('@/components/panels/BalanceValidator'), { ssr: false });
const DifficultyCurve = dynamic(() => import('@/components/panels/DifficultyCurve'), { ssr: false });
const SimulationPanel = dynamic(() => import('@/components/panels/SimulationPanel'), { ssr: false });
const FPSSimulationPanel = dynamic(() => import('@/components/panels/FPSSimulationPanel'), { ssr: false });
const FPSTeamSimulationPanel = dynamic(() => import('@/components/panels/FPSTeamSimulationPanel'), { ssr: false });
const DeckSimulationPanel = dynamic(() => import('@/components/panels/DeckSimulationPanel'), { ssr: false });
const FrameDataPanel = dynamic(() => import('@/components/panels/FrameDataPanel'), { ssr: false });
const AIBehaviorPanel = dynamic(() => import('@/components/panels/AIBehaviorPanel'), { ssr: false });
const EconomyPanel = dynamic(() => import('@/components/panels/EconomyPanel'), { ssr: false });
const DPSVariancePanel = dynamic(() => import('@/components/panels/DPSVariancePanel'), { ssr: false });
const CurveFittingPanel = dynamic(() => import('@/components/panels/CurveFittingPanel'), { ssr: false });
const EntityDefinition = dynamic(() => import('@/components/panels/EntityDefinition'), { ssr: false });
const AutoBalancerPanel = dynamic(() => import('@/components/panels/AutoBalancerPanel'), { ssr: false });
const LootSimulatorPanel = dynamic(() => import('@/components/panels/LootSimulatorPanel'), { ssr: false });
const PowerCurveComparePanel = dynamic(() => import('@/components/panels/PowerCurveComparePanel'), { ssr: false });
const CommentsPanel = dynamic(() => import('@/components/panels/CommentsPanel'), { ssr: false });
const InterfaceDesignerPanel = dynamic(() => import('@/components/panels/InterfaceDesignerPanel'), { ssr: false });
const AutomationsPanel = dynamic(() => import('@/components/panels/AutomationsPanel'), { ssr: false });
const SensitivityAnalysisPanel = dynamic(() => import('@/components/panels/SensitivityAnalysisPanel'), { ssr: false });
const ChangeHistoryPanel = dynamic(() => import('@/components/panels/ChangeHistoryPanel'), { ssr: false });
const PresetComparisonModal = dynamic(() => import('@/components/modals/PresetComparisonModal'), { ssr: false });

interface PanelState {
  show: boolean;
  setShow: (value: boolean) => void;
}

export interface DockedToolboxProps {
  panels: Record<ToolId, PanelState>;
}

const TOOL_LABEL_KEYS: Record<ToolId, string> = {
  calculator: 'sidebar.calculator',
  comparison: 'sidebar.comparison',
  chart: 'sidebar.chart',
  preset: 'sidebar.presetComparison',
  imbalance: 'sidebar.imbalanceDetector',
  goal: 'sidebar.goalSolver',
  balance: 'sidebar.balanceAnalysis',
  economy: 'sidebar.economy',
  dpsVariance: 'sidebar.dpsVariance',
  curveFitting: 'sidebar.curveFitting',
  formulaHelper: 'bottomTabs.formulaHelper',
  balanceValidator: 'bottomTabs.balanceValidator',
  difficultyCurve: 'bottomTabs.difficultyCurve',
  simulation: 'bottomTabs.simulation',
  entityDefinition: 'bottomTabs.entityDefinition',
  autoBalancer: 'sidebar.autoBalancer',
  lootSimulator: 'sidebar.lootSimulator',
  powerCurveCompare: 'sidebar.powerCurveCompare',
  comments: 'sidebar.comments',
  interfaceDesigner: 'sidebar.interfaceDesigner',
  automations: 'sidebar.automations',
  sensitivity: 'sidebar.sensitivity',
  changeHistory: 'sidebar.changeHistory',
  fpsSimulation: 'sidebar.fpsSimulation',
  fpsTeamSimulation: 'sidebar.fpsTeamSimulation',
  deckSimulation: 'sidebar.deckSimulation',
  frameData: 'sidebar.frameData',
  aiBehavior: 'sidebar.aiBehavior',
};

function renderToolContent(toolId: ToolId, panels: Record<ToolId, PanelState>) {
  const close = () => panels[toolId].setShow(false);
  switch (toolId) {
    case 'calculator':
      return <Calculator onClose={close} isPanel />;
    case 'comparison':
      return <ComparisonChart onClose={close} isPanel />;
    case 'chart':
      return <GrowthCurveChart onClose={close} />;
    case 'preset':
      return <PresetComparisonModal onClose={close} isPanel />;
    case 'imbalance':
      return <ImbalanceDetectorPanel onClose={close} />;
    case 'goal':
      return <GoalSolverPanel onClose={close} />;
    case 'balance':
      return <BalanceAnalysisPanel onClose={close} />;
    case 'economy':
      return <EconomyPanel onClose={close} />;
    case 'dpsVariance':
      return <DPSVariancePanel onClose={close} isPanel />;
    case 'curveFitting':
      return <CurveFittingPanel onClose={close} />;
    case 'formulaHelper':
      return <FormulaHelper onClose={close} />;
    case 'balanceValidator':
      return <BalanceValidator onClose={close} />;
    case 'difficultyCurve':
      return <DifficultyCurve onClose={close} />;
    case 'simulation':
      return <SimulationPanel onClose={close} />;
    case 'fpsSimulation':
      return <FPSSimulationPanel onClose={close} />;
    case 'fpsTeamSimulation':
      return <FPSTeamSimulationPanel onClose={close} />;
    case 'deckSimulation':
      return <DeckSimulationPanel onClose={close} />;
    case 'frameData':
      return <FrameDataPanel onClose={close} />;
    case 'aiBehavior':
      return <AIBehaviorPanel onClose={close} />;
    case 'entityDefinition':
      return <EntityDefinition onClose={close} />;
    case 'autoBalancer':
      return <AutoBalancerPanel onClose={close} />;
    case 'lootSimulator':
      return <LootSimulatorPanel onClose={close} />;
    case 'powerCurveCompare':
      return <PowerCurveComparePanel onClose={close} />;
    case 'comments':
      return <CommentsPanel onClose={close} />;
    case 'interfaceDesigner':
      return <InterfaceDesignerPanel onClose={close} />;
    case 'automations':
      return <AutomationsPanel onClose={close} />;
    case 'sensitivity':
      return <SensitivityAnalysisPanel onClose={close} isPanel />;
    case 'changeHistory':
      return <ChangeHistoryPanel onClose={close} />;
  }
}

export default function DockedToolbox({ panels }: DockedToolboxProps) {
  const t = useTranslations();

  // 활성 그룹 = 해당 그룹 도구 중 최소 1개 이상 show=true
  const activeGroup = TOOL_GROUPS.find((g) =>
    g.tools.some((tid) => panels[tid].show)
  );

  // 크기 조절 (좌측 가장자리 드래그). localStorage 로 유지.
  const [width, setWidth] = useState(DEFAULT_W);
  const resizeRef = useRef<{ startX: number; startW: number } | null>(null);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(WIDTH_KEY) : null;
    if (stored) {
      const n = parseInt(stored, 10);
      if (!isNaN(n) && n >= MIN_W && n <= MAX_W) setWidth(n);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem(WIDTH_KEY, String(width));
  }, [width]);

  const handleResizeStart = (e: React.PointerEvent) => {
    e.preventDefault();
    resizeRef.current = { startX: e.clientX, startW: width };
    const onMove = (ev: PointerEvent) => {
      if (!resizeRef.current) return;
      // 우측 패널이라 왼쪽으로 드래그 = 너비 확장
      const dx = resizeRef.current.startX - ev.clientX;
      const next = Math.max(MIN_W, Math.min(MAX_W, resizeRef.current.startW + dx));
      setWidth(next);
    };
    const onUp = () => {
      resizeRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  // 현재 보이는 탭 — 그룹 내에서 show=true 인 도구 중 가장 먼저 나오는 것
  const [activeTab, setActiveTab] = useState<ToolId | null>(null);

  // 그룹이 바뀌거나 활성 탭 도구가 닫혔을 때 activeTab 재조정
  useEffect(() => {
    if (!activeGroup) {
      setActiveTab(null);
      return;
    }
    const shown = activeGroup.tools.filter((tid) => panels[tid].show);
    if (shown.length === 0) {
      setActiveTab(null);
      return;
    }
    if (!activeTab || !shown.includes(activeTab)) {
      setActiveTab(shown[0]);
    }
  }, [activeGroup, panels, activeTab]);

  if (!activeGroup || !activeTab) return null;

  const closeGroup = () => {
    activeGroup.tools.forEach((tid) => {
      if (panels[tid].show) panels[tid].setShow(false);
    });
  };

  return (
    <aside
      role="complementary"
      aria-label={t(activeGroup.titleKey as 'toolGroups.build')}
      className="flex-shrink-0 border-l flex flex-col overflow-hidden relative fixed md:relative inset-x-0 bottom-[88px] md:bottom-auto top-auto md:inset-auto z-40 md:z-auto md:!w-[var(--dock-w)] w-full max-h-[65vh] md:max-h-none md:pb-[110px]"
      style={{
        ['--dock-w' as string]: `${width}px`,
        background: 'var(--bg-primary)',
        borderColor: 'var(--border-primary)',
      }}
    >
      {/* 좌측 가장자리 resize handle */}
      <div
        onPointerDown={handleResizeStart}
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[var(--accent)] transition-colors z-10"
        style={{ touchAction: 'none' }}
        role="separator"
        aria-label="Resize toolbox"
      />
      {/* 그룹 색 인디케이터 — 상단 2px 바 (아이덴티티, 말로 반복 안 해도 됨) */}
      <div
        aria-hidden
        className="h-[2px] flex-shrink-0"
        style={{ background: activeGroup.color }}
      />

      {/* 헤더 — 한 줄: 그룹 라벨(메타) + 도구 선택(주) + 닫기 */}
      <header
        className="flex items-center gap-2 px-3 py-2 border-b"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <span
          className="text-overline flex-shrink-0"
          style={{ color: activeGroup.color, letterSpacing: '0.08em' }}
        >
          {t(activeGroup.titleKey as 'toolGroups.build')}
        </span>

        {activeGroup.tools.length > 1 ? (
          <ToolDropdown
            tools={activeGroup.tools}
            current={activeTab}
            color={activeGroup.color}
            onChange={(nextId) => {
              activeGroup.tools.forEach((tid) => {
                if (tid !== nextId && panels[tid].show) panels[tid].setShow(false);
              });
              if (!panels[nextId].show) panels[nextId].setShow(true);
              setActiveTab(nextId);
            }}
          />
        ) : (
          <span
            className="flex-1 text-sm font-semibold truncate"
            style={{ color: 'var(--text-primary)' }}
          >
            {t(TOOL_LABEL_KEYS[activeTab] as 'sidebar.calculator')}
          </span>
        )}

        <button
          onClick={closeGroup}
          className="p-1 rounded hover:bg-[var(--bg-hover)] transition-colors flex-shrink-0"
          aria-label={t('common.close')}
          style={{ color: 'var(--text-tertiary)' }}
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      {/* 탭 컨텐츠 */}
      <div className="flex-1 overflow-auto">
        {renderToolContent(activeTab, panels)}
      </div>
    </aside>
  );
}

/**
 * 인라인 도구 드롭다운 — Calculator 의 수식 선택 스타일 재사용.
 * glass-card 트리거(좌측 그룹색 accent) + glass-panel 드롭다운 + 외부 클릭 backdrop.
 */
function ToolDropdown({
  tools, current, color, onChange,
}: {
  tools: ToolId[];
  current: ToolId;
  color: string;
  onChange: (next: ToolId) => void;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const currentLabel = t(TOOL_LABEL_KEYS[current] as 'sidebar.calculator');

  return (
    <div className="relative flex-1 min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="glass-card w-full flex items-center gap-2 px-3 py-2 transition-all hover:shadow-md text-left"
        style={{ borderLeft: `3px solid ${color}` }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span
          className="text-sm font-bold flex-1 truncate"
          style={{ color: 'var(--text-primary)' }}
        >
          {currentLabel}
        </span>
        <ChevronDown
          className={`w-4 h-4 transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`}
          style={{ color: 'var(--text-secondary)' }}
        />
      </button>

      {open && (
        <>
          {/* 외부 클릭 시 닫기 backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            role="listbox"
            className="absolute left-0 right-0 top-full mt-1 glass-panel z-50 overflow-hidden p-1"
          >
            {tools.map((tid) => {
              const label = t(TOOL_LABEL_KEYS[tid] as 'sidebar.calculator');
              const description = t(TOOL_DESCRIPTIONS[tid] as 'toolDesc.calculator');
              const isActive = tid === current;
              return (
                <button
                  key={tid}
                  type="button"
                  onClick={() => {
                    onChange(tid);
                    setOpen(false);
                  }}
                  role="option"
                  aria-selected={isActive}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                    isActive ? '' : 'hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                  style={{ background: isActive ? `${color}15` : undefined }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                    style={{ background: color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm font-semibold truncate"
                      style={{ color: isActive ? color : 'var(--text-primary)' }}
                    >
                      {label}
                    </div>
                    <div
                      className="text-caption truncate mt-0.5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
