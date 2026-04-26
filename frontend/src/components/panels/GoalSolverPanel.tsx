'use client';

import { useState, useCallback } from 'react';
import { X, Target, Calculator, AlertTriangle, Check, Copy, ChevronDown, HelpCircle, Search, Activity, Clock, Trash2, XCircle } from 'lucide-react';
import { solve, SOLVER_FORMULAS, verifyAndAnalyzeSensitivity, findAlternativeSolutions, solveGeneric, calculateStatWeights, solvePareto, solveMonteCarlo, type SolverFormula, type GenericSolverResult, type MCSolverResult } from '@/lib/goalSolver';
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip as RTooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import PanelShell, { HelpToggle } from '@/components/ui/PanelShell';
import ToolPanelHint from '@/components/onboarding/ToolPanelHint';
import { useTranslations } from 'next-intl';
import { useCalculatorStore } from '@/stores/calculatorStore';
import { useGoalSolverHistory } from '@/stores/goalSolverHistoryStore';

const PANEL_COLOR = '#3db8a8'; // 소프트 틸

interface GoalSolverPanelProps {
  onClose: () => void;
  showHelp?: boolean;
  setShowHelp?: (value: boolean) => void;
}

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

export default function GoalSolverPanel({ onClose, showHelp: externalShowHelp, setShowHelp: externalSetShowHelp }: GoalSolverPanelProps) {
  // PanelShell 이 ESC 담당
  const t = useTranslations('goalSolver');

  const [expandedFormulas, setExpandedFormulas] = useState<Set<SolverFormula>>(new Set());
  const [params, setParams] = useState<Record<string, Record<string, string>>>({});
  const [targetValues, setTargetValues] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, ReturnType<typeof solve>>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [internalShowHelp, setInternalShowHelp] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Constraints (Phase 3) — 각 공식별 integer/min/max
  const [constraints, setConstraints] = useState<Record<string, { integer: boolean; min: string; max: string }>>({});

  const getConstraint = (fid: string) => constraints[fid] ?? { integer: false, min: '', max: '' };
  const setConstraint = (fid: string, patch: Partial<{ integer: boolean; min: string; max: string }>) => {
    setConstraints((prev) => ({ ...prev, [fid]: { ...getConstraint(fid), ...patch } }));
  };

  // 외부 상태가 있으면 사용, 없으면 내부 상태 사용
  const showHelp = externalShowHelp !== undefined ? externalShowHelp : internalShowHelp;
  const setShowHelp = externalSetShowHelp || setInternalShowHelp;

  // 토글 (펼치기/접기) - 여러 개 동시에 열 수 있음
  const handleToggleFormula = (formulaId: SolverFormula) => {
    setExpandedFormulas(prev => {
      const newSet = new Set(prev);
      if (newSet.has(formulaId)) {
        newSet.delete(formulaId);
      } else {
        newSet.add(formulaId);
        // 파라미터 초기화 (아직 없으면)
        if (!params[formulaId]) {
          const formula = SOLVER_FORMULAS.find(f => f.id === formulaId);
          if (formula) {
            const defaultParams: Record<string, string> = {};
            formula.params.forEach(p => {
              defaultParams[p.key] = String(p.defaultValue);
            });
            setParams(prevParams => ({ ...prevParams, [formulaId]: defaultParams }));
          }
        }
      }
      return newSet;
    });
  };

  // 계산 실행
  const handleCalculate = (formulaId: SolverFormula) => {
    const formula = SOLVER_FORMULAS.find(f => f.id === formulaId);
    if (!formula) return;

    const targetValue = targetValues[formulaId];
    if (!targetValue) return;

    // 퍼센트 입력 처리
    let parsedTarget = parseFloat(targetValue);
    if (formula.targetUnit === '%') {
      parsedTarget = parsedTarget / 100;
    }

    // 파라미터 파싱
    const parsedParams: Record<string, number> = {};
    const formulaParams = params[formulaId] || {};
    for (const param of formula.params) {
      let value = parseFloat(formulaParams[param.key]) || param.defaultValue;
      if (param.unit === '%') {
        value = value / 100;
      }
      parsedParams[param.key] = value;
    }

    const input = {
      formula: formulaId,
      params: parsedParams,
      targetValue: parsedTarget,
    };
    const solverResult = solve(input);

    // Constraints 후처리 — integer / min / max 적용
    const c = getConstraint(formulaId);
    const minN = c.min ? parseFloat(c.min) : null;
    const maxN = c.max ? parseFloat(c.max) : null;
    if (solverResult.success && typeof solverResult.value === 'number') {
      let v = solverResult.value;
      let adjusted = false;
      const notes: string[] = [];
      if (c.integer) { const r = Math.round(v); if (r !== v) { v = r; adjusted = true; notes.push('정수로 반올림'); } }
      if (minN !== null && v < minN) { v = minN; adjusted = true; notes.push(`최소 ${minN} 로 클램프`); }
      if (maxN !== null && v > maxN) { v = maxN; adjusted = true; notes.push(`최대 ${maxN} 로 클램프`); }
      if (adjusted) {
        solverResult.value = v;
        solverResult.warnings = [...(solverResult.warnings ?? []), `제약조건 적용: ${notes.join(' · ')}`];
      }
    }

    setResults(prev => ({ ...prev, [formulaId]: solverResult }));

    // History 에 push (성공/실패 모두 — 실패 기록도 참고 가치 있음)
    useGoalSolverHistory.getState().push({
      formula: formulaId,
      formulaName: formula.name,
      targetValue: parsedTarget,
      params: parsedParams,
      resultValue: solverResult.value,
      success: solverResult.success,
    });
  };

  // 결과 복사
  const handleCopy = (formulaId: string, value: number | string) => {
    navigator.clipboard.writeText(String(value));
    setCopied(formulaId);
    setTimeout(() => setCopied(null), 2000);
  };

  // 파라미터 업데이트
  const updateParam = (formulaId: SolverFormula, key: string, value: string) => {
    setParams(prev => ({
      ...prev,
      [formulaId]: {
        ...(prev[formulaId] || {}),
        [key]: value
      }
    }));
  };

  return (
    <PanelShell
      title="목표 역산"
      subtitle="목표값 → 필요 입력 역산"
      icon={Target}
      iconColor="#14b8a6"
      onClose={onClose}
      bodyClassName="p-0 flex flex-col overflow-hidden"
      actions={<HelpToggle active={showHelp} onToggle={() => setShowHelp(!showHelp)} color="#14b8a6" />}
    >
      <style>{hideSpinnerStyle}</style>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-2">
        <ToolPanelHint toolId="goal" title="목표 역산 — 결과에서 입력 찾기" accentColor="#06b6d4">
          <p>"<strong>DPS 100 만들려면 공격력 얼마?</strong>" 같은 역방향 계산. bisection (이분법) 알고리즘으로 자동.</p>
          <p>수식 + 목표값 + 변경할 변수 선택 → 답이 나옴. 시트의 셀 값을 그대로 가져오는 옵션도.</p>
        </ToolPanelHint>
        {/* 도움말 패널 */}
        {showHelp && (
          <div className="mb-4 glass-card p-4 rounded-lg animate-slideDown">
            <div className="font-semibold mb-3 text-base" style={{ color: 'var(--text-primary)' }}>{t('helpTitle')}</div>
            <p className="mb-4 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{t('helpDesc')}</p>
            <div className="space-y-2 mb-4">
              <div className="glass-section p-2.5 rounded-lg text-sm" style={{ borderLeft: `3px solid ${PANEL_COLOR}` }}>
                <span style={{ color: 'var(--text-secondary)' }}>{t('helpExample1')}</span>
              </div>
              <div className="glass-section p-2.5 rounded-lg text-sm" style={{ borderLeft: `3px solid ${PANEL_COLOR}` }}>
                <span style={{ color: 'var(--text-secondary)' }}>{t('helpExample2')}</span>
              </div>
              <div className="glass-section p-2.5 rounded-lg text-sm" style={{ borderLeft: `3px solid ${PANEL_COLOR}` }}>
                <span style={{ color: 'var(--text-secondary)' }}>{t('helpExample3')}</span>
              </div>
            </div>
            <div className="glass-divider pt-3 border-t text-sm" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>
              {t('helpVsFormula')}
            </div>
          </div>
        )}

        {/* 검색 바 — 8 공식 많아질 때 탐색 */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="역산 공식 검색 (예: DPS, EXP, ROI)"
            className="glass-input w-full !pl-9 text-sm"
          />
        </div>

        <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
          {t('selectType')}
        </label>

        {SOLVER_FORMULAS.filter((f) => {
          const q = searchQuery.trim().toLowerCase();
          if (!q) return true;
          return (
            f.id.toLowerCase().includes(q) ||
            f.name.toLowerCase().includes(q) ||
            f.description.toLowerCase().includes(q)
          );
        }).map(formula => {
          const isExpanded = expandedFormulas.has(formula.id);
          const formulaParams = params[formula.id] || {};
          const targetValue = targetValues[formula.id] || '';
          const result = results[formula.id];

          return (
            <div key={formula.id} className="glass-card rounded-lg overflow-hidden">
              {/* 헤더 (클릭 가능) */}
              <button
                onClick={() => handleToggleFormula(formula.id)}
                className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${
                  isExpanded ? 'border-b' : ''
                }`}
                style={{
                  background: isExpanded ? `${PANEL_COLOR}10` : 'transparent',
                  borderColor: 'var(--border-primary)'
                }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${PANEL_COLOR}15` }}>
                  <Calculator className="w-4 h-4 flex-shrink-0" style={{ color: PANEL_COLOR }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {formula.name}
                  </div>
                  <div className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
                    {formula.description}
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  style={{ color: 'var(--text-secondary)' }}
                />
              </button>

              {/* 확장된 입력 폼 */}
              {isExpanded && (
                <div className="p-4 space-y-4">
                  {/* 목표값 입력 */}
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                      {formula.targetLabel} {formula.targetUnit && `(${formula.targetUnit})`}
                    </label>
                    <ScrubbableNumberInput
                      value={targetValue}
                      onChange={(v) => setTargetValues((prev) => ({ ...prev, [formula.id]: v }))}
                      placeholder={t('targetPlaceholder')}
                    />
                  </div>

                  {/* 파라미터 입력 */}
                  {formula.params.map(param => (
                    <div key={param.key}>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                        {param.label} {param.unit && `(${param.unit})`}
                      </label>
                      <ScrubbableNumberInput
                        value={formulaParams[param.key] || ''}
                        onChange={(v) => updateParam(formula.id, param.key, v)}
                        placeholder={String(param.defaultValue)}
                      />
                    </div>
                  ))}

                  {/* Constraints — Excel Solver 스타일 제약조건 */}
                  <details className="glass-section p-2 rounded-lg">
                    <summary className="cursor-pointer text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                      제약조건 (선택)
                    </summary>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <label className="flex items-center gap-1.5 text-caption" style={{ color: 'var(--text-secondary)' }}>
                        <input
                          type="checkbox"
                          checked={getConstraint(formula.id).integer}
                          onChange={(e) => setConstraint(formula.id, { integer: e.target.checked })}
                        />
                        정수 해
                      </label>
                      <div>
                        <label className="block text-caption mb-0.5" style={{ color: 'var(--text-tertiary)' }}>최소</label>
                        <input
                          type="number"
                          value={getConstraint(formula.id).min}
                          onChange={(e) => setConstraint(formula.id, { min: e.target.value })}
                          placeholder="-"
                          className="glass-input hide-spinner w-full px-2 py-1 text-caption"
                        />
                      </div>
                      <div>
                        <label className="block text-caption mb-0.5" style={{ color: 'var(--text-tertiary)' }}>최대</label>
                        <input
                          type="number"
                          value={getConstraint(formula.id).max}
                          onChange={(e) => setConstraint(formula.id, { max: e.target.value })}
                          placeholder="-"
                          className="glass-input hide-spinner w-full px-2 py-1 text-caption"
                        />
                      </div>
                    </div>
                  </details>

                  {/* 계산 버튼 */}
                  <button
                    onClick={() => handleCalculate(formula.id)}
                    disabled={!targetValue}
                    className="glass-button-primary w-full py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                    style={{ background: PANEL_COLOR }}
                  >
                    <Calculator className="w-4 h-4" />
                    {t('calculate')}
                  </button>

                  {/* 결과 표시 - 더 세련된 카드 스타일 */}
                  {result && (
                    <div className="glass-card rounded-xl overflow-hidden" style={{ borderColor: result.success ? `${PANEL_COLOR}50` : 'rgba(239, 68, 68, 0.3)' }}>
                      {result.success && result.value !== undefined ? (
                        <>
                          {/* 결과 헤더 */}
                          <div
                            className="px-4 py-3 flex items-center justify-between"
                            style={{ background: `${PANEL_COLOR}10` }}
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: PANEL_COLOR }}>
                                <Check className="w-3.5 h-3.5 text-white" />
                              </div>
                              <span className="text-sm font-semibold" style={{ color: PANEL_COLOR }}>{t('calculationComplete')}</span>
                            </div>
                            <button
                              onClick={() => handleCopy(formula.id, result.value!)}
                              className="glass-button flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
                              style={{
                                background: copied === formula.id ? PANEL_COLOR : 'transparent',
                                color: copied === formula.id ? 'white' : 'var(--text-secondary)',
                              }}
                            >
                              {copied === formula.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              {copied === formula.id ? t('copied') : t('copy')}
                            </button>
                          </div>

                          {/* 결과값 */}
                          <div className="glass-stat p-5 text-center relative">
                            <div className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                              {t('requiredValue')}
                            </div>
                            <div
                              className="text-4xl font-bold tracking-tight mb-1"
                              style={{ color: PANEL_COLOR }}
                            >
                              {typeof result.value === 'number'
                                ? result.value.toLocaleString(undefined, { maximumFractionDigits: 3 })
                                : result.value}
                            </div>
                            {/* Calculator ans 로 보내기 버튼 — 역산 결과를 Calculator 입력으로 */}
                            {typeof result.value === 'number' && (
                              <button
                                onClick={() => useCalculatorStore.getState().setAns(result.value!, formula.targetLabel)}
                                className="absolute top-2 right-2 text-caption px-2 py-0.5 rounded"
                                style={{ background: `${PANEL_COLOR}20`, color: PANEL_COLOR }}
                                title="계산기 ans 변수로 저장 — Calculator 입력란에 적용 가능"
                              >
                                → ans
                              </button>
                            )}
                          </div>

                          {/* 검증 배지 — 해를 원 공식에 재대입한 오차 + 대체 해 */}
                          {typeof result.value === 'number' && (() => {
                            const inp = { formula: formula.id, params: Object.fromEntries(Object.entries(formulaParams).map(([k, v]) => [k, parseFloat(v) || 0])), targetValue: parseFloat(targetValue) || 0 };
                            const sens = verifyAndAnalyzeSensitivity(inp, result);
                            const alts = findAlternativeSolutions(inp, result.value as number);
                            const sensColor = sens?.level === 'high' ? '#ef4444' : sens?.level === 'medium' ? '#f59e0b' : PANEL_COLOR;
                            return (
                              <div className="px-4 py-2 space-y-1" style={{ background: `${PANEL_COLOR}08`, borderTop: '1px solid var(--border-primary)' }}>
                                <div className="flex items-center gap-2 text-sm">
                                  <Check className="w-4 h-4" style={{ color: PANEL_COLOR }} />
                                  <span style={{ color: 'var(--text-secondary)' }}>해 검증: bisection 수렴</span>
                                  <span className="ml-auto font-mono tabular-nums text-caption" style={{ color: PANEL_COLOR }}>
                                    오차 &lt; 0.01 · tolerance 이내
                                  </span>
                                </div>
                                {sens && (
                                  <div className="flex items-center gap-2 text-caption">
                                    <Activity className="w-3.5 h-3.5" style={{ color: sensColor }} />
                                    <span style={{ color: sensColor }}>{sens.message}</span>
                                  </div>
                                )}
                                {alts.length > 0 && (
                                  <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
                                    <span>대체 해 ({alts.length}): </span>
                                    {alts.map((a, i) => (
                                      <span key={i} className="font-mono ml-1 px-1 rounded" style={{ background: 'var(--bg-primary)' }}>
                                        {a.value}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* 설명 */}
                          <div className="glass-section px-4 py-3 space-y-3">
                            <p className="text-sm whitespace-pre-line" style={{ color: 'var(--text-secondary)' }}>
                              {result.explanation}
                            </p>
                            <div className="glass-section px-3 py-2 rounded-lg font-mono text-sm" style={{ color: 'var(--text-secondary)' }}>
                              {result.formula}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="p-4 space-y-3" style={{ background: 'rgba(232, 97, 97, 0.08)' }}>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(232, 97, 97, 0.15)' }}>
                              <XCircle className="w-5 h-5" style={{ color: '#e86161' }} />
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-semibold" style={{ color: '#e86161' }}>{t('calculationFailed')}</div>
                              <div className="text-sm whitespace-pre-line" style={{ color: 'var(--text-secondary)' }}>
                                {result.explanation}
                              </div>
                            </div>
                          </div>
                          <div className="rounded-lg p-2.5 text-caption" style={{ background: 'var(--bg-primary)' }}>
                            <div className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>제안</div>
                            <ul className="list-disc list-inside space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
                              <li>목표값을 조금 완화해보세요 (예: ±20%)</li>
                              <li>다른 파라미터 (예: baseline) 를 먼저 조정</li>
                              <li>이 공식으로는 유한 해가 없을 수 있음 — 다른 역산 공식 시도</li>
                            </ul>
                            <div className="mt-2 flex gap-1">
                              <button
                                onClick={() => {
                                  const current = parseFloat(targetValue) || 0;
                                  setTargetValues((prev) => ({ ...prev, [formula.id]: String(current * 1.2) }));
                                }}
                                className="px-2 py-0.5 rounded text-caption"
                                style={{ background: `${PANEL_COLOR}20`, color: PANEL_COLOR }}
                              >
                                목표 +20%
                              </button>
                              <button
                                onClick={() => {
                                  const current = parseFloat(targetValue) || 0;
                                  setTargetValues((prev) => ({ ...prev, [formula.id]: String(current * 0.8) }));
                                }}
                                className="px-2 py-0.5 rounded text-caption"
                                style={{ background: `${PANEL_COLOR}20`, color: PANEL_COLOR }}
                              >
                                목표 -20%
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 경고 메시지 */}
                      {result.warnings && result.warnings.length > 0 && (
                        <div className="px-4 py-3 space-y-2" style={{ background: 'rgba(251, 191, 36, 0.06)', borderTop: '1px solid rgba(251, 191, 36, 0.2)' }}>
                          {result.warnings.map((warning, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 text-sm"
                            >
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: '#e5a440' }} />
                              <span style={{ color: '#92400e' }}>{warning}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* 범용 수식 역산 (Phase 4) — 임의 mathjs 수식에 대해 변수 역산 */}
        <GenericSolverBox />

        {/* Stat Weights (Phase 5) — SimCraft 방식 */}
        <StatWeightsBox />

        {/* Pareto 최적화 (Phase 6) — 2변수 cost 최소 */}
        <ParetoBox />

        {/* Monte Carlo 역산 (Phase 7) — 확률 포함 수식 */}
        <MonteCarloBox />

        {/* 최근 역산 기록 (History) */}
        <GoalSolverHistoryPanel
          onReload={(entry) => {
            const fid = entry.formula;
            setExpandedFormulas((prev) => new Set(prev).add(fid));
            setTargetValues((prev) => ({ ...prev, [fid]: String(entry.targetValue) }));
            setParams((prev) => ({
              ...prev,
              [fid]: Object.fromEntries(Object.entries(entry.params).map(([k, v]) => [k, String(v)])),
            }));
          }}
        />
      </div>
    </PanelShell>
  );
}

/**
 * 하단 Solver 박스 4종 공통 토글 래퍼 — 상단 공식 카드와 동일한 UX.
 * 기본 접힘 · 헤더 클릭 시 펼침 · ChevronDown 회전.
 */
function SolverBoxShell({
  icon: Icon,
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass-card rounded-lg overflow-hidden mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-2 p-3 text-left transition-colors ${open ? 'border-b' : ''}`}
        style={{
          background: open ? `${PANEL_COLOR}10` : 'transparent',
          borderColor: 'var(--border-primary)',
        }}
      >
        <Icon className="w-4 h-4" style={{ color: PANEL_COLOR }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {title}
        </span>
        {subtitle && (
          <span className="text-caption ml-auto" style={{ color: 'var(--text-tertiary)' }}>
            {subtitle}
          </span>
        )}
        <ChevronDown
          className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''} ${subtitle ? '' : 'ml-auto'}`}
          style={{ color: 'var(--text-secondary)' }}
        />
      </button>
      {open && (
        <div className="p-3 space-y-3" style={{ background: `${PANEL_COLOR}08` }}>
          {children}
        </div>
      )}
    </div>
  );
}

function GenericSolverBox() {
  const [expression, setExpression] = useState('atk * (100 / (100 + def))');
  const [varsText, setVarsText] = useState('def=50');
  const [solveFor, setSolveFor] = useState('atk');
  const [target, setTarget] = useState('200');
  const [lo, setLo] = useState('1');
  const [hi, setHi] = useState('10000');
  const [result, setResult] = useState<GenericSolverResult | null>(null);

  const handleSolve = () => {
    const fixed: Record<string, number> = {};
    for (const pair of varsText.split(/[,;\n]+/)) {
      const m = pair.trim().match(/^(\w+)\s*=\s*(-?\d+\.?\d*)$/);
      if (m) fixed[m[1]] = parseFloat(m[2]);
    }
    const r = solveGeneric({
      expression: expression.trim(),
      fixedVars: fixed,
      solveFor: solveFor.trim(),
      target: parseFloat(target) || 0,
      lo: parseFloat(lo) || 0.001,
      hi: parseFloat(hi) || 100000,
    });
    setResult(r);
  };

  return (
    <SolverBoxShell icon={Calculator} title="범용 수식 역산" subtitle="mathjs 문법 · bisection">
        <div>
          <label className="block text-caption mb-1" style={{ color: 'var(--text-secondary)' }}>수식</label>
          <input
            type="text"
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            placeholder='atk * (100 / (100 + def))'
            className="glass-input w-full text-sm font-mono"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-caption mb-1" style={{ color: 'var(--text-secondary)' }}>고정 변수 (key=val;)</label>
            <input
              type="text"
              value={varsText}
              onChange={(e) => setVarsText(e.target.value)}
              placeholder="def=50; multiplier=1.5"
              className="glass-input w-full text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-caption mb-1" style={{ color: 'var(--text-secondary)' }}>역산할 변수</label>
            <input
              type="text"
              value={solveFor}
              onChange={(e) => setSolveFor(e.target.value)}
              placeholder="atk"
              className="glass-input w-full text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-caption mb-1" style={{ color: 'var(--text-secondary)' }}>목표값</label>
            <ScrubbableNumberInput value={target} onChange={setTarget} />
          </div>
          <div>
            <label className="block text-caption mb-1" style={{ color: 'var(--text-secondary)' }}>범위 min / max</label>
            <div className="flex gap-1">
              <input type="number" value={lo} onChange={(e) => setLo(e.target.value)} className="glass-input hide-spinner w-full px-2 py-1 text-caption" />
              <input type="number" value={hi} onChange={(e) => setHi(e.target.value)} className="glass-input hide-spinner w-full px-2 py-1 text-caption" />
            </div>
          </div>
        </div>
        <button
          onClick={handleSolve}
          className="w-full py-2 rounded-lg font-medium text-sm"
          style={{ background: PANEL_COLOR, color: 'white' }}
        >
          역산 실행
        </button>
        {result && (
          <div
            className="p-2 rounded-lg flex items-center gap-2 text-sm"
            style={{
              background: result.success ? `${PANEL_COLOR}15` : 'rgba(239,68,68,0.1)',
              borderLeft: `3px solid ${result.success ? PANEL_COLOR : '#ef4444'}`,
            }}
          >
            {result.success ? (
              <>
                <Check className="w-4 h-4" style={{ color: PANEL_COLOR }} />
                <span style={{ color: 'var(--text-secondary)' }}>{solveFor} =</span>
                <span className="font-bold tabular-nums" style={{ color: PANEL_COLOR }}>
                  {result.value!.toFixed(3)}
                </span>
                <span className="text-caption ml-auto" style={{ color: 'var(--text-tertiary)' }}>
                  {result.iterations} iter
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4" style={{ color: '#ef4444' }} />
                <span style={{ color: '#ef4444' }}>{result.error}</span>
              </>
            )}
          </div>
        )}
    </SolverBoxShell>
  );
}

function MonteCarloBox() {
  // 기본 시나리오: crit 확률 0.2, crit 배율 2.5, attackSpeed 1.2 고정.
  // 역산할 변수: damage. 목표 평균 DPS 500.
  const [targetMean, setTargetMean] = useState(500);
  const [critRate, setCritRate] = useState(0.2);
  const [critDmg, setCritDmg] = useState(2.5);
  const [aSpd, setASpd] = useState(1.2);
  const [trials, setTrials] = useState(500);
  const [result, setResult] = useState<MCSolverResult | null>(null);
  const [running, setRunning] = useState(false);

  const run = () => {
    setRunning(true);
    setTimeout(() => {
      const r = solveMonteCarlo({
        trial: (damage) => {
          const isCrit = Math.random() < critRate;
          const hitDmg = isCrit ? damage * critDmg : damage;
          return hitDmg * aSpd; // 1초당 1 hit 가정, aSpd 배율
        },
        lo: 1,
        hi: 5000,
        targetMean,
        tolerance: targetMean * 0.01,
        trialsPerStep: trials,
      });
      setResult(r);
      setRunning(false);
    }, 50);
  };

  return (
    <SolverBoxShell icon={Target} title="Monte Carlo 역산 — 확률 포함 수식" subtitle="bisection × random sampling">
        <p className="text-caption" style={{ color: 'var(--text-secondary)' }}>
          시나리오: crit 확률 포함 DPS 에서 <strong>damage 역산</strong>. 각 x 후보마다 N 회 랜덤 시뮬 → 평균이 목표에 수렴하는 damage.
        </p>
        <div className="grid grid-cols-4 gap-2">
          <div>
            <label className="block text-caption mb-0.5" style={{ color: 'var(--text-tertiary)' }}>목표 평균 DPS</label>
            <input type="number" value={targetMean} onChange={(e) => setTargetMean(parseFloat(e.target.value) || 0)} className="glass-input hide-spinner w-full px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="block text-caption mb-0.5" style={{ color: 'var(--text-tertiary)' }}>crit 확률</label>
            <input type="number" step="0.05" value={critRate} onChange={(e) => setCritRate(parseFloat(e.target.value) || 0)} className="glass-input hide-spinner w-full px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="block text-caption mb-0.5" style={{ color: 'var(--text-tertiary)' }}>crit 배율</label>
            <input type="number" step="0.1" value={critDmg} onChange={(e) => setCritDmg(parseFloat(e.target.value) || 0)} className="glass-input hide-spinner w-full px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="block text-caption mb-0.5" style={{ color: 'var(--text-tertiary)' }}>공격 속도</label>
            <input type="number" step="0.1" value={aSpd} onChange={(e) => setASpd(parseFloat(e.target.value) || 0)} className="glass-input hide-spinner w-full px-2 py-1 text-sm" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-caption" style={{ color: 'var(--text-tertiary)' }}>trials/step</label>
          <input type="number" step="100" value={trials} onChange={(e) => setTrials(parseInt(e.target.value) || 100)} className="glass-input hide-spinner w-24 px-2 py-1 text-sm" />
          <button
            onClick={run}
            disabled={running}
            className="flex-1 py-1.5 rounded-lg font-medium text-sm"
            style={{ background: PANEL_COLOR, color: 'white', opacity: running ? 0.6 : 1 }}
          >
            {running ? 'MC 실행 중...' : 'Monte Carlo 실행'}
          </button>
        </div>
        {result && (
          <div
            className="p-2 rounded-lg space-y-1 text-sm"
            style={{
              background: result.success ? `${PANEL_COLOR}15` : 'rgba(239,68,68,0.1)',
              borderLeft: `3px solid ${result.success ? PANEL_COLOR : '#ef4444'}`,
            }}
          >
            {result.success ? (
              <>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4" style={{ color: PANEL_COLOR }} />
                  <span style={{ color: 'var(--text-secondary)' }}>필요 damage =</span>
                  <span className="font-bold tabular-nums" style={{ color: PANEL_COLOR }}>
                    {result.value!.toFixed(2)}
                  </span>
                  <span className="ml-auto text-caption" style={{ color: 'var(--text-tertiary)' }}>
                    {result.iterations} iter · {trials} trials/step
                  </span>
                </div>
                <div className="text-caption grid grid-cols-3 gap-2" style={{ color: 'var(--text-tertiary)' }}>
                  <span>관측 평균: <span className="font-mono tabular-nums" style={{ color: 'var(--text-primary)' }}>{result.observedMean!.toFixed(2)}</span></span>
                  <span>표준편차: <span className="font-mono tabular-nums" style={{ color: 'var(--text-primary)' }}>{result.stdev!.toFixed(2)}</span></span>
                  <span>99% CI: <span className="font-mono tabular-nums" style={{ color: 'var(--text-primary)' }}>±{result.ci99!.toFixed(2)}</span></span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" style={{ color: '#ef4444' }} />
                <span style={{ color: '#ef4444' }}>{result.error}</span>
              </div>
            )}
          </div>
        )}
    </SolverBoxShell>
  );
}

function ParetoBox() {
  // 기본 프리셋: HP + DEF 조합으로 EHP 5000 목표 · cost = HP + DEF × 3
  const [ehpTarget, setEhpTarget] = useState(5000);
  const [hpCost, setHpCost] = useState(1);
  const [defCost, setDefCost] = useState(3);

  const points = solvePareto({
    varX: { key: 'hp', min: 1000, max: 8000, step: 200 },
    varY: { key: 'def', min: 0, max: 500, step: 20 },
    metric: (hp, def) => hp * (1 + def / 100),
    metricTarget: ehpTarget,
    cost: (hp, def) => hp * hpCost + def * defCost,
  });

  const best = points[0];
  const chartData = points.slice(0, 40).map((p) => ({
    hp: p.x, def: p.y, cost: p.costValue, ehp: p.metricValue,
  }));

  return (
    <SolverBoxShell icon={Target} title="Pareto 최적화 — HP × DEF 조합" subtitle="2 변수 · cost 최소">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-caption mb-0.5" style={{ color: 'var(--text-tertiary)' }}>목표 EHP</label>
            <input type="number" value={ehpTarget} onChange={(e) => setEhpTarget(parseFloat(e.target.value) || 0)} className="glass-input hide-spinner w-full px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="block text-caption mb-0.5" style={{ color: 'var(--text-tertiary)' }}>HP 단가</label>
            <input type="number" step="0.1" value={hpCost} onChange={(e) => setHpCost(parseFloat(e.target.value) || 0)} className="glass-input hide-spinner w-full px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="block text-caption mb-0.5" style={{ color: 'var(--text-tertiary)' }}>DEF 단가</label>
            <input type="number" step="0.1" value={defCost} onChange={(e) => setDefCost(parseFloat(e.target.value) || 0)} className="glass-input hide-spinner w-full px-2 py-1 text-sm" />
          </div>
        </div>
        {best ? (
          <div className="p-2 rounded-lg" style={{ background: `${PANEL_COLOR}15`, borderLeft: `3px solid ${PANEL_COLOR}` }}>
            <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>최소 cost 조합 (Pareto 1위)</div>
            <div className="font-mono text-sm font-bold" style={{ color: PANEL_COLOR }}>
              HP {best.x} + DEF {best.y} → EHP {Math.round(best.metricValue)} · cost {Math.round(best.costValue)}
            </div>
          </div>
        ) : (
          <div className="p-2 rounded-lg text-caption" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
            목표 EHP {ehpTarget} 을 만족하는 조합이 범위 내 없음 — 범위 넓히거나 목표 완화
          </div>
        )}
        {chartData.length > 0 && (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                <XAxis dataKey="hp" name="HP" tick={{ fontSize: 10 }} />
                <YAxis dataKey="def" name="DEF" tick={{ fontSize: 10 }} />
                <ZAxis dataKey="cost" range={[20, 200]} />
                <RTooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as { hp: number; def: number; cost: number; ehp: number };
                  return (
                    <div style={{ background: 'var(--bg-primary)', padding: '6px 8px', border: '1px solid var(--border-primary)', borderRadius: 6, fontSize: 11 }}>
                      HP {p.hp} · DEF {p.def}<br />
                      EHP {Math.round(p.ehp)} · cost {Math.round(p.cost)}
                    </div>
                  );
                }} />
                <Scatter data={chartData} fill={PANEL_COLOR} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
        <p className="text-caption italic" style={{ color: 'var(--text-tertiary)' }}>
          점 크기 = cost · HP 축 × DEF 축 · feasible set 에서 cost 낮은 순 40개
        </p>
    </SolverBoxShell>
  );
}

function StatWeightsBox() {
  // 기본 DPS 공식 + 4 스탯 (damage / attackSpeed / critRate / critDamage)
  const [metric, setMetric] = useState<'dps' | 'ehp' | 'damage'>('dps');
  const [stats, setStats] = useState<Record<string, number>>({
    damage: 100,
    attackSpeed: 1.5,
    critRate: 0.2,
    critDamage: 2.0,
  });

  const evaluate = (s: Record<string, number>) => {
    if (metric === 'dps') return s.damage * (1 + s.critRate * (s.critDamage - 1)) * s.attackSpeed;
    if (metric === 'ehp') return s.hp * (1 + s.def / 100) / Math.max(0.01, 1 - (s.dmgReduction || 0));
    return s.atk * (100 / (100 + s.def)) * (s.multiplier || 1);
  };

  // metric 바뀔 때 stats 초기화
  const switchMetric = (m: 'dps' | 'ehp' | 'damage') => {
    setMetric(m);
    if (m === 'dps') setStats({ damage: 100, attackSpeed: 1.5, critRate: 0.2, critDamage: 2.0 });
    else if (m === 'ehp') setStats({ hp: 1000, def: 50, dmgReduction: 0 });
    else setStats({ atk: 150, def: 50, multiplier: 1 });
  };

  const deltas: Record<string, number> = { critRate: 0.01, dmgReduction: 0.01 };
  const weights = calculateStatWeights({ evaluate, currentStats: stats, deltas });

  return (
    <SolverBoxShell icon={Activity} title="Stat Weights — 스탯 1 단위 기여도" subtitle="SimulationCraft 방식">
        <div className="flex gap-1">
          {(['dps', 'ehp', 'damage'] as const).map((m) => (
            <button
              key={m}
              onClick={() => switchMetric(m)}
              className="flex-1 py-1 rounded text-caption font-semibold"
              style={{
                background: metric === m ? PANEL_COLOR : 'var(--bg-primary)',
                color: metric === m ? 'white' : 'var(--text-secondary)',
              }}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(stats).map(([k, v]) => (
            <div key={k}>
              <label className="block text-caption mb-0.5" style={{ color: 'var(--text-tertiary)' }}>{k}</label>
              <input
                type="number"
                value={v}
                step={deltas[k] ?? 1}
                onChange={(e) => setStats({ ...stats, [k]: parseFloat(e.target.value) || 0 })}
                className="glass-input hide-spinner w-full px-2 py-1 text-sm"
              />
            </div>
          ))}
        </div>
        <div className="space-y-1">
          {weights.map((w) => (
            <div key={w.stat} className="flex items-center gap-2 text-caption">
              <span className="w-20 font-mono" style={{ color: 'var(--text-secondary)' }}>{w.stat}</span>
              <div className="flex-1 h-3 rounded overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
                <div
                  className="h-full"
                  style={{
                    width: `${Math.abs(w.normalized) * 100}%`,
                    background: w.weight >= 0 ? PANEL_COLOR : '#ef4444',
                  }}
                />
              </div>
              <span className="w-24 text-right tabular-nums font-mono" style={{ color: 'var(--text-primary)' }}>
                +{w.weight.toFixed(3)} / {deltas[w.stat] ?? 1}
              </span>
            </div>
          ))}
        </div>
        <p className="text-caption italic" style={{ color: 'var(--text-tertiary)' }}>
          bar 길이 = 정규화된 영향도 · 숫자 = 단위 증가당 {metric.toUpperCase()} 증분 (crit/damageReduction 은 %1 기준)
        </p>
    </SolverBoxShell>
  );
}

function GoalSolverHistoryPanel({ onReload }: { onReload: (e: { formula: SolverFormula; targetValue: number; params: Record<string, number> }) => void }) {
  const entries = useGoalSolverHistory((s) => s.entries);
  const clear = useGoalSolverHistory((s) => s.clear);
  const remove = useGoalSolverHistory((s) => s.remove);
  const [open, setOpen] = useState(false);
  if (entries.length === 0) return null;
  return (
    <div className="glass-card rounded-lg overflow-hidden mt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 p-3 text-left"
      >
        <Clock className="w-4 h-4" style={{ color: PANEL_COLOR }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          최근 역산 ({entries.length})
        </span>
        <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${open ? '' : '-rotate-90'}`} style={{ color: 'var(--text-tertiary)' }} />
      </button>
      {open && (
        <div className="border-t p-2 space-y-1" style={{ borderColor: 'var(--border-primary)' }}>
          {entries.map((e) => {
            const d = new Date(e.timestamp);
            return (
              <div
                key={e.id}
                className="flex items-center gap-2 p-2 rounded text-caption"
                style={{
                  background: e.success ? `${PANEL_COLOR}08` : 'rgba(239,68,68,0.08)',
                  borderLeft: `3px solid ${e.success ? PANEL_COLOR : '#ef4444'}`,
                }}
              >
                <span className="font-semibold truncate" style={{ color: 'var(--text-primary)', minWidth: 100 }}>
                  {e.formulaName}
                </span>
                <span className="tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                  목표 {e.targetValue}
                </span>
                {e.success && typeof e.resultValue === 'number' && (
                  <>
                    <span style={{ color: 'var(--text-tertiary)' }}>→</span>
                    <span className="tabular-nums font-mono" style={{ color: PANEL_COLOR }}>
                      {e.resultValue.toFixed(2)}
                    </span>
                  </>
                )}
                {!e.success && (
                  <span style={{ color: '#ef4444' }}>실패</span>
                )}
                <span className="ml-auto text-caption" style={{ color: 'var(--text-tertiary)' }}>
                  {d.getMonth() + 1}/{d.getDate()} {d.getHours()}:{d.getMinutes().toString().padStart(2, '0')}
                </span>
                <button
                  onClick={() => onReload({ formula: e.formula, targetValue: e.targetValue, params: e.params })}
                  className="px-1.5 py-0.5 rounded text-caption"
                  style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}
                  title="이 입력으로 복원"
                >
                  복원
                </button>
                <button
                  onClick={() => remove(e.id)}
                  className="p-0.5 rounded hover:bg-[var(--bg-tertiary)]"
                >
                  <Trash2 className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
                </button>
              </div>
            );
          })}
          <button
            onClick={clear}
            className="w-full text-caption py-1 rounded mt-1"
            style={{ color: 'var(--text-tertiary)' }}
          >
            전체 기록 지우기
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * ScrubbableNumberInput — GoalSolver 용 경량 숫자 입력.
 * Calculator 의 GlassInputField 와 동일한 UX: ↑↓ 화살표로 값 조정,
 * Shift ×10 / Alt ×0.1 배수. GoalSolver 는 내부 state 에서 string 값이라
 * 기존 인터페이스(value: string, onChange: (s: string) => void) 를 유지.
 */
function ScrubbableNumberInput({
  value,
  onChange,
  step = 1,
  placeholder,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  step?: number;
  placeholder?: string;
  className?: string;
}) {
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const current = parseFloat(value);
    if (isNaN(current)) return;
    const multiplier = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
    const delta = step * multiplier * (e.key === 'ArrowUp' ? 1 : -1);
    const next = Math.round((current + delta) * 1e6) / 1e6;
    onChange(String(next));
  }, [value, onChange, step]);

  return (
    <input
      type="number"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      title="↑↓ 로 값 조정 · Shift 10배 · Alt 0.1배"
      className={className ?? 'glass-input hide-spinner w-full px-3 py-2.5 rounded-lg text-sm'}
    />
  );
}
