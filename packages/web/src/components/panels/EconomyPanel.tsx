import { useState, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Coins, Plus, Trash2, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle, RefreshCw, Download,
  ArrowUpCircle, ArrowDownCircle, Info,
  Maximize2, X, Grid3X3, Users, User, Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import CustomSelect from '@/components/ui/CustomSelect';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import {
  simulateEconomy,
  calculateBalanceSuggestions,
  simulateSinglePlayerEconomy,
  DEFAULT_FAUCETS,
  DEFAULT_SINKS,
  DEFAULT_CONFIG,
  DEFAULT_SINGLE_SOURCES,
  DEFAULT_SINGLE_SINKS,
  DEFAULT_SINGLE_CONFIG,
  type Faucet,
  type Sink,
  type EconomyConfig,
  type SinglePlayerSource,
  type SinglePlayerSink,
  type SinglePlayerConfig
} from '@/lib/economySimulator';
import { useProjectStore } from '@/stores/projectStore';
import { Tooltip as TooltipUI } from '@/components/ui/Tooltip';
import PanelShell, { HelpToggle } from '@/components/ui/PanelShell';
import type { EconomyDesignHandle } from '@/hooks/useEconomyDesign';

const PANEL_COLOR = '#e5a440'; // 소프트 앰버

interface EconomyPanelProps {
  showHelp?: boolean;
  setShowHelp?: (value: boolean) => void;
  onClose?: () => void;
  /**
   * Workbench 가 hold 한 디자인 핸들. 분석 탭 데이터(Faucet/Sink/config) 와
   * 다이어그램 노드를 양방향 동기화.
   * 없으면 기존 동작(로컬 state)으로 폴백 — 단독 호출 호환성.
   */
  design?: EconomyDesignHandle | null;
}

export default function EconomyPanel({ showHelp: externalShowHelp, setShowHelp: externalSetShowHelp, onClose, design }: EconomyPanelProps) {
  const t = useTranslations('economy');
  const [internalShowHelp, setInternalShowHelp] = useState(false);
  const showHelp = externalShowHelp ?? internalShowHelp;
  const setShowHelp = externalSetShowHelp ?? setInternalShowHelp;

  // 폴백 로컬 state — design 핸들이 없을 때만 사용
  const [localFaucets, setLocalFaucets] = useState<Faucet[]>(DEFAULT_FAUCETS);
  const [localSinks, setLocalSinks] = useState<Sink[]>(DEFAULT_SINKS);
  const [localConfig, setLocalConfig] = useState<EconomyConfig>(DEFAULT_CONFIG);
  const [localGameMode, setLocalGameMode] = useState<'online' | 'single'>('online');
  const [localSingleSources, setLocalSingleSources] = useState<SinglePlayerSource[]>(DEFAULT_SINGLE_SOURCES);
  const [localSingleSinks, setLocalSingleSinks] = useState<SinglePlayerSink[]>(DEFAULT_SINGLE_SINKS);
  const [localSingleConfig, setLocalSingleConfig] = useState<SinglePlayerConfig>(DEFAULT_SINGLE_CONFIG);

  // 데이터 source — design 핸들 우선, 없으면 폴백
  const faucets = design ? design.economy.faucets : localFaucets;
  const sinks = design ? design.economy.sinks : localSinks;
  const config = design ? design.economy.config : localConfig;
  const gameMode: 'online' | 'single' = design ? (design.economy.gameMode ?? 'online') : localGameMode;
  const singleSources = design ? (design.economy.singleSources ?? DEFAULT_SINGLE_SOURCES) : localSingleSources;
  const singleSinks = design ? (design.economy.singleSinks ?? DEFAULT_SINGLE_SINKS) : localSingleSinks;
  const singleConfig = design ? (design.economy.singleConfig ?? DEFAULT_SINGLE_CONFIG) : localSingleConfig;

  // 데이터 setter — design 액션 → automation persist + 노드 동기 / 폴백 → 로컬 state
  const setGameMode = (m: 'online' | 'single') => {
    if (design) design.setGameMode(m);
    else setLocalGameMode(m);
  };
  const setConfig = (next: EconomyConfig | ((prev: EconomyConfig) => EconomyConfig)) => {
    const value = typeof next === 'function' ? next(config) : next;
    if (design) design.setConfig(value);
    else setLocalConfig(value);
  };
  const setFaucets = (next: Faucet[] | ((prev: Faucet[]) => Faucet[])) => {
    const value = typeof next === 'function' ? next(faucets) : next;
    if (!design) {
      setLocalFaucets(value);
      return;
    }
    // design 모드: prev 와 비교해 add/update/delete 분기
    const prevById = new Map(design.economy.faucets.map((f) => [f.id, f]));
    const nextById = new Map(value.map((f) => [f.id, f]));
    for (const f of value) {
      const prev = prevById.get(f.id);
      if (!prev) design.addFaucet(f);
      else if (prev !== f) design.updateFaucet(f.id, f);
    }
    for (const id of prevById.keys()) {
      if (!nextById.has(id)) design.deleteFaucet(id);
    }
  };
  const setSinks = (next: Sink[] | ((prev: Sink[]) => Sink[])) => {
    const value = typeof next === 'function' ? next(sinks) : next;
    if (!design) {
      setLocalSinks(value);
      return;
    }
    const prevById = new Map(design.economy.sinks.map((s) => [s.id, s]));
    const nextById = new Map(value.map((s) => [s.id, s]));
    for (const s of value) {
      const prev = prevById.get(s.id);
      if (!prev) design.addSink(s);
      else if (prev !== s) design.updateSink(s.id, s);
    }
    for (const id of prevById.keys()) {
      if (!nextById.has(id)) design.deleteSink(id);
    }
  };
  const setSingleConfig = (next: SinglePlayerConfig | ((prev: SinglePlayerConfig) => SinglePlayerConfig)) => {
    const value = typeof next === 'function' ? next(singleConfig) : next;
    if (design) design.setSingleConfig(value);
    else setLocalSingleConfig(value);
  };
  const setSingleSources = (next: SinglePlayerSource[] | ((prev: SinglePlayerSource[]) => SinglePlayerSource[])) => {
    const value = typeof next === 'function' ? next(singleSources) : next;
    if (!design) {
      setLocalSingleSources(value);
      return;
    }
    const prevById = new Map((design.economy.singleSources ?? []).map((s) => [s.id, s]));
    const nextById = new Map(value.map((s) => [s.id, s]));
    for (const s of value) {
      const prev = prevById.get(s.id);
      if (!prev) design.addSingleSource(s);
      else if (prev !== s) design.updateSingleSource(s.id, s);
    }
    for (const id of prevById.keys()) {
      if (!nextById.has(id)) design.deleteSingleSource(id);
    }
  };
  const setSingleSinks = (next: SinglePlayerSink[] | ((prev: SinglePlayerSink[]) => SinglePlayerSink[])) => {
    const value = typeof next === 'function' ? next(singleSinks) : next;
    if (!design) {
      setLocalSingleSinks(value);
      return;
    }
    const prevById = new Map((design.economy.singleSinks ?? []).map((s) => [s.id, s]));
    const nextById = new Map(value.map((s) => [s.id, s]));
    for (const s of value) {
      const prev = prevById.get(s.id);
      if (!prev) design.addSingleSink(s);
      else if (prev !== s) design.updateSingleSink(s.id, s);
    }
    for (const id of prevById.keys()) {
      if (!nextById.has(id)) design.deleteSingleSink(id);
    }
  };

  const [activeTab, setActiveTab] = useState<'faucets' | 'sinks' | 'config'>('faucets');
  const [fullscreenChart, setFullscreenChart] = useState(false);
  const [singleActiveTab, setSingleActiveTab] = useState<'sources' | 'sinks' | 'config'>('sources');

  // 온라인 게임 결과
  const result = useMemo(() => simulateEconomy(faucets, sinks, config), [faucets, sinks, config]);
  const suggestions = useMemo(() => calculateBalanceSuggestions(faucets, sinks, config), [faucets, sinks, config]);

  // 싱글 게임 결과
  const singleResult = useMemo(
    () => simulateSinglePlayerEconomy(singleSources, singleSinks, singleConfig),
    [singleSources, singleSinks, singleConfig]
  );

  // 온라인 게임 함수들
  const addFaucet = () => {
    setFaucets([...faucets, { id: `faucet_${Date.now()}`, name: t('newFaucet'), ratePerHour: 100, playerPercentage: 0.5 }]);
  };

  const addSink = () => {
    setSinks([...sinks, { id: `sink_${Date.now()}`, name: t('newSink'), costPerUse: 50, usesPerHour: 1, playerPercentage: 0.5, isRequired: false }]);
  };

  const updateFaucet = (id: string, updates: Partial<Faucet>) => {
    setFaucets(faucets.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const updateSink = (id: string, updates: Partial<Sink>) => {
    setSinks(sinks.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  // 싱글 게임 함수들
  const addSingleSource = () => {
    setSingleSources([...singleSources, {
      id: `source_${Date.now()}`,
      name: t('newSource'),
      baseAmount: 50,
      growthType: 'linear',
      growthRate: 10,
      occurrence: 'per_stage'
    }]);
  };

  const addSingleSink = () => {
    setSingleSinks([...singleSinks, {
      id: `sink_${Date.now()}`,
      name: t('newSink'),
      baseCost: 30,
      growthType: 'linear',
      growthRate: 5,
      category: 'consumable',
      isRequired: false,
      frequency: 1
    }]);
  };

  const updateSingleSource = (id: string, updates: Partial<SinglePlayerSource>) => {
    setSingleSources(singleSources.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const updateSingleSink = (id: string, updates: Partial<SinglePlayerSink>) => {
    setSingleSinks(singleSinks.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const handleExport = () => {
    const data = gameMode === 'online'
      ? { mode: 'online', config, faucets, sinks, result, suggestions, exportedAt: new Date().toISOString() }
      : { mode: 'single', config: singleConfig, sources: singleSources, sinks: singleSinks, result: singleResult, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `economy-simulation-${gameMode}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatNumber = (n: number) => {
    const absN = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (absN >= 1e12) return `${sign}${(absN / 1e12).toFixed(1)}T`;
    if (absN >= 1e9) return `${sign}${(absN / 1e9).toFixed(1)}B`;
    if (absN >= 1e6) return `${sign}${(absN / 1e6).toFixed(1)}M`;
    if (absN >= 1e3) return `${sign}${(absN / 1e3).toFixed(1)}K`;
    return n.toFixed(0);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'good': return '#3db88a';
      case 'warning': return '#e5a440';
      case 'critical': return '#e86161';
      default: return 'var(--text-secondary)';
    }
  };

  return (
    <PanelShell
      title={t('titleHeader')}
      subtitle={t('subtitleHeader')}
      icon={Coins}
      iconColor={PANEL_COLOR}
      onClose={onClose ?? (() => {})}
      bodyClassName="p-0 flex flex-col overflow-hidden"
      actions={<HelpToggle active={showHelp} onToggle={() => setShowHelp(!showHelp)} color={PANEL_COLOR} />}
    >
      <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden scrollbar-slim">
        {/* Help Content */}
        {showHelp && (
          <div className="mx-4 mt-4 mb-2 glass-card p-4 animate-slideDown shrink-0 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${PANEL_COLOR}, ${PANEL_COLOR}cc)` }}>
                <Coins className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{t('helpTitle')}</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{t('helpDesc')}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="glass-section p-2" style={{ borderLeft: '3px solid #3db88a' }}>
                <span className="font-semibold text-sm" style={{ color: '#3db88a' }}>{t('faucets')}</span>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{t('helpFaucet')}</p>
              </div>
              <div className="glass-section p-2" style={{ borderLeft: '3px solid #e86161' }}>
                <span className="font-semibold text-sm" style={{ color: '#e86161' }}>{t('sinks')}</span>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{t('helpSink')}</p>
              </div>
              <div className="glass-section p-2" style={{ borderLeft: `3px solid ${PANEL_COLOR}` }}>
                <span className="font-semibold text-sm" style={{ color: PANEL_COLOR }}>{t('helpBalanceTitle')}</span>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{t('helpBalance')}</p>
              </div>
            </div>
          </div>
        )}

        {/* Game Mode Toggle */}
        <div className="px-4 pt-4 pb-2 shrink-0">
          <div className="glass-section p-1 flex gap-1">
            <button
              onClick={() => setGameMode('online')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                gameMode === 'online'
                  ? 'shadow-sm'
                  : 'hover:bg-black/5 dark:hover:bg-white/5'
              )}
              style={{
                background: gameMode === 'online' ? `linear-gradient(135deg, ${PANEL_COLOR}20, ${PANEL_COLOR}10)` : 'transparent',
                color: gameMode === 'online' ? PANEL_COLOR : 'var(--text-secondary)',
                border: gameMode === 'online' ? `1px solid ${PANEL_COLOR}40` : '1px solid transparent'
              }}
            >
              <Users className="w-4 h-4" />
              {t('modeOnline')}
            </button>
            <button
              onClick={() => setGameMode('single')}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                gameMode === 'single'
                  ? 'shadow-sm'
                  : 'hover:bg-black/5 dark:hover:bg-white/5'
              )}
              style={{
                background: gameMode === 'single' ? `linear-gradient(135deg, ${PANEL_COLOR}20, ${PANEL_COLOR}10)` : 'transparent',
                color: gameMode === 'single' ? PANEL_COLOR : 'var(--text-secondary)',
                border: gameMode === 'single' ? `1px solid ${PANEL_COLOR}40` : '1px solid transparent'
              }}
            >
              <User className="w-4 h-4" />
              {t('modeSingle')}
            </button>
          </div>
        </div>

        {/* Online Mode Content */}
        {gameMode === 'online' && (
          <>
        {/* Header Summary */}
        <div className="p-4 shrink-0">
          <div className="grid grid-cols-4 gap-2">
            <div className="glass-stat">
              <div className="flex items-center gap-1.5 mb-1">
                <ArrowUpCircle className="w-3.5 h-3.5" style={{ color: '#3db88a' }} />
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('totalFaucet')}</span>
              </div>
              <div className="text-lg font-bold" style={{ color: '#3db88a' }}>{formatNumber(result.totalFaucetPerHour)}/h</div>
            </div>
            <div className="glass-stat">
              <div className="flex items-center gap-1.5 mb-1">
                <ArrowDownCircle className="w-3.5 h-3.5" style={{ color: '#e86161' }} />
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('totalSink')}</span>
              </div>
              <div className="text-lg font-bold" style={{ color: '#e86161' }}>{formatNumber(result.totalSinkPerHour)}/h</div>
            </div>
            <div className="glass-stat">
              <div className="flex items-center gap-1.5 mb-1">
                {result.netFlowPerHour >= 0 ? <TrendingUp className="w-3.5 h-3.5" style={{ color: '#e5a440' }} /> : <TrendingDown className="w-3.5 h-3.5" style={{ color: '#5a9cf5' }} />}
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('netFlow')}</span>
              </div>
              <div className="text-lg font-bold" style={{ color: result.netFlowPerHour >= 0 ? '#e5a440' : '#5a9cf5' }}>{result.netFlowPerHour >= 0 ? '+' : ''}{formatNumber(result.netFlowPerHour)}/h</div>
            </div>
            <div className="glass-stat" style={{ background: `linear-gradient(135deg, ${getSeverityColor(result.pinchPointAnalysis.severity)}15, ${getSeverityColor(result.pinchPointAnalysis.severity)}05)` }}>
              <div className="flex items-center gap-1.5 mb-1">
                {result.pinchPointAnalysis.isHealthy ? <CheckCircle className="w-3.5 h-3.5" style={{ color: getSeverityColor(result.pinchPointAnalysis.severity) }} /> : <AlertTriangle className="w-3.5 h-3.5" style={{ color: getSeverityColor(result.pinchPointAnalysis.severity) }} />}
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('balance')}</span>
              </div>
              <div className="text-lg font-bold" style={{ color: getSeverityColor(result.pinchPointAnalysis.severity) }}>{(result.faucetSinkRatio * 100).toFixed(0)}%</div>
            </div>
          </div>

          {result.warnings.length > 0 && (
            <div className="mt-3 glass-section p-2" style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
              {result.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-sm" style={{ color: '#e5a440' }}>
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="px-4">
          <div className="glass-tabs">
            {(['faucets', 'sinks', 'config'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn('glass-tab flex-1 text-center', activeTab === tab && 'active')}
              >
                {tab === 'faucets' && <>{t('faucets')} ({faucets.length})</>}
                {tab === 'sinks' && <>{t('sinks')} ({sinks.length})</>}
                {tab === 'config' && <>{t('settings')}</>}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-4 space-y-4">
          {activeTab === 'faucets' && (
            <div className="flex flex-wrap gap-2">
              {faucets.map(faucet => (
                <div key={faucet.id} className="glass-card p-3 space-y-2 flex-1 min-w-[220px] max-w-[280px]" style={{ borderLeft: '3px solid #3db88a' }}>
                  <div className="flex items-center justify-between">
                    <input type="text" value={faucet.name} onChange={(e) => updateFaucet(faucet.id, { name: e.target.value })} className="input-base font-semibold flex-1 min-w-0" style={{ color: 'var(--text-primary)' }} />
                    <button onClick={() => setFaucets(faucets.filter(f => f.id !== faucet.id))} className="p-1 rounded-lg hover:bg-red-500/20"><Trash2 className="w-3 h-3" style={{ color: 'var(--text-secondary)' }} /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <GlassInputField label={t('ratePerHour')} value={faucet.ratePerHour} onChange={(v) => updateFaucet(faucet.id, { ratePerHour: v })} />
                    <GlassInputField label={t('playerPercent')} value={faucet.playerPercentage * 100} onChange={(v) => updateFaucet(faucet.id, { playerPercentage: v / 100 })} min={0} max={100} />
                  </div>
                </div>
              ))}
              <button onClick={addFaucet} className="glass-card flex items-center justify-center gap-2 px-4 py-3 text-sm min-w-[120px]" style={{ color: '#3db88a', borderStyle: 'dashed' }}>
                <Plus className="w-3 h-3" /> {t('addFaucet')}
              </button>
            </div>
          )}

          {activeTab === 'sinks' && (
            <div className="flex flex-wrap gap-2">
              {sinks.map(sink => (
                <div key={sink.id} className="glass-card p-3 space-y-2 flex-1 min-w-[260px] max-w-[320px]" style={{ borderLeft: '3px solid #e86161' }}>
                  <div className="flex items-center justify-between">
                    <input type="text" value={sink.name} onChange={(e) => updateSink(sink.id, { name: e.target.value })} className="input-base font-semibold flex-1 min-w-0" style={{ color: 'var(--text-primary)' }} />
                    <button onClick={() => setSinks(sinks.filter(s => s.id !== sink.id))} className="p-1 rounded-lg hover:bg-red-500/20"><Trash2 className="w-3 h-3" style={{ color: 'var(--text-secondary)' }} /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <GlassInputField label={t('costPerUse')} value={sink.costPerUse} onChange={(v) => updateSink(sink.id, { costPerUse: v })} />
                    <GlassInputField label={t('usesPerHour')} value={sink.usesPerHour} onChange={(v) => updateSink(sink.id, { usesPerHour: v })} step={0.1} />
                    <GlassInputField label={t('playerPercent')} value={sink.playerPercentage * 100} onChange={(v) => updateSink(sink.id, { playerPercentage: v / 100 })} min={0} max={100} />
                    <div className="flex flex-col">
                      <label className="text-sm mb-1 font-medium" style={{ color: 'var(--text-secondary)' }}>{t('required')}</label>
                      <button
                        onClick={() => updateSink(sink.id, { isRequired: !sink.isRequired })}
                        className="flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors"
                        style={{
                          background: sink.isRequired ? 'rgba(232, 97, 97, 0.15)' : 'var(--bg-secondary)',
                          border: `1px solid ${sink.isRequired ? 'rgba(232, 97, 97, 0.4)' : 'var(--border-primary)'}`,
                          color: sink.isRequired ? '#e86161' : 'var(--text-secondary)'
                        }}
                      >
                        <div className={cn("w-7 h-4 rounded-full relative transition-colors duration-200", sink.isRequired ? "bg-red-500" : "bg-[var(--bg-tertiary)]")} style={{ border: sink.isRequired ? 'none' : '1px solid var(--border-secondary)' }}>
                          <span className={cn("absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full transition-all duration-200 shadow-sm", sink.isRequired ? "left-[14px] bg-white" : "left-0.5 bg-[var(--text-secondary)]")} />
                        </div>
                        <span>{sink.isRequired ? 'ON' : 'OFF'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={addSink} className="glass-card flex items-center justify-center gap-2 px-4 py-3 text-sm min-w-[120px]" style={{ color: '#e86161', borderStyle: 'dashed' }}>
                <Plus className="w-3 h-3" /> {t('addSink')}
              </button>
            </div>
          )}

          {activeTab === 'config' && (
            <div className="flex flex-wrap gap-3 items-end">
              <GlassConfigInput label={t('currencyName')} value={config.currencyName} onChange={(v) => setConfig({ ...config, currencyName: String(v) })} type="text" />
              <GlassConfigInput label={t('playerCount')} value={config.playerCount} onChange={(v) => setConfig({ ...config, playerCount: Number(v) })} />
              <GlassConfigInput label={t('initialSupply')} value={config.initialSupply} onChange={(v) => setConfig({ ...config, initialSupply: Number(v) })} />
              <GlassConfigInput label={t('simulationDays')} value={config.simulationDays} onChange={(v) => setConfig({ ...config, simulationDays: Number(v) })} />
              <GlassConfigInput label={`${t('targetInflation')} (%)`} value={config.targetInflationRate * 100} onChange={(v) => setConfig({ ...config, targetInflationRate: Number(v) / 100 })} step={0.1} />
              <button onClick={() => { setFaucets(DEFAULT_FAUCETS); setSinks(DEFAULT_SINKS); setConfig(DEFAULT_CONFIG); }} className="glass-button flex items-center gap-1.5 text-sm">
                <RefreshCw className="w-3 h-3" /> {t('resetDefaults')}
              </button>
              <button onClick={handleExport} className="glass-button-primary flex items-center gap-1.5 text-sm">
                <Download className="w-3 h-3" /> {t('exportResults')}
              </button>
            </div>
          )}

          {/* Supply Chart */}
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('supplyOverTime')} ({config.simulationDays}{t('days')})</h3>
              <button onClick={() => setFullscreenChart(true)} className="p-1.5 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"><Maximize2 className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} /></button>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={result.supplyOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                  <XAxis dataKey="day" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={{ stroke: 'var(--border-primary)' }} />
                  <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={{ stroke: 'var(--border-primary)' }} tickFormatter={(v) => formatNumber(v)} />
                  <Tooltip contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: '12px', fontSize: '12px' }} formatter={(value: number) => [formatNumber(value), t('supply')]} labelFormatter={(day) => `Day ${day}`} />
                  <Line type="monotone" dataKey="supply" stroke="#5a9cf5" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-card p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#3db88a' }}><ArrowUpCircle className="w-4 h-4" /> {t('faucetBreakdown')}</h3>
              <div className="space-y-2">
                {result.faucetBreakdown.map((f, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span style={{ color: 'var(--text-secondary)' }}>{f.name}</span>
                      <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{f.percentage.toFixed(1)}%</span>
                    </div>
                    <div className="glass-progress"><div className="glass-progress-bar" style={{ width: `${f.percentage}%`, background: `hsl(${142 - i * 20}, 70%, 50%)` }} /></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass-card p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#e86161' }}><ArrowDownCircle className="w-4 h-4" /> {t('sinkBreakdown')}</h3>
              <div className="space-y-2">
                {result.sinkBreakdown.map((s, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span style={{ color: 'var(--text-secondary)' }}>{s.name}</span>
                      <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{s.percentage.toFixed(1)}%</span>
                    </div>
                    <div className="glass-progress"><div className="glass-progress-bar" style={{ width: `${s.percentage}%`, background: `hsl(${0 + i * 15}, 70%, 50%)` }} /></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="glass-card p-4" style={{ background: `linear-gradient(135deg, ${getSeverityColor(result.pinchPointAnalysis.severity)}10, transparent)` }}>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: getSeverityColor(result.pinchPointAnalysis.severity) }}><Info className="w-4 h-4" /> {t('recommendations')}</h3>
            <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>{result.pinchPointAnalysis.recommendation}</p>
            {suggestions.explanation && <p className="text-sm glass-section p-2" style={{ color: 'var(--text-primary)' }}>{suggestions.explanation}</p>}
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="glass-section p-2 text-center">
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('inflationRate')}</div>
                <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{(result.inflationRate * 100).toFixed(2)}%/{t('day')}</div>
              </div>
              <div className="glass-section p-2 text-center">
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('daysToDouble')}</div>
                <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{result.daysToDouble !== null ? `${result.daysToDouble.toFixed(0)}${t('days')}` : '-'}</div>
              </div>
              <div className="glass-section p-2 text-center">
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('faucetSinkRatio')}</div>
                <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{result.faucetSinkRatio.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>
          </>
        )}

        {/* Single Player Mode Content */}
        {gameMode === 'single' && (
          <>
            {/* Header Summary */}
            <div className="p-4 shrink-0">
              <div className="grid grid-cols-4 gap-2">
                <div className="glass-stat">
                  <div className="flex items-center gap-1.5 mb-1">
                    <ArrowUpCircle className="w-3.5 h-3.5" style={{ color: '#3db88a' }} />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('totalIncome')}</span>
                  </div>
                  <div className="text-lg font-bold" style={{ color: '#3db88a' }}>{formatNumber(singleResult.totalIncome)}</div>
                </div>
                <div className="glass-stat">
                  <div className="flex items-center gap-1.5 mb-1">
                    <ArrowDownCircle className="w-3.5 h-3.5" style={{ color: '#e86161' }} />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('totalExpense')}</span>
                  </div>
                  <div className="text-lg font-bold" style={{ color: '#e86161' }}>{formatNumber(singleResult.totalExpense)}</div>
                </div>
                <div className="glass-stat">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Coins className="w-3.5 h-3.5" style={{ color: '#5a9cf5' }} />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('finalBalance')}</span>
                  </div>
                  <div className="text-lg font-bold" style={{ color: '#5a9cf5' }}>{formatNumber(singleResult.finalBalance)}</div>
                </div>
                <div className="glass-stat" style={{ background: `linear-gradient(135deg, ${singleResult.pacing.isBalanced ? '#3db88a' : '#e5a440'}15, ${singleResult.pacing.isBalanced ? '#3db88a' : '#e5a440'}05)` }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    {singleResult.pacing.isBalanced ? <CheckCircle className="w-3.5 h-3.5" style={{ color: '#3db88a' }} /> : <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#e5a440' }} />}
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('balance')}</span>
                  </div>
                  <div className="text-lg font-bold" style={{ color: singleResult.pacing.isBalanced ? '#3db88a' : '#e5a440' }}>{singleResult.incomeToExpenseRatio.toFixed(2)}</div>
                </div>
              </div>

              {/* Pinch Points Warning */}
              {singleResult.pinchPoints.filter(p => p.severity !== 'minor').length > 0 && (
                <div className="mt-3 glass-section p-2" style={{ background: 'rgba(245, 158, 11, 0.1)' }}>
                  {singleResult.pinchPoints.filter(p => p.severity !== 'minor').slice(0, 3).map((p, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm" style={{ color: p.severity === 'critical' ? '#e86161' : '#e5a440' }}>
                      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                      <span>{p.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="px-4">
              <div className="glass-tabs">
                {(['sources', 'sinks', 'config'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setSingleActiveTab(tab)}
                    className={cn('glass-tab flex-1 text-center', singleActiveTab === tab && 'active')}
                  >
                    {tab === 'sources' && <>{t('sources')} ({singleSources.length})</>}
                    {tab === 'sinks' && <>{t('sinks')} ({singleSinks.length})</>}
                    {tab === 'config' && <>{t('settings')}</>}
                  </button>
                ))}
              </div>
            </div>

            {/* Tab Content */}
            <div className="p-4 space-y-4">
              {singleActiveTab === 'sources' && (
                <div className="flex flex-wrap gap-2">
                  {singleSources.map(source => (
                    <div key={source.id} className="glass-card p-3 space-y-2 flex-1 min-w-[260px] max-w-[320px]" style={{ borderLeft: '3px solid #3db88a' }}>
                      <div className="flex items-center justify-between">
                        <input type="text" value={source.name} onChange={(e) => updateSingleSource(source.id, { name: e.target.value })} className="input-base font-semibold flex-1 min-w-0" style={{ color: 'var(--text-primary)' }} />
                        <button onClick={() => setSingleSources(singleSources.filter(s => s.id !== source.id))} className="p-1 rounded-lg hover:bg-red-500/20"><Trash2 className="w-3 h-3" style={{ color: 'var(--text-secondary)' }} /></button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <GlassInputField label={t('baseAmount')} value={source.baseAmount} onChange={(v) => updateSingleSource(source.id, { baseAmount: v })} />
                        <div>
                          <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('growthType')}</label>
                          <CustomSelect
                            value={source.growthType}
                            onChange={(v) => updateSingleSource(source.id, { growthType: v as SinglePlayerSource['growthType'] })}
                            options={[
                              { value: 'linear', label: t('growthLinear') },
                              { value: 'exponential', label: t('growthExponential') },
                              { value: 'logarithmic', label: t('growthLogarithmic') },
                            ]}
                            color="#3db88a"
                            size="sm"
                          />
                        </div>
                        <GlassInputField label={t('growthRate')} value={source.growthRate} onChange={(v) => updateSingleSource(source.id, { growthRate: v })} step={0.01} />
                        <div>
                          <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('occurrence')}</label>
                          <CustomSelect
                            value={source.occurrence}
                            onChange={(v) => updateSingleSource(source.id, { occurrence: v as SinglePlayerSource['occurrence'] })}
                            options={[
                              { value: 'per_stage', label: t('perStage') },
                              { value: 'per_enemy', label: t('perEnemy') },
                              { value: 'per_boss', label: t('perBoss') },
                              { value: 'milestone', label: t('milestone') },
                            ]}
                            color="#3db88a"
                            size="sm"
                          />
                        </div>
                        {(source.occurrence === 'per_enemy' || source.occurrence === 'per_boss') && (
                          <GlassInputField label={t('occurrenceCount')} value={source.occurrenceCount || 1} onChange={(v) => updateSingleSource(source.id, { occurrenceCount: v })} />
                        )}
                      </div>
                    </div>
                  ))}
                  <button onClick={addSingleSource} className="glass-card flex items-center justify-center gap-2 px-4 py-3 text-sm min-w-[120px]" style={{ color: '#3db88a', borderStyle: 'dashed' }}>
                    <Plus className="w-3 h-3" /> {t('addSource')}
                  </button>
                </div>
              )}

              {singleActiveTab === 'sinks' && (
                <div className="flex flex-wrap gap-2">
                  {singleSinks.map(sink => (
                    <div key={sink.id} className="glass-card p-3 space-y-2 flex-1 min-w-[260px] max-w-[320px]" style={{ borderLeft: '3px solid #e86161' }}>
                      <div className="flex items-center justify-between">
                        <input type="text" value={sink.name} onChange={(e) => updateSingleSink(sink.id, { name: e.target.value })} className="input-base font-semibold flex-1 min-w-0" style={{ color: 'var(--text-primary)' }} />
                        <button onClick={() => setSingleSinks(singleSinks.filter(s => s.id !== sink.id))} className="p-1 rounded-lg hover:bg-red-500/20"><Trash2 className="w-3 h-3" style={{ color: 'var(--text-secondary)' }} /></button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <GlassInputField label={t('baseCost')} value={sink.baseCost} onChange={(v) => updateSingleSink(sink.id, { baseCost: v })} />
                        <div>
                          <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('growthType')}</label>
                          <CustomSelect
                            value={sink.growthType}
                            onChange={(v) => updateSingleSink(sink.id, { growthType: v as SinglePlayerSink['growthType'] })}
                            options={[
                              { value: 'linear', label: t('growthLinear') },
                              { value: 'exponential', label: t('growthExponential') },
                              { value: 'logarithmic', label: t('growthLogarithmic') },
                            ]}
                            color="#e86161"
                            size="sm"
                          />
                        </div>
                        <GlassInputField label={t('growthRate')} value={sink.growthRate} onChange={(v) => updateSingleSink(sink.id, { growthRate: v })} step={0.01} />
                        <GlassInputField label={t('frequency')} value={sink.frequency} onChange={(v) => updateSingleSink(sink.id, { frequency: v })} step={0.1} />
                        <div>
                          <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>{t('category')}</label>
                          <CustomSelect
                            value={sink.category}
                            onChange={(v) => updateSingleSink(sink.id, { category: v as SinglePlayerSink['category'] })}
                            options={[
                              { value: 'upgrade', label: t('categoryUpgrade') },
                              { value: 'consumable', label: t('categoryConsumable') },
                              { value: 'unlock', label: t('categoryUnlock') },
                              { value: 'repair', label: t('categoryRepair') },
                              { value: 'optional', label: t('categoryOptional') },
                            ]}
                            color="#e86161"
                            size="sm"
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{t('required')}</label>
                          <button
                            onClick={() => updateSingleSink(sink.id, { isRequired: !sink.isRequired })}
                            className="flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors"
                            style={{
                              background: sink.isRequired ? 'rgba(232, 97, 97, 0.15)' : 'var(--bg-secondary)',
                              border: `1px solid ${sink.isRequired ? 'rgba(232, 97, 97, 0.4)' : 'var(--border-primary)'}`,
                              color: sink.isRequired ? '#e86161' : 'var(--text-secondary)'
                            }}
                          >
                            <div className={cn("w-7 h-4 rounded-full relative transition-colors duration-200", sink.isRequired ? "bg-red-500" : "bg-[var(--bg-tertiary)]")} style={{ border: sink.isRequired ? 'none' : '1px solid var(--border-secondary)' }}>
                              <span className={cn("absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full transition-all duration-200 shadow-sm", sink.isRequired ? "left-[14px] bg-white" : "left-0.5 bg-[var(--text-secondary)]")} />
                            </div>
                            <span>{sink.isRequired ? 'ON' : 'OFF'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button onClick={addSingleSink} className="glass-card flex items-center justify-center gap-2 px-4 py-3 text-sm min-w-[120px]" style={{ color: '#e86161', borderStyle: 'dashed' }}>
                    <Plus className="w-3 h-3" /> {t('addSink')}
                  </button>
                </div>
              )}

              {singleActiveTab === 'config' && (
                <div className="flex flex-wrap gap-3 items-end">
                  <GlassConfigInput label={t('currencyName')} value={singleConfig.currencyName} onChange={(v) => setSingleConfig({ ...singleConfig, currencyName: String(v) })} type="text" />
                  <GlassConfigInput label={t('totalStages')} value={singleConfig.totalStages} onChange={(v) => setSingleConfig({ ...singleConfig, totalStages: Number(v) })} />
                  <GlassConfigInput label={t('initialCurrency')} value={singleConfig.initialCurrency} onChange={(v) => setSingleConfig({ ...singleConfig, initialCurrency: Number(v) })} />
                  <GlassConfigInput label={t('earlyGameEnd')} value={singleConfig.earlyGameEnd} onChange={(v) => setSingleConfig({ ...singleConfig, earlyGameEnd: Number(v) })} />
                  <GlassConfigInput label={t('midGameEnd')} value={singleConfig.midGameEnd} onChange={(v) => setSingleConfig({ ...singleConfig, midGameEnd: Number(v) })} />
                  <GlassConfigInput label={t('difficultyMultiplier')} value={singleConfig.difficultyMultiplier} onChange={(v) => setSingleConfig({ ...singleConfig, difficultyMultiplier: Number(v) })} step={0.1} />
                  <button onClick={() => { setSingleSources(DEFAULT_SINGLE_SOURCES); setSingleSinks(DEFAULT_SINGLE_SINKS); setSingleConfig(DEFAULT_SINGLE_CONFIG); }} className="glass-button flex items-center gap-1.5 text-sm">
                    <RefreshCw className="w-3 h-3" /> {t('resetDefaults')}
                  </button>
                  <button onClick={handleExport} className="glass-button-primary flex items-center gap-1.5 text-sm">
                    <Download className="w-3 h-3" /> {t('exportResults')}
                  </button>
                </div>
              )}

              {/* Balance Chart */}
              <div className="glass-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('balanceOverStages')} ({singleConfig.totalStages} {t('stages')})</h3>
                  <button onClick={() => setFullscreenChart(true)} className="p-1.5 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"><Maximize2 className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} /></button>
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={singleResult.stageData.filter((_, i) => i % Math.max(1, Math.floor(singleConfig.totalStages / 50)) === 0 || i === singleResult.stageData.length - 1)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                      <XAxis dataKey="stage" tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={{ stroke: 'var(--border-primary)' }} />
                      <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} axisLine={{ stroke: 'var(--border-primary)' }} tickFormatter={(v) => formatNumber(v)} />
                      <Tooltip contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: '12px', fontSize: '12px' }} formatter={(value: number, name: string) => [formatNumber(value), name === 'cumulativeBalance' ? t('balance') : name === 'income' ? t('income') : t('expense')]} labelFormatter={(stage) => `${t('stage')} ${stage}`} />
                      <Line type="monotone" dataKey="cumulativeBalance" stroke="#5a9cf5" strokeWidth={2} dot={false} name="cumulativeBalance" />
                      <Line type="monotone" dataKey="income" stroke="#3db88a" strokeWidth={1} dot={false} name="income" />
                      <Line type="monotone" dataKey="expense" stroke="#e86161" strokeWidth={1} dot={false} name="expense" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Pacing Analysis */}
              <div className="grid grid-cols-3 gap-3">
                {(['early', 'mid', 'late'] as const).map((phase, idx) => {
                  const ratio = phase === 'early' ? singleResult.pacing.earlyGameRatio : phase === 'mid' ? singleResult.pacing.midGameRatio : singleResult.pacing.lateGameRatio;
                  const targetRatio = phase === 'early' ? 1.2 : phase === 'mid' ? 1.0 : 0.9;
                  const isGood = ratio >= targetRatio * 0.9;
                  return (
                    <div key={phase} className="glass-card p-3">
                      <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                        {phase === 'early' ? t('phaseEarly') : phase === 'mid' ? t('phaseMid') : t('phaseLate')}
                      </h4>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="text-xl font-bold" style={{ color: isGood ? '#3db88a' : '#e5a440' }}>{ratio.toFixed(2)}</div>
                        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>({t('target')}: {targetRatio})</div>
                      </div>
                      <div className="glass-progress h-2">
                        <div className="glass-progress-bar" style={{ width: `${Math.min(100, (ratio / 2) * 100)}%`, background: isGood ? '#3db88a' : '#e5a440' }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Recommendations */}
              <div className="glass-card p-4" style={{ background: `linear-gradient(135deg, ${singleResult.pacing.isBalanced ? '#3db88a' : '#e5a440'}10, transparent)` }}>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: singleResult.pacing.isBalanced ? '#3db88a' : '#e5a440' }}><Info className="w-4 h-4" /> {t('recommendations')}</h3>
                <div className="space-y-1">
                  {singleResult.recommendations.map((rec, i) => (
                    <p key={i} className="text-sm" style={{ color: 'var(--text-secondary)' }}>• {rec}</p>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Fullscreen Chart Modal */}
      {fullscreenChart && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(0, 0, 0, 0.8)' }} onClick={() => setFullscreenChart(false)}>
          <div className="glass-panel w-full h-[90vh] sm:h-full max-w-6xl sm:max-h-[90vh] p-4 sm:p-6 flex flex-col rounded-t-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {gameMode === 'online'
                  ? `${t('supplyOverTime')} (${config.simulationDays}${t('days')})`
                  : `${t('balanceOverStages')} (${singleConfig.totalStages} ${t('stages')})`
                }
              </h2>
              <button onClick={() => setFullscreenChart(false)} className="glass-button !p-2"><X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} /></button>
            </div>
            <div className="flex-1 min-h-0">
              {gameMode === 'online' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={result.supplyOverTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                    <XAxis dataKey="day" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={{ stroke: 'var(--border-primary)' }} />
                    <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={{ stroke: 'var(--border-primary)' }} tickFormatter={(v) => formatNumber(v)} />
                    <Tooltip contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: '12px', fontSize: '14px' }} formatter={(value: number) => [formatNumber(value), t('supply')]} labelFormatter={(day) => `Day ${day}`} />
                    <Line type="monotone" dataKey="supply" stroke="#5a9cf5" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={singleResult.stageData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                    <XAxis dataKey="stage" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={{ stroke: 'var(--border-primary)' }} />
                    <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={{ stroke: 'var(--border-primary)' }} tickFormatter={(v) => formatNumber(v)} />
                    <Tooltip
                      contentStyle={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', borderRadius: '12px', fontSize: '14px' }}
                      formatter={(value: number, name: string) => [formatNumber(value), name === 'cumulativeBalance' ? t('balance') : name === 'income' ? t('income') : t('expense')]}
                      labelFormatter={(stage) => `${t('stage')} ${stage}`}
                    />
                    <Line type="monotone" dataKey="cumulativeBalance" stroke="#5a9cf5" strokeWidth={2} dot={false} name="cumulativeBalance" />
                    <Line type="monotone" dataKey="income" stroke="#3db88a" strokeWidth={1.5} dot={false} name="income" />
                    <Line type="monotone" dataKey="expense" stroke="#e86161" strokeWidth={1.5} dot={false} name="expense" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}
    </PanelShell>
  );
}

function GlassInputField({ label, value, onChange, step = 1, min, max }: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number }) {
  const t = useTranslations('economy');
  const [inputValue, setInputValue] = useState(String(value));
  const [isHovered, setIsHovered] = useState(false);
  const { startCellSelection, cellSelectionMode } = useProjectStore();

  useEffect(() => { setInputValue(String(value)); }, [value]);

  const handleCellSelect = () => {
    startCellSelection(label, (cellValue) => { setInputValue(String(cellValue)); onChange(cellValue); });
  };

  return (
    <div>
      <label className="text-sm font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      <div className="relative" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
        <input
          type="text"
          inputMode="decimal"
          value={inputValue}
          onChange={(e) => { const v = e.target.value; if (v === '' || /^-?\d*\.?\d*$/.test(v)) { setInputValue(v); const n = parseFloat(v); if (!isNaN(n)) onChange(n); } }}
          onBlur={() => { const n = parseFloat(inputValue); if (isNaN(n) || inputValue === '') { setInputValue(String(min ?? 0)); onChange(min ?? 0); } else { setInputValue(String(n)); } }}
          className="glass-input w-full !py-1.5 pr-7 text-sm"
        />
        {isHovered && !cellSelectionMode.active && (
          <TooltipUI content={t('selectFromCell')} position="top">
            <button onClick={handleCellSelect} className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"><Grid3X3 className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} /></button>
          </TooltipUI>
        )}
      </div>
    </div>
  );
}

function GlassConfigInput({ label, value, onChange, step = 1, type = 'number' }: { label: string; value: number | string; onChange: (v: number | string) => void; step?: number; type?: 'number' | 'text' }) {
  const t = useTranslations('economy');
  const [inputValue, setInputValue] = useState(String(value));
  const [isHovered, setIsHovered] = useState(false);
  const { startCellSelection, cellSelectionMode } = useProjectStore();
  const isNumeric = type === 'number';

  useEffect(() => { setInputValue(String(value)); }, [value]);

  const handleCellSelect = () => {
    startCellSelection(label, (cellValue) => { setInputValue(String(cellValue)); onChange(isNumeric ? cellValue : String(cellValue)); });
  };

  return (
    <div className="min-w-[140px]">
      <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      <div className="relative" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
        <input
          type="text"
          inputMode={isNumeric ? "decimal" : "text"}
          value={inputValue}
          onChange={(e) => { const v = e.target.value; if (!isNumeric) { setInputValue(v); onChange(v); } else if (v === '' || /^-?\d*\.?\d*$/.test(v)) { setInputValue(v); const n = parseFloat(v); if (!isNaN(n)) onChange(n); } }}
          onBlur={() => { if (isNumeric) { const n = parseFloat(inputValue); if (isNaN(n) || inputValue === '') { setInputValue('0'); onChange(0); } else { setInputValue(String(n)); } } }}
          className="glass-input w-full pr-9 text-sm"
        />
        {isHovered && !cellSelectionMode.active && isNumeric && (
          <TooltipUI content={t('selectFromCell')} position="top">
            <button onClick={handleCellSelect} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"><Grid3X3 className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} /></button>
          </TooltipUI>
        )}
      </div>
    </div>
  );
}
