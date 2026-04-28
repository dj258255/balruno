'use client';

import { useState } from 'react';
import { GitBranch, TrendingUp, BarChart2, AlertTriangle, Target, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import PanelShell, { HelpToggle } from '@/components/ui/PanelShell';
import ToolPanelHint from '@/components/onboarding/ToolPanelHint';
import SheetSelector from './SheetSelector';

import { useTranslations } from 'next-intl';
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
  const t = useTranslations();
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
    { id: 'matchup', label: t('balanceAnalysis.tabMatchup'), icon: <GitBranch className="w-4 h-4" />, tooltip: t('balanceAnalysis.tabMatchupTooltip'), color: '#7c7ff2' },
    { id: 'power', label: t('balanceAnalysis.tabPower'), icon: <TrendingUp className="w-4 h-4" />, tooltip: t('balanceAnalysis.tabPowerTooltip'), color: '#3db88a' },
    { id: 'correlation', label: t('balanceAnalysis.tabCorrelation'), icon: <BarChart2 className="w-4 h-4" />, tooltip: t('balanceAnalysis.tabCorrelationTooltip'), color: '#5a9cf5' },
    { id: 'deadzone', label: t('balanceAnalysis.tabDeadzone'), icon: <AlertTriangle className="w-4 h-4" />, tooltip: t('balanceAnalysis.tabDeadzoneTooltip'), color: '#e5a440' },
    { id: 'curve', label: t('balanceAnalysis.tabCurve'), icon: <Target className="w-4 h-4" />, tooltip: t('balanceAnalysis.tabCurveTooltip'), color: '#9179f2' },
  ];

  return (
    <PanelShell
      title={t('balanceAnalysis.titleHeader')}
      subtitle={t('balanceAnalysis.subtitleHeader')}
      icon={GitBranch}
      iconColor="#7c7ff2"
      onClose={onClose}
      bodyClassName="p-0 flex flex-col overflow-hidden"
      actions={<HelpToggle active={showHelpVal} onToggle={() => setShowHelpVal(!showHelpVal)} color="#7c7ff2" />}
    >
      <style>{customScrollStyle}</style>

      <div className="px-4 pt-3">
        <ToolPanelHint toolId="balanceAnalysis" title={t('balanceAnalysis.hintTitle')} accentColor="#ec4899">
          <p>{t.rich('balanceAnalysis.hintP1', { strong: (chunks) => <strong>{chunks}</strong> })}</p>
          <p>{t('balanceAnalysis.hintP2')}</p>
        </ToolPanelHint>
      </div>

      {/* 전체화면 모달 */}
      {showMatrixModal && matchupResult && (
        <MatrixModal
          matchupResult={matchupResult}
          onClose={() => setShowMatrixModal(false)}
        />
      )}

      {/* 프로젝트/시트 선택 — 공통 SheetSelector */}
      <SheetSelector
        selectedProjectId={selectedProjectId}
        onProjectChange={setSelectedProjectId}
        showProjectSelector={true}
        selectedSheetId={selectedSheetId}
        onSheetChange={setSelectedSheetId}
        label={t('balanceAnalysis.analysisSheetLabel')}
        color="#7c7ff2"
        className="mx-3 mt-3"
      />

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
