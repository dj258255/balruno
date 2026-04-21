'use client';

import { useState, useMemo, useEffect } from 'react';
import { X, Calculator as CalcIcon, Crosshair, Zap, Shield, TrendingUp, Download, ChevronDown, Grid3X3 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { DPS, TTK, EHP, DAMAGE, SCALE } from '@/lib/formulaEngine';
import { useProjectStore } from '@/stores/projectStore';
import { Tooltip } from '@/components/ui/Tooltip';
import { useEscapeKey } from '@/hooks';
import PanelShell, { HelpToggle } from '@/components/ui/PanelShell';
import CustomSelect from '@/components/ui/CustomSelect';

const PANEL_COLOR = '#9179f2'; // 소프트 퍼플

function getRowDisplayName(rowId: string, currentSheet: { name: string; rows: { id: string }[] } | undefined, t: ReturnType<typeof useTranslations>): string {
  if (!currentSheet) return t('sheet.rows');
  const rowIndex = currentSheet.rows.findIndex(r => r.id === rowId);
  return `${currentSheet.name} - ${t('comparison.rowNum', { num: rowIndex + 1 })}`;
}

interface CalculatorProps {
  onClose: () => void;
  isPanel?: boolean;
  showHelp?: boolean;
  setShowHelp?: (value: boolean) => void;
}

type CalculatorTab = 'dps' | 'ttk' | 'ehp' | 'damage' | 'scale';

const getTabHelp = (t: ReturnType<typeof useTranslations>) => ({
  dps: { title: t('dps.title'), description: t('dps.desc'), formula: t('dps.formula'), terms: [{ name: t('dps.damage'), desc: t('dps.damageDesc') }, { name: t('dps.attackSpeed'), desc: t('dps.attackSpeedDesc') }, { name: t('dps.critRate'), desc: t('dps.critRateDesc') }, { name: t('dps.critDamage'), desc: t('dps.critDamageDesc') }], example: t('dps.example'), useCase: t('dps.useCase') },
  ttk: { title: t('ttk.title'), description: t('ttk.desc'), formula: t('ttk.formula'), terms: [{ name: t('ttk.targetHp'), desc: t('ttk.targetHpDesc') }, { name: t('ttk.damage'), desc: t('ttk.damageDesc') }, { name: t('ttk.attackSpeed'), desc: t('ttk.attackSpeedDesc') }], example: t('ttk.example'), useCase: t('ttk.useCase') },
  ehp: { title: t('ehp.title'), description: t('ehp.desc'), formula: t('ehp.formula'), terms: [{ name: t('ehp.hp'), desc: t('ehp.hpDesc') }, { name: t('ehp.def'), desc: t('ehp.defDesc') }, { name: t('ehp.reduction'), desc: t('ehp.reductionDesc') }], example: t('ehp.example'), useCase: t('ehp.useCase') },
  damage: { title: t('damageCalc.title'), description: t('damageCalc.desc'), formula: t('damageCalc.formula'), terms: [{ name: t('damageCalc.atk'), desc: t('damageCalc.atkDesc') }, { name: t('damageCalc.def'), desc: t('damageCalc.defDesc') }, { name: t('damageCalc.multiplier'), desc: t('damageCalc.multiplierDesc') }], example: t('damageCalc.example'), useCase: t('damageCalc.useCase') },
  scale: { title: t('scale.title'), description: t('scale.desc'), formula: t('scale.formula'), terms: [{ name: t('scale.base'), desc: t('scale.baseDesc') }, { name: t('scale.level'), desc: t('scale.levelDesc') }, { name: t('scale.rate'), desc: t('scale.rateDesc') }, { name: t('scale.curveType'), desc: t('scale.curveTypeDesc') }], example: t('scale.example'), useCase: t('scale.useCase') },
});

const getCurveTypeHelp = (t: ReturnType<typeof useTranslations>): Record<string, { name: string; formula: string; description: string; useCase: string }> => ({
  linear: { name: t('curveHelp.linear.name'), formula: t('curveHelp.linear.formula'), description: t('curveHelp.linear.desc'), useCase: t('curveHelp.linear.useCase') },
  exponential: { name: t('curveHelp.exponential.name'), formula: t('curveHelp.exponential.formula'), description: t('curveHelp.exponential.desc'), useCase: t('curveHelp.exponential.useCase') },
  logarithmic: { name: t('curveHelp.logarithmic.name'), formula: t('curveHelp.logarithmic.formula'), description: t('curveHelp.logarithmic.desc'), useCase: t('curveHelp.logarithmic.useCase') },
  quadratic: { name: t('curveHelp.quadratic.name'), formula: t('curveHelp.quadratic.formula'), description: t('curveHelp.quadratic.desc'), useCase: t('curveHelp.quadratic.useCase') },
});

const TAB_COLORS = {
  dps: '#e5a440',
  ttk: '#e86161',
  ehp: '#5a9cf5',
  damage: '#e87aa8',
  scale: '#3db88a',
};

export default function Calculator({ onClose, isPanel = false, showHelp = false, setShowHelp }: CalculatorProps) {
  const t = useTranslations('calculator');
  const [activeTab, setActiveTab] = useState<CalculatorTab>('dps');
  const [showTabDropdown, setShowTabDropdown] = useState(false);
  const { selectedRows, clearSelectedRows, deselectRow, projects, currentProjectId, currentSheetId } = useProjectStore();

  useEscapeKey(onClose);

  const currentProject = projects.find(p => p.id === currentProjectId);
  const currentSheet = currentProject?.sheets.find(s => s.id === currentSheetId);
  const TAB_HELP = useMemo(() => getTabHelp(t), [t]);
  const CURVE_TYPE_HELP = useMemo(() => getCurveTypeHelp(t), [t]);

  const [dpsInputs, setDpsInputs] = useState({ damage: 100, attackSpeed: 1.5, critRate: 0.2, critDamage: 2.0 });
  const [ttkInputs, setTtkInputs] = useState({ targetHP: 1000, damage: 100, attackSpeed: 1.5 });
  const [ehpInputs, setEhpInputs] = useState({ hp: 1000, def: 50, damageReduction: 0 });
  const [damageInputs, setDamageInputs] = useState({ atk: 150, def: 50, multiplier: 1 });
  const [scaleInputs, setScaleInputs] = useState({ base: 100, level: 10, rate: 1.1, curveType: 'linear' as string });

  const dpsResult = useMemo(() => DPS(dpsInputs.damage, dpsInputs.attackSpeed, dpsInputs.critRate, dpsInputs.critDamage), [dpsInputs]);
  const ttkResult = useMemo(() => { const ttk = TTK(ttkInputs.targetHP, ttkInputs.damage, ttkInputs.attackSpeed); const hitsNeeded = Math.ceil(ttkInputs.targetHP / ttkInputs.damage); return { ttk, hitsNeeded }; }, [ttkInputs]);
  const ehpResult = useMemo(() => EHP(ehpInputs.hp, ehpInputs.def, ehpInputs.damageReduction), [ehpInputs]);
  const damageResult = useMemo(() => DAMAGE(damageInputs.atk, damageInputs.def, damageInputs.multiplier), [damageInputs]);
  const scaleResult = useMemo(() => SCALE(scaleInputs.base, scaleInputs.level, scaleInputs.rate, scaleInputs.curveType), [scaleInputs]);

  const scaleData = useMemo(() => {
    const data = [];
    for (let lv = 1; lv <= 100; lv += 5) {
      data.push({ level: lv, value: SCALE(scaleInputs.base, lv, scaleInputs.rate, scaleInputs.curveType) });
    }
    return data;
  }, [scaleInputs]);

  const tabs = [
    { id: 'dps' as const, name: 'DPS', icon: Zap, tooltip: t('tabTooltip.dps') },
    { id: 'ttk' as const, name: 'TTK', icon: Crosshair, tooltip: t('tabTooltip.ttk') },
    { id: 'ehp' as const, name: 'EHP', icon: Shield, tooltip: t('tabTooltip.ehp') },
    { id: 'damage' as const, name: 'DAMAGE', icon: CalcIcon, tooltip: t('tabTooltip.damage') },
    { id: 'scale' as const, name: 'SCALE', icon: TrendingUp, tooltip: t('tabTooltip.scale') },
  ];

  const loadFromSelectedRow = (row: typeof selectedRows[0]) => {
    if (activeTab === 'dps') {
      const damage = Number(row.values['damage'] || row.values['ATK'] || 0);
      const attackSpeed = Number(row.values['attackSpeed'] || 1);
      const critRate = Number(row.values['critRate'] || 0);
      const critDamage = Number(row.values['critDamage'] || 2);
      setDpsInputs({ damage, attackSpeed, critRate, critDamage });
    } else if (activeTab === 'ttk') {
      const targetHP = Number(row.values['HP'] || 1000);
      const damage = Number(row.values['damage'] || 100);
      const attackSpeed = Number(row.values['attackSpeed'] || 1);
      setTtkInputs({ targetHP, damage, attackSpeed });
    } else if (activeTab === 'ehp') {
      const hp = Number(row.values['HP'] || 1000);
      const def = Number(row.values['DEF'] || 0);
      const damageReduction = Number(row.values['damageReduction'] || 0);
      setEhpInputs({ hp, def, damageReduction });
    } else if (activeTab === 'damage') {
      const atk = Number(row.values['ATK'] || 100);
      const def = Number(row.values['DEF'] || 0);
      const multiplier = Number(row.values['multiplier'] || 1);
      setDamageInputs({ atk, def, multiplier });
    } else if (activeTab === 'scale') {
      const base = Number(row.values['base'] || 100);
      const level = Number(row.values['level'] || 1);
      const rate = Number(row.values['rate'] || 1.1);
      setScaleInputs({ ...scaleInputs, base, level, rate });
    }
  };

  const tabColor = TAB_COLORS[activeTab];

  const modalHeader = (
    <div className="flex items-center justify-between shrink-0 px-4 sm:px-6 py-3 sm:py-4 border-b" style={{ borderColor: 'var(--border-primary)' }}>
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="rounded-xl flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10" style={{ background: `linear-gradient(135deg, ${PANEL_COLOR}, ${PANEL_COLOR}cc)` }}>
          <CalcIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{t('fullTitle')}</h2>
          <p className="text-sm sm:text-sm hidden sm:block" style={{ color: 'var(--text-secondary)' }}>{t('subtitle')}</p>
        </div>
      </div>
      <button onClick={onClose} className="rounded-lg transition-colors p-2" style={{ color: 'var(--text-secondary)' }}><X className="w-5 h-5" /></button>
    </div>
  );

  const body = (
    <>
      {/* 수식 선택 드롭다운 */}
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="relative flex-1">
            <button
              onClick={() => setShowTabDropdown(!showTabDropdown)}
              className="glass-card w-full flex items-center justify-center gap-2 px-4 py-3 transition-all hover:shadow-md"
              style={{ borderLeft: `3px solid ${tabColor}` }}
            >
              {(() => {
                const currentTab = tabs.find(t => t.id === activeTab);
                const Icon = currentTab?.icon || Zap;
                return (
                  <>
                    <Icon className="w-4 h-4" style={{ color: tabColor }} />
                    <span className="text-sm font-bold flex-1" style={{ color: 'var(--text-primary)' }}>{currentTab?.name}</span>
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{currentTab?.tooltip}</span>
                    <ChevronDown className={cn("w-4 h-4 transition-transform duration-200 ml-1", showTabDropdown && "rotate-180")} style={{ color: 'var(--text-secondary)' }} />
                  </>
                );
              })()}
            </button>
            {showTabDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowTabDropdown(false)} />
                <div className="absolute left-0 right-0 top-full mt-1 glass-panel z-50 overflow-hidden p-1">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id); setShowTabDropdown(false); }}
                        className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all", isActive ? "" : "hover:bg-black/5 dark:hover:bg-white/5")}
                        style={{ background: isActive ? `${TAB_COLORS[tab.id]}15` : undefined }}
                      >
                        <Icon className="w-4 h-4 shrink-0" style={{ color: TAB_COLORS[tab.id] }} />
                        <span className="text-sm font-semibold" style={{ color: isActive ? TAB_COLORS[tab.id] : 'var(--text-primary)' }}>{tab.name}</span>
                        <span className="text-sm flex-1 text-right" style={{ color: 'var(--text-secondary)' }}>{tab.tooltip}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 선택된 행 데이터 */}
        {selectedRows.length > 0 && (
          <div className="mx-4 mb-3 glass-card p-3" style={{ background: `${tabColor}10` }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm font-medium" style={{ color: tabColor }}>
                <Download className="w-3.5 h-3.5" />
                <span>{t('selectedData')} ({selectedRows.length})</span>
              </div>
              <button onClick={clearSelectedRows} className="text-sm px-2 py-1 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5" style={{ color: 'var(--text-secondary)' }}>{t('deselectAll')}</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {selectedRows.map((row) => (
                <div key={row.rowId} className="glass-badge flex items-center gap-1.5 pr-1">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{getRowDisplayName(row.rowId, currentSheet, t)}</span>
                  <button onClick={() => loadFromSelectedRow(row)} className="px-1.5 py-0.5 rounded-md text-sm font-semibold transition-colors" style={{ background: tabColor, color: 'white' }}>{t('load')}</button>
                  <button onClick={() => deselectRow(row.rowId)} className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10"><X className="w-3 h-3" style={{ color: 'var(--text-secondary)' }} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 컨텐츠 */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4 space-y-4 scrollbar-slim">
          {/* 도움말 */}
          {showHelp && (
            <div className="glass-card p-4 animate-slideDown">
              <div className="font-semibold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>{t('helpTitle')}</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'DPS', desc: 'Damage Per Second', color: TAB_COLORS.dps },
                  { key: 'TTK', desc: 'Time To Kill', color: TAB_COLORS.ttk },
                  { key: 'EHP', desc: 'Effective HP', color: TAB_COLORS.ehp },
                  { key: 'DAMAGE', desc: 'Final Damage', color: TAB_COLORS.damage },
                  { key: 'SCALE', desc: 'Level Scaling', color: TAB_COLORS.scale },
                ].map(item => (
                  <div key={item.key} className="glass-section p-2 flex items-center gap-2">
                    <span className="font-mono font-bold text-sm" style={{ color: item.color }}>{item.key}</span>
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* DPS */}
          {activeTab === 'dps' && (
            <div className="space-y-4">
              <div className="glass-card p-4" style={{ borderLeft: `3px solid ${tabColor}` }}>
                <div className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>{TAB_HELP.dps.title}</div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{TAB_HELP.dps.description}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <GlassInputField label={t('damage1hit')} value={dpsInputs.damage} onChange={(v) => setDpsInputs({ ...dpsInputs, damage: v })} />
                <GlassInputField label={t('attackSpeed')} value={dpsInputs.attackSpeed} onChange={(v) => setDpsInputs({ ...dpsInputs, attackSpeed: v })} step={0.1} />
                <GlassInputField label={t('critRate')} value={dpsInputs.critRate} onChange={(v) => setDpsInputs({ ...dpsInputs, critRate: v })} step={0.01} min={0} max={1} />
                <GlassInputField label={t('critMultiplier')} value={dpsInputs.critDamage} onChange={(v) => setDpsInputs({ ...dpsInputs, critDamage: v })} step={0.1} />
              </div>
              <GlassResultCard label={t('dpsResult')} value={dpsResult.toFixed(2)} color={tabColor} extra={`${t('baseDps')}: ${(dpsInputs.damage * dpsInputs.attackSpeed).toFixed(2)} | ${t('critBonus')}: +${((dpsResult / (dpsInputs.damage * dpsInputs.attackSpeed) - 1) * 100).toFixed(1)}%`} />
              <GlassFormulaBox formula="damage x (1 + critRate x (critDamage - 1)) x attackSpeed" hint={t('dpsFormulaHint')} color={tabColor} />
            </div>
          )}

          {/* TTK */}
          {activeTab === 'ttk' && (
            <div className="space-y-4">
              <div className="glass-card p-4" style={{ borderLeft: `3px solid ${tabColor}` }}>
                <div className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>{TAB_HELP.ttk.title}</div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{TAB_HELP.ttk.description}</div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <GlassInputField label={t('targetHp')} value={ttkInputs.targetHP} onChange={(v) => setTtkInputs({ ...ttkInputs, targetHP: v })} />
                <GlassInputField label={t('damage1')} value={ttkInputs.damage} onChange={(v) => setTtkInputs({ ...ttkInputs, damage: v })} />
                <GlassInputField label={t('attackSpeed')} value={ttkInputs.attackSpeed} onChange={(v) => setTtkInputs({ ...ttkInputs, attackSpeed: v })} step={0.1} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <GlassResultCard label={t('ttkResult')} value={ttkResult.ttk === Infinity ? '-' : `${ttkResult.ttk.toFixed(2)}s`} color={tabColor} />
                <GlassResultCard label={t('hitsRequired')} value={`${ttkResult.hitsNeeded}`} color="#e5a440" />
              </div>
              <GlassFormulaBox formula="(ceil(targetHP / damage) - 1) / attackSpeed" hint={t('ttkFormulaHint')} color={tabColor} />
            </div>
          )}

          {/* EHP */}
          {activeTab === 'ehp' && (
            <div className="space-y-4">
              <div className="glass-card p-4" style={{ borderLeft: `3px solid ${tabColor}` }}>
                <div className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>{TAB_HELP.ehp.title}</div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{TAB_HELP.ehp.description}</div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <GlassInputField label={t('hp')} value={ehpInputs.hp} onChange={(v) => setEhpInputs({ ...ehpInputs, hp: v })} />
                <GlassInputField label={t('def')} value={ehpInputs.def} onChange={(v) => setEhpInputs({ ...ehpInputs, def: v })} />
                <GlassInputField label={t('damageReduction')} value={ehpInputs.damageReduction} onChange={(v) => setEhpInputs({ ...ehpInputs, damageReduction: v })} step={0.01} min={0} max={0.99} />
              </div>
              <GlassResultCard label={t('ehpResult')} value={ehpResult.toFixed(0)} color={tabColor} extra={`${t('vsOriginal')} ${((ehpResult / ehpInputs.hp) * 100).toFixed(1)}% (x${(ehpResult / ehpInputs.hp).toFixed(2)})`} />
              <GlassFormulaBox formula="hp x (1 + def/100) x (1 / (1 - damageReduction))" hint={t('ehpFormulaHint')} color={tabColor} />
            </div>
          )}

          {/* DAMAGE */}
          {activeTab === 'damage' && (
            <div className="space-y-4">
              <div className="glass-card p-4" style={{ borderLeft: `3px solid ${tabColor}` }}>
                <div className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>{TAB_HELP.damage.title}</div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{TAB_HELP.damage.description}</div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <GlassInputField label={t('atk')} value={damageInputs.atk} onChange={(v) => setDamageInputs({ ...damageInputs, atk: v })} />
                <GlassInputField label={t('def')} value={damageInputs.def} onChange={(v) => setDamageInputs({ ...damageInputs, def: v })} />
                <GlassInputField label={t('skillMultiplier')} value={damageInputs.multiplier} onChange={(v) => setDamageInputs({ ...damageInputs, multiplier: v })} step={0.1} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <GlassResultCard label={t('finalDamage')} value={damageResult.toFixed(1)} color={tabColor} />
                <GlassResultCard label={t('damageReductionRate')} value={`${((1 - 100 / (100 + damageInputs.def)) * 100).toFixed(1)}%`} color="var(--text-secondary)" />
              </div>
              <GlassFormulaBox formula="atk x (100 / (100 + def)) x multiplier" hint={t('damageFormulaHint')} color={tabColor} />
            </div>
          )}

          {/* SCALE */}
          {activeTab === 'scale' && (
            <div className="space-y-4">
              <div className="glass-card p-4" style={{ borderLeft: `3px solid ${tabColor}` }}>
                <div className="font-semibold text-sm mb-1" style={{ color: 'var(--text-primary)' }}>{TAB_HELP.scale.title}</div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{TAB_HELP.scale.description}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <GlassInputField label={t('baseValue')} value={scaleInputs.base} onChange={(v) => setScaleInputs({ ...scaleInputs, base: v })} />
                <GlassInputField label={t('level')} value={scaleInputs.level} onChange={(v) => setScaleInputs({ ...scaleInputs, level: v })} />
                <GlassInputField label={t('growthRate')} value={scaleInputs.rate} onChange={(v) => setScaleInputs({ ...scaleInputs, rate: v })} step={0.01} />
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('curveType')}</label>
                  <CustomSelect
                    value={scaleInputs.curveType}
                    onChange={(v) => setScaleInputs({ ...scaleInputs, curveType: v })}
                    options={[
                      { value: 'linear', label: t('curveLinear') },
                      { value: 'exponential', label: t('curveExponential') },
                      { value: 'logarithmic', label: t('curveLogarithmic') },
                      { value: 'quadratic', label: t('curveQuadratic') },
                    ]}
                    color={tabColor}
                    size="sm"
                  />
                </div>
              </div>
              {CURVE_TYPE_HELP[scaleInputs.curveType] && (
                <div className="glass-section p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm" style={{ color: tabColor }}>{CURVE_TYPE_HELP[scaleInputs.curveType].name}</span>
                    <code className="text-sm px-2 py-0.5 rounded-lg" style={{ background: `${tabColor}15`, color: tabColor }}>{CURVE_TYPE_HELP[scaleInputs.curveType].formula}</code>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{CURVE_TYPE_HELP[scaleInputs.curveType].description}</p>
                </div>
              )}
              <GlassResultCard label={t('levelStat', { level: scaleInputs.level })} value={scaleResult.toFixed(1)} color={tabColor} />
              <div className="glass-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'rgba(0,0,0,0.03)' }}>
                      <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--text-secondary)' }}>{t('level')}</th>
                      {scaleData.slice(0, 8).map((d) => (
                        <th key={d.level} className="px-2 py-2 text-right font-medium" style={{ color: 'var(--text-secondary)' }}>{d.level}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-3 py-2 font-semibold" style={{ color: 'var(--text-primary)' }}>{t('value')}</td>
                      {scaleData.slice(0, 8).map((d) => (
                        <td key={d.level} className="px-2 py-2 text-right" style={{ color: tabColor }}>{d.value.toFixed(0)}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
    </>
  );

  if (isPanel) {
    return (
      <PanelShell
        title={t('fullTitle')}
        subtitle={t('subtitle')}
        icon={CalcIcon}
        iconColor={PANEL_COLOR}
        onClose={onClose}
        bodyClassName="p-0 flex flex-col overflow-hidden"
        actions={setShowHelp ? <HelpToggle active={showHelp} onToggle={() => setShowHelp(!showHelp)} color={PANEL_COLOR} /> : undefined}
      >
        {body}
      </PanelShell>
    );
  }

  return (
    <div className="fixed inset-0 modal-overlay flex items-center justify-center z-[1100] p-2 sm:p-4">
      <div className="card w-full max-w-2xl max-h-[95vh] sm:max-h-[85vh] flex flex-col animate-fadeIn">
        {modalHeader}
        {body}
      </div>
    </div>
  );
}

function GlassInputField({ label, value, onChange, step = 1, min, max }: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number }) {
  const [inputValue, setInputValue] = useState(String(value));
  const [isHovered, setIsHovered] = useState(false);
  const { startCellSelection, cellSelectionMode } = useProjectStore();

  useEffect(() => { setInputValue(String(value)); }, [value]);

  const handleCellSelect = () => {
    startCellSelection(label, (cellValue) => { setInputValue(String(cellValue)); onChange(cellValue); });
  };

  return (
    <div onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={inputValue}
          onChange={(e) => { const newValue = e.target.value; if (newValue === '' || /^-?\d*\.?\d*$/.test(newValue)) { setInputValue(newValue); const num = parseFloat(newValue); if (!isNaN(num)) onChange(num); } }}
          onBlur={() => { const num = parseFloat(inputValue); if (isNaN(num) || inputValue === '') { setInputValue(String(min ?? 0)); onChange(min ?? 0); } else { setInputValue(String(num)); } }}
          className="glass-input w-full pr-9 text-sm"
        />
        {isHovered && !cellSelectionMode.active && (
          <Tooltip content="Select from cell" position="top">
            <button onClick={handleCellSelect} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5">
              <Grid3X3 className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

function GlassResultCard({ label, value, color, extra }: { label: string; value: string; color: string; extra?: string }) {
  return (
    <div className="glass-stat">
      <div className="text-sm mb-1 font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</div>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      {extra && <div className="text-sm mt-1.5" style={{ color: 'var(--text-secondary)' }}>{extra}</div>}
    </div>
  );
}

function GlassFormulaBox({ formula, hint, color }: { formula: string; hint?: string; color: string }) {
  return (
    <div className="glass-section p-3" style={{ borderLeft: `3px solid ${color}` }}>
      <div className="text-sm mb-1 font-medium" style={{ color: 'var(--text-secondary)' }}>Formula</div>
      <code className="text-sm font-mono font-semibold" style={{ color }}>{formula}</code>
      {hint && <div className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>{hint}</div>}
    </div>
  );
}
