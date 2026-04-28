'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Shield,
  Swords,
  Heart,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Target,
  Zap,
  Play,
  Users,
  Plus,
  Trash2,
  Grid3X3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import PanelShell, { HelpToggle } from '@/components/ui/PanelShell';
import { useProjectStore } from '@/stores/projectStore';
import { Tooltip } from '@/components/ui/Tooltip';
import CustomSelect from '@/components/ui/CustomSelect';

const PANEL_COLOR = '#3db88a'; // 소프트 그린

interface BalanceValidatorProps {
  onClose?: () => void;
  showHelp?: boolean;
  setShowHelp?: (value: boolean) => void;
}

const ROLE_EXPECTATIONS = {
  tank: {
    icon: Shield,
    color: '#5a9cf5',
    dpsRange: [50, 90],
    ehpRange: [180, 250],
  },
  dps: {
    icon: Swords,
    color: '#e86161',
    dpsRange: [130, 200],
    ehpRange: [60, 90],
  },
  support: {
    icon: Heart,
    color: '#3db88a',
    dpsRange: [40, 70],
    ehpRange: [90, 130],
  },
  balanced: {
    icon: Target,
    color: '#e5a440',
    dpsRange: [90, 110],
    ehpRange: [90, 110],
  },
};

const BASE_STATS = {
  hp: 1000,
  atk: 100,
  def: 50,
  attackSpeed: 1.0,
  critRate: 0.05,
  critDamage: 1.5,
};

interface UnitData {
  name: string;
  role: keyof typeof ROLE_EXPECTATIONS;
  hp: number;
  atk: number;
  def: number;
  attackSpeed: number;
  critRate: number;
  critDamage: number;
}

function calculateDPS(unit: UnitData): number {
  const effectiveDamage = unit.atk * (1 + unit.critRate * (unit.critDamage - 1));
  return effectiveDamage * unit.attackSpeed;
}

function calculateEHP(unit: UnitData): number {
  return unit.hp * (1 + unit.def / 100);
}

const BASE_DPS = calculateDPS({ name: '', role: 'balanced', ...BASE_STATS });
const BASE_EHP = calculateEHP({ name: '', role: 'balanced', hp: BASE_STATS.hp, atk: BASE_STATS.atk, def: BASE_STATS.def, attackSpeed: BASE_STATS.attackSpeed, critRate: BASE_STATS.critRate, critDamage: BASE_STATS.critDamage });

function validateUnit(unit: UnitData) {
  const dps = calculateDPS(unit);
  const ehp = calculateEHP(unit);
  const dpsPercent = (dps / BASE_DPS) * 100;
  const ehpPercent = (ehp / BASE_EHP) * 100;

  const role = ROLE_EXPECTATIONS[unit.role];
  const dpsInRange = dpsPercent >= role.dpsRange[0] && dpsPercent <= role.dpsRange[1];
  const ehpInRange = ehpPercent >= role.ehpRange[0] && ehpPercent <= role.ehpRange[1];

  type IssueDescriptor = { key: 'issueDpsLow' | 'issueDpsHigh' | 'issueEhpLow' | 'issueEhpHigh'; values: { percent: string; min?: number; max?: number } };
  const issues: IssueDescriptor[] = [];
  if (!dpsInRange) {
    if (dpsPercent < role.dpsRange[0]) {
      issues.push({ key: 'issueDpsLow', values: { percent: dpsPercent.toFixed(0), min: role.dpsRange[0] } });
    } else {
      issues.push({ key: 'issueDpsHigh', values: { percent: dpsPercent.toFixed(0), max: role.dpsRange[1] } });
    }
  }
  if (!ehpInRange) {
    if (ehpPercent < role.ehpRange[0]) {
      issues.push({ key: 'issueEhpLow', values: { percent: ehpPercent.toFixed(0), min: role.ehpRange[0] } });
    } else {
      issues.push({ key: 'issueEhpHigh', values: { percent: ehpPercent.toFixed(0), max: role.ehpRange[1] } });
    }
  }

  const totalValue = (dpsPercent * 0.5 + ehpPercent * 0.5);

  return { dps, ehp, dpsPercent, ehpPercent, dpsInRange, ehpInRange, totalValue, isBalanced: issues.length === 0, issues };
}

function simulate1v1(unitA: UnitData, unitB: UnitData): { winner: string; rounds: number; hpRemaining: number } {
  const dpsA = calculateDPS(unitA);
  const dpsB = calculateDPS(unitB);
  const ehpA = calculateEHP(unitA);
  const ehpB = calculateEHP(unitB);

  const dmgAtoB = dpsA * (100 / (100 + unitB.def));
  const dmgBtoA = dpsB * (100 / (100 + unitA.def));

  const timeToKillB = ehpB / dmgAtoB;
  const timeToKillA = ehpA / dmgBtoA;

  if (timeToKillB < timeToKillA) {
    const hpRemaining = unitA.hp - (dmgBtoA * timeToKillB);
    return { winner: unitA.name, rounds: Math.ceil(timeToKillB), hpRemaining: Math.max(0, hpRemaining) };
  } else {
    const hpRemaining = unitB.hp - (dmgAtoB * timeToKillA);
    return { winner: unitB.name, rounds: Math.ceil(timeToKillA), hpRemaining: Math.max(0, hpRemaining) };
  }
}

// 셀 선택 가능한 스탯 입력 컴포넌트
function StatInputField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const tCell = useTranslations('balanceValidator');
  const [inputValue, setInputValue] = useState(String(value));
  const [isHovered, setIsHovered] = useState(false);
  const { startCellSelection, cellSelectionMode } = useProjectStore();

  useEffect(() => {
    setInputValue(String(value));
  }, [value]);

  const handleCellSelect = () => {
    startCellSelection(label, (cellValue) => {
      setInputValue(String(cellValue));
      onChange(cellValue);
    });
  };

  return (
    <div onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <label className="text-sm block mb-1 font-medium" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </label>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={inputValue}
          onChange={(e) => {
            const newValue = e.target.value;
            if (newValue === '' || /^-?\d*\.?\d*$/.test(newValue)) {
              setInputValue(newValue);
              const num = parseFloat(newValue);
              if (!isNaN(num)) onChange(num);
            }
          }}
          onBlur={() => {
            const num = parseFloat(inputValue);
            if (isNaN(num) || inputValue === '') {
              setInputValue('0');
              onChange(0);
            } else {
              setInputValue(String(num));
            }
          }}
          className="glass-input w-full !py-1.5 !pr-8 text-sm text-center"
        />
        {isHovered && !cellSelectionMode.active && (
          <Tooltip content={tCell('selectFromCell')} position="top">
            <button
              onClick={handleCellSelect}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            >
              <Grid3X3 className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

export default function BalanceValidator({ onClose, showHelp: externalShowHelp, setShowHelp: externalSetShowHelp }: BalanceValidatorProps) {
  const t = useTranslations('balanceValidator');
  const [internalShowHelp, setInternalShowHelp] = useState(false);
  const showHelp = externalShowHelp ?? internalShowHelp;
  const setShowHelp = externalSetShowHelp ?? setInternalShowHelp;
  const [units, setUnits] = useState<UnitData[]>([
    { name: t('sampleWarrior'), role: 'balanced', hp: 1000, atk: 100, def: 50, attackSpeed: 1.0, critRate: 0.05, critDamage: 1.5 },
  ]);
  const [selectedUnits, setSelectedUnits] = useState<[number, number]>([0, 0]);
  const [simResult, setSimResult] = useState<{ winner: string; rounds: number; hpRemaining: number } | null>(null);

  const addUnit = () => {
    setUnits([...units, { name: t('newUnitName', { n: units.length + 1 }), role: 'balanced', hp: 1000, atk: 100, def: 50, attackSpeed: 1.0, critRate: 0.05, critDamage: 1.5 }]);
  };

  const updateUnit = (index: number, field: keyof UnitData, value: string | number) => {
    const newUnits = [...units];
    if (field === 'name' || field === 'role') {
      newUnits[index] = { ...newUnits[index], [field]: value };
    } else {
      newUnits[index] = { ...newUnits[index], [field]: Number(value) };
    }
    setUnits(newUnits);
  };

  const removeUnit = (index: number) => {
    if (units.length > 1) setUnits(units.filter((_, i) => i !== index));
  };

  const runSimulation = () => {
    if (units.length >= 2 && selectedUnits[0] !== selectedUnits[1]) {
      setSimResult(simulate1v1(units[selectedUnits[0]], units[selectedUnits[1]]));
    }
  };

  const validations = useMemo(() => units.map(validateUnit), [units]);

  const overallBalance = useMemo(() => {
    const totalValues = validations.map(v => v.totalValue);
    const avg = totalValues.reduce((a, b) => a + b, 0) / totalValues.length;
    const variance = totalValues.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / totalValues.length;
    const stdDev = Math.sqrt(variance);
    return { average: avg, stdDev, isBalanced: stdDev < 15 };
  }, [validations]);

  return (
    <PanelShell
      title={t('titleHeader')}
      subtitle={t('subtitleHeader')}
      icon={Shield}
      iconColor={PANEL_COLOR}
      onClose={onClose ?? (() => {})}
      bodyClassName="p-4 space-y-5 overflow-x-hidden scrollbar-slim"
      actions={<HelpToggle active={showHelp} onToggle={() => setShowHelp(!showHelp)} color={PANEL_COLOR} />}
    >
      <>
        {/* 도움말 섹션 */}
        {showHelp && (
          <div className="glass-card p-4 animate-slideDown space-y-4">
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `linear-gradient(135deg, ${PANEL_COLOR}, ${PANEL_COLOR}cc)` }}
              >
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{t('tooltipTitle')}</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{t('tooltipDesc')}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="glass-section p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-3.5 h-3.5" style={{ color: '#e5a440' }} />
                  <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>DPS</span>
                </div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('tooltipFeature1')}</p>
              </div>
              <div className="glass-section p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-3.5 h-3.5" style={{ color: '#5a9cf5' }} />
                  <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>EHP</span>
                </div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('tooltipFeature2')}</p>
              </div>
            </div>
          </div>
        )}

        {/* 기준값 표시 */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4" style={{ color: PANEL_COLOR }} />
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{t('baseValue')}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'HP', value: BASE_STATS.hp },
              { label: 'ATK', value: BASE_STATS.atk },
              { label: 'DEF', value: BASE_STATS.def },
              { label: t('baseDps'), value: BASE_DPS.toFixed(0) },
              { label: t('baseEhp'), value: BASE_EHP.toFixed(0) },
              { label: t('atkSpeed'), value: BASE_STATS.attackSpeed },
            ].map(({ label, value }) => (
              <div key={label} className="glass-section p-2 text-center">
                <div className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</div>
                <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 역할별 기대치 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" style={{ color: PANEL_COLOR }} />
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{t('roleExpectations')}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(ROLE_EXPECTATIONS).map(([key, role]) => {
              const Icon = role.icon;
              return (
                <div
                  key={key}
                  className="glass-card p-3"
                  style={{ borderLeft: `3px solid ${role.color}` }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Icon className="w-4 h-4" style={{ color: role.color }} />
                    <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                      {t(`roles.${key}`)}
                    </span>
                  </div>
                  <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    DPS: {role.dpsRange[0]}-{role.dpsRange[1]}%
                  </div>
                  <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    EHP: {role.ehpRange[0]}-{role.ehpRange[1]}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 유닛 목록 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Swords className="w-4 h-4" style={{ color: PANEL_COLOR }} />
              <h4 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                {t('unitValidation')}
              </h4>
            </div>
            <button
              onClick={addUnit}
              className="glass-button-primary flex items-center gap-1.5 !px-3 !py-1.5 text-sm"
              style={{ background: `linear-gradient(135deg, ${PANEL_COLOR}, ${PANEL_COLOR}dd)` }}
            >
              <Plus className="w-3.5 h-3.5" />
              {t('addUnit')}
            </button>
          </div>

          {units.map((unit, index) => {
            const validation = validations[index];
            const role = ROLE_EXPECTATIONS[unit.role];
            const RoleIcon = role.icon;

            return (
              <div
                key={index}
                className="glass-card p-4"
                style={{
                  borderLeft: `3px solid ${validation.isBalanced ? '#3db88a' : '#e5a440'}`,
                }}
              >
                {/* 유닛 기본 정보 */}
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="text"
                    value={unit.name}
                    onChange={(e) => updateUnit(index, 'name', e.target.value)}
                    className="glass-input flex-1 text-sm font-medium"
                  />
                  <CustomSelect
                    value={unit.role}
                    onChange={(v) => updateUnit(index, 'role', v)}
                    options={Object.entries(ROLE_EXPECTATIONS).map(([key]) => ({
                      value: key,
                      label: t(`roles.${key}`),
                    }))}
                    color={PANEL_COLOR}
                    size="sm"
                  />
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${role.color}20` }}
                  >
                    <RoleIcon className="w-4 h-4" style={{ color: role.color }} />
                  </div>
                  {units.length > 1 && (
                    <button
                      onClick={() => removeUnit(index)}
                      className="glass-button !p-2"
                      style={{ color: '#e86161' }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* 스탯 입력 */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { key: 'hp', label: t('stats.hp') },
                    { key: 'atk', label: t('stats.atk') },
                    { key: 'def', label: t('stats.def') },
                    { key: 'attackSpeed', label: t('stats.atkSpeed') },
                    { key: 'critRate', label: t('stats.critRate') },
                    { key: 'critDamage', label: t('stats.critDmg') },
                  ].map(({ key, label }) => (
                    <StatInputField
                      key={key}
                      label={label}
                      value={unit[key as keyof UnitData] as number}
                      onChange={(v) => updateUnit(index, key as keyof UnitData, v)}
                    />
                  ))}
                </div>

                {/* 검증 결과 */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div
                    className="glass-section p-3"
                    style={{
                      background: validation.dpsInRange ? 'rgba(61, 184, 138, 0.1)' : 'rgba(229, 164, 64, 0.1)',
                    }}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Zap className="w-3.5 h-3.5" style={{ color: validation.dpsInRange ? '#3db88a' : '#e5a440' }} />
                      <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                        DPS: {validation.dps.toFixed(0)}
                      </span>
                    </div>
                    <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {validation.dpsPercent.toFixed(0)}% ({t('expected')}: {role.dpsRange[0]}-{role.dpsRange[1]}%)
                    </div>
                  </div>
                  <div
                    className="glass-section p-3"
                    style={{
                      background: validation.ehpInRange ? 'rgba(61, 184, 138, 0.1)' : 'rgba(229, 164, 64, 0.1)',
                    }}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Shield className="w-3.5 h-3.5" style={{ color: validation.ehpInRange ? '#3db88a' : '#e5a440' }} />
                      <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                        EHP: {validation.ehp.toFixed(0)}
                      </span>
                    </div>
                    <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {validation.ehpPercent.toFixed(0)}% ({t('expected')}: {role.ehpRange[0]}-{role.ehpRange[1]}%)
                    </div>
                  </div>
                </div>

                {/* 경고/성공 메시지 */}
                {validation.isBalanced ? (
                  <div className="flex items-center gap-1.5 text-sm" style={{ color: '#3db88a' }}>
                    <CheckCircle className="w-4 h-4" />
                    <span className="font-medium">{t('roleBalanced')}</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {validation.issues.map((issue, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-sm" style={{ color: '#e5a440' }}>
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{t(issue.key, issue.values)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 1:1 시뮬레이션 */}
        {units.length >= 2 && (
          <div className="glass-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Play className="w-4 h-4" style={{ color: PANEL_COLOR }} />
              <h4 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                {t('simulation1v1')}
              </h4>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <CustomSelect
                value={String(selectedUnits[0])}
                onChange={(v) => setSelectedUnits([Number(v), selectedUnits[1]])}
                options={units.map((u, i) => ({ value: String(i), label: u.name }))}
                color={PANEL_COLOR}
                size="sm"
                className="flex-1"
              />
              <span className="text-sm font-bold px-2" style={{ color: 'var(--text-secondary)' }}>VS</span>
              <CustomSelect
                value={String(selectedUnits[1])}
                onChange={(v) => setSelectedUnits([selectedUnits[0], Number(v)])}
                options={units.map((u, i) => ({ value: String(i), label: u.name }))}
                color={PANEL_COLOR}
                size="sm"
                className="flex-1"
              />
              <button
                onClick={runSimulation}
                disabled={selectedUnits[0] === selectedUnits[1]}
                className="glass-button-primary !p-2.5 disabled:opacity-50"
              >
                <Play className="w-4 h-4" />
              </button>
            </div>
            {simResult && (
              <div className="glass-section p-3">
                <div className="font-bold text-sm mb-1" style={{ color: PANEL_COLOR }}>
                  {t('winner')}: {simResult.winner}
                </div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {simResult.rounds}{t('afterSeconds')}: {simResult.hpRemaining.toFixed(0)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 전체 밸런스 요약 */}
        <div
          className="glass-card p-4"
          style={{
            background: overallBalance.isBalanced
              ? 'linear-gradient(135deg, rgba(61, 184, 138, 0.15), rgba(61, 184, 138, 0.05))'
              : 'linear-gradient(135deg, rgba(229, 164, 64, 0.15), rgba(229, 164, 64, 0.05))',
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4" style={{ color: overallBalance.isBalanced ? '#3db88a' : '#e5a440' }} />
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              {t('overallBalance')}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>{t('avgValue')}: </span>
              <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{overallBalance.average.toFixed(1)}%</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>{t('stdDev')}: </span>
              <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{overallBalance.stdDev.toFixed(1)}%</span>
            </div>
            <span
              className="glass-badge ml-auto"
              style={{
                background: overallBalance.isBalanced ? 'rgba(61, 184, 138, 0.2)' : 'rgba(229, 164, 64, 0.2)',
                color: overallBalance.isBalanced ? '#3db88a' : '#e5a440',
              }}
            >
              {overallBalance.isBalanced ? t('good') : t('needsAdjust')}
            </span>
          </div>
        </div>
      </>
    </PanelShell>
  );
}
