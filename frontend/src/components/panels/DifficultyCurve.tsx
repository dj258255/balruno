'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Settings, BarChart3, Wrench, ChevronDown, TrendingUp } from 'lucide-react';
import PanelShell, { HelpToggle } from '@/components/ui/PanelShell';

// number input spinner 숨기는 스타일
const hideSpinnerStyle = `
  .hide-spinner::-webkit-outer-spin-button,
  .hide-spinner::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .hide-spinner[type=number] {
    -moz-appearance: textfield;
  }
`;

// 훅과 컴포넌트 임포트
import { useDifficultyCurve } from './difficulty-curve/hooks';
import {
  DifficultyChart,
  FullscreenChart,
  PresetSelector,
  PlaytimeSelector,
  MaxStageSelector,
  WallStageEditor,
  MilestoneEditor,
  CurveTypeSelector,
  FlowZoneEditor,
  RestPointEditor,
  DDAEditor,
  HelpPanel,
} from './difficulty-curve/components';

const PANEL_COLOR = '#a855f7';

// 섹션 구분선 컴포넌트 — 접이식(선택) + 한 줄 설명(선택)
function SectionDivider({
  icon: Icon,
  title,
  color,
  description,
  collapsible = false,
  collapsed = false,
  onToggle,
}: {
  icon: React.ElementType;
  title: string;
  color: string;
  description?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const content = (
    <>
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${color}15` }}
      >
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {title}
          </span>
          {collapsible && (
            <ChevronDown
              className={`w-3 h-3 transition-transform ${collapsed ? '-rotate-90' : ''}`}
              style={{ color: 'var(--text-tertiary)' }}
            />
          )}
        </div>
        {description && (
          <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--text-tertiary)' }}>
            {description}
          </p>
        )}
      </div>
      <div className="flex-1 h-px" style={{ background: 'var(--border-primary)' }} />
    </>
  );
  if (collapsible) {
    return (
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 pt-2 pb-1 text-left hover:opacity-80 transition-opacity"
        aria-expanded={!collapsed}
      >
        {content}
      </button>
    );
  }
  return <div className="flex items-center gap-3 pt-2 pb-1">{content}</div>;
}

interface DifficultyCurveProps {
  onClose?: () => void;
}

export default function DifficultyCurve({ onClose }: DifficultyCurveProps) {
  const t = useTranslations('difficultyCurve');
  const [showHelp, setShowHelp] = useState(false);
  // 고급 설정 섹션들 접기 상태 — 시각화 / 벽·마일스톤·휴식 기본 열림, DDA 만 기본 접힘
  const [collapsedAdvanced, setCollapsedAdvanced] = useState(true);

  const state = useDifficultyCurve();

  const {
    preset,
    setPreset,
    playtime,
    setPlaytime,
    maxStage,
    setMaxStage,
    wallStages,
    milestones,
    showFullscreen,
    setShowFullscreen,
    zoomLevel,
    panOffset,
    isPanning,
    hoveredStage,
    setHoveredStage,
    curveData,
    estimatedDays,
    hoveredData,
    // 곡선 타입
    curveType,
    setCurveType,
    sawtoothPeriod,
    setSawtoothPeriod,
    // 플로우 존
    flowZoneConfig,
    setFlowZoneConfig,
    showFlowZones,
    setShowFlowZones,
    flowZoneStats,
    // 휴식 포인트
    restPoints,
    addRestPoint,
    removeRestPoint,
    updateRestPoint,
    // DDA
    ddaConfig,
    setDDAConfig,
    ddaSimulation,
    simulateWinStreak,
    simulateLossStreak,
    resetDDASimulation,
    // 벽 스테이지 데이터
    wallData,
    // 액션
    handleZoomIn,
    handleZoomOut,
    handleResetView,
    handlePanStart,
    handlePanMove,
    handlePanEnd,
    handleWheel,
    addWallStage,
    removeWallStage,
    updateWallStage,
    changeWallType,
    generateRecommendedWalls,
    updateMilestone,
    updateMilestonePowerBonus,
  } = state;

  return (
    <PanelShell
      title="난이도 곡선"
      subtitle="스테이지별 벽·마일스톤·플로우 설계"
      icon={TrendingUp}
      iconColor={PANEL_COLOR}
      onClose={onClose ?? (() => {})}
      bodyClassName="p-4 space-y-4 overflow-x-hidden scrollbar-slim"
      actions={
        <HelpToggle active={showHelp} onToggle={() => setShowHelp((v) => !v)} color={PANEL_COLOR} />
      }
    >
      <style>{hideSpinnerStyle}</style>

      {/* 도움말 섹션 */}
      {showHelp && <HelpPanel />}

      {/* ===== 섹션 1: 기본 설정 ===== */}
      <SectionDivider
        icon={Settings}
        title={t('sectionBasic')}
        color="#9179f2"
        description="프리셋·곡선 타입·전체 스테이지 수를 먼저 정합니다"
      />

      <div className="space-y-4">
        <PresetSelector preset={preset} setPreset={setPreset} />

        <CurveTypeSelector
          curveType={curveType}
          setCurveType={setCurveType}
          sawtoothPeriod={sawtoothPeriod}
          setSawtoothPeriod={setSawtoothPeriod}
        />

        <PlaytimeSelector
          playtime={playtime}
          setPlaytime={setPlaytime}
          onGenerateRecommended={generateRecommendedWalls}
          wallStages={wallStages}
          estimatedDays={estimatedDays}
          maxStage={maxStage}
        />

        <MaxStageSelector maxStage={maxStage} setMaxStage={setMaxStage} />
      </div>

      {/* ===== 섹션 2: 시각화 ===== */}
      <SectionDivider
        icon={BarChart3}
        title={t('sectionVisualization')}
        color="#5a9cf5"
        description="차트 미리보기 + 플로우·DDA 오버레이"
      />

      {/* 난이도 곡선 시각화 (항상 보임 — 메인 출력물) */}
      <DifficultyChart
        curveData={curveData}
        wallStages={wallStages}
        maxStage={maxStage}
        hoveredStage={hoveredStage}
        setHoveredStage={setHoveredStage}
        hoveredData={hoveredData}
        onShowFullscreen={() => setShowFullscreen(true)}
        showFlowZones={showFlowZones}
        restPoints={restPoints}
      />

      {/* 고급 설정 — 기본 접힘 (플로우 존 + DDA) */}
      <SectionDivider
        icon={BarChart3}
        title="고급 분석"
        color="#06b6d4"
        description="플로우 존(Csikszentmihalyi) · DDA 동적 난이도"
        collapsible
        collapsed={collapsedAdvanced}
        onToggle={() => setCollapsedAdvanced((v) => !v)}
      />
      {!collapsedAdvanced && (
        <div className="space-y-4">
          <FlowZoneEditor
            flowZoneConfig={flowZoneConfig}
            setFlowZoneConfig={setFlowZoneConfig}
            showFlowZones={showFlowZones}
            setShowFlowZones={setShowFlowZones}
            flowZoneStats={flowZoneStats}
          />
          <DDAEditor
            ddaConfig={ddaConfig}
            setDDAConfig={setDDAConfig}
            ddaSimulation={ddaSimulation}
            onSimulateWin={simulateWinStreak}
            onSimulateLoss={simulateLossStreak}
            onResetSimulation={resetDDASimulation}
          />
        </div>
      )}

      {/* 전체화면 모달 */}
      {showFullscreen && (
        <FullscreenChart
          curveData={curveData}
          wallStages={wallStages}
          milestones={milestones}
          maxStage={maxStage}
          zoomLevel={zoomLevel}
          panOffset={panOffset}
          isPanning={isPanning}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetView={handleResetView}
          onPanStart={handlePanStart}
          onPanMove={handlePanMove}
          onPanEnd={handlePanEnd}
          onWheel={handleWheel}
          onClose={() => setShowFullscreen(false)}
          showFlowZones={showFlowZones}
          restPoints={restPoints}
          flowZoneStats={flowZoneStats}
        />
      )}

      {/* ===== 섹션 3: 스테이지 설계 ===== */}
      <SectionDivider
        icon={Wrench}
        title={t('sectionStageDesign')}
        color="#3db88a"
        description="벽 스테이지 · 마일스톤 · 휴식 포인트 배치"
      />

      <div className="space-y-4">
        <WallStageEditor
          wallStages={wallStages}
          wallData={wallData}
          maxStage={maxStage}
          onAdd={addWallStage}
          onRemove={removeWallStage}
          onUpdate={updateWallStage}
          onChangeType={changeWallType}
        />

        <MilestoneEditor
          milestones={milestones}
          onUpdate={updateMilestone}
          onUpdateBonus={updateMilestonePowerBonus}
        />

        <RestPointEditor
          restPoints={restPoints}
          maxStage={maxStage}
          onAdd={addRestPoint}
          onRemove={removeRestPoint}
          onUpdate={updateRestPoint}
        />
      </div>
    </PanelShell>
  );
}
