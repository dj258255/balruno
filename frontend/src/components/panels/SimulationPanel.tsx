'use client';

import { useState, useCallback } from 'react';
import { Play, RefreshCw, User, Grid3X3, Swords } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { toast } from '@/components/ui/Toast';
import PanelShell, { HelpToggle } from '@/components/ui/PanelShell';
import { useTranslations } from 'next-intl';
import CustomSelect from '@/components/ui/CustomSelect';
import type { SimulationResult, UnitStats } from '@/lib/simulation/types';

// 분리된 훅과 컴포넌트들
import { useSimulationState } from './simulation/hooks';
import { useSimulationActions } from './simulation/hooks';
import {
  TeamUnitModal,
  BattleSettings,
  UnitStatsPanel,
  SimulationResults,
  TeamBattlePanel,
} from './simulation/components';
import { PANEL_COLOR } from './simulation/constants';

interface SimulationPanelProps {
  onClose: () => void;
  showHelp?: boolean;
  setShowHelp?: (value: boolean) => void;
}

export default function SimulationPanel({ onClose, showHelp: externalShowHelp, setShowHelp: externalSetShowHelp }: SimulationPanelProps) {
  const t = useTranslations('simulation');
  const tCommon = useTranslations();
  const [internalShowHelp, setInternalShowHelp] = useState(false);
  const showHelp = externalShowHelp ?? internalShowHelp;
  const setShowHelp = externalSetShowHelp ?? setInternalShowHelp;

  const { startCellSelection } = useProjectStore();

  // 커스텀 훅으로 상태 관리
  const state = useSimulationState();
  const actions = useSimulationActions({
    unit1Stats: state.unit1Stats,
    unit2Stats: state.unit2Stats,
    unit1Skills: state.unit1Skills,
    unit2Skills: state.unit2Skills,
    team1Units: state.team1Units,
    team2Units: state.team2Units,
    runs: state.runs,
    maxDuration: state.maxDuration,
    damageFormula: state.damageFormula,
    defenseFormula: state.defenseFormula,
    useArmorPen: state.useArmorPen,
    armorPen: state.armorPen,
    targetingMode: state.targetingMode,
    setIsRunning: state.setIsRunning,
    setProgress: state.setProgress,
    setResult: state.setResult,
    setTeamResult: state.setTeamResult,
    setSelectedBattleIndex: state.setSelectedBattleIndex,
  });

  return (
    <PanelShell
      title="전투 시뮬"
      subtitle="1:1/팀 전투 Monte Carlo"
      icon={Swords}
      iconColor="#e11d48"
      onClose={onClose}
      bodyClassName="p-0 flex flex-col overflow-hidden"
      actions={<HelpToggle active={showHelp} onToggle={() => setShowHelp(!showHelp)} color="#e11d48" />}
    >
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4">
        {/* 도움말 섹션 */}
        {showHelp && (
          <HelpSection t={t} tCommon={tCommon} />
        )}

        {/* 모드 선택 탭 */}
        <ModeSelector
          battleMode={state.battleMode}
          setBattleMode={state.setBattleMode}
          t={t}
        />

        {/* 1v1 모드 UI */}
        {state.battleMode === '1v1' && (
          <OneVsOneMode
            state={state}
            actions={actions}
            startCellSelection={startCellSelection}
            t={t}
          />
        )}

        {/* 팀 전투 모드 UI */}
        {state.battleMode === 'team' && (
          <TeamBattlePanel
            team1Units={state.team1Units}
            team2Units={state.team2Units}
            units={state.units}
            targetingMode={state.targetingMode}
            setTargetingMode={state.setTargetingMode}
            teamResult={state.teamResult}
            isRunning={state.isRunning}
            runs={state.runs}
            setRuns={state.setRuns}
            onRunSimulation={actions.runTeamSimulation}
            onAddToTeam={state.addToTeam}
            onRemoveFromTeam={state.removeFromTeam}
            onOpenModal={state.setTeamUnitModal}
          />
        )}
      </div>

      {/* 팀 유닛 편집 모달 */}
      <TeamUnitModal
        isOpen={state.teamUnitModal.isOpen}
        onClose={() => state.setTeamUnitModal({ isOpen: false, teamNumber: 1, editUnit: null })}
        onSave={(unit) => state.updateTeamUnit(state.teamUnitModal.teamNumber, unit)}
        unit={state.teamUnitModal.editUnit}
        teamNumber={state.teamUnitModal.teamNumber}
        units={state.units}
        onLoadFromSheet={(unit) => {
          state.setTeamUnitModal(prev => ({
            ...prev,
            editUnit: { ...unit, id: `team${prev.teamNumber}_${Date.now()}` }
          }));
        }}
      />
    </PanelShell>
  );
}

// 도움말 섹션 컴포넌트
interface HelpSectionProps {
  t: ReturnType<typeof useTranslations>;
  tCommon: ReturnType<typeof useTranslations>;
}

function HelpSection({ tCommon }: HelpSectionProps) {
  return (
    <div className="mb-4 p-3 rounded-lg animate-slideDown" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}>
      <div className="space-y-3">
        <div className="flex items-start gap-2">
          <div className="w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${PANEL_COLOR}20` }}>
            <Swords className="w-3 h-3" style={{ color: PANEL_COLOR }} />
          </div>
          <div>
            <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{tCommon('help.simulation.title')}</p>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{tCommon('help.simulation.desc')}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <div className="p-2 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
            <span className="font-medium" style={{ color: PANEL_COLOR }}>DPS</span>
            <span className="ml-1" style={{ color: 'var(--text-secondary)' }}>{tCommon('help.simulation.dps')}</span>
          </div>
          <div className="p-2 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
            <span className="font-medium" style={{ color: PANEL_COLOR }}>TTK</span>
            <span className="ml-1" style={{ color: 'var(--text-secondary)' }}>{tCommon('help.simulation.ttk')}</span>
          </div>
          <div className="p-2 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
            <span className="font-medium" style={{ color: PANEL_COLOR }}>{tCommon('help.simulation.winRate')}</span>
            <span className="ml-1" style={{ color: 'var(--text-secondary)' }}>{tCommon('help.simulation.winRateDesc')}</span>
          </div>
          <div className="p-2 rounded-lg" style={{ background: 'var(--bg-primary)' }}>
            <span className="font-medium" style={{ color: PANEL_COLOR }}>{tCommon('help.simulation.monteCarlo')}</span>
            <span className="ml-1" style={{ color: 'var(--text-secondary)' }}>{tCommon('help.simulation.monteCarloDesc')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// 모드 선택 컴포넌트
interface ModeSelectorProps {
  battleMode: '1v1' | 'team';
  setBattleMode: (mode: '1v1' | 'team') => void;
  t: ReturnType<typeof useTranslations>;
}

function ModeSelector({ battleMode, setBattleMode, t }: ModeSelectorProps) {
  return (
    <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
      <button
        onClick={() => setBattleMode('1v1')}
        className="flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
        style={{
          background: battleMode === '1v1' ? 'var(--bg-primary)' : 'transparent',
          color: battleMode === '1v1' ? 'var(--accent)' : 'var(--text-secondary)',
          boxShadow: battleMode === '1v1' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
        }}
      >
        <User className="w-4 h-4" />
        {t('mode1v1')}
      </button>
      <button
        onClick={() => setBattleMode('team')}
        className="flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2"
        style={{
          background: battleMode === 'team' ? 'var(--bg-primary)' : 'transparent',
          color: battleMode === 'team' ? 'var(--accent)' : 'var(--text-secondary)',
          boxShadow: battleMode === 'team' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
        }}
      >
        <Grid3X3 className="w-4 h-4" />
        {t('modeTeam')}
      </button>
    </div>
  );
}

/**
 * 시뮬 결과를 현재 시트에 행으로 commit. 컬럼명 매칭되면 그 셀, 아니면 fallback.
 * stat-snapshot 컬럼 있으면 JSON 으로 스냅샷 저장.
 */
function saveSimResultToCurrentSheet(result: SimulationResult, unit1: UnitStats, unit2: UnitStats) {
  const store = useProjectStore.getState();
  const { currentProjectId, currentSheetId, projects, addRow } = store;
  if (!currentProjectId || !currentSheetId) {
    toast.error('저장할 시트를 먼저 선택하세요');
    return;
  }
  const project = projects.find((p) => p.id === currentProjectId);
  const sheet = project?.sheets.find((s) => s.id === currentSheetId);
  if (!sheet) return;

  const payload: Record<string, string | number> = {
    timestamp: new Date().toISOString(),
    unit1: unit1.name || 'Unit 1',
    unit2: unit2.name || 'Unit 2',
    winRate: Math.round((result.unit1WinRate ?? 0) * 100) / 100,
    avgDuration: Math.round((result.avgDuration ?? 0) * 100) / 100,
    totalRuns: result.totalRuns,
  };

  const matchCol = (...names: string[]) => {
    const needles = names.map((n) => n.toLowerCase().replace(/\s/g, ''));
    return sheet.columns.find((c) => {
      const cn = c.name.toLowerCase().replace(/\s/g, '');
      return needles.some((n) => cn === n || cn.includes(n));
    });
  };

  const cells: Record<string, string | number> = {};
  const tsCol = matchCol('timestamp', 'date', '일시', '날짜');
  const u1Col = matchCol('unit1', 'attacker', '유닛1', '공격');
  const u2Col = matchCol('unit2', 'defender', '유닛2', '방어');
  const wrCol = matchCol('winrate', 'win', '승률');
  const durCol = matchCol('duration', 'time', '시간', '소요');
  const runsCol = matchCol('runs', 'iterations', 'samples', '반복');
  const snapCol = sheet.columns.find((c) => c.type === 'stat-snapshot');

  if (tsCol) cells[tsCol.id] = payload.timestamp;
  if (u1Col) cells[u1Col.id] = payload.unit1;
  if (u2Col) cells[u2Col.id] = payload.unit2;
  if (wrCol) cells[wrCol.id] = payload.winRate;
  if (durCol) cells[durCol.id] = payload.avgDuration;
  if (runsCol) cells[runsCol.id] = payload.totalRuns;
  if (snapCol) {
    cells[snapCol.id] = JSON.stringify({
      capturedAt: Date.now(),
      sourceRowId: '',
      stats: payload,
      label: `${payload.unit1} vs ${payload.unit2}`,
    });
  }

  if (Object.keys(cells).length === 0) {
    const textCol = sheet.columns.find((c) => c.type === 'general');
    if (textCol) cells[textCol.id] = `${payload.unit1} vs ${payload.unit2} · WR ${payload.winRate}%`;
  }

  const rowId = addRow(currentProjectId, currentSheetId, cells);
  if (rowId) {
    toast.success(`${sheet.name} 에 시뮬 결과 저장됨`);
  }
}

// 1v1 모드 컴포넌트
interface OneVsOneModeProps {
  state: ReturnType<typeof useSimulationState>;
  actions: ReturnType<typeof useSimulationActions>;
  startCellSelection: (label: string, callback: (value: string | number | boolean | null) => void) => void;
  t: ReturnType<typeof useTranslations>;
}

function OneVsOneMode({ state, actions, startCellSelection, t }: OneVsOneModeProps) {
  return (
    <>
      {/* 유닛 스탯 입력 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <UnitStatsPanel
          unitStats={state.unit1Stats}
          setUnitStats={state.setUnit1Stats}
          skills={state.unit1Skills}
          setSkills={state.setUnit1Skills}
          showSkills={state.showUnit1Skills}
          setShowSkills={state.setShowUnit1Skills}
          units={state.units}
          onLoadFromSheet={(unit) => state.loadFromSheet(1, unit)}
          startCellSelection={startCellSelection}
          color="var(--primary-blue)"
          placeholder="유닛 A"
        />

        <UnitStatsPanel
          unitStats={state.unit2Stats}
          setUnitStats={state.setUnit2Stats}
          skills={state.unit2Skills}
          setSkills={state.setUnit2Skills}
          showSkills={state.showUnit2Skills}
          setShowSkills={state.setShowUnit2Skills}
          units={state.units}
          onLoadFromSheet={(unit) => state.loadFromSheet(2, unit)}
          startCellSelection={startCellSelection}
          color="var(--primary-red)"
          placeholder="유닛 B"
        />
      </div>

      {/* 설정 패널 */}
      {state.showSettings && (
        <BattleSettings
          runs={state.runs}
          setRuns={state.setRuns}
          damageFormula={state.damageFormula}
          setDamageFormula={state.setDamageFormula}
          defenseFormula={state.defenseFormula}
          setDefenseFormula={state.setDefenseFormula}
          maxDuration={state.maxDuration}
          setMaxDuration={state.setMaxDuration}
          useArmorPen={state.useArmorPen}
          setUseArmorPen={state.setUseArmorPen}
          armorPen={state.armorPen}
          setArmorPen={state.setArmorPen}
          columnMapping={state.columnMapping}
          setColumnMapping={state.setColumnMapping}
          autoDetectedColumns={state.autoDetectedColumns}
          currentSheet={state.currentSheet}
        />
      )}

      {/* 실행 버튼 + 횟수 선택 */}
      <div className="flex gap-2">
        <button
          onClick={actions.runSimulation}
          disabled={!state.unit1Stats.name || !state.unit2Stats.name || state.unit1Stats.maxHp <= 0 || state.unit2Stats.maxHp <= 0 || state.isRunning}
          className="flex-1 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          style={{
            background: state.isRunning ? 'var(--bg-tertiary)' : 'var(--accent)',
            color: state.isRunning ? 'var(--text-secondary)' : 'white'
          }}
        >
          {state.isRunning ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              {t('running')} {state.progress.toFixed(0)}%
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              {t('runSimulation')}
            </>
          )}
        </button>
        <CustomSelect
          value={String(state.runs)}
          onChange={(v) => state.setRuns(Number(v))}
          disabled={state.isRunning}
          options={[
            { value: '1000', label: '1K' },
            { value: '5000', label: '5K' },
            { value: '10000', label: '10K' },
            { value: '50000', label: '50K' },
            { value: '100000', label: '100K' },
          ]}
          size="sm"
        />
      </div>

      {/* 진행률 바 */}
      {state.isRunning && (
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
          <div
            className="h-full transition-all duration-200"
            style={{
              width: `${state.progress}%`,
              background: 'var(--accent)'
            }}
          />
        </div>
      )}

      {/* 결과 표시 */}
      {state.result && (
        <SimulationResults
          result={state.result}
          unit1Stats={state.unit1Stats}
          unit2Stats={state.unit2Stats}
          showDetailedStats={state.showDetailedStats}
          setShowDetailedStats={state.setShowDetailedStats}
          selectedBattleIndex={state.selectedBattleIndex}
          setSelectedBattleIndex={state.setSelectedBattleIndex}
          onExport={(format) => actions.exportResults(format, state.result)}
          onSaveToSheet={state.result ? () => saveSimResultToCurrentSheet(state.result!, state.unit1Stats, state.unit2Stats) : undefined}
        />
      )}

      {/* 유닛이 없을 때 안내 */}
      {state.units.length === 0 && (
        <div className="text-center py-8">
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {t('noUnitData')}
          </div>
          <div className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
            {t('noUnitDataDesc')}
          </div>
        </div>
      )}
    </>
  );
}
