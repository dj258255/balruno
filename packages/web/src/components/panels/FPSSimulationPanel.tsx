'use client';

/**
 * FPS TTK 시뮬레이션 패널 — Destiny / Valorant / CoD 밸런싱 방식.
 *
 * 두 무기 A/B 를 나란히 입력 → 거리/장갑/aim skill 변수 조절 → Monte Carlo.
 * 결과: TTK · BTK · 1v1 승률 · 거리별 effective DPS 곡선
 */

import { useState, useMemo } from 'react';
import { Crosshair, Swords, Flame, Cloud, Zap, Plus, Trash2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import PanelShell from '@/components/ui/PanelShell';
import {
  WEAPON_PRESETS,
  UTILITY_PRESETS,
  aimSkillToProfile,
  simulateWeaponTtk,
  simulateFpsDuel,
  calculateDpsCurve,
  calculateShieldBreakdown,
  SHIELD_BRACKETS,
  type WeaponStats,
  type ActiveUtility,
  type UtilityKind,
} from '@/lib/fpsSimulation';
import { useTranslations } from 'next-intl';

interface Props {
  onClose: () => void;
}

const DEFAULT_TARGET = { hp: 100, shield: 50, armor: 0.1 };

export default function FPSSimulationPanel({ onClose }: Props) {
  const t = useTranslations();
  const [weaponA, setWeaponA] = useState<WeaponStats>({ ...WEAPON_PRESETS[0], name: t('fpsSim.weaponAName') });
  const [weaponB, setWeaponB] = useState<WeaponStats>({ ...WEAPON_PRESETS[1], name: t('fpsSim.weaponBName') });
  const [aimSkillA, setAimSkillA] = useState(65);
  const [aimSkillB, setAimSkillB] = useState(65);
  const [distance, setDistance] = useState(20);
  const [targetArmor, setTargetArmor] = useState(0.1);
  const [firstShot, setFirstShot] = useState<'A' | 'B' | 'both-aware'>('both-aware');
  const [aMoving, setAMoving] = useState(false);
  const [bMoving, setBMoving] = useState(false);
  const [utilities, setUtilities] = useState<ActiveUtility[]>([]);
  const [runs, setRuns] = useState(5000);

  const aimA = useMemo(() => aimSkillToProfile(aimSkillA), [aimSkillA]);
  const aimB = useMemo(() => aimSkillToProfile(aimSkillB), [aimSkillB]);
  const target = useMemo(() => ({ ...DEFAULT_TARGET, armor: targetArmor }), [targetArmor]);

  const resultA = useMemo(
    () => simulateWeaponTtk(weaponA, target, distance, aimA, runs),
    [weaponA, target, distance, aimA, runs],
  );
  const resultB = useMemo(
    () => simulateWeaponTtk(weaponB, target, distance, aimB, runs),
    [weaponB, target, distance, aimB, runs],
  );
  const duel = useMemo(
    () =>
      simulateFpsDuel(
        weaponA, aimA,
        weaponB, aimB,
        { hp: 100, shield: 0, armor: 0 },
        { hp: 100, shield: 0, armor: 0 },
        { distance, firstShot, bothAwareDelayMs: 100, aMoving, bMoving, utilities },
        runs,
      ),
    [weaponA, aimA, weaponB, aimB, distance, firstShot, aMoving, bMoving, utilities, runs],
  );

  const addUtility = (kind: UtilityKind, affects: 'A' | 'B' | 'both') => {
    setUtilities((prev) => [...prev, { ...UTILITY_PRESETS[kind], kind, affects, deployedAtMs: 0 }]);
  };
  const removeUtility = (i: number) => setUtilities((prev) => prev.filter((_, j) => j !== i));
  const updateUtility = (i: number, patch: Partial<ActiveUtility>) =>
    setUtilities((prev) => prev.map((u, j) => (j === i ? { ...u, ...patch } : u)));

  const dpsCurveA = useMemo(() => {
    const distances = Array.from({ length: 21 }, (_, i) => i * 5); // 0, 5, 10, ..., 100m
    return calculateDpsCurve(weaponA, target, aimA, distances);
  }, [weaponA, target, aimA]);
  const dpsCurveB = useMemo(() => {
    const distances = Array.from({ length: 21 }, (_, i) => i * 5);
    return calculateDpsCurve(weaponB, target, aimB, distances);
  }, [weaponB, target, aimB]);

  const chartData = dpsCurveA.map((p, i) => ({
    distance: p.distance,
    A: Math.round(p.effectiveDps),
    B: Math.round(dpsCurveB[i].effectiveDps),
  }));

  return (
    <PanelShell
      title={t('fpsSim.titleHeader')}
      subtitle={t('fpsSim.subtitleHeader')}
      icon={Crosshair}
      iconColor="#ef4444"
      onClose={onClose}
      bodyClassName="p-3 space-y-3 overflow-y-auto"
    >
      {/* 무기 A / B 입력 */}
      <div className="grid grid-cols-2 gap-2">
        <WeaponCard weapon={weaponA} setWeapon={setWeaponA} color="#3b82f6" />
        <WeaponCard weapon={weaponB} setWeapon={setWeaponB} color="#ef4444" />
      </div>

      {/* 교전 상황 */}
      <div className="p-3 rounded-lg space-y-3" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="text-label font-medium" style={{ color: 'var(--text-primary)' }}>
          {t('fpsSim.engagementSituation')}
        </div>

        <RangeRow label={t('fpsSim.distance')} value={distance} unit="m" min={1} max={100} step={1} onChange={setDistance} />
        <RangeRow label={t('fpsSim.targetArmor')} value={targetArmor} unit="" min={0} max={0.9} step={0.05} onChange={setTargetArmor} format={(v) => `${Math.round(v * 100)}%`} />

        <div>
          <div className="text-label mb-1" style={{ color: 'var(--text-secondary)' }}>
            {t('fpsSim.firstShotAdvantage')}
          </div>
          <div className="flex gap-1">
            {(['A', 'both-aware', 'B'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setFirstShot(opt)}
                className={`flex-1 py-1.5 rounded-md text-label font-medium transition-colors ${
                  firstShot === opt ? '' : 'hover:bg-[var(--bg-hover)]'
                }`}
                style={{
                  background: firstShot === opt ? 'var(--accent)' : 'var(--bg-primary)',
                  color: firstShot === opt ? 'white' : 'var(--text-secondary)',
                  border: '1px solid var(--border-primary)',
                }}
              >
                {opt === 'A' ? t('fpsSim.aFirst') : opt === 'B' ? t('fpsSim.bFirst') : t('fpsSim.simultaneous')}
              </button>
            ))}
          </div>
        </div>

        <RangeRow label={t('fpsSim.aimSkillA')} value={aimSkillA} unit="" min={0} max={100} step={5} onChange={setAimSkillA} format={(v) => `${v} (${skillTier(v)})`} />
        <RangeRow label={t('fpsSim.aimSkillB')} value={aimSkillB} unit="" min={0} max={100} step={5} onChange={setAimSkillB} format={(v) => `${v} (${skillTier(v)})`} />

        <div className="flex gap-2">
          <label className="flex-1 flex items-center gap-2 p-2 rounded-md cursor-pointer" style={{ background: 'var(--bg-primary)' }}>
            <input type="checkbox" checked={aMoving} onChange={(e) => setAMoving(e.target.checked)} />
            <span className="text-label" style={{ color: 'var(--text-primary)' }}>{t('fpsSim.aMoving')}</span>
          </label>
          <label className="flex-1 flex items-center gap-2 p-2 rounded-md cursor-pointer" style={{ background: 'var(--bg-primary)' }}>
            <input type="checkbox" checked={bMoving} onChange={(e) => setBMoving(e.target.checked)} />
            <span className="text-label" style={{ color: 'var(--text-primary)' }}>{t('fpsSim.bMoving')}</span>
          </label>
        </div>

        {/* 유틸리티 (스모크 · 플래시 · 몰로토프 · 디코이) */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-label" style={{ color: 'var(--text-secondary)' }}>
              {t('fpsSim.utilitiesHeader', { n: utilities.length })}
            </span>
            <div className="flex gap-1">
              {(['smoke', 'flash', 'molotov', 'decoy'] as const).map((kind) => (
                <button
                  key={kind}
                  onClick={() => addUtility(kind, 'B')}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-caption hover:bg-[var(--bg-hover)]"
                  style={{ background: 'var(--bg-primary)', color: UTILITY_COLOR[kind] }}
                  title={t('fpsSim.addUtilityTooltip', { kind: t(UTILITY_LABEL[kind] as 'fpsSim.utilSmoke') })}
                >
                  <Plus className="w-2.5 h-2.5" />
                  {UTILITY_LABEL[kind]}
                </button>
              ))}
            </div>
          </div>
          {utilities.length > 0 && (
            <div className="space-y-1">
              {utilities.map((u, i) => (
                <div key={i} className="flex items-center gap-1 p-1 rounded" style={{ background: 'var(--bg-primary)' }}>
                  <UtilityIcon kind={u.kind} />
                  <span className="text-caption font-semibold" style={{ color: UTILITY_COLOR[u.kind] }}>
                    {UTILITY_LABEL[u.kind]}
                  </span>
                  <select
                    value={u.affects}
                    onChange={(e) => updateUtility(i, { affects: e.target.value as 'A' | 'B' | 'both' })}
                    className="input-compact"
                    style={{ width: 70 }}
                  >
                    <option value="A">{t('fpsSim.targetA')}</option>
                    <option value="B">{t('fpsSim.targetB')}</option>
                    <option value="both">{t('fpsSim.targetBoth')}</option>
                  </select>
                  <label className="text-caption ml-1" style={{ color: 'var(--text-tertiary)' }}>
                    {u.kind === 'molotov' ? 'dps' : 'hit×'}
                  </label>
                  <input
                    type="number"
                    value={u.intensity ?? 0}
                    step={u.kind === 'molotov' ? 1 : 0.05}
                    min={0}
                    onChange={(e) => updateUtility(i, { intensity: parseFloat(e.target.value) || 0 })}
                    className="input-compact hide-spinner"
                    style={{ width: 50 }}
                  />
                  <label className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
                    sec
                  </label>
                  <input
                    type="number"
                    value={u.durationMs / 1000}
                    step={0.5}
                    min={0.1}
                    onChange={(e) => updateUtility(i, { durationMs: (parseFloat(e.target.value) || 0.1) * 1000 })}
                    className="input-compact hide-spinner"
                    style={{ width: 55 }}
                  />
                  <label className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
                    @ms
                  </label>
                  <input
                    type="number"
                    value={u.deployedAtMs}
                    step={100}
                    min={0}
                    onChange={(e) => updateUtility(i, { deployedAtMs: parseFloat(e.target.value) || 0 })}
                    className="input-compact hide-spinner"
                    style={{ width: 60 }}
                    title={t('fpsSim.utilTimingTitle')}
                  />
                  <button onClick={() => removeUtility(i)} className="p-1 rounded hover:bg-[var(--bg-tertiary)] ml-auto">
                    <Trash2 className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="text-caption italic mt-1" style={{ color: 'var(--text-tertiary)' }}>
            {t('fpsSim.utilExplain')}
          </p>
        </div>

        <RangeRow label={t('fpsSim.iterations')} value={runs} unit={t('fpsSim.iterationsUnit')} min={500} max={20000} step={500} onChange={setRuns} />
      </div>

      {/* 결과 요약 */}
      <div className="grid grid-cols-2 gap-2">
        <ResultCard label={t('fpsSim.weaponAResult')} result={resultA} color="#3b82f6" />
        <ResultCard label={t('fpsSim.weaponBResult')} result={resultB} color="#ef4444" />
      </div>

      {/* 1v1 승률 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Swords className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          <span className="text-label font-medium" style={{ color: 'var(--text-primary)' }}>{t('fpsSim.duelWinrate')}</span>
          <span className="ml-auto text-caption" style={{ color: 'var(--text-tertiary)' }}>
            {t('fpsSim.duelAvg', { ms: Math.round(duel.avgDurationMs) })}
          </span>
        </div>
        <div className="flex h-6 rounded-md overflow-hidden">
          <div
            className="flex items-center justify-center text-caption font-semibold text-white"
            style={{ background: '#3b82f6', width: `${Math.round(duel.aWinRate * 100)}%` }}
          >
            {duel.aWinRate > 0.1 && `A ${Math.round(duel.aWinRate * 100)}%`}
          </div>
          {duel.drawRate > 0 && (
            <div
              className="flex items-center justify-center text-caption text-white"
              style={{ background: 'var(--text-tertiary)', width: `${Math.round(duel.drawRate * 100)}%` }}
            >
              {duel.drawRate > 0.05 && t('fpsSim.drawMark', { pct: Math.round(duel.drawRate * 100) })}
            </div>
          )}
          <div
            className="flex items-center justify-center text-caption font-semibold text-white"
            style={{ background: '#ef4444', width: `${Math.round(duel.bWinRate * 100)}%` }}
          >
            {duel.bWinRate > 0.1 && `B ${Math.round(duel.bWinRate * 100)}%`}
          </div>
        </div>
      </div>

      {/* 거리별 effective DPS */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Flame className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          <span className="text-label font-medium" style={{ color: 'var(--text-primary)' }}>
            {t('fpsSim.effectiveDps')}
          </span>
        </div>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 2" stroke="var(--border-primary)" opacity={0.3} />
              <XAxis
                dataKey="distance"
                tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
                tickLine={false}
                label={{ value: 'm', position: 'insideBottomRight', offset: -2, fontSize: 10, fill: 'var(--text-tertiary)' }}
              />
              <YAxis tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }} tickLine={false} width={32} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 6,
                  fontSize: 11,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="A" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} name={weaponA.name} />
              <Line type="monotone" dataKey="B" stroke="#ef4444" strokeWidth={2} dot={false} isAnimationActive={false} name={weaponB.name} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Apex 스타일 쉴드 brackets */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="text-label font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
          {t('fpsSim.shieldByTier', { d: distance })}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ShieldBreakdownTable weapon={weaponA} distance={distance} name={weaponA.name} />
          <ShieldBreakdownTable weapon={weaponB} distance={distance} name={weaponB.name} />
        </div>
      </div>

      <div className="text-caption italic" style={{ color: 'var(--text-tertiary)' }}>
        {t('fpsSim.ttkBtkNote')}
      </div>
    </PanelShell>
  );
}

function ShieldBreakdownTable({ weapon, distance, name }: { weapon: WeaponStats; distance: number; name: string }) {
  const t = useTranslations();
  const rows = calculateShieldBreakdown(weapon, distance);
  return (
    <div>
      <div className="text-caption font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
        {name}
      </div>
      <div className="space-y-0.5">
        <div className="grid grid-cols-5 gap-1 text-caption px-1" style={{ color: 'var(--text-tertiary)' }}>
          <span>{t('fpsSim.tierLabel')}</span>
          <span className="text-center">{t('fpsSim.hpShieldLabel')}</span>
          <span className="text-center">{t('fpsSim.bodyBtk')}</span>
          <span className="text-center">{t('fpsSim.headBtk')}</span>
          <span className="text-center">TTK(ms)</span>
        </div>
        {rows.map((r) => {
          const bracket = SHIELD_BRACKETS[r.tier];
          return (
            <div key={r.tier} className="grid grid-cols-5 gap-1 text-label px-1 py-0.5 rounded" style={{ background: 'var(--bg-primary)' }}>
              <span className="font-medium inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: bracket.color }} />
                {r.label}
              </span>
              <span className="text-center tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                {r.totalHp}
              </span>
              <span className="text-center tabular-nums font-semibold" style={{ color: 'var(--text-primary)' }}>
                {r.btkBody}
              </span>
              <span className="text-center tabular-nums font-semibold" style={{ color: '#ef4444' }}>
                {r.btkHead}
              </span>
              <span className="text-center tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                {Math.round(r.ttkBodyMs)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function skillTier(v: number): string {
  const t = useTranslations();
  if (v < 30) return t('fpsSim.tierBeginner');
  if (v < 50) return t('fpsSim.tierBelowAvg');
  if (v < 70) return t('fpsSim.tierAvg');
  if (v < 85) return t('fpsSim.tierSkilled');
  return t('fpsSim.tierExpert');
}

const UTILITY_LABEL: Record<UtilityKind, string> = {
  smoke: 'fpsSim.utilSmoke',
  flash: 'fpsSim.utilFlash',
  molotov: 'fpsSim.utilMolotov',
  decoy: 'fpsSim.utilDecoy',
};
const UTILITY_COLOR: Record<UtilityKind, string> = {
  smoke: '#6b7280',
  flash: '#fbbf24',
  molotov: '#ef4444',
  decoy: '#8b5cf6',
};

function UtilityIcon({ kind }: { kind: UtilityKind }) {
  const color = UTILITY_COLOR[kind];
  if (kind === 'smoke') return <Cloud className="w-3 h-3" style={{ color }} />;
  if (kind === 'flash') return <Zap className="w-3 h-3" style={{ color }} />;
  if (kind === 'molotov') return <Flame className="w-3 h-3" style={{ color }} />;
  return <Swords className="w-3 h-3" style={{ color }} />;
}

// ============================================================================
// 서브 컴포넌트
// ============================================================================

function WeaponCard({
  weapon,
  setWeapon,
  color,
}: {
  weapon: WeaponStats;
  setWeapon: (fn: (prev: WeaponStats) => WeaponStats) => void;
  color: string;
}) {
  const t = useTranslations();
  const update = <K extends keyof WeaponStats>(key: K, value: WeaponStats[K]) =>
    setWeapon((prev) => ({ ...prev, [key]: value }));

  const loadPreset = (id: string) => {
    const p = WEAPON_PRESETS.find((x) => x.id === id);
    if (p) setWeapon(() => ({ ...p, name: p.name }));
  };

  return (
    <div className="p-3 rounded-lg space-y-2" style={{ background: 'var(--bg-tertiary)', border: `2px solid ${color}` }}>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={weapon.name}
          onChange={(e) => update('name', e.target.value)}
          className="input-base font-medium flex-1 min-w-0"
          style={{ color }}
        />
        <select
          value=""
          onChange={(e) => loadPreset(e.target.value)}
          className="input-compact"
          style={{ width: '70px' }}
          title={t('fpsSim.presetTitle')}
        >
          <option value="">{t('fpsSim.presetPlaceholder')}</option>
          {WEAPON_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <NumField label={t('fpsSim.damageHead')} value={weapon.damageHead} onChange={(v) => update('damageHead', v)} />
        <NumField label={t('fpsSim.damageBody')} value={weapon.damageBody} onChange={(v) => update('damageBody', v)} />
        <NumField label={t('fpsSim.damageLimb')} value={weapon.damageLimb} onChange={(v) => update('damageLimb', v)} />
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <NumField label="RPM" value={weapon.rpm} onChange={(v) => update('rpm', v)} />
        <NumField label={t('fpsSim.magazine')} value={weapon.magazineSize} onChange={(v) => update('magazineSize', v)} />
        <NumField label={t('fpsSim.armorPen')} value={weapon.armorPenPercent} step={0.05} onChange={(v) => update('armorPenPercent', v)} />
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <NumField label={t('fpsSim.falloffStart')} value={weapon.rangeFalloffStart} onChange={(v) => update('rangeFalloffStart', v)} />
        <NumField label={t('fpsSim.falloffEnd')} value={weapon.rangeFalloffEnd} onChange={(v) => update('rangeFalloffEnd', v)} />
        <NumField label={t('fpsSim.falloffMul')} value={weapon.falloffDamageMultiplier} step={0.05} onChange={(v) => update('falloffDamageMultiplier', v)} />
      </div>
      {/* 첫 발 보너스 / 반동 / 이동 패널티 — 실제 FPS 공식 밸런싱 지표 */}
      <div className="grid grid-cols-3 gap-1.5">
        <NumField label={t('fpsSim.firstShotBonus')} value={weapon.firstShotAccuracyBonus ?? 0} step={0.05} onChange={(v) => update('firstShotAccuracyBonus', v)} />
        <NumField label={t('fpsSim.recoil')} value={weapon.recoilIntensity ?? 0} step={0.05} onChange={(v) => update('recoilIntensity', v)} />
        <NumField label={t('fpsSim.movingPenalty')} value={weapon.movingAccuracyPenalty ?? 0} step={0.05} onChange={(v) => update('movingAccuracyPenalty', v)} />
      </div>
      <NumField label={t('fpsSim.reloadSec')} value={weapon.reloadTimeSeconds} step={0.1} onChange={(v) => update('reloadTimeSeconds', v)} />
    </div>
  );
}

function NumField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div>
      <label className="block text-caption mb-0.5" style={{ color: 'var(--text-tertiary)' }}>
        {label}
      </label>
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full input-compact hide-spinner"
      />
    </div>
  );
}

function RangeRow({
  label,
  value,
  unit,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-label" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className="text-label font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
          {format ? format(value) : `${value}${unit}`}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
        style={{ accentColor: 'var(--accent)' }}
      />
    </div>
  );
}

function ResultCard({ label, result, color }: { label: string; result: ReturnType<typeof simulateWeaponTtk>; color: string }) {
  const t = useTranslations();
  return (
    <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)', border: `1px solid ${color}` }}>
      <div className="text-label font-medium mb-2" style={{ color }}>
        {label}
      </div>
      <div className="grid grid-cols-2 gap-1 text-label">
        <Metric name="TTK" value={`${Math.round(result.avgTtkMs)}ms`} sub={`中 ${Math.round(result.medianTtkMs)}ms`} />
        <Metric name="BTK" value={t('fpsSim.btkUnit', { n: result.avgBtk.toFixed(1) })} sub={t('fpsSim.btkSub', { min: result.minBtk, max: result.maxBtk })} />
        <Metric name="kill%" value={`${Math.round(result.killProbability * 100)}%`} sub={t('fpsSim.killSub')} />
        <Metric name="eff DPS" value={Math.round(result.effectiveDps).toString()} sub={t('fpsSim.effDpsSub', { n: Math.round(result.theoreticalMaxDps) })} />
      </div>
    </div>
  );
}

function Metric({ name, value, sub }: { name: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>{name}</div>
      <div className="font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>{value}</div>
      {sub && <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>{sub}</div>}
    </div>
  );
}
