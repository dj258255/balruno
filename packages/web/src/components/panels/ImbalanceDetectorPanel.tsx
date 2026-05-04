import { useState, useMemo } from 'react';
import {
  X,
  AlertTriangle,
  AlertCircle,
  Info,
  TrendingUp,
  BarChart,
  Scale,
  Mountain,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Settings,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { detectImbalances, getSeverityColor, type ImbalanceIssue, type Severity, type DetectionConfig } from '@/lib/imbalanceDetector';
import { reviewBalance } from '@/lib/balanceReview';
import { Sparkles } from 'lucide-react';
import PanelShell, { HelpToggle } from '@/components/ui/PanelShell';
import ToolPanelHint from '@/components/onboarding/ToolPanelHint';
import { useTranslations } from 'next-intl';
import SheetSelector from './SheetSelector';

const PANEL_COLOR = '#e5a440'; // 소프트 앰버

interface ImbalanceDetectorPanelProps {
  onClose: () => void;
  showHelp?: boolean;
  setShowHelp?: (value: boolean) => void;
}

// 타입별 아이콘 매핑
const TYPE_ICONS: Record<string, typeof AlertTriangle> = {
  outlier: AlertTriangle,
  power_creep: TrendingUp,
  variance: BarChart,
  cliff: Mountain,
  efficiency: Scale,
};

export default function ImbalanceDetectorPanel({ onClose, showHelp: externalShowHelp, setShowHelp: externalSetShowHelp }: ImbalanceDetectorPanelProps) {
  // PanelShell 이 ESC 담당
  const t = useTranslations('imbalanceDetector');

  const { projects, currentProjectId, currentSheetId } = useProjectStore();

  // 프로젝트 및 시트 선택 상태
  const [selectedProjectId, setSelectedProjectId] = useState<string>(currentProjectId || '');
  const [selectedSheetId, setSelectedSheetId] = useState<string>(currentSheetId || '');

  const currentProject = projects.find(p => p.id === selectedProjectId);
  const selectedSheet = currentProject?.sheets.find(s => s.id === selectedSheetId);

  // 상태
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [issues, setIssues] = useState<ImbalanceIssue[]>([]);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<Severity | 'all'>('all');
  const [internalShowHelp, setInternalShowHelp] = useState(false);

  // 외부 상태가 있으면 사용, 없으면 내부 상태 사용
  const showHelp = externalShowHelp !== undefined ? externalShowHelp : internalShowHelp;
  const setShowHelp = externalSetShowHelp || setInternalShowHelp;

  // 설정
  const [config, setConfig] = useState<DetectionConfig>({
    outlierThreshold: 2.5,
    powerCreepThreshold: 3,
    varianceThreshold: 0.3,
    cliffThreshold: 2,
  });

  // 분석 실행
  const runAnalysis = () => {
    if (!selectedSheet) return;

    setIsAnalyzing(true);
    setHasAnalyzed(false);

    // 비동기처럼 보이게 (UI 업데이트 허용)
    setTimeout(() => {
      const detected = detectImbalances(selectedSheet, config);
      setIssues(detected);
      setHasAnalyzed(true);
      setIsAnalyzing(false);
    }, 100);
  };

  // 필터링된 이슈
  const filteredIssues = useMemo(() => {
    if (filterSeverity === 'all') return issues;
    return issues.filter(i => i.severity === filterSeverity);
  }, [issues, filterSeverity]);

  // 심각도별 카운트
  const severityCounts = useMemo(() => {
    const counts = { critical: 0, warning: 0, info: 0 };
    for (const issue of issues) {
      counts[issue.severity]++;
    }
    return counts;
  }, [issues]);

  // AI 리뷰 (템플릿 기반)
  const aiReview = useMemo(() => {
    if (!hasAnalyzed) return null;
    return reviewBalance(issues);
  }, [hasAnalyzed, issues]);
  const [showAiReview, setShowAiReview] = useState(true);

  // 이슈 확장/축소 토글
  const toggleIssue = (issueId: string) => {
    setExpandedIssues(prev => {
      const next = new Set(prev);
      if (next.has(issueId)) {
        next.delete(issueId);
      } else {
        next.add(issueId);
      }
      return next;
    });
  };

  return (
    <PanelShell
      title={t('titleHeader')}
      subtitle={t('subtitleHeader')}
      icon={AlertTriangle}
      iconColor={PANEL_COLOR}
      onClose={onClose}
      bodyClassName="p-4 space-y-4 overflow-x-hidden scrollbar-slim"
      actions={<HelpToggle active={showHelp} onToggle={() => setShowHelp(!showHelp)} color={PANEL_COLOR} />}
    >
      <>
        <ToolPanelHint toolId="imbalance" title={t('hintTitle')} accentColor="#ec4899">
          <p>{t.rich('hintP1', { z: (chunks) => <strong>{chunks}</strong> })}</p>
          <p>{t('hintP2')}</p>
        </ToolPanelHint>
        {/* 프로젝트/시트 선택 */}
        <SheetSelector
          selectedProjectId={selectedProjectId}
          onProjectChange={(projectId) => {
            setSelectedProjectId(projectId);
            setHasAnalyzed(false);
            setIssues([]);
          }}
          showProjectSelector={true}
          selectedSheetId={selectedSheetId}
          onSheetChange={(sheetId) => {
            setSelectedSheetId(sheetId);
            setHasAnalyzed(false);
            setIssues([]);
          }}
          label={t('selectSheet')}
          color={PANEL_COLOR}
        />

        {/* 도움말 패널 */}
        {showHelp && (
          <div className="mb-4 glass-card p-3 rounded-lg animate-slideDown">
            <div className="font-medium mb-2 text-sm" style={{ color: 'var(--text-primary)' }}>{t('helpTitle')}</div>
            <p className="mb-3 text-sm" style={{ color: 'var(--text-secondary)' }}>{t('helpDesc')}</p>
            <div className="space-y-2 mb-3">
              <div className="glass-section p-2.5 rounded-lg" style={{ borderLeft: '3px solid #e86161' }}>
                <span className="font-medium text-sm" style={{ color: '#e86161' }}>{t('outlier')}</span>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{t('helpOutlier')}</p>
              </div>
              <div className="glass-section p-2.5 rounded-lg" style={{ borderLeft: '3px solid #e5a440' }}>
                <span className="font-medium text-sm" style={{ color: '#e5a440' }}>{t('powerCreep')}</span>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{t('helpPowerCreep')}</p>
              </div>
              <div className="glass-section p-2.5 rounded-lg" style={{ borderLeft: '3px solid #9179f2' }}>
                <span className="font-medium text-sm" style={{ color: '#9179f2' }}>{t('cliff')}</span>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{t('helpCliff')}</p>
              </div>
              <div className="glass-section p-2.5 rounded-lg" style={{ borderLeft: '3px solid #5a9cf5' }}>
                <span className="font-medium text-sm" style={{ color: '#5a9cf5' }}>{t('variance')}</span>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{t('helpVariance')}</p>
              </div>
            </div>
            <div className="glass-divider pt-2 border-t text-sm" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>
              {t('helpVsAnalysis')}
            </div>
          </div>
        )}
        {/* 설정 패널 */}
        {showSettings && (
          <div className="glass-card p-3 rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t('settings')}</div>
              <div className="group relative">
                <HelpCircle className="w-3.5 h-3.5 cursor-help" style={{ color: 'var(--text-secondary)' }} />
                <div className="absolute left-0 top-5 z-50 hidden group-hover:block w-64 glass-panel p-2 rounded-lg text-sm shadow-lg" style={{ color: 'var(--text-secondary)' }}>
                  {t('settingsTooltip')}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* 이상치 임계값 */}
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {t('outlierThreshold')}
                  </label>
                  <div className="group relative">
                    <HelpCircle className="w-3 h-3 cursor-help" style={{ color: 'var(--text-secondary)' }} />
                    <div className="absolute left-0 top-4 z-50 hidden group-hover:block w-56 glass-panel p-2 rounded-lg text-sm shadow-lg" style={{ color: 'var(--text-secondary)' }}>
                      <div className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{t('outlierTooltipTitle')}</div>
                      {t('outlierTooltipDesc')}
                      <div className="mt-1.5 space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
                        <div>{t('outlierSensitive')}</div>
                        <div>{t('outlierNormal')}</div>
                        <div>{t('outlierInsensitive')}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <input
                  type="number"
                  value={config.outlierThreshold}
                  onChange={(e) => setConfig({ ...config, outlierThreshold: parseFloat(e.target.value) || 2.5 })}
                  step={0.5}
                  min={1}
                  max={5}
                  className="glass-input w-full px-2 py-1.5 rounded text-sm"
                />
              </div>

              {/* 파워크립 임계값 */}
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {t('powerCreepThreshold')}
                  </label>
                  <div className="group relative">
                    <HelpCircle className="w-3 h-3 cursor-help" style={{ color: 'var(--text-secondary)' }} />
                    <div className="absolute right-0 top-4 z-50 hidden group-hover:block w-56 glass-panel p-2 rounded-lg text-sm shadow-lg" style={{ color: 'var(--text-secondary)' }}>
                      <div className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{t('powerCreepTooltipTitle')}</div>
                      {t('powerCreepTooltipDesc')}
                      <div className="mt-1.5 space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
                        <div>{t('powerCreepStrict')}</div>
                        <div>{t('powerCreepNormal')}</div>
                        <div>{t('powerCreepLenient')}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <input
                  type="number"
                  value={config.powerCreepThreshold}
                  onChange={(e) => setConfig({ ...config, powerCreepThreshold: parseFloat(e.target.value) || 3 })}
                  step={0.5}
                  min={1.5}
                  max={10}
                  className="glass-input w-full px-2 py-1.5 rounded text-sm"
                />
              </div>

              {/* 분산 임계값 */}
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {t('varianceThreshold')}
                  </label>
                  <div className="group relative">
                    <HelpCircle className="w-3 h-3 cursor-help" style={{ color: 'var(--text-secondary)' }} />
                    <div className="absolute left-0 top-4 z-50 hidden group-hover:block w-56 glass-panel p-2 rounded-lg text-sm shadow-lg" style={{ color: 'var(--text-secondary)' }}>
                      <div className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{t('varianceTooltipTitle')}</div>
                      {t('varianceTooltipDesc')}
                      <div className="mt-1.5 space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
                        <div>{t('varianceStrict')}</div>
                        <div>{t('varianceNormal')}</div>
                        <div>{t('varianceLenient')}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <input
                  type="number"
                  value={config.varianceThreshold}
                  onChange={(e) => setConfig({ ...config, varianceThreshold: parseFloat(e.target.value) || 0.3 })}
                  step={0.1}
                  min={0.1}
                  max={1}
                  className="glass-input w-full px-2 py-1.5 rounded text-sm"
                />
              </div>

              {/* 절벽 임계값 */}
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {t('cliffThreshold')}
                  </label>
                  <div className="group relative">
                    <HelpCircle className="w-3 h-3 cursor-help" style={{ color: 'var(--text-secondary)' }} />
                    <div className="absolute right-0 top-4 z-50 hidden group-hover:block w-56 glass-panel p-2 rounded-lg text-sm shadow-lg" style={{ color: 'var(--text-secondary)' }}>
                      <div className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>{t('cliffTooltipTitle')}</div>
                      {t('cliffTooltipDesc')}
                      <div className="mt-1.5 space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
                        <div>{t('cliffStrict')}</div>
                        <div>{t('cliffNormal')}</div>
                        <div>{t('cliffLenient')}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <input
                  type="number"
                  value={config.cliffThreshold}
                  onChange={(e) => setConfig({ ...config, cliffThreshold: parseFloat(e.target.value) || 2 })}
                  step={0.5}
                  min={1.5}
                  max={5}
                  className="glass-input w-full px-2 py-1.5 rounded text-sm"
                />
              </div>
            </div>

            {/* 추천 설정 안내 */}
            <div className="glass-section p-2 rounded-lg text-sm" style={{ background: `${PANEL_COLOR}10`, borderLeft: `3px solid ${PANEL_COLOR}` }}>
              <div className="flex items-center gap-1.5 mb-1">
                <Info className="w-3 h-3" style={{ color: PANEL_COLOR }} />
                <span className="font-medium" style={{ color: PANEL_COLOR }}>{t('recommendedSettings')}</span>
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>{t('recommendedSettingsDesc')}</div>
            </div>
          </div>
        )}

        {/* 분석 버튼 */}
        <button
          onClick={runAnalysis}
          disabled={!selectedSheet || isAnalyzing}
          className="glass-button-primary w-full py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
          style={{
            background: isAnalyzing ? 'var(--bg-tertiary)' : PANEL_COLOR,
            color: isAnalyzing ? 'var(--text-secondary)' : 'white'
          }}
        >
          {isAnalyzing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              {t('analyzing')}
            </>
          ) : (
            <>
              <AlertTriangle className="w-4 h-4" />
              {t('runAnalysis')}
            </>
          )}
        </button>

        {/* 분석 결과 */}
        {hasAnalyzed && (
          <>
            {/* 요약 */}
            <div className="glass-card p-4 rounded-lg">
              {issues.length === 0 ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(34, 197, 94, 0.2)' }}>
                    <CheckCircle className="w-5 h-5" style={{ color: 'rgb(34, 197, 94)' }} />
                  </div>
                  <div>
                    <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{t('noIssues')}</div>
                    <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('noIssuesDesc')}</div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {t('issuesFound', { count: issues.length })}
                  </div>

                  <div className="glass-tabs flex gap-2 p-1 rounded-lg">
                    <button
                      onClick={() => setFilterSeverity('all')}
                      className="glass-button px-3 py-1.5 rounded-lg text-sm font-medium"
                      style={{
                        background: filterSeverity === 'all' ? 'var(--accent)' : 'transparent',
                        color: filterSeverity === 'all' ? 'white' : 'var(--text-secondary)'
                      }}
                    >
                      {t('all')} ({issues.length})
                    </button>
                    {severityCounts.critical > 0 && (
                      <button
                        onClick={() => setFilterSeverity('critical')}
                        className="glass-button px-3 py-1.5 rounded-lg text-sm font-medium"
                        style={{
                          background: filterSeverity === 'critical' ? '#e86161' : 'transparent',
                          color: filterSeverity === 'critical' ? 'white' : '#e86161'
                        }}
                      >
                        {t('critical')} ({severityCounts.critical})
                      </button>
                    )}
                    {severityCounts.warning > 0 && (
                      <button
                        onClick={() => setFilterSeverity('warning')}
                        className="glass-button px-3 py-1.5 rounded-lg text-sm font-medium"
                        style={{
                          background: filterSeverity === 'warning' ? PANEL_COLOR : 'transparent',
                          color: filterSeverity === 'warning' ? 'white' : PANEL_COLOR
                        }}
                      >
                        {t('warning')} ({severityCounts.warning})
                      </button>
                    )}
                    {severityCounts.info > 0 && (
                      <button
                        onClick={() => setFilterSeverity('info')}
                        className="glass-button px-3 py-1.5 rounded-lg text-sm font-medium"
                        style={{
                          background: filterSeverity === 'info' ? '#5a9cf5' : 'transparent',
                          color: filterSeverity === 'info' ? 'white' : '#5a9cf5'
                        }}
                      >
                        {t('info')} ({severityCounts.info})
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* AI 밸런스 리뷰 (템플릿) */}
            {aiReview && (
              <div
                className="rounded-lg border-2 overflow-hidden"
                style={{
                  borderColor: aiReview.metrics.critical > 0 ? '#ef4444' : aiReview.metrics.score >= 80 ? '#10b981' : '#f59e0b',
                  background: 'var(--bg-secondary)',
                }}
              >
                <button
                  onClick={() => setShowAiReview((v) => !v)}
                  className="w-full px-3 py-2 flex items-center gap-2 hover:bg-[var(--bg-tertiary)]"
                >
                  <Sparkles size={14} style={{ color: 'var(--accent)' }} />
                  <span className="text-sm font-semibold flex-1 text-left" style={{ color: 'var(--text-primary)' }}>
                    {t('aiReview')}
                  </span>
                  <span className="text-caption px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
                    {t('scoreOf', { score: aiReview.metrics.score })}
                  </span>
                  {showAiReview ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {showAiReview && (
                  <div className="px-3 pb-3 space-y-3 text-xs" style={{ color: 'var(--text-primary)' }}>
                    <div className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                      {aiReview.headline}
                    </div>
                    <p style={{ color: 'var(--text-secondary)' }}>{aiReview.summary}</p>

                    {aiReview.sections.map((sec) => (
                      <div key={sec.severity}>
                        <div className="font-semibold mb-1">{sec.title}</div>
                        <div className="whitespace-pre-line text-caption" style={{ color: 'var(--text-secondary)' }}>
                          {sec.body}
                        </div>
                      </div>
                    ))}

                    {aiReview.actionable.length > 0 && (
                      <div>
                        <div className="font-semibold mb-1">{t('actionableTop', { n: aiReview.actionable.length })}</div>
                        <ol className="list-decimal pl-5 space-y-0.5 text-caption" style={{ color: 'var(--text-secondary)' }}>
                          {aiReview.actionable.map((a, i) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    <p className="text-caption italic pt-1 border-t" style={{ color: 'var(--text-tertiary)', borderColor: 'var(--border-primary)' }}>
                      {t('aiReviewNote')}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 이슈 목록 */}
            {filteredIssues.length > 0 && (
              <div className="space-y-2">
                {filteredIssues.map(issue => {
                  const Icon = TYPE_ICONS[issue.type] || AlertCircle;
                  const isExpanded = expandedIssues.has(issue.id);
                  const color = getSeverityColor(issue.severity);

                  return (
                    <div
                      key={issue.id}
                      className="glass-card rounded-lg overflow-hidden"
                      style={{
                        borderLeft: `4px solid ${color}`,
                      }}
                    >
                      <button
                        onClick={() => toggleIssue(issue.id)}
                        className="w-full flex items-center gap-3 p-3 text-left"
                        style={{ background: `${color}08` }}
                      >
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: `${color}20` }}
                        >
                          <Icon className="w-4 h-4" style={{ color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div
                            className={`text-sm font-medium ${isExpanded ? '' : 'truncate'}`}
                            style={{ color: 'var(--text-primary)' }}
                            title={issue.title}
                          >
                            {issue.title}
                          </div>
                          <div className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
                            {t('rowsAffected', { count: issue.affectedRows.length })}
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
                        ) : (
                          <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="p-3 space-y-3">
                          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            {issue.description}
                          </div>

                          {issue.suggestion && (
                            <div className="glass-section p-2 rounded-lg text-sm" style={{ borderLeft: `3px solid ${color}` }}>
                              <div className="flex items-center gap-1 mb-1">
                                <Info className="w-3 h-3" style={{ color }} />
                                <span className="font-medium" style={{ color }}>{t('suggestion')}</span>
                              </div>
                              <div style={{ color: 'var(--text-secondary)' }}>{issue.suggestion}</div>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-1">
                            {issue.affectedColumns.map(colId => {
                              const col = selectedSheet?.columns.find(c => c.id === colId);
                              return (
                                <span
                                  key={colId}
                                  className="glass-badge px-2 py-0.5 rounded text-sm"
                                >
                                  {col?.name || colId}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* 시트가 없을 때 */}
        {!selectedSheet && (
          <div className="glass-card text-center py-8 rounded-lg">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--text-secondary)' }} />
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('selectSheet')}
            </p>
          </div>
        )}
      </>
    </PanelShell>
  );
}
