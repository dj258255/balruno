'use client';

/**
 * Track 6 — 우측 도킹 도구 박스.
 *
 * 기존 플로팅 ToolPanels 의 역할 승계. 17개 도구 중 활성인 것 중 가장 먼저 등장한
 * 그룹 하나를 선택 → 해당 그룹의 내부 탭 헤더 + 선택 탭 컨텐츠 렌더.
 *
 * UX:
 *  - 한 번에 하나의 그룹만 표시
 *  - 그룹 내부는 탭 전환 (탭을 누르면 해당 도구의 show=true)
 *  - 탭의 X 버튼으로 각 탭 닫기 (해당 도구 show=false). 모두 닫히면 그룹 사라짐
 *  - 그룹 헤더의 X 로 그룹 전체 닫기
 *
 * 기존 플로팅 상태 (`show*`) 는 그대로 유지 — 이 컴포넌트는 그 state 의 read/write 만.
 */

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { TOOL_GROUPS, type ToolGroupId, type ToolId } from '@/config/toolGroups';

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
const EconomyPanel = dynamic(() => import('@/components/panels/EconomyPanel'), { ssr: false });
const DPSVariancePanel = dynamic(() => import('@/components/panels/DPSVariancePanel'), { ssr: false });
const CurveFittingPanel = dynamic(() => import('@/components/panels/CurveFittingPanel'), { ssr: false });
const EntityDefinition = dynamic(() => import('@/components/panels/EntityDefinition'), { ssr: false });
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
    case 'entityDefinition':
      return <EntityDefinition onClose={close} />;
  }
}

export default function DockedToolbox({ panels }: DockedToolboxProps) {
  const t = useTranslations();

  // 활성 그룹 = 해당 그룹 도구 중 최소 1개 이상 show=true
  const activeGroup = TOOL_GROUPS.find((g) =>
    g.tools.some((tid) => panels[tid].show)
  );

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

  const shownTabs = activeGroup.tools.filter((tid) => panels[tid].show);

  const closeGroup = () => {
    activeGroup.tools.forEach((tid) => {
      if (panels[tid].show) panels[tid].setShow(false);
    });
  };

  return (
    <aside
      className="w-[420px] flex-shrink-0 border-l hidden md:flex flex-col overflow-hidden"
      style={{
        background: 'var(--bg-primary)',
        borderColor: 'var(--border-primary)',
      }}
    >
      {/* 헤더: 그룹 타이틀 + 그룹 닫기 */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: activeGroup.color }}
          />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {t(activeGroup.titleKey as 'toolGroups.formulaWorkbench')}
          </h3>
        </div>
        <button
          onClick={closeGroup}
          className="p-1 rounded hover:bg-[var(--bg-hover)] transition-colors"
          aria-label={t('common.close')}
          style={{ color: 'var(--text-tertiary)' }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 탭 바 — 그룹 내부 여러 도구가 활성일 때만 */}
      {shownTabs.length > 1 && (
        <div
          className="flex gap-0.5 px-2 py-1 border-b overflow-x-auto"
          style={{
            borderColor: 'var(--border-primary)',
            background: 'var(--bg-secondary)',
          }}
        >
          {shownTabs.map((tid) => (
            <button
              key={tid}
              onClick={() => setActiveTab(tid)}
              className="px-3 py-1.5 text-xs rounded transition-colors flex items-center gap-1.5 shrink-0"
              style={{
                background: activeTab === tid ? 'var(--bg-primary)' : 'transparent',
                color: activeTab === tid ? activeGroup.color : 'var(--text-secondary)',
                fontWeight: activeTab === tid ? 600 : 400,
              }}
            >
              {t(TOOL_LABEL_KEYS[tid] as 'sidebar.calculator')}
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  panels[tid].setShow(false);
                }}
                className="p-0.5 rounded hover:bg-[var(--bg-hover)]"
                aria-label={t('common.close')}
              >
                <X className="w-3 h-3" />
              </span>
            </button>
          ))}
        </div>
      )}

      {/* 단일 탭일 때 — 도구 이름을 서브헤더로 */}
      {shownTabs.length === 1 && (
        <div
          className="px-4 py-1.5 border-b text-xs"
          style={{
            borderColor: 'var(--border-primary)',
            background: 'var(--bg-secondary)',
            color: 'var(--text-tertiary)',
          }}
        >
          {t(TOOL_LABEL_KEYS[activeTab] as 'sidebar.calculator')}
        </div>
      )}

      {/* 탭 컨텐츠 */}
      <div className="flex-1 overflow-auto">
        {renderToolContent(activeTab, panels)}
      </div>
    </aside>
  );
}
