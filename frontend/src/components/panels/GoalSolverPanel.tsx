'use client';

import { useState } from 'react';
import { X, Target, Calculator, AlertTriangle, Check, Copy, ChevronDown, HelpCircle } from 'lucide-react';
import { solve, SOLVER_FORMULAS, type SolverFormula } from '@/lib/goalSolver';
import PanelShell, { HelpToggle } from '@/components/ui/PanelShell';
import { useTranslations } from 'next-intl';

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

    const solverResult = solve({
      formula: formulaId,
      params: parsedParams,
      targetValue: parsedTarget,
    });

    setResults(prev => ({ ...prev, [formulaId]: solverResult }));
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

        <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
          {t('selectType')}
        </label>

        {SOLVER_FORMULAS.map(formula => {
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
                    <input
                      type="number"
                      value={targetValue}
                      onChange={(e) => setTargetValues(prev => ({ ...prev, [formula.id]: e.target.value }))}
                      placeholder={t('targetPlaceholder')}
                      className="glass-input hide-spinner w-full px-3 py-2.5 rounded-lg text-sm"
                    />
                  </div>

                  {/* 파라미터 입력 */}
                  {formula.params.map(param => (
                    <div key={param.key}>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                        {param.label} {param.unit && `(${param.unit})`}
                      </label>
                      <input
                        type="number"
                        value={formulaParams[param.key] || ''}
                        onChange={(e) => updateParam(formula.id, param.key, e.target.value)}
                        placeholder={String(param.defaultValue)}
                        className="glass-input hide-spinner w-full px-3 py-2.5 rounded-lg text-sm"
                      />
                    </div>
                  ))}

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
                          <div className="glass-stat p-5 text-center">
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
                          </div>

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
                        <div className="p-4 flex items-center gap-3" style={{ background: 'rgba(232, 97, 97, 0.08)' }}>
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(232, 97, 97, 0.15)' }}>
                            <AlertTriangle className="w-5 h-5" style={{ color: '#e86161' }} />
                          </div>
                          <div>
                            <div className="text-sm font-semibold" style={{ color: '#e86161' }}>{t('calculationFailed')}</div>
                            <div className="text-sm whitespace-pre-line" style={{ color: 'var(--text-secondary)' }}>
                              {result.explanation}
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
      </div>
    </PanelShell>
  );
}
