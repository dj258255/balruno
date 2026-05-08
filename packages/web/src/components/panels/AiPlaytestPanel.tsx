/**
 * AI Playtest 패널 — 배치 시뮬 + imbalance 자동 탐지 리포트.
 */

import { useState } from 'react';
import { TestTube, Play, AlertTriangle, CheckCircle, XCircle, Info, Sparkles } from 'lucide-react';
import PanelShell from '@/components/ui/PanelShell';
import {
  runPlaytest,
  defaultPlaytestScenarios,
  type PlaytestReport,
  type IssueSeverity,
  type PlaytestDomain,
} from '@/lib/aiPlaytest';
import { useTranslations } from 'next-intl';

interface Props {
  onClose: () => void;
}

const SEVERITY_COLOR: Record<IssueSeverity, string> = {
  ok: '#10b981',
  warn: '#f59e0b',
  critical: '#ef4444',
};

const SEVERITY_ICON: Record<IssueSeverity, typeof AlertTriangle> = {
  ok: CheckCircle,
  warn: AlertTriangle,
  critical: XCircle,
};

const DOMAIN_LABEL: Record<PlaytestDomain, string> = {
  unit: 'aiPlaytest.unit',
  fps: 'FPS',
  deck: 'aiPlaytest.deck',
  moba: 'MOBA',
  'mmo-raid': 'aiPlaytest.mmoRaid',
  'auto-battler': 'aiPlaytest.autoBattler',
  horde: 'aiPlaytest.horde',
};

export default function AiPlaytestPanel({ onClose }: Props) {
  const t = useTranslations();
  const [report, setReport] = useState<PlaytestReport | null>(null);
  const [running, setRunning] = useState(false);

  const handleRun = async () => {
    setRunning(true);
    try {
      const r = await runPlaytest(defaultPlaytestScenarios());
      setReport(r);
    } finally {
      setRunning(false);
    }
  };

  return (
    <PanelShell
      title="AI Playtest"
      subtitle={t('aiPlaytest.subtitleHeader')}
      icon={TestTube}
      iconColor="#10b981"
      onClose={onClose}
      bodyClassName="p-3 space-y-3 overflow-y-auto"
    >
      {/* 실행 바 */}
      <div className="p-3 rounded-lg flex items-center gap-3" style={{ background: 'var(--bg-tertiary)' }}>
        <button
          onClick={handleRun}
          disabled={running}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-label font-semibold disabled:opacity-50"
          style={{ background: 'var(--accent)', color: 'white' }}
        >
          <Play className="w-4 h-4" />
          {running ? t('aiPlaytest.running') : t('aiPlaytest.runPlaytest')}
        </button>
        <div className="flex-1 text-caption" style={{ color: 'var(--text-secondary)' }}>
          {t('aiPlaytest.scenarioBaseline')}
          {t('aiPlaytest.autoDetect')}
        </div>
      </div>

      {!report && !running && (
        <>
          {/* 첫 사용자 — AI Playtest 가 뭐고 왜 쓰는지 */}
          <div className="p-4 rounded-lg space-y-3" style={{ background: 'var(--bg-tertiary)', borderLeft: '3px solid #10b981' }}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#10b98120' }}>
                <Sparkles className="w-4 h-4" style={{ color: '#10b981' }} />
              </div>
              <div className="flex-1">
                <h3 className="text-label font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {t('aiPlaytest.aboutTitle')}
                </h3>
                <p className="text-caption mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {t('aiPlaytest.aboutBody')}
                </p>
              </div>
            </div>
            <ul className="space-y-1 text-caption pl-1" style={{ color: 'var(--text-secondary)' }}>
              <li>{t('aiPlaytest.feat1')}</li>
              <li>{t('aiPlaytest.feat2')}</li>
              <li>{t('aiPlaytest.feat3')}</li>
            </ul>
          </div>

          <div className="p-6 rounded-lg text-center" style={{ background: 'var(--bg-tertiary)' }}>
            <Info className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-label" style={{ color: 'var(--text-secondary)' }}>
              {t('aiPlaytest.pressRun')}
            </p>
            <p className="text-caption mt-1" style={{ color: 'var(--text-tertiary)' }}>
              {t('aiPlaytest.durationNote')}
            </p>
          </div>
        </>
      )}

      {report && (
        <>
          {/* 종합 */}
          <div className="p-4 rounded-lg flex items-center gap-4" style={{
            background: 'var(--bg-tertiary)',
            border: `2px solid ${report.criticalCount > 0 ? '#ef4444' : report.warnCount > 0 ? '#f59e0b' : '#10b981'}`,
          }}>
            <div>
              <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>Overall Score</div>
              <div className="text-4xl font-bold tabular-nums" style={{ color: report.overallScore >= 70 ? '#10b981' : report.overallScore >= 40 ? '#f59e0b' : '#ef4444' }}>
                {report.overallScore}
              </div>
              <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>/100</div>
            </div>
            <div className="flex-1 grid grid-cols-3 gap-2">
              <Metric label="Critical" value={report.criticalCount} color="#ef4444" />
              <Metric label="Warn" value={report.warnCount} color="#f59e0b" />
              <Metric label={t('aiPlaytest.totalScenarios')} value={report.scenarios.length} color="#3b82f6" />
            </div>
            <div className="text-caption tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
              {(report.durationMs / 1000).toFixed(1)}s
            </div>
          </div>

          {/* 도메인 health */}
          <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
            <div className="text-label font-medium mb-2" style={{ color: 'var(--text-primary)' }}>{t('aiPlaytest.domainHealth')}</div>
            <div className="grid grid-cols-7 gap-1">
              {(Object.entries(report.domainHealth) as [PlaytestDomain, IssueSeverity][]).map(([domain, severity]) => {
                const Icon = SEVERITY_ICON[severity];
                const color = SEVERITY_COLOR[severity];
                return (
                  <div
                    key={domain}
                    className="flex flex-col items-center gap-1 p-2 rounded"
                    style={{ background: `${color}20`, border: `1px solid ${color}` }}
                  >
                    <Icon className="w-4 h-4" style={{ color }} />
                    <span className="text-caption font-medium text-center" style={{ color }}>
                      {DOMAIN_LABEL[domain]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Issue 리스트 */}
          {(report.criticalCount + report.warnCount > 0) && (
            <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
              <div className="text-label font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                {t('aiPlaytest.foundIssues', { n: report.criticalCount + report.warnCount })}
              </div>
              <div className="space-y-1">
                {report.scenarios.flatMap((s) => s.issues).map((issue, idx) => {
                  const color = SEVERITY_COLOR[issue.severity];
                  const Icon = SEVERITY_ICON[issue.severity];
                  return (
                    <div
                      key={idx}
                      className="p-2 rounded"
                      style={{ background: 'var(--bg-primary)', borderLeft: `3px solid ${color}` }}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 shrink-0" style={{ color }} />
                        <span className="font-semibold text-label" style={{ color }}>{issue.metricLabel}</span>
                        <span className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
                          · {issue.scenarioName}
                        </span>
                        <span className="ml-auto text-caption tabular-nums font-mono" style={{ color: 'var(--text-primary)' }}>
                          {t('aiPlaytest.observed')} <span style={{ color }}>{issue.observedValue.toFixed(3)}</span>
                          {' '}
                          vs [{issue.expectedRange[0]}, {issue.expectedRange[1]}]
                        </span>
                      </div>
                      {issue.recommendation && (
                        <p className="text-caption mt-1 ml-6" style={{ color: 'var(--text-secondary)' }}>
                          → {issue.recommendation}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 시나리오별 상세 */}
          <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
            <div className="text-label font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
              {t('aiPlaytest.scenarioResults')}
            </div>
            <div className="space-y-2">
              {report.scenarios.map((s) => {
                const worstSeverity: IssueSeverity =
                  s.issues.some((i) => i.severity === 'critical') ? 'critical'
                  : s.issues.some((i) => i.severity === 'warn') ? 'warn'
                  : 'ok';
                const color = SEVERITY_COLOR[worstSeverity];
                const Icon = SEVERITY_ICON[worstSeverity];
                return (
                  <details key={s.scenarioId} className="rounded border" style={{ background: 'var(--bg-primary)', borderColor: color }}>
                    <summary className="p-2 cursor-pointer flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5" style={{ color }} />
                      <span className="text-label font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {s.scenarioName}
                      </span>
                      <span className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
                        [{DOMAIN_LABEL[s.domain]}]
                      </span>
                      <span className="ml-auto text-caption tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                        {s.runCount} runs · {s.durationMs}ms · {s.issues.length} issue
                      </span>
                    </summary>
                    <div className="p-2 pt-0">
                      <table className="w-full text-caption">
                        <thead>
                          <tr style={{ color: 'var(--text-tertiary)' }}>
                            <th className="text-left">Metric</th>
                            <th className="text-right">avg</th>
                            <th className="text-right">min</th>
                            <th className="text-right">max</th>
                            <th className="text-right">stdev</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(s.metrics).map(([k, m]) => (
                            <tr key={k} style={{ borderTop: '1px solid var(--border-primary)' }}>
                              <td className="py-0.5">{k}</td>
                              <td className="text-right tabular-nums">{m.avg.toFixed(3)}</td>
                              <td className="text-right tabular-nums">{m.min.toFixed(3)}</td>
                              <td className="text-right tabular-nums">{m.max.toFixed(3)}</td>
                              <td className="text-right tabular-nums">{m.stdev.toFixed(3)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                );
              })}
            </div>
          </div>
        </>
      )}

      <p className="text-caption italic" style={{ color: 'var(--text-tertiary)' }}>
        {t('aiPlaytest.validatorNote')}
      </p>
    </PanelShell>
  );
}

function Metric({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="p-2 rounded" style={{ background: 'var(--bg-primary)' }}>
      <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>{label}</div>
      <div className="text-xl font-bold tabular-nums" style={{ color }}>{value}</div>
    </div>
  );
}
