'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Settings, BarChart3, Wrench, ChevronDown, TrendingUp, Zap, Sliders, Users, PlayCircle, AlertTriangle } from 'lucide-react';
import PanelShell, { HelpToggle } from '@/components/ui/PanelShell';
import { simulateDifficultyCurve } from '@/lib/difficultySimulator';

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
          <p className="text-caption mt-0.5 truncate" style={{ color: 'var(--text-tertiary)' }}>
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
  // Simple/Advanced 모드 — 사용자 진입 장벽 낮춤. 기본 Simple.
  // Simple: 프리셋 + 플레이타임 + 차트 (차트 클릭으로 벽 직접 조작)
  //         + "자세히 ▸" 인라인 확장으로 곡선타입/최대스테이지 점진 노출
  // Advanced: 기존 전체 UI (플로우존/DDA/벽편집기/마일스톤/휴식포인트)
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple');
  // Simple 모드 내 sub-disclosure
  const [simpleExpandCurve, setSimpleExpandCurve] = useState(false);
  const [simpleExpandStage, setSimpleExpandStage] = useState(false);

  // Playtest (가상 플레이어 시뮬) — Simple/Advanced 모두 노출
  const [playtestRunning, setPlaytestRunning] = useState(false);
  const [playtestPlayers, setPlaytestPlayers] = useState(200);
  const [playtestResult, setPlaytestResult] = useState<ReturnType<typeof simulateDifficultyCurve> | null>(null);

  const runPlaytest = () => {
    setPlaytestRunning(true);
    // 다음 tick 에서 실행 (UI 반응성)
    setTimeout(() => {
      const r = simulateDifficultyCurve({
        segments: curveData,
        wallStages,
        restPoints,
        virtualPlayers: playtestPlayers,
        giveUpStreak: 3,
        attemptsPerStage: 1.8,
        secPerAttempt: 45,
      });
      setPlaytestResult(r);
      setPlaytestRunning(false);
    }, 50);
  };

  const dropoutColor = useMemo(() => {
    if (!playtestResult) return '#6b7280';
    const r = playtestResult.dropoutRate;
    if (r < 0.2) return '#10b981';
    if (r < 0.5) return '#f59e0b';
    return '#ef4444';
  }, [playtestResult]);
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

      {/* Simple / Advanced 모드 토글 — 진입 장벽 낮춤 */}
      <div
        className="flex items-center gap-1 p-1 rounded-lg"
        style={{ background: 'var(--bg-tertiary)' }}
      >
        <button
          onClick={() => setMode('simple')}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium transition-colors"
          style={{
            background: mode === 'simple' ? PANEL_COLOR : 'transparent',
            color: mode === 'simple' ? 'white' : 'var(--text-secondary)',
          }}
        >
          <Zap className="w-3.5 h-3.5" />
          간단 모드
        </button>
        <button
          onClick={() => setMode('advanced')}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium transition-colors"
          style={{
            background: mode === 'advanced' ? PANEL_COLOR : 'transparent',
            color: mode === 'advanced' ? 'white' : 'var(--text-secondary)',
          }}
        >
          <Sliders className="w-3.5 h-3.5" />
          고급 모드
        </button>
      </div>

      {/* Simple 모드 안내 */}
      {mode === 'simple' && (
        <div
          className="p-3 rounded-lg text-caption leading-relaxed"
          style={{ background: `${PANEL_COLOR}10`, borderLeft: `3px solid ${PANEL_COLOR}`, color: 'var(--text-secondary)' }}
        >
          <strong style={{ color: PANEL_COLOR }}>게임 장르 프리셋</strong>을 선택하고{' '}
          <strong>플레이타임</strong>을 설정하면, 업계 기준 난이도 곡선과 벽 스테이지가 자동 생성됩니다.
          세밀 조정이 필요하면 <strong>고급 모드</strong>로 전환하세요.
        </div>
      )}

      {/* ===== 섹션 1: 기본 설정 ===== */}
      <SectionDivider
        icon={Settings}
        title={t('sectionBasic')}
        color="#9179f2"
      />

      <div className="space-y-4">
        <PresetSelector preset={preset} setPreset={setPreset} />

        {/* Simple 모드: 인라인 "자세히 ▸" 로 점진 노출 (진짜 숨기는 게 아님) */}
        {mode === 'simple' && (
          <div className="space-y-2">
            <button
              onClick={() => setSimpleExpandCurve((v) => !v)}
              className="inline-flex items-center gap-1 text-caption font-medium"
              style={{ color: PANEL_COLOR }}
            >
              <ChevronDown className={`w-3 h-3 transition-transform ${simpleExpandCurve ? 'rotate-0' : '-rotate-90'}`} />
              곡선 타입 자세히
            </button>
            {simpleExpandCurve && (
              <CurveTypeSelector
                curveType={curveType}
                setCurveType={setCurveType}
                sawtoothPeriod={sawtoothPeriod}
                setSawtoothPeriod={setSawtoothPeriod}
              />
            )}
          </div>
        )}

        {mode === 'advanced' && (
          <CurveTypeSelector
            curveType={curveType}
            setCurveType={setCurveType}
            sawtoothPeriod={sawtoothPeriod}
            setSawtoothPeriod={setSawtoothPeriod}
          />
        )}

        <PlaytimeSelector
          playtime={playtime}
          setPlaytime={setPlaytime}
          onGenerateRecommended={generateRecommendedWalls}
          wallStages={wallStages}
          estimatedDays={estimatedDays}
          maxStage={maxStage}
        />

        {mode === 'simple' && (
          <div className="space-y-2">
            <button
              onClick={() => setSimpleExpandStage((v) => !v)}
              className="inline-flex items-center gap-1 text-caption font-medium"
              style={{ color: PANEL_COLOR }}
            >
              <ChevronDown className={`w-3 h-3 transition-transform ${simpleExpandStage ? 'rotate-0' : '-rotate-90'}`} />
              스테이지 수 직접 지정
            </button>
            {simpleExpandStage && <MaxStageSelector maxStage={maxStage} setMaxStage={setMaxStage} />}
          </div>
        )}

        {mode === 'advanced' && (
          <MaxStageSelector maxStage={maxStage} setMaxStage={setMaxStage} />
        )}
      </div>

      {/* ===== 섹션 2: 시각화 ===== */}
      <SectionDivider
        icon={BarChart3}
        title={t('sectionVisualization')}
        color="#5a9cf5"
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
        onToggleWall={(stage) => {
          // 같은 stage 에 있으면 제거, 없으면 추가 (토글)
          if (wallStages.includes(stage)) {
            removeWallStage(stage);
          } else {
            addWallStage(stage);
          }
        }}
      />

      {/* Playtest (가상 플레이어 시뮬) — King Candy Crush 봇 시뮬 방식 경량화 */}
      <div
        className="p-3 rounded-lg space-y-2"
        style={{ background: 'var(--bg-tertiary)', borderLeft: '3px solid #06b6d4' }}
      >
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4" style={{ color: '#06b6d4' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Playtest — 가상 플레이어 시뮬
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-caption" style={{ color: 'var(--text-tertiary)' }}>N</span>
            <input
              type="number"
              min={50}
              max={5000}
              step={50}
              value={playtestPlayers}
              onChange={(e) => setPlaytestPlayers(parseInt(e.target.value) || 50)}
              className="input-compact hide-spinner w-20"
            />
            <button
              onClick={runPlaytest}
              disabled={playtestRunning || curveData.length === 0}
              className="inline-flex items-center gap-1 px-3 py-1 rounded text-caption font-semibold disabled:opacity-40"
              style={{ background: '#06b6d4', color: 'white' }}
            >
              <PlayCircle className="w-3.5 h-3.5" />
              {playtestRunning ? '실행 중...' : '재생'}
            </button>
          </div>
        </div>
        {!playtestResult && (
          <p className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
            재생 버튼을 누르면 가상 플레이어 {playtestPlayers}명이 이 곡선을 플레이 시도 →
            이탈률·평균 도달 스테이지·가장 막히는 벽 자동 탐지
          </p>
        )}
        {playtestResult && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 rounded" style={{ background: 'var(--bg-primary)', borderLeft: `3px solid ${dropoutColor}` }}>
                <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>이탈률</div>
                <div className="text-lg font-bold tabular-nums" style={{ color: dropoutColor }}>
                  {Math.round(playtestResult.dropoutRate * 100)}%
                </div>
                <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
                  {playtestResult.dropoutRate < 0.2 ? '건강' : playtestResult.dropoutRate < 0.5 ? '조정 권장' : '과도하게 어려움'}
                </div>
              </div>
              <div className="p-2 rounded" style={{ background: 'var(--bg-primary)' }}>
                <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>평균 도달</div>
                <div className="text-lg font-bold tabular-nums" style={{ color: '#3b82f6' }}>
                  {playtestResult.avgReachedStage.toFixed(1)}
                </div>
                <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
                  / {curveData.length} 스테이지
                </div>
              </div>
              <div className="p-2 rounded" style={{ background: 'var(--bg-primary)' }}>
                <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>평균 플레이타임</div>
                <div className="text-lg font-bold tabular-nums" style={{ color: '#8b5cf6' }}>
                  {playtestResult.avgPlaytimeMin.toFixed(0)}분
                </div>
                <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
                  생존자 기준
                </div>
              </div>
            </div>
            {playtestResult.topDropoutStages.length > 0 && (
              <div className="p-2 rounded" style={{ background: '#ef444415', borderLeft: '3px solid #ef4444' }}>
                <div className="flex items-center gap-1 text-caption font-semibold mb-1" style={{ color: '#ef4444' }}>
                  <AlertTriangle className="w-3 h-3" />
                  가장 막히는 스테이지 TOP {playtestResult.topDropoutStages.length}
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  {playtestResult.topDropoutStages.map((d) => (
                    <span
                      key={d.stage}
                      className="px-2 py-0.5 rounded text-caption font-mono"
                      style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                      title={`Stage ${d.stage} 에서 ${d.dropouts}명 이탈 (${Math.round(d.dropoutRate * 100)}%)`}
                    >
                      Stage {d.stage} · {Math.round(d.dropoutRate * 100)}%
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 고급 설정 — Advanced 모드에서만 */}
      {mode === 'advanced' && (
        <>
          <SectionDivider
            icon={BarChart3}
            title="고급 분석"
            color="#06b6d4"
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
        </>
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

      {/* ===== 섹션 3: 스테이지 설계 — Advanced 전용 ===== */}
      {mode === 'advanced' && (
        <>
          <SectionDivider
            icon={Wrench}
            title={t('sectionStageDesign')}
            color="#3db88a"
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
        </>
      )}

      {/* Simple 모드 안내 footer — "세부 조정 필요 시 고급 모드" */}
      {mode === 'simple' && (
        <div className="text-caption italic text-center pt-2" style={{ color: 'var(--text-tertiary)' }}>
          벽 스테이지·마일스톤·휴식 포인트를 직접 편집하려면 상단 <strong>고급 모드</strong>로 전환하세요.
        </div>
      )}
    </PanelShell>
  );
}
