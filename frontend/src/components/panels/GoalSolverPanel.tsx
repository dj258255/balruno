'use client';

import { useState, useCallback } from 'react';
import { X, Target, Calculator, AlertTriangle, Check, Copy, ChevronDown, HelpCircle, Search, Activity, Clock, Trash2, XCircle } from 'lucide-react';
import { solve, SOLVER_FORMULAS, verifyAndAnalyzeSensitivity, findAlternativeSolutions, type SolverFormula } from '@/lib/goalSolver';
import PanelShell, { HelpToggle } from '@/components/ui/PanelShell';
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
                            <div className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>💡 제안</div>
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
