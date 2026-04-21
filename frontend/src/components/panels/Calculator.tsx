'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { X, Calculator as CalcIcon, Crosshair, Zap, Shield, TrendingUp, Download, ChevronDown, Grid3X3, Sliders, BarChart3 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { DPS, TTK, EHP, DAMAGE, SCALE } from '@/lib/formulaEngine';
import { useProjectStore } from '@/stores/projectStore';
import { Tooltip } from '@/components/ui/Tooltip';
import { useEscapeKey } from '@/hooks';
import PanelShell, { HelpToggle } from '@/components/ui/PanelShell';
import CustomSelect from '@/components/ui/CustomSelect';
import { useCalculatorStore } from '@/stores/calculatorStore';
import { bisect } from '@/lib/bisection';
import { Target as TargetIcon } from 'lucide-react';

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

  // Scenario A/B — 현재 탭 입력 스냅샷 저장/비교 (Raidbots Top Gear / Excel Scenario Manager 패턴)
  const [scenarioA, setScenarioA] = useState<Record<string, Record<string, number | string>> | null>(null);
  const [scenarioB, setScenarioB] = useState<Record<string, Record<string, number | string>> | null>(null);

  // History — 입력 변경 snapshot. Cmd+Z 로 직전 입력 복원 (최대 20개)
  type AllInputs = { dps: typeof dpsInputs; ttk: typeof ttkInputs; ehp: typeof ehpInputs; damage: typeof damageInputs; scale: typeof scaleInputs };
  const [history, setHistory] = useState<AllInputs[]>([]);
  const pushHistory = useCallback(() => {
    setHistory((prev) => [...prev.slice(-19), { dps: { ...dpsInputs }, ttk: { ...ttkInputs }, ehp: { ...ehpInputs }, damage: { ...damageInputs }, scale: { ...scaleInputs } }]);
  }, [dpsInputs, ttkInputs, ehpInputs, damageInputs, scaleInputs]);
  const undoHistory = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const snap = prev[prev.length - 1];
      setDpsInputs(snap.dps);
      setTtkInputs(snap.ttk);
      setEhpInputs(snap.ehp);
      setDamageInputs(snap.damage);
      setScaleInputs(snap.scale);
      return prev.slice(0, -1);
    });
  }, []);

  // Cmd/Ctrl+Z 키 핸들러
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoHistory();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undoHistory]);

  // 입력 변경 전 현재 상태 history 에 push 하는 wrapper (각 setter)
  const setDpsWithHistory = (next: typeof dpsInputs) => { pushHistory(); setDpsInputs(next); };
  const setTtkWithHistory = (next: typeof ttkInputs) => { pushHistory(); setTtkInputs(next); };
  const setEhpWithHistory = (next: typeof ehpInputs) => { pushHistory(); setEhpInputs(next); };

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

        {/* ans 변수 chip — 다른 탭에서 저장한 결과 불러오기 (Desmos ans 패턴) */}
        <AnsChip tabColor={tabColor} activeTab={activeTab}
          onApply={(val) => {
            // 활성 탭의 첫 입력란에 ans 값 주입
            if (activeTab === 'dps') setDpsInputs((p) => ({ ...p, damage: val }));
            else if (activeTab === 'ttk') setTtkInputs((p) => ({ ...p, damage: val }));
            else if (activeTab === 'ehp') setEhpInputs((p) => ({ ...p, hp: val }));
            else if (activeTab === 'damage') setDamageInputs((p) => ({ ...p, atk: val }));
            else if (activeTab === 'scale') setScaleInputs((p) => ({ ...p, base: val }));
          }}
        />

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
              <CalcSection icon={Sliders} title="설정" color={tabColor}>
                <div className="text-caption" style={{ color: 'var(--text-secondary)' }}>{TAB_HELP.dps.description}</div>
                <div className="grid grid-cols-2 gap-3">
                  <GlassInputField label={t('damage1hit')} value={dpsInputs.damage} onChange={(v) => setDpsWithHistory({ ...dpsInputs, damage: v })} />
                  <GlassInputField label={t('attackSpeed')} value={dpsInputs.attackSpeed} onChange={(v) => setDpsWithHistory({ ...dpsInputs, attackSpeed: v })} step={0.1} />
                  <GlassInputField label={t('critRate')} value={dpsInputs.critRate} onChange={(v) => setDpsWithHistory({ ...dpsInputs, critRate: v })} step={0.01} min={0} max={1} />
                  <GlassInputField label={t('critMultiplier')} value={dpsInputs.critDamage} onChange={(v) => setDpsWithHistory({ ...dpsInputs, critDamage: v })} step={0.1} />
                </div>
              </CalcSection>
              <CalcSection icon={BarChart3} title="결과" color={tabColor}>
              <GlassResultCard label={t('dpsResult')} value={dpsResult.toFixed(2)} color={tabColor} numericValue={dpsResult} extra={`${t('baseDps')}: ${(dpsInputs.damage * dpsInputs.attackSpeed).toFixed(2)} | ${t('critBonus')}: +${((dpsResult / (dpsInputs.damage * dpsInputs.attackSpeed) - 1) * 100).toFixed(1)}%`} />
              <GlassFormulaBox formula="damage x (1 + critRate x (critDamage - 1)) x attackSpeed" hint={t('dpsFormulaHint')} color={tabColor} />
              <GoalSeekBox
                color={tabColor}
                targetLabel="DPS"
                variables={[
                  { key: 'damage', label: '데미지', min: 1, max: 10000 },
                  { key: 'attackSpeed', label: '공격 속도', min: 0.1, max: 20 },
                  { key: 'critRate', label: '치명 확률', min: 0, max: 1 },
                  { key: 'critDamage', label: '치명 배율', min: 1, max: 10 },
                ]}
                computeWithOverride={(k, v) => {
                  const o = { ...dpsInputs, [k]: v };
                  return o.damage * (1 + o.critRate * (o.critDamage - 1)) * o.attackSpeed;
                }}
                onApply={(k, v) => setDpsWithHistory({ ...dpsInputs, [k]: v })}
              />
              <ScenarioCompareBox
                color={tabColor}
                tabKey="dps"
                currentInputs={dpsInputs}
                computeResult={(o) => DPS(Number(o.damage), Number(o.attackSpeed), Number(o.critRate), Number(o.critDamage))}
                resultLabel="DPS"
                scenarioA={scenarioA}
                scenarioB={scenarioB}
                setScenarioA={setScenarioA}
                setScenarioB={setScenarioB}
              />
              <SensitivityTornado
                color={tabColor}
                inputs={dpsInputs}
                variables={[
                  { key: 'damage', label: '데미지' },
                  { key: 'attackSpeed', label: '공격 속도' },
                  { key: 'critRate', label: '치명 확률' },
                  { key: 'critDamage', label: '치명 배율' },
                ]}
                computeResult={(o) => DPS(Number(o.damage), Number(o.attackSpeed), Number(o.critRate), Number(o.critDamage))}
              />
              <BreakdownBox
                color={tabColor}
                steps={[
                  { label: 'Base DPS (damage × attackSpeed)', value: dpsInputs.damage * dpsInputs.attackSpeed },
                  { label: 'Crit 보정 (1 + critRate × (critMul - 1))', value: 1 + dpsInputs.critRate * (dpsInputs.critDamage - 1), note: `×${(1 + dpsInputs.critRate * (dpsInputs.critDamage - 1)).toFixed(3)}` },
                  { label: '최종 DPS', value: dpsResult, note: 'base × crit 보정' },
                ]}
              />
              </CalcSection>
            </div>
          )}

          {/* TTK */}
          {activeTab === 'ttk' && (
            <div className="space-y-4">
              <CalcSection icon={Sliders} title="설정" color={tabColor}>
                <div className="text-caption" style={{ color: 'var(--text-secondary)' }}>{TAB_HELP.ttk.description}</div>
                <div className="grid grid-cols-3 gap-3">
                  <GlassInputField label={t('targetHp')} value={ttkInputs.targetHP} onChange={(v) => setTtkWithHistory({ ...ttkInputs, targetHP: v })} />
                  <GlassInputField label={t('damage1')} value={ttkInputs.damage} onChange={(v) => setTtkWithHistory({ ...ttkInputs, damage: v })} />
                  <GlassInputField label={t('attackSpeed')} value={ttkInputs.attackSpeed} onChange={(v) => setTtkWithHistory({ ...ttkInputs, attackSpeed: v })} step={0.1} />
                </div>
              </CalcSection>
              <CalcSection icon={BarChart3} title="결과" color={tabColor}>
              <div className="grid grid-cols-2 gap-3">
                <GlassResultCard label={t('ttkResult')} value={ttkResult.ttk === Infinity ? '-' : `${ttkResult.ttk.toFixed(2)}s`} color={tabColor} numericValue={ttkResult.ttk === Infinity ? undefined : ttkResult.ttk} />
                <GlassResultCard label={t('hitsRequired')} value={`${ttkResult.hitsNeeded}`} color="#e5a440" numericValue={ttkResult.hitsNeeded} />
              </div>
              <GlassFormulaBox formula="(ceil(targetHP / damage) - 1) / attackSpeed" hint={t('ttkFormulaHint')} color={tabColor} />
              <GoalSeekBox
                color={tabColor}
                targetLabel="TTK (초)"
                variables={[
                  { key: 'damage', label: '데미지', min: 1, max: 10000 },
                  { key: 'attackSpeed', label: '공격 속도', min: 0.1, max: 20 },
                ]}
                computeWithOverride={(k, v) => {
                  const o = { ...ttkInputs, [k]: v };
                  const hits = Math.ceil(o.targetHP / Math.max(1, o.damage));
                  return (hits - 1) / Math.max(0.001, o.attackSpeed);
                }}
                onApply={(k, v) => setTtkWithHistory({ ...ttkInputs, [k]: v })}
              />
              <ScenarioCompareBox
                color={tabColor}
                tabKey="ttk"
                currentInputs={ttkInputs}
                computeResult={(o) => {
                  const t = TTK(Number(o.targetHP), Number(o.damage), Number(o.attackSpeed));
                  return t === Infinity ? -1 : t;
                }}
                resultLabel="TTK"
                scenarioA={scenarioA}
                scenarioB={scenarioB}
                setScenarioA={setScenarioA}
                setScenarioB={setScenarioB}
                formatResult={(v) => v < 0 ? '∞' : `${v.toFixed(2)}s`}
              />
              <SensitivityTornado
                color={tabColor}
                inputs={ttkInputs}
                variables={[
                  { key: 'targetHP', label: '타겟 HP' },
                  { key: 'damage', label: '데미지' },
                  { key: 'attackSpeed', label: '공격 속도' },
                ]}
                computeResult={(o) => {
                  const t = TTK(Number(o.targetHP), Number(o.damage), Number(o.attackSpeed));
                  return t === Infinity ? 0 : t;
                }}
              />
              <BreakdownBox
                color={tabColor}
                steps={[
                  { label: '필요 히트 수 (ceil(HP / damage))', value: ttkResult.hitsNeeded },
                  { label: '히트 간 간격 (1 / attackSpeed)', value: 1 / Math.max(0.001, ttkInputs.attackSpeed), note: `${(1 / Math.max(0.001, ttkInputs.attackSpeed)).toFixed(3)}s` },
                  { label: '최종 TTK ((hits-1) × interval)', value: ttkResult.ttk === Infinity ? '∞' : `${ttkResult.ttk.toFixed(2)}s`, note: '첫 히트는 즉시' },
                ]}
              />
              </CalcSection>
            </div>
          )}

          {/* EHP */}
          {activeTab === 'ehp' && (
            <div className="space-y-4">
              <CalcSection icon={Sliders} title="설정" color={tabColor}>
                <div className="text-caption" style={{ color: 'var(--text-secondary)' }}>{TAB_HELP.ehp.description}</div>
                <div className="grid grid-cols-3 gap-3">
                  <GlassInputField label={t('hp')} value={ehpInputs.hp} onChange={(v) => setEhpWithHistory({ ...ehpInputs, hp: v })} />
                  <GlassInputField label={t('def')} value={ehpInputs.def} onChange={(v) => setEhpWithHistory({ ...ehpInputs, def: v })} />
                  <GlassInputField label={t('damageReduction')} value={ehpInputs.damageReduction} onChange={(v) => setEhpWithHistory({ ...ehpInputs, damageReduction: v })} step={0.01} min={0} max={0.99} />
                </div>
              </CalcSection>
              <CalcSection icon={BarChart3} title="결과" color={tabColor}>
              <GlassResultCard label={t('ehpResult')} value={ehpResult.toFixed(0)} color={tabColor} numericValue={ehpResult} extra={`${t('vsOriginal')} ${((ehpResult / ehpInputs.hp) * 100).toFixed(1)}% (x${(ehpResult / ehpInputs.hp).toFixed(2)})`} />
              <GlassFormulaBox formula="hp x (1 + def/100) x (1 / (1 - damageReduction))" hint={t('ehpFormulaHint')} color={tabColor} />
              <GoalSeekBox
                color={tabColor}
                targetLabel="EHP"
                variables={[
                  { key: 'hp', label: 'HP', min: 1, max: 100000 },
                  { key: 'def', label: '방어력', min: 0, max: 2000 },
                  { key: 'damageReduction', label: '피해 감소', min: 0, max: 0.95 },
                ]}
                computeWithOverride={(k, v) => {
                  const o = { ...ehpInputs, [k]: v };
                  return EHP(o.hp, o.def, o.damageReduction);
                }}
                onApply={(k, v) => setEhpWithHistory({ ...ehpInputs, [k]: v })}
              />
              <ScenarioCompareBox
                color={tabColor}
                tabKey="ehp"
                currentInputs={ehpInputs}
                computeResult={(o) => EHP(Number(o.hp), Number(o.def), Number(o.damageReduction))}
                resultLabel="EHP"
                scenarioA={scenarioA}
                scenarioB={scenarioB}
                setScenarioA={setScenarioA}
                setScenarioB={setScenarioB}
                formatResult={(v) => v.toFixed(0)}
              />
              <SensitivityTornado
                color={tabColor}
                inputs={ehpInputs}
                variables={[
                  { key: 'hp', label: 'HP' },
                  { key: 'def', label: '방어력' },
                  { key: 'damageReduction', label: '피해 감소' },
                ]}
                computeResult={(o) => EHP(Number(o.hp), Number(o.def), Number(o.damageReduction))}
              />
              <BreakdownBox
                color={tabColor}
                steps={[
                  { label: 'HP', value: ehpInputs.hp },
                  { label: 'DEF 보정 (1 + def/100)', value: 1 + ehpInputs.def / 100, note: `×${(1 + ehpInputs.def / 100).toFixed(3)}` },
                  { label: '피해 감소 보정 (1 / (1 - DR))', value: 1 / Math.max(0.01, 1 - ehpInputs.damageReduction), note: `×${(1 / Math.max(0.01, 1 - ehpInputs.damageReduction)).toFixed(3)}` },
                  { label: '최종 EHP', value: ehpResult, note: 'HP × DEF × DR 보정' },
                ]}
              />
              </CalcSection>
            </div>
          )}

          {/* DAMAGE */}
          {activeTab === 'damage' && (
            <div className="space-y-4">
              <CalcSection icon={Sliders} title="설정" color={tabColor}>
                <div className="text-caption" style={{ color: 'var(--text-secondary)' }}>{TAB_HELP.damage.description}</div>
                <div className="grid grid-cols-3 gap-3">
                  <GlassInputField label={t('atk')} value={damageInputs.atk} onChange={(v) => setDamageInputs({ ...damageInputs, atk: v })} />
                  <GlassInputField label={t('def')} value={damageInputs.def} onChange={(v) => setDamageInputs({ ...damageInputs, def: v })} />
                  <GlassInputField label={t('skillMultiplier')} value={damageInputs.multiplier} onChange={(v) => setDamageInputs({ ...damageInputs, multiplier: v })} step={0.1} />
                </div>
              </CalcSection>
              <CalcSection icon={BarChart3} title="결과" color={tabColor}>
                <div className="grid grid-cols-2 gap-3">
                  <GlassResultCard label={t('finalDamage')} value={damageResult.toFixed(1)} color={tabColor} numericValue={damageResult} />
                  <GlassResultCard label={t('damageReductionRate')} value={`${((1 - 100 / (100 + damageInputs.def)) * 100).toFixed(1)}%`} color="var(--text-secondary)" />
                </div>
                <GlassFormulaBox formula="atk x (100 / (100 + def)) x multiplier" hint={t('damageFormulaHint')} color={tabColor} />
              </CalcSection>
            </div>
          )}

          {/* SCALE */}
          {activeTab === 'scale' && (
            <div className="space-y-4">
              <CalcSection icon={Sliders} title="설정" color={tabColor}>
                <div className="text-caption" style={{ color: 'var(--text-secondary)' }}>{TAB_HELP.scale.description}</div>
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
              </CalcSection>
              <CalcSection icon={BarChart3} title="결과" color={tabColor}>
              {CURVE_TYPE_HELP[scaleInputs.curveType] && (
                <div className="glass-section p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm" style={{ color: tabColor }}>{CURVE_TYPE_HELP[scaleInputs.curveType].name}</span>
                    <code className="text-sm px-2 py-0.5 rounded-lg" style={{ background: `${tabColor}15`, color: tabColor }}>{CURVE_TYPE_HELP[scaleInputs.curveType].formula}</code>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{CURVE_TYPE_HELP[scaleInputs.curveType].description}</p>
                </div>
              )}
              <GlassResultCard label={t('levelStat', { level: scaleInputs.level })} value={scaleResult.toFixed(1)} color={tabColor} numericValue={scaleResult} />
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
              <GoalSeekBox
                color={tabColor}
                targetLabel={`Lv ${scaleInputs.level} 값`}
                variables={[
                  { key: 'base', label: '기본값', min: 1, max: 100000 },
                  { key: 'rate', label: '성장률', min: 0.01, max: 5 },
                ]}
                computeWithOverride={(k, v) => {
                  const o = { ...scaleInputs, [k]: v };
                  return SCALE(o.base, o.level, o.rate, o.curveType);
                }}
                onApply={(k, v) => setScaleInputs({ ...scaleInputs, [k]: v })}
              />
              <ScenarioCompareBox
                color={tabColor}
                tabKey="scale"
                currentInputs={scaleInputs}
                computeResult={(o) => SCALE(Number(o.base), Number(o.level), Number(o.rate), String(o.curveType))}
                resultLabel={`Lv ${scaleInputs.level} 값`}
                scenarioA={scenarioA}
                scenarioB={scenarioB}
                setScenarioA={setScenarioA}
                setScenarioB={setScenarioB}
                formatResult={(v) => v.toFixed(1)}
              />
              <SensitivityTornado
                color={tabColor}
                inputs={scaleInputs}
                variables={[
                  { key: 'base', label: '기본값' },
                  { key: 'level', label: '레벨' },
                  { key: 'rate', label: '성장률' },
                ]}
                computeResult={(o) => SCALE(Number(o.base), Number(o.level), Number(o.rate), String(o.curveType))}
              />
              <BreakdownBox
                color={tabColor}
                steps={[
                  { label: '기본값 (base)', value: scaleInputs.base },
                  { label: `곡선 타입 · ${CURVE_TYPE_HELP[scaleInputs.curveType]?.name ?? scaleInputs.curveType}`, value: CURVE_TYPE_HELP[scaleInputs.curveType]?.formula ?? '—' },
                  { label: `레벨 ${scaleInputs.level} 적용 · 성장률 ${scaleInputs.rate}`, value: scaleResult, note: `SCALE(${scaleInputs.base}, ${scaleInputs.level}, ${scaleInputs.rate}, ${scaleInputs.curveType})` },
                ]}
              />
              </CalcSection>
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

  // Scrubbable — 화살표 ↑↓ 로 증감. Shift × 10배, Alt ÷ 10배 (Desmos/Figma 패턴)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const base = parseFloat(inputValue);
    if (isNaN(base)) return;
    const multiplier = e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
    const delta = step * multiplier * (e.key === 'ArrowUp' ? 1 : -1);
    let next = base + delta;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    // 소수점 누적 오차 방지
    next = Math.round(next * 1e6) / 1e6;
    setInputValue(String(next));
    onChange(next);
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
          onKeyDown={handleKeyDown}
          title="↑↓ 로 값 조정 · Shift 10배 · Alt 0.1배"
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

function AnsChip({ tabColor, activeTab, onApply }: { tabColor: string; activeTab: string; onApply: (value: number) => void }) {
  const ans = useCalculatorStore((s) => s.ans);
  const ansLabel = useCalculatorStore((s) => s.ansLabel);
  const clear = useCalculatorStore((s) => s.clear);
  if (ans === null) return null;
  return (
    <div
      className="mx-4 mb-3 flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
      style={{ background: `${tabColor}10`, border: `1px solid ${tabColor}40` }}
    >
      <span className="font-mono font-bold" style={{ color: tabColor }}>ans</span>
      <span style={{ color: 'var(--text-secondary)' }}>= </span>
      <span className="font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
        {Math.abs(ans) >= 1000 ? ans.toLocaleString(undefined, { maximumFractionDigits: 2 }) : ans.toFixed(2)}
      </span>
      {ansLabel && (
        <span className="text-caption px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>
          {ansLabel}
        </span>
      )}
      <button
        onClick={() => onApply(ans)}
        className="ml-auto px-2 py-0.5 rounded text-caption font-semibold"
        style={{ background: tabColor, color: 'white' }}
        title={`${activeTab} 탭의 첫 입력에 적용`}
      >
        적용 →
      </button>
      <button
        onClick={clear}
        className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5"
        title="ans 지우기"
      >
        <X className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
      </button>
    </div>
  );
}

function GlassResultCard({ label, value, color, extra, numericValue }: { label: string; value: string; color: string; extra?: string; numericValue?: number }) {
  const setAns = useCalculatorStore((s) => s.setAns);
  const copyAns = () => {
    if (numericValue !== undefined && !isNaN(numericValue)) {
      setAns(numericValue, label);
    }
  };
  return (
    <div
      className="glass-stat group relative"
      role="status"
      aria-live="polite"
      aria-label={`${label}: ${value}`}
    >
      <div className="text-sm mb-1 font-medium flex items-center justify-between" style={{ color: 'var(--text-secondary)' }}>
        <span>{label}</span>
        {numericValue !== undefined && (
          <button
            onClick={copyAns}
            className="opacity-0 group-hover:opacity-100 text-caption px-1.5 py-0.5 rounded"
            style={{ background: `${color}20`, color }}
            title="이 값을 ans 변수에 저장 (다른 탭 입력에서 불러오기)"
          >
            → ans
          </button>
        )}
      </div>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      {extra && <div className="text-sm mt-1.5" style={{ color: 'var(--text-secondary)' }}>{extra}</div>}
    </div>
  );
}

/**
 * CalcSection — Calculator 각 탭 내부의 "설정" / "결과" 섹션 wrapper.
 * 네모 테두리 카드 + 좌측 accent 로 섹션 구분 확실하게.
 */
function CalcSection({
  icon: Icon,
  title,
  color,
  children,
}: {
  icon: React.ElementType;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-lg p-3 space-y-3"
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4" style={{ color }} />
        <span className="text-sm font-semibold" style={{ color }}>{title}</span>
      </div>
      {children}
    </section>
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

/**
 * BreakdownBox — 수식 중간값(baseDamage × critMult × armorReduction) 을 단계별 분해.
 * Path of Building 수준 투명성. "왜 이 결과가 나왔는지" 분해해서 보여줌.
 */
function BreakdownBox({
  color,
  steps,
}: {
  color: string;
  steps: { label: string; value: number | string; note?: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass-section p-3" style={{ borderLeft: `3px solid ${color}` }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="text-sm font-semibold" style={{ color }}>
          Breakdown — 계산 단계 분해
        </span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${open ? '' : '-rotate-90'}`}
          style={{ color }}
        />
      </button>
      {open && (
        <div className="mt-2 space-y-1">
          {steps.map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-caption p-1.5 rounded"
              style={{ background: 'var(--bg-primary)' }}
            >
              <span
                className="font-mono font-bold px-1.5 rounded"
                style={{ background: `${color}20`, color, minWidth: 24, textAlign: 'center' }}
              >
                {i + 1}
              </span>
              <span className="flex-1" style={{ color: 'var(--text-primary)' }}>{s.label}</span>
              <span className="font-mono tabular-nums font-bold" style={{ color }}>
                {typeof s.value === 'number' ? s.value.toFixed(2) : s.value}
              </span>
              {s.note && (
                <span className="text-caption italic" style={{ color: 'var(--text-tertiary)' }}>
                  {s.note}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * SensitivityTornado — 각 입력을 ±delta% 변동 시 결과 기여도 막대 랭킹.
 * GoldSim / Power BI Inforiver 의 토네이도 차트 경량 버전.
 * 어떤 입력이 가장 영향 크게 주는지 한눈에 파악.
 */
function SensitivityTornado<T extends Record<string, number | string>>({
  color,
  inputs,
  variables,
  computeResult,
  delta = 0.1,
}: {
  color: string;
  inputs: T;
  variables: { key: string; label: string }[];
  computeResult: (inputs: T) => number;
  delta?: number;
}) {
  const base = computeResult(inputs);
  const rows = variables
    .map((v) => {
      const current = Number(inputs[v.key]);
      if (!isFinite(current) || current === 0) return null;
      const up = computeResult({ ...inputs, [v.key]: current * (1 + delta) } as T);
      const down = computeResult({ ...inputs, [v.key]: current * (1 - delta) } as T);
      const range = Math.max(Math.abs(up - base), Math.abs(down - base));
      return { key: v.key, label: v.label, up, down, range, upDelta: up - base, downDelta: down - base };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.range - a.range);

  const maxRange = Math.max(1, ...rows.map((r) => r.range));

  return (
    <div className="glass-section p-3" style={{ borderLeft: `3px solid ${color}` }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold" style={{ color }}>
          Sensitivity — 입력 ±{Math.round(delta * 100)}% 영향도
        </span>
        <span className="text-caption tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
          baseline {base.toFixed(2)}
        </span>
      </div>
      <div className="space-y-1">
        {rows.map((r) => {
          const downPct = (Math.abs(r.downDelta) / maxRange) * 50;
          const upPct = (Math.abs(r.upDelta) / maxRange) * 50;
          return (
            <div key={r.key} className="flex items-center gap-2 text-caption">
              <span className="w-20 truncate" style={{ color: 'var(--text-secondary)' }}>{r.label}</span>
              <div className="flex-1 flex items-center h-4 relative" style={{ background: 'var(--bg-primary)' }}>
                {/* down (음수 쪽, 왼쪽) */}
                <div
                  className="absolute right-1/2 top-0 bottom-0"
                  style={{ width: `${downPct}%`, background: r.downDelta < 0 ? '#ef4444' : '#10b981', opacity: 0.7 }}
                />
                {/* up (양수 쪽, 오른쪽) */}
                <div
                  className="absolute left-1/2 top-0 bottom-0"
                  style={{ width: `${upPct}%`, background: r.upDelta > 0 ? '#10b981' : '#ef4444', opacity: 0.7 }}
                />
                {/* 중앙선 */}
                <div className="absolute left-1/2 top-0 bottom-0 w-px" style={{ background: 'var(--text-tertiary)' }} />
              </div>
              <span className="w-24 text-right tabular-nums font-mono" style={{ color: 'var(--text-primary)' }}>
                {r.downDelta > 0 ? '+' : ''}{r.downDelta.toFixed(1)} / {r.upDelta > 0 ? '+' : ''}{r.upDelta.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-caption italic mt-2" style={{ color: 'var(--text-tertiary)' }}>
        각 입력 -{Math.round(delta * 100)}% / +{Math.round(delta * 100)}% 변동 시 결과 변화량 · range 넓은 순 정렬
      </p>
    </div>
  );
}

/**
 * ScenarioCompareBox — 현재 탭 입력 2개 시나리오로 저장 + 결과 나란히 비교.
 * Raidbots Top Gear / Excel Scenario Manager 패턴.
 */
function ScenarioCompareBox<T extends Record<string, number | string>>({
  color,
  tabKey,
  currentInputs,
  computeResult,
  resultLabel,
  scenarioA,
  scenarioB,
  setScenarioA,
  setScenarioB,
  formatResult,
}: {
  color: string;
  tabKey: string;
  currentInputs: T;
  computeResult: (inputs: T) => number;
  resultLabel: string;
  scenarioA: Record<string, Record<string, number | string>> | null;
  scenarioB: Record<string, Record<string, number | string>> | null;
  setScenarioA: (s: Record<string, Record<string, number | string>> | null) => void;
  setScenarioB: (s: Record<string, Record<string, number | string>> | null) => void;
  formatResult?: (v: number) => string;
}) {
  const snapshotA = scenarioA?.[tabKey] as T | undefined;
  const snapshotB = scenarioB?.[tabKey] as T | undefined;
  const fmt = formatResult ?? ((v: number) => v.toFixed(2));

  const saveTo = (which: 'A' | 'B') => {
    const nextAll = { ...(which === 'A' ? scenarioA : scenarioB) ?? {}, [tabKey]: { ...currentInputs } };
    (which === 'A' ? setScenarioA : setScenarioB)(nextAll);
  };
  const clearSlot = (which: 'A' | 'B') => {
    const map = { ...(which === 'A' ? scenarioA : scenarioB) ?? {} };
    delete map[tabKey];
    (which === 'A' ? setScenarioA : setScenarioB)(Object.keys(map).length ? map : null);
  };

  const resultA = snapshotA ? computeResult(snapshotA) : null;
  const resultB = snapshotB ? computeResult(snapshotB) : null;
  const delta = resultA !== null && resultB !== null ? resultB - resultA : null;
  const deltaPct = resultA !== null && resultB !== null && resultA !== 0 ? (delta! / Math.abs(resultA)) * 100 : null;

  return (
    <div className="glass-section p-3" style={{ borderLeft: `3px solid ${color}` }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold" style={{ color }}>
          Scenario A/B 비교
        </span>
        <span className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
          입력 세트 저장 + 결과 나란히
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(['A', 'B'] as const).map((label) => {
          const snap = label === 'A' ? snapshotA : snapshotB;
          const res = label === 'A' ? resultA : resultB;
          return (
            <div
              key={label}
              className="p-2 rounded"
              style={{ background: 'var(--bg-primary)', border: `1px solid ${snap ? color : 'var(--border-primary)'}` }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-caption font-bold px-1.5 rounded" style={{ background: color, color: 'white' }}>
                  {label}
                </span>
                {snap ? (
                  <button
                    onClick={() => clearSlot(label)}
                    className="text-caption"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    지우기
                  </button>
                ) : (
                  <button
                    onClick={() => saveTo(label)}
                    className="text-caption px-2 py-0.5 rounded"
                    style={{ background: `${color}20`, color }}
                  >
                    현재값 저장
                  </button>
                )}
              </div>
              {snap && res !== null ? (
                <>
                  <div className="text-xl font-bold tabular-nums" style={{ color }}>
                    {fmt(res)}
                  </div>
                  <div className="text-caption mt-0.5 space-y-0" style={{ color: 'var(--text-tertiary)' }}>
                    {Object.entries(snap).map(([k, v]) => (
                      <div key={k} className="truncate">
                        <span className="font-mono">{k}</span>: <span>{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-caption italic py-3 text-center" style={{ color: 'var(--text-tertiary)' }}>
                  (비어있음)
                </div>
              )}
            </div>
          );
        })}
      </div>
      {delta !== null && (
        <div
          className="mt-2 p-2 rounded flex items-center gap-2"
          style={{ background: delta === 0 ? 'var(--bg-tertiary)' : delta > 0 ? '#10b98115' : '#ef444415' }}
        >
          <span className="text-caption" style={{ color: 'var(--text-secondary)' }}>
            B vs A {resultLabel} 변화:
          </span>
          <span
            className="font-bold tabular-nums"
            style={{ color: delta === 0 ? 'var(--text-secondary)' : delta > 0 ? '#10b981' : '#ef4444' }}
          >
            {delta > 0 ? '+' : ''}{fmt(delta)}
            {deltaPct !== null && ` (${deltaPct > 0 ? '+' : ''}${deltaPct.toFixed(1)}%)`}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * GoalSeekBox — Excel Goal Seek 인라인 버전.
 *
 * 사용자가 "목표값" 과 "역산할 변수" 를 지정하면 bisect 로 필요 입력 자동 산출.
 * 결과는 해당 변수에 바로 적용 (onApply).
 *
 * variables: 역산 가능한 변수 목록 ({ key, label, min, max, step })
 * computeResult: 현재 입력 상태에서 결과값 하나 반환하는 함수 (단변수 monotone 가정)
 * getInputValue / setInputValue: 해당 변수 하나를 get/set
 */
function GoalSeekBox({
  color,
  targetLabel,
  variables,
  computeWithOverride,
  onApply,
}: {
  color: string;
  targetLabel: string;
  variables: { key: string; label: string; min: number; max: number }[];
  /** 특정 변수 하나를 value 로 바꿨을 때의 결과값 */
  computeWithOverride: (varKey: string, value: number) => number;
  onApply: (varKey: string, value: number) => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [targetValue, setTargetValue] = useState(100);
  const [selectedVar, setSelectedVar] = useState(variables[0]?.key ?? '');
  const [result, setResult] = useState<{ value: number; converged: boolean } | null>(null);

  const handleSolve = () => {
    const v = variables.find((x) => x.key === selectedVar);
    if (!v) return;
    const r = bisect((x) => computeWithOverride(v.key, x), targetValue, {
      lo: v.min,
      hi: v.max,
      tolerance: 0.01,
      maxIter: 60,
    });
    if (r) {
      setResult({ value: r.x, converged: r.converged });
    } else {
      setResult({ value: 0, converged: false });
    }
  };

  return (
    <div className="glass-section p-3" style={{ borderLeft: `3px solid ${color}` }}>
      <div className="flex items-center justify-between mb-2">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => { setEnabled(e.target.checked); setResult(null); }}
          />
          <TargetIcon className="w-3.5 h-3.5" style={{ color }} />
          <span className="text-sm font-semibold" style={{ color }}>
            Goal Seek — 목표값 역산
          </span>
        </label>
        <span className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
          Excel Goal Seek 방식 · bisection
        </span>
      </div>
      {enabled && (
        <>
          <div className="grid grid-cols-[auto_1fr_auto_1fr_auto] gap-2 items-center">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>목표 {targetLabel}</span>
            <input
              type="number"
              inputMode="decimal"
              value={targetValue}
              onChange={(e) => setTargetValue(parseFloat(e.target.value) || 0)}
              className="glass-input text-sm"
            />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>역산할 변수</span>
            <select
              value={selectedVar}
              onChange={(e) => { setSelectedVar(e.target.value); setResult(null); }}
              className="glass-input text-sm"
            >
              {variables.map((v) => (
                <option key={v.key} value={v.key}>{v.label}</option>
              ))}
            </select>
            <button
              onClick={handleSolve}
              className="px-3 py-1.5 rounded text-sm font-semibold"
              style={{ background: color, color: 'white' }}
            >
              계산
            </button>
          </div>
          {result && (
            <div
              className="mt-2 p-2 rounded flex items-center gap-2"
              style={{
                background: result.converged ? `${color}10` : '#ef444410',
                borderLeft: `3px solid ${result.converged ? color : '#ef4444'}`,
              }}
            >
              {result.converged ? (
                <>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    필요 {variables.find((v) => v.key === selectedVar)?.label}:
                  </span>
                  <span className="text-lg font-bold tabular-nums" style={{ color }}>
                    {result.value.toFixed(2)}
                  </span>
                  <button
                    onClick={() => onApply(selectedVar, result.value)}
                    className="ml-auto px-2 py-0.5 rounded text-caption font-semibold"
                    style={{ background: color, color: 'white' }}
                  >
                    적용 →
                  </button>
                </>
              ) : (
                <span className="text-sm" style={{ color: '#ef4444' }}>
                  수렴 실패 — 목표값이 해당 변수 범위 밖입니다
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
