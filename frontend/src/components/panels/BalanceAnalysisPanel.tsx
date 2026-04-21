'use client';

import { useState } from 'react';
import { GitBranch, TrendingUp, BarChart2, AlertTriangle, Target, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import PanelShell, { HelpToggle } from '@/components/ui/PanelShell';
import SheetSelector from './SheetSelector';

// 커스텀 스크롤바 스타일
const customScrollStyle = `
  .custom-tab-scroll::-webkit-scrollbar {
    height: 3px;
  }
  .custom-tab-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-tab-scroll::-webkit-scrollbar-thumb {
    background: var(--border-secondary);
    border-radius: 3px;
  }
  .custom-tab-scroll::-webkit-scrollbar-thumb:hover {
    background: var(--text-secondary);
  }
  .custom-tab-scroll {
    scrollbar-width: thin;
    scrollbar-color: var(--border-secondary) transparent;
  }
`;

// 훅과 컴포넌트 임포트
import { useBalanceAnalysisState, type AnalysisTab } from './balance-analysis/hooks';
import {
  MatchupAnalysis,
  MatrixModal,
  PowerCurveAnalysis,
  CorrelationAnalysis,
  DeadZoneAnalysis,
  CurveGenerator,
  HelpPanel,
} from './balance-analysis/components';

interface BalanceAnalysisPanelProps {
  onClose: () => void;
  showHelp?: boolean;
  setShowHelp?: (value: boolean) => void;
}

export default function BalanceAnalysisPanel({
  onClose,
  showHelp: externalShowHelp,
  setShowHelp: externalSetShowHelp
}: BalanceAnalysisPanelProps) {
  // PanelShell 이 useEscapeKey 담당
  const [internalShowHelp, setInternalShowHelp] = useState(false);
  const showHelpVal = externalShowHelp ?? internalShowHelp;
  const setShowHelpVal = externalSetShowHelp ?? setInternalShowHelp;

  const state = useBalanceAnalysisState(showHelpVal, setShowHelpVal);

  const {
    activeTab,
    setActiveTab,
    isAnalyzing,
    matchupResult,
    powerResult,
    correlationResult,
    runsPerMatch,
    setRunsPerMatch,
    showMatrixModal,
    setShowMatrixModal,
    showHelp,
    showTabDropdown,
    setShowTabDropdown,
    units,
    currentSheet,
    columnMapping,
    setColumnMapping,
    selectedProjectId,
    setSelectedProjectId,
    selectedSheetId,
    setSelectedSheetId,
    runMatchupAnalysis,
    runPowerAnalysis,
    runCorrelationAnalysis,
  } = state;

  const columns = currentSheet?.columns || [];

  const tabs: { id: AnalysisTab; label: string; icon: React.ReactNode; tooltip: string; color: string }[] = [
    { id: 'matchup', label: '상성 분석', icon: <GitBranch className="w-4 h-4" />, tooltip: '가위바위보 상성 관계 분석', color: '#7c7ff2' },
    { id: 'power', label: '파워 커브', icon: <TrendingUp className="w-4 h-4" />, tooltip: '레벨별 스탯 성장 패턴 분석', color: '#3db88a' },
    { id: 'correlation', label: '상관관계', icon: <BarChart2 className="w-4 h-4" />, tooltip: '스탯 간 상관계수 분석', color: '#5a9cf5' },
    { id: 'deadzone', label: '데드존', icon: <AlertTriangle className="w-4 h-4" />, tooltip: '활용되지 않는 스탯 구간 탐지', color: '#e5a440' },
    { id: 'curve', label: '커브 생성', icon: <Target className="w-4 h-4" />, tooltip: '밸런스 곡선 자동 생성', color: '#9179f2' },
  ];

  return (
    <PanelShell
      title="밸런스 분석"
      subtitle="매치업·파워커브·상관·데드존"
      icon={GitBranch}
      iconColor="#7c7ff2"
      onClose={onClose}
      bodyClassName="p-0 flex flex-col overflow-hidden"
      actions={<HelpToggle active={showHelpVal} onToggle={() => setShowHelpVal(!showHelpVal)} color="#7c7ff2" />}
    >
      <style>{customScrollStyle}</style>

      {/* 전체화면 모달 */}
      {showMatrixModal && matchupResult && (
        <MatrixModal
          matchupResult={matchupResult}
          onClose={() => setShowMatrixModal(false)}
        />
      )}

      {/* 프로젝트/시트 선택 */}
      <div className="px-3 pt-3">
        <SheetSelector
          selectedProjectId={selectedProjectId}
          onProjectChange={setSelectedProjectId}
          showProjectSelector={true}
          selectedSheetId={selectedSheetId}
          onSheetChange={setSelectedSheetId}
          label="분석할 시트"
          color="#7c7ff2"
        />
      </div>

      {/* 분석 유형 선택 드롭다운 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'var(--border-primary)' }}>
        <div className="relative flex-1">
          <button
            onClick={() => setShowTabDropdown(!showTabDropdown)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all hover:opacity-90"
            style={{
              background: `${tabs.find(t => t.id === activeTab)?.color}15`,
              color: tabs.find(t => t.id === activeTab)?.color,
              border: `1px solid ${tabs.find(t => t.id === activeTab)?.color}40`
            }}
          >
            {(() => {
              const currentTab = tabs.find(t => t.id === activeTab);
              return (
                <>
                  <span style={{ color: currentTab?.color }}>{currentTab?.icon}</span>
                  <span className="text-sm font-medium flex-1" style={{ color: currentTab?.color }}>{currentTab?.label}</span>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{currentTab?.tooltip}</span>
                  <ChevronDown className={cn("w-4 h-4 transition-transform duration-200 ml-1", showTabDropdown && "rotate-180")} style={{ color: 'var(--text-secondary)' }} />
                </>
              );
            })()}
          </button>
          {showTabDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowTabDropdown(false)} />
              <div className="absolute left-0 right-0 top-full mt-1 glass-panel rounded-lg shadow-lg z-50 overflow-hidden">
                <div className="p-1">
                  {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveTab(tab.id);
                          setShowTabDropdown(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors"
                        style={{
                          background: isActive ? `${tab.color}15` : 'transparent',
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <div
                          className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                          style={{ background: `${tab.color}20` }}
                        >
                          <span style={{ color: tab.color }}>{tab.icon}</span>
                        </div>
                        <span className="text-sm font-medium" style={{ color: isActive ? tab.color : 'var(--text-primary)' }}>
                          {tab.label}
                        </span>
                        <span className="text-sm flex-1 text-right" style={{ color: 'var(--text-secondary)' }}>
                          {tab.tooltip}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 내용 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
        {/* 도움말 패널 */}
        {showHelp && <HelpPanel />}

        {activeTab === 'matchup' && (
          <MatchupAnalysis
            units={units}
            runsPerMatch={runsPerMatch}
            setRunsPerMatch={setRunsPerMatch}
            isAnalyzing={isAnalyzing}
            matchupResult={matchupResult}
            onRunAnalysis={runMatchupAnalysis}
            onShowMatrix={() => setShowMatrixModal(true)}
            columns={columns}
            columnMapping={columnMapping}
            onMappingChange={setColumnMapping}
          />
        )}

        {activeTab === 'power' && (
          <PowerCurveAnalysis
            units={units}
            powerResult={powerResult}
            onRunAnalysis={runPowerAnalysis}
            columns={columns}
            columnMapping={columnMapping}
            onMappingChange={setColumnMapping}
          />
        )}

        {activeTab === 'correlation' && (
          <CorrelationAnalysis
            units={units}
            correlationResult={correlationResult}
            onRunAnalysis={runCorrelationAnalysis}
            columns={columns}
            columnMapping={columnMapping}
            onMappingChange={setColumnMapping}
          />
        )}

        {activeTab === 'deadzone' && (
          <DeadZoneAnalysis
            units={units}
            columns={columns}
            columnMapping={columnMapping}
            onMappingChange={setColumnMapping}
          />
        )}

        {activeTab === 'curve' && (
          <CurveGenerator />
        )}
      </div>
    </PanelShell>
  );
}
