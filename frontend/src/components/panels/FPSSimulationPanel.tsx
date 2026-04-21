'use client';

/**
 * FPS TTK 시뮬레이션 패널 — Destiny / Valorant / CoD 밸런싱 방식.
 *
 * 두 무기 A/B 를 나란히 입력 → 거리/장갑/aim skill 변수 조절 → Monte Carlo.
 * 결과: TTK · BTK · 1v1 승률 · 거리별 effective DPS 곡선
 */

import { useState, useMemo } from 'react';
import { Crosshair, Swords, Flame } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import PanelShell from '@/components/ui/PanelShell';
import {
  WEAPON_PRESETS,
  aimSkillToProfile,
  simulateWeaponTtk,
  simulateFpsDuel,
  calculateDpsCurve,
  calculateShieldBreakdown,
  SHIELD_BRACKETS,
  type WeaponStats,
} from '@/lib/fpsSimulation';

interface Props {
  onClose: () => void;
}

const DEFAULT_TARGET = { hp: 100, shield: 50, armor: 0.1 };

export default function FPSSimulationPanel({ onClose }: Props) {
  const [weaponA, setWeaponA] = useState<WeaponStats>({ ...WEAPON_PRESETS[0], name: '무기 A' });
  const [weaponB, setWeaponB] = useState<WeaponStats>({ ...WEAPON_PRESETS[1], name: '무기 B' });
  const [aimSkillA, setAimSkillA] = useState(65);
  const [aimSkillB, setAimSkillB] = useState(65);
  const [distance, setDistance] = useState(20);
  const [targetArmor, setTargetArmor] = useState(0.1);
  const [firstShot, setFirstShot] = useState<'A' | 'B' | 'both-aware'>('both-aware');
  const [aMoving, setAMoving] = useState(false);
  const [bMoving, setBMoving] = useState(false);
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
        { distance, firstShot, bothAwareDelayMs: 100, aMoving, bMoving },
        runs,
      ),
    [weaponA, aimA, weaponB, aimB, distance, firstShot, aMoving, bMoving, runs],
  );

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
      title="FPS TTK 시뮬"
      subtitle="두 무기 비교 · Monte Carlo"
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
          교전 상황
        </div>

        <RangeRow label="거리" value={distance} unit="m" min={1} max={100} step={1} onChange={setDistance} />
        <RangeRow label="타겟 장갑" value={targetArmor} unit="" min={0} max={0.9} step={0.05} onChange={setTargetArmor} format={(v) => `${Math.round(v * 100)}%`} />

        <div>
          <div className="text-label mb-1" style={{ color: 'var(--text-secondary)' }}>
            첫발 우위
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
                {opt === 'A' ? 'A 선공' : opt === 'B' ? 'B 선공' : '동시 인지'}
              </button>
            ))}
          </div>
        </div>

        <RangeRow label="A 에임 실력" value={aimSkillA} unit="" min={0} max={100} step={5} onChange={setAimSkillA} format={(v) => `${v} (${skillTier(v)})`} />
        <RangeRow label="B 에임 실력" value={aimSkillB} unit="" min={0} max={100} step={5} onChange={setAimSkillB} format={(v) => `${v} (${skillTier(v)})`} />

        <div className="flex gap-2">
          <label className="flex-1 flex items-center gap-2 p-2 rounded-md cursor-pointer" style={{ background: 'var(--bg-primary)' }}>
            <input type="checkbox" checked={aMoving} onChange={(e) => setAMoving(e.target.checked)} />
            <span className="text-label" style={{ color: 'var(--text-primary)' }}>A 이동 중</span>
          </label>
          <label className="flex-1 flex items-center gap-2 p-2 rounded-md cursor-pointer" style={{ background: 'var(--bg-primary)' }}>
            <input type="checkbox" checked={bMoving} onChange={(e) => setBMoving(e.target.checked)} />
            <span className="text-label" style={{ color: 'var(--text-primary)' }}>B 이동 중</span>
          </label>
        </div>

        <RangeRow label="반복 수" value={runs} unit="회" min={500} max={20000} step={500} onChange={setRuns} />
      </div>

      {/* 결과 요약 */}
      <div className="grid grid-cols-2 gap-2">
        <ResultCard label="무기 A" result={resultA} color="#3b82f6" />
        <ResultCard label="무기 B" result={resultB} color="#ef4444" />
      </div>

      {/* 1v1 승률 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Swords className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          <span className="text-label font-medium" style={{ color: 'var(--text-primary)' }}>1v1 교전 승률</span>
          <span className="ml-auto text-caption" style={{ color: 'var(--text-tertiary)' }}>
            평균 {Math.round(duel.avgDurationMs)}ms
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
              {duel.drawRate > 0.05 && `무 ${Math.round(duel.drawRate * 100)}%`}
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
            거리별 Effective DPS (hit% × 부위 × 감쇠 반영)
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
          쉴드 티어별 BTK / TTK (Apex 방식) · 현재 거리 {distance}m
        </div>
        <div className="grid grid-cols-2 gap-2">
          <ShieldBreakdownTable weapon={weaponA} distance={distance} name={weaponA.name} />
          <ShieldBreakdownTable weapon={weaponB} distance={distance} name={weaponB.name} />
        </div>
      </div>

      <div className="text-caption italic" style={{ color: 'var(--text-tertiary)' }}>
        TTK = Time to Kill (첫 명중부터 처치까지 밀리초) · BTK = Bullets to Kill · 타겟 기본 HP 100 + 쉴드 50
      </div>
    </PanelShell>
  );
}

function ShieldBreakdownTable({ weapon, distance, name }: { weapon: WeaponStats; distance: number; name: string }) {
  const rows = calculateShieldBreakdown(weapon, distance);
  return (
    <div>
      <div className="text-caption font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
        {name}
      </div>
      <div className="space-y-0.5">
        <div className="grid grid-cols-5 gap-1 text-caption px-1" style={{ color: 'var(--text-tertiary)' }}>
          <span>티어</span>
          <span className="text-center">HP+쉴드</span>
          <span className="text-center">몸 BTK</span>
          <span className="text-center">헤드 BTK</span>
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
  if (v < 30) return '초보';
  if (v < 50) return '평균↓';
  if (v < 70) return '평균';
  if (v < 85) return '숙련';
  return '전문가';
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
          title="프리셋"
        >
          <option value="">프리셋</option>
          {WEAPON_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <NumField label="머리" value={weapon.damageHead} onChange={(v) => update('damageHead', v)} />
        <NumField label="몸통" value={weapon.damageBody} onChange={(v) => update('damageBody', v)} />
        <NumField label="팔다리" value={weapon.damageLimb} onChange={(v) => update('damageLimb', v)} />
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <NumField label="RPM" value={weapon.rpm} onChange={(v) => update('rpm', v)} />
        <NumField label="탄창" value={weapon.magazineSize} onChange={(v) => update('magazineSize', v)} />
        <NumField label="관통%" value={weapon.armorPenPercent} step={0.05} onChange={(v) => update('armorPenPercent', v)} />
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <NumField label="감쇠 시작m" value={weapon.rangeFalloffStart} onChange={(v) => update('rangeFalloffStart', v)} />
        <NumField label="감쇠 끝m" value={weapon.rangeFalloffEnd} onChange={(v) => update('rangeFalloffEnd', v)} />
        <NumField label="최소배율" value={weapon.falloffDamageMultiplier} step={0.05} onChange={(v) => update('falloffDamageMultiplier', v)} />
      </div>
      {/* 첫 발 보너스 / 반동 / 이동 패널티 — 실제 FPS 공식 밸런싱 지표 */}
      <div className="grid grid-cols-3 gap-1.5">
        <NumField label="첫발+" value={weapon.firstShotAccuracyBonus ?? 0} step={0.05} onChange={(v) => update('firstShotAccuracyBonus', v)} />
        <NumField label="반동" value={weapon.recoilIntensity ?? 0} step={0.05} onChange={(v) => update('recoilIntensity', v)} />
        <NumField label="이동패널" value={weapon.movingAccuracyPenalty ?? 0} step={0.05} onChange={(v) => update('movingAccuracyPenalty', v)} />
      </div>
      <NumField label="재장전(초)" value={weapon.reloadTimeSeconds} step={0.1} onChange={(v) => update('reloadTimeSeconds', v)} />
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
  return (
    <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)', border: `1px solid ${color}` }}>
      <div className="text-label font-medium mb-2" style={{ color }}>
        {label}
      </div>
      <div className="grid grid-cols-2 gap-1 text-label">
        <Metric name="TTK" value={`${Math.round(result.avgTtkMs)}ms`} sub={`中 ${Math.round(result.medianTtkMs)}ms`} />
        <Metric name="BTK" value={`${result.avgBtk.toFixed(1)}발`} sub={`min ${result.minBtk} / max ${result.maxBtk}`} />
        <Metric name="kill%" value={`${Math.round(result.killProbability * 100)}%`} sub="탄창 내" />
        <Metric name="eff DPS" value={Math.round(result.effectiveDps).toString()} sub={`이론 ${Math.round(result.theoreticalMaxDps)}`} />
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
