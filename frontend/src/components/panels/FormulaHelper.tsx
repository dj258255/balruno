'use client';

import { useState, useMemo } from 'react';
import {
  Calculator,
  Copy,
  Check,
  Swords,
  Coins,
  Layers,
  Wrench,
  Link,
  Sigma,
  Triangle,
  GitBranch,
  BarChart3,
  FunctionSquare,
  Play,
  Search,
  BookOpen,
} from 'lucide-react';
import { availableFunctions, evaluateFormula } from '@/lib/formulaEngine';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import PanelShell, { HelpToggle } from '@/components/ui/PanelShell';

// 카테고리 정의
const CATEGORY_IDS = ['all', 'combat', 'economy', 'stage', 'util', 'ref', 'math', 'stat', 'trig', 'logic'] as const;
const CATEGORY_ICONS: Record<string, typeof Calculator> = {
  all: Calculator,
  combat: Swords,
  economy: Coins,
  stage: Layers,
  util: Wrench,
  ref: Link,
  math: Sigma,
  stat: BarChart3,
  trig: Triangle,
  logic: GitBranch,
};
const CATEGORY_COLORS: Record<string, string> = {
  all: '#5a9cf5',
  combat: '#e86161',
  economy: '#e5a440',
  stage: '#9179f2',
  util: '#4fc4d4',
  ref: '#3db88a',
  math: '#5a9cf5',
  stat: '#e87aa8',
  trig: '#3db8a8',
  logic: '#a896f5',
};

interface FormulaHelperProps {
  onClose?: () => void;
  showHelp?: boolean;
  setShowHelp?: (value: boolean) => void;
}

const PANEL_COLOR = '#5a9cf5'; // 소프트 블루

export default function FormulaHelper({ onClose, showHelp: externalShowHelp, setShowHelp: externalSetShowHelp }: FormulaHelperProps) {
  const t = useTranslations();
  const [internalShowHelp, setInternalShowHelp] = useState(false);
  const showHelp = externalShowHelp ?? internalShowHelp;
  const setShowHelp = externalSetShowHelp ?? setInternalShowHelp;
  const [testFormula, setTestFormula] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [copiedFunction, setCopiedFunction] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const getCategoryName = (id: string) => {
    const keyMap: Record<string, string> = {
      all: 'formulaHelper.catAll',
      combat: 'formulaHelper.catCombat',
      economy: 'formulaHelper.catEconomy',
      stage: 'formulaHelper.catStage',
      util: 'formulaHelper.catUtil',
      ref: 'formulaHelper.catRef',
      math: 'formulaHelper.catMath',
      stat: 'formulaHelper.catStat',
      trig: 'formulaHelper.catTrig',
      logic: 'formulaHelper.catLogic',
    };
    return t(keyMap[id] || id);
  };

  const getFunctionDescription = (funcName: string, fallback: string) => {
    if (funcName.includes('.')) {
      return fallback;
    }
    const key = `formulaHelper.functions.${funcName}`;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  const filteredFunctions = useMemo(() => {
    let funcs = availableFunctions;

    if (selectedCategory !== 'all') {
      funcs = funcs.filter(f => f.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      funcs = funcs.filter(f =>
        f.name.toLowerCase().includes(query) ||
        f.description.toLowerCase().includes(query)
      );
    }

    return funcs;
  }, [selectedCategory, searchQuery]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: availableFunctions.length };
    availableFunctions.forEach(f => {
      counts[f.category] = (counts[f.category] || 0) + 1;
    });
    return counts;
  }, []);

  const handleTest = () => {
    if (!testFormula.trim()) {
      setTestResult(null);
      return;
    }
    const result = evaluateFormula(testFormula);
    if (result.error) {
      setTestResult(`${t('formulaHelper.error')} ${result.error}`);
    } else {
      setTestResult(`${t('formulaHelper.result')} ${result.value}`);
    }
  };

  const handleCopy = (text: string, functionName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFunction(functionName);
    setTimeout(() => setCopiedFunction(null), 2000);
  };

  return (
    <PanelShell
      title="수식 도우미"
      subtitle="90+ 함수 레퍼런스 검색"
      icon={BookOpen}
      iconColor="#8b5cf6"
      onClose={onClose ?? (() => {})}
      bodyClassName="p-0 flex flex-col overflow-hidden"
      actions={<HelpToggle active={showHelp} onToggle={() => setShowHelp(!showHelp)} color="#8b5cf6" />}
    >
      <div className="p-4 space-y-5 overflow-y-auto overflow-x-hidden flex-1 scrollbar-slim">
        {/* 도움말 섹션 */}
        {showHelp && (
          <div className="glass-card p-4 animate-slideDown space-y-4">
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `linear-gradient(135deg, ${PANEL_COLOR}, ${PANEL_COLOR}cc)` }}
              >
                <FunctionSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{t('formulaHelper.helpTitle')}</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{t('formulaHelper.helpDesc')}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="glass-section p-3">
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen className="w-3.5 h-3.5" style={{ color: PANEL_COLOR }} />
                  <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{t('formulaHelper.helpUsage')}</span>
                </div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('formulaHelper.helpUsageDesc')}</p>
              </div>
              <div className="glass-section p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Play className="w-3.5 h-3.5" style={{ color: '#3db88a' }} />
                  <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{t('formulaHelper.helpTest')}</span>
                </div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('formulaHelper.helpTestDesc')}</p>
              </div>
            </div>

            <div className="glass-divider" />

            <div className="space-y-2">
              <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('formulaHelper.syntaxGuide')}</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="glass-section p-2">
                  <code className="text-sm px-1.5 py-0.5 rounded" style={{ background: `${PANEL_COLOR}15`, color: PANEL_COLOR }}>=</code>
                  <span className="ml-1.5" style={{ color: 'var(--text-secondary)' }}>{t('formulaHelper.formulaStart')}</span>
                </div>
                <div className="glass-section p-2">
                  <code className="text-sm px-1.5 py-0.5 rounded" style={{ background: `${PANEL_COLOR}15`, color: PANEL_COLOR }}>PREV.</code>
                  <span className="ml-1.5" style={{ color: 'var(--text-secondary)' }}>{t('formulaHelper.prevRowRef')}</span>
                </div>
                <div className="glass-section p-2">
                  <code className="text-sm px-1.5 py-0.5 rounded" style={{ background: `${PANEL_COLOR}15`, color: PANEL_COLOR }}>Settings.</code>
                  <span className="ml-1.5" style={{ color: 'var(--text-secondary)' }}>{t('formulaHelper.settingsRef')}</span>
                </div>
                <div className="glass-section p-2">
                  <code className="text-sm px-1.5 py-0.5 rounded" style={{ background: `${PANEL_COLOR}15`, color: PANEL_COLOR }}>REF()</code>
                  <span className="ml-1.5" style={{ color: 'var(--text-secondary)' }}>{t('formulaHelper.cellRef')}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 수식 테스트 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4" style={{ color: PANEL_COLOR }} />
            <h4 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{t('formulaHelper.testFormula')}</h4>
          </div>
          <div className="glass-card p-3 space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={testFormula}
                onChange={(e) => setTestFormula(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTest()}
                placeholder={t('formulaHelper.testPlaceholder')}
                className="glass-input flex-1 text-sm"
              />
              <button
                onClick={handleTest}
                className="glass-button-primary !px-4 text-sm"
              >
                {t('formulaHelper.test')}
              </button>
            </div>
            {testResult && (
              <div
                className="px-3 py-2.5 rounded-xl text-sm font-medium"
                style={{
                  background: testResult.startsWith(t('formulaHelper.error'))
                    ? 'rgba(239, 68, 68, 0.1)'
                    : 'rgba(16, 185, 129, 0.1)',
                  color: testResult.startsWith(t('formulaHelper.error'))
                    ? '#e86161'
                    : '#3db88a',
                }}
              >
                {testResult}
              </div>
            )}
          </div>
        </div>

        {/* 검색 및 카테고리 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4" style={{ color: PANEL_COLOR }} />
            <h4 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{t('formulaHelper.category')}</h4>
            <span className="glass-badge ml-auto text-sm" style={{ color: PANEL_COLOR }}>
              {t('formulaHelper.functionCount', { count: availableFunctions.length })}
            </span>
          </div>

          {/* 검색 */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-secondary)' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="함수 검색..."
              className="glass-input w-full !pl-9 text-sm"
            />
          </div>

          {/* 카테고리 탭 */}
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_IDS.map((catId) => {
              const Icon = CATEGORY_ICONS[catId];
              const color = CATEGORY_COLORS[catId];
              const isSelected = selectedCategory === catId;
              return (
                <button
                  key={catId}
                  onClick={() => setSelectedCategory(catId)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-all duration-200',
                    isSelected ? 'shadow-sm' : 'hover:opacity-80'
                  )}
                  style={{
                    background: isSelected ? color : 'rgba(0,0,0,0.03)',
                    color: isSelected ? 'white' : 'var(--text-secondary)',
                  }}
                >
                  <Icon className="w-3 h-3" />
                  <span>{getCategoryName(catId)}</span>
                  <span
                    className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                    style={{
                      background: isSelected ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.05)',
                    }}
                  >
                    {categoryCounts[catId] || 0}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 함수 목록 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              {t('formulaHelper.functionList')}
            </h4>
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {t('formulaHelper.showing', { count: filteredFunctions.length })}
            </span>
          </div>

          <div className="grid gap-2">
            {filteredFunctions.map((func) => {
              const categoryColor = CATEGORY_COLORS[func.category];
              const categoryName = getCategoryName(func.category);
              const CategoryIcon = CATEGORY_ICONS[func.category];

              return (
                <div
                  key={func.name}
                  className="glass-card p-3 transition-all duration-200 hover:shadow-md"
                  style={{
                    borderLeft: `3px solid ${categoryColor}`,
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code
                          className="font-bold text-sm"
                          style={{ color: categoryColor }}
                        >
                          {func.name}
                        </code>
                        <span
                          className="glass-badge flex items-center gap-1 !py-0.5"
                          style={{ background: `${categoryColor}15`, color: categoryColor }}
                        >
                          <CategoryIcon className="w-2.5 h-2.5" />
                          <span className="text-sm">{categoryName}</span>
                        </span>
                      </div>
                      <p className="text-sm mt-1.5" style={{ color: 'var(--text-secondary)' }}>
                        {getFunctionDescription(func.name, func.description)}
                      </p>
                      <code
                        className="text-[11px] block mt-1.5 px-2 py-1 rounded-lg"
                        style={{ background: 'rgba(0,0,0,0.03)', color: 'var(--text-secondary)' }}
                      >
                        {func.syntax}
                      </code>
                    </div>
                    <button
                      onClick={() => handleCopy(func.example, func.name)}
                      className="glass-button !p-2 shrink-0"
                      title={t('formulaHelper.copyExample')}
                    >
                      {copiedFunction === func.name ? (
                        <Check className="w-4 h-4" style={{ color: '#3db88a' }} />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>예시:</span>
                    <code
                      className="text-sm px-2 py-1 rounded-lg font-medium"
                      style={{ background: `${categoryColor}10`, color: categoryColor }}
                    >
                      {func.example}
                    </code>
                  </div>

                  {(func.formula || func.paramHint) && (
                    <div className="glass-section mt-2.5 p-2.5 space-y-1.5">
                      {func.formula && (
                        <div className="flex items-start gap-2 text-sm">
                          <span className="shrink-0 font-medium" style={{ color: 'var(--text-secondary)' }}>
                            {t('formulaHelper.formulaLabel')}
                          </span>
                          <code className="font-mono break-all" style={{ color: 'var(--text-primary)' }}>
                            {func.formula}
                          </code>
                        </div>
                      )}
                      {func.paramHint && (
                        <div className="text-[11px] break-words" style={{ color: 'var(--text-secondary)' }}>
                          {func.paramHint}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </PanelShell>
  );
}
