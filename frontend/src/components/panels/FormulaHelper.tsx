'use client';

import { useState, useMemo, useEffect } from 'react';
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
  Star,
  Clock,
} from 'lucide-react';
import { availableFunctions, evaluateFormula } from '@/lib/formulaEngine';
import { convertExcelToBalruno, looksLikeExcel } from '@/lib/formulaConverter';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import PanelShell, { HelpToggle } from '@/components/ui/PanelShell';
import ToolPanelHint from '@/components/onboarding/ToolPanelHint';

// 카테고리 정의 — 기본 10개 + 확장 모드 4개 (Formualizer 엔진 필요)
const CATEGORY_IDS = [
  'all', 'combat', 'economy', 'stage', 'util', 'ref', 'math', 'stat', 'trig', 'logic',
  'lookup', 'condAgg', 'text', 'date',
] as const;
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
  lookup: Link,
  condAgg: Sigma,
  text: BookOpen,
  date: Clock,
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
  lookup: '#06b6d4',
  condAgg: '#0ea5e9',
  text: '#8b5cf6',
  date: '#f59e0b',
};

interface FormulaHelperProps {
  onClose?: () => void;
  showHelp?: boolean;
  setShowHelp?: (value: boolean) => void;
}

const PANEL_COLOR = '#5a9cf5'; // 소프트 블루

const FAVORITES_KEY = 'balruno:formulaHelper:favorites';
const RECENTS_KEY = 'balruno:formulaHelper:recents';
const MAX_RECENTS = 8;

/**
 * Fuzzy 매칭 점수 — 0 = 매칭 안 됨, 높을수록 좋은 매칭.
 *  - 토큰이 순서대로 나타나면 ↑
 *  - 이름 시작 매칭 = 추가 점수
 *  - VSCode / Sublime / Raycast 공통 알고리즘 간소화
 */
function fuzzyScore(text: string, query: string): number {
  if (!query) return 1;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  if (t === q) return 1000;
  if (t.startsWith(q)) return 500 - (t.length - q.length);
  // substring contain
  const idx = t.indexOf(q);
  if (idx >= 0) return 200 - idx;
  // 순서 보존 문자 매칭
  let ti = 0;
  let matched = 0;
  let prevGap = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi];
    const found = t.indexOf(ch, ti);
    if (found < 0) return 0;
    prevGap += found - ti;
    ti = found + 1;
    matched++;
  }
  return Math.max(1, 100 - prevGap);
}

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
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);

  // localStorage hydration
  useEffect(() => {
    try {
      const favs = localStorage.getItem(FAVORITES_KEY);
      if (favs) setFavorites(JSON.parse(favs));
      const rec = localStorage.getItem(RECENTS_KEY);
      if (rec) setRecents(JSON.parse(rec));
    } catch {}
  }, []);

  const toggleFavorite = (name: string) => {
    setFavorites((prev) => {
      const next = prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name];
      try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const pushRecent = (name: string) => {
    setRecents((prev) => {
      const next = [name, ...prev.filter((n) => n !== name)].slice(0, MAX_RECENTS);
      try { localStorage.setItem(RECENTS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

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
      lookup: 'formulaHelper.catLookup',
      condAgg: 'formulaHelper.catCondAgg',
      text: 'formulaHelper.catText',
      date: 'formulaHelper.catDate',
    };
    return t(keyMap[id] || id);
  };

  const getFunctionDescription = (funcName: string, fallback: string) => {
    if (funcName.includes('.')) {
      return fallback;
    }
    // next-intl 의 t() 는 missing key 시 console.error 를 직접 호출해 try-catch 로 못 잡음.
    // t.has() 로 존재 체크 후 lookup — Excel 호환 함수 등 i18n 누락분은 silent fallback.
    const key = `formulaHelper.functions.${funcName}`;
    return t.has(key) ? t(key) : fallback;
  };

  const filteredFunctions = useMemo(() => {
    let funcs = availableFunctions;
    let rawQuery = searchQuery.trim();

    // `>cat keyword` prefix — VSCode Command Palette 식
    // e.g. ">combat hp" → combat 카테고리에서 hp 검색
    let categoryOverride: string | null = null;
    const prefixMatch = rawQuery.match(/^>(\w+)\s*(.*)$/);
    if (prefixMatch) {
      const cat = prefixMatch[1].toLowerCase();
      if (CATEGORY_IDS.includes(cat as typeof CATEGORY_IDS[number])) {
        categoryOverride = cat;
        rawQuery = prefixMatch[2];
      }
    }

    const effectiveCategory = categoryOverride ?? selectedCategory;
    if (effectiveCategory !== 'all' && effectiveCategory !== 'favorites' && effectiveCategory !== 'recents') {
      funcs = funcs.filter(f => f.category === effectiveCategory);
    } else if (effectiveCategory === 'favorites') {
      funcs = funcs.filter(f => favorites.includes(f.name));
    } else if (effectiveCategory === 'recents') {
      // 최근 사용 순서 유지
      const rank = new Map(recents.map((n, i) => [n, i]));
      funcs = funcs
        .filter(f => rank.has(f.name))
        .sort((a, b) => (rank.get(a.name)! - rank.get(b.name)!));
    }

    if (!rawQuery) return funcs;

    // Fuzzy 점수로 정렬 (name 우선, description 보조)
    const scored = funcs
      .map((f) => {
        const nameScore = fuzzyScore(f.name, rawQuery);
        const descScore = fuzzyScore(f.description, rawQuery) * 0.3;
        return { f, score: Math.max(nameScore, descScore) };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored.map((r) => r.f);
  }, [selectedCategory, searchQuery, favorites, recents]);

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
    pushRecent(functionName);
    setTimeout(() => setCopiedFunction(null), 2000);
  };

  return (
    <PanelShell
      title={t('formulaHelper.titleHeader')}
      subtitle={t('formulaHelper.subtitleHeader')}
      icon={BookOpen}
      iconColor="#8b5cf6"
      onClose={onClose ?? (() => {})}
      bodyClassName="p-0 flex flex-col overflow-hidden"
      actions={<HelpToggle active={showHelp} onToggle={() => setShowHelp(!showHelp)} color="#8b5cf6" />}
    >
      <div className="p-4 space-y-5 overflow-y-auto overflow-x-hidden flex-1 scrollbar-slim">
        <ToolPanelHint toolId="formulaHelper" title={t('formulaHelper.hintTitle')} accentColor="#06b6d4">
          <p>{t.rich('formulaHelper.hintP1', { strong: (chunks) => <strong>{chunks}</strong>, code: (chunks) => <code>{chunks}</code> })}</p>
          <p>{t.rich('formulaHelper.hintP2', { code: (chunks) => <code>{chunks}</code> })}</p>
        </ToolPanelHint>
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
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text');
                  if (looksLikeExcel(pasted)) {
                    e.preventDefault();
                    const r = convertExcelToBalruno(pasted);
                    setTestFormula(r.converted);
                    if (r.warnings.length > 0) {
                      setTestResult(t('formulaHelper.convertWarning', { warnings: r.warnings.join(' / ') }));
                    }
                  }
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleTest()}
                placeholder={t('formulaHelper.testPlaceholder') + t('formulaHelper.placeholderTestExtra')}
                className="glass-input flex-1 text-sm"
              />
              <button
                onClick={handleTest}
                className="glass-button-primary !px-4 text-sm"
              >
                {t('formulaHelper.test')}
              </button>
            </div>
            <p className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
              {t.rich('formulaHelper.convertHelp', { code: (chunks) => <code>{chunks}</code> })}
            </p>
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
              placeholder={t('formulaHelper.placeholderSearch')}
              className="glass-input w-full !pl-9 text-sm"
            />
          </div>

          {/* 검색 tip */}
          <p className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
            {t.rich('formulaHelper.searchHelp', { strong: (chunks) => <strong>{chunks}</strong>, code: (chunks) => <code>{chunks}</code> })}
          </p>

          {/* 카테고리 탭 + 즐겨찾기/최근 */}
          <div className="flex flex-wrap gap-1.5">
            {/* 즐겨찾기 / 최근 가상 카테고리 */}
            {(['favorites', 'recents'] as const).map((special) => {
              const Icon = special === 'favorites' ? Star : Clock;
              const isSelected = selectedCategory === special;
              const count = special === 'favorites' ? favorites.length : recents.length;
              const color = special === 'favorites' ? '#fbbf24' : '#8b5cf6';
              return (
                <button
                  key={special}
                  onClick={() => setSelectedCategory(special)}
                  disabled={count === 0}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-caption font-medium transition-all duration-200',
                    isSelected ? 'shadow-sm' : 'hover:opacity-80',
                    count === 0 && 'opacity-30 cursor-not-allowed',
                  )}
                  style={{
                    background: isSelected ? color : 'rgba(0,0,0,0.03)',
                    color: isSelected ? 'white' : 'var(--text-secondary)',
                  }}
                >
                  <Icon className="w-3 h-3" />
                  <span>{special === 'favorites' ? t('formulaHelper.favorites') : t('formulaHelper.recent')}</span>
                  <span
                    className="px-1.5 py-0.5 rounded-full text-caption font-bold"
                    style={{
                      background: isSelected ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.05)',
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
            {CATEGORY_IDS.map((catId) => {
              const Icon = CATEGORY_ICONS[catId];
              const color = CATEGORY_COLORS[catId];
              const isSelected = selectedCategory === catId;
              return (
                <button
                  key={catId}
                  onClick={() => setSelectedCategory(catId)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-caption font-medium transition-all duration-200',
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
                    className="px-1.5 py-0.5 rounded-full text-caption font-bold"
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
                        className="text-caption block mt-1.5 px-2 py-1 rounded-lg"
                        style={{ background: 'rgba(0,0,0,0.03)', color: 'var(--text-secondary)' }}
                      >
                        {func.syntax}
                      </code>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => toggleFavorite(func.name)}
                        className="glass-button !p-2"
                        title={favorites.includes(func.name) ? t('formulaHelper.removeFavorite') : t('formulaHelper.addFavorite')}
                      >
                        <Star
                          className="w-4 h-4"
                          fill={favorites.includes(func.name) ? '#fbbf24' : 'none'}
                          style={{ color: favorites.includes(func.name) ? '#fbbf24' : 'var(--text-secondary)' }}
                        />
                      </button>
                      <button
                        onClick={() => handleCopy(func.example, func.name)}
                        className="glass-button !p-2"
                        title={t('formulaHelper.copyExample')}
                      >
                        {copiedFunction === func.name ? (
                          <Check className="w-4 h-4" style={{ color: '#3db88a' }} />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t('formulaHelper.exampleLabel')}</span>
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
                        <div className="text-caption break-words" style={{ color: 'var(--text-secondary)' }}>
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
