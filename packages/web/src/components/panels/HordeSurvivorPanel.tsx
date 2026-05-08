/**
 * Horde/Survivor 시뮬 패널 — Vampire Survivors 스타일 빌드 최적화.
 */

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Skull, Flame, Snowflake, Zap, Sparkles, Droplet, Shield, Plus, Trash2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import PanelShell from '@/components/ui/PanelShell';
import {
  simulateHordeSurvivor,
  evaluateBuild,
  defaultHordeConfig,
  WEAPON_PRESETS,
  type Weapon,
  type HordeSurvivorConfig,
} from '@/lib/hordeSurvivor';

interface Props {
  onClose: () => void;
}

const ELEMENT_ICON: Record<string, typeof Skull> = {
  physical: Skull,
  fire: Flame,
  ice: Snowflake,
  lightning: Zap,
  holy: Sparkles,
  poison: Droplet,
};

const ELEMENT_COLOR: Record<string, string> = {
  physical: '#94a3b8',
  fire: '#ef4444',
  ice: '#3b82f6',
  lightning: '#fbbf24',
  holy: '#f0abfc',
  poison: '#10b981',
};

export default function HordeSurvivorPanel({ onClose }: Props) {
  const t = useTranslations();
  const [cfg, setCfg] = useState<HordeSurvivorConfig>(defaultHordeConfig());

  const result = useMemo(() => simulateHordeSurvivor(cfg), [cfg]);
  const evaluation = useMemo(() => evaluateBuild(cfg.weapons), [cfg.weapons]);

  const chartData = result.samples.map((s) => ({
    min: (s.timeSec / 60).toFixed(1),
    hp: s.playerHp,
    dps: s.playerDps,
    density: s.enemyDensity,
    overflow: s.overflow,
    level: s.playerLevel,
  }));

  const addWeapon = (w: Weapon) => {
    if (cfg.weapons.length >= 6) return;
    setCfg({ ...cfg, weapons: [...cfg.weapons, { weapon: w, level: 1 }] });
  };
  const removeWeapon = (idx: number) => {
    setCfg({ ...cfg, weapons: cfg.weapons.filter((_, i) => i !== idx) });
  };
  const updateLevel = (idx: number, level: number) => {
    setCfg({ ...cfg, weapons: cfg.weapons.map((w, i) => (i === idx ? { ...w, level } : w)) });
  };

  const survivedMin = Math.floor(result.survivedSec / 60);
  const outcomeColor = result.survived ? '#10b981' : '#ef4444';
  const outcomeLabel = result.survived ? t('hordeSurvivor.survived30') : t('hordeSurvivor.diedAt', { m: survivedMin, s: (result.survivedSec % 60).toString().padStart(2, '0') });

  // 무기 속성 카운트
  const elementSummary = cfg.weapons.reduce<Record<string, number>>((acc, { weapon }) => {
    if (weapon.element) acc[weapon.element] = (acc[weapon.element] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <PanelShell
      title={t('hordeSurvivor.titleHeader')}
      subtitle={t('hordeSurvivor.subtitleHeader')}
      icon={Skull}
      iconColor="#8b5cf6"
      onClose={onClose}
      bodyClassName="p-3 space-y-3 overflow-y-auto"
    >
      {/* 결과 */}
      <div className="p-4 rounded-lg flex items-center gap-4" style={{ background: 'var(--bg-tertiary)', border: `2px solid ${outcomeColor}` }}>
        <Shield className="w-10 h-10" style={{ color: outcomeColor }} />
        <div className="flex-1">
          <div className="text-heading font-bold" style={{ color: outcomeColor }}>{outcomeLabel}</div>
          <div className="text-caption" style={{ color: 'var(--text-secondary)' }}>
            {t('hordeSurvivor.maxLevelKills', { lvl: result.maxLevel, kills: result.totalKills.toLocaleString(), avg: result.avgKillsPerSec.toFixed(1) })}
          </div>
        </div>
        <div>
          <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>{t('hordeSurvivor.buildScore')}</div>
          <div className="text-2xl font-bold tabular-nums" style={{ color: evaluation.score > 70 ? '#10b981' : evaluation.score > 40 ? '#f59e0b' : '#ef4444' }}>
            {evaluation.score}/100
          </div>
        </div>
      </div>

      {/* 지표 */}
      <div className="grid grid-cols-4 gap-2">
        <Stat label={t('hordeSurvivor.dps10m')} value={Math.round(evaluation.dpsAt10min).toLocaleString()} color="#3b82f6" />
        <Stat label={t('hordeSurvivor.dps20m')} value={Math.round(evaluation.dpsAt20min).toLocaleString()} color="#8b5cf6" />
        <Stat label={t('hordeSurvivor.dps30m')} value={Math.round(evaluation.dpsAt30min).toLocaleString()} color="#ef4444" />
        <Stat label={t('hordeSurvivor.synergy')} value={`×${evaluation.synergyBonus.toFixed(2)}`} sub={t('hordeSurvivor.synergySubtitle')} color="#f59e0b" />
      </div>

      {/* 빌드 — 6 슬롯 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-label font-medium" style={{ color: 'var(--text-primary)' }}>
            {t('hordeSurvivor.weaponBuild', { n: cfg.weapons.length })}
          </span>
          <div className="flex items-center gap-1 flex-wrap">
            {Object.entries(elementSummary).map(([el, count]) => {
              const Icon = ELEMENT_ICON[el] ?? Skull;
              const color = ELEMENT_COLOR[el] ?? '#94a3b8';
              return (
                <span key={el} className="inline-flex items-center gap-0.5 px-1.5 rounded text-caption font-semibold" style={{ background: `${color}20`, color }}>
                  <Icon className="w-3 h-3" />
                  {count}
                </span>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-6 gap-1 mb-2">
          {cfg.weapons.map((w, idx) => {
            const Icon = ELEMENT_ICON[w.weapon.element ?? 'physical'] ?? Skull;
            const color = ELEMENT_COLOR[w.weapon.element ?? 'physical'];
            return (
              <div key={idx} className="p-2 rounded flex flex-col items-center gap-1" style={{ background: 'var(--bg-primary)', border: `1px solid ${color}` }}>
                <Icon className="w-4 h-4" style={{ color }} />
                <span className="text-caption font-semibold text-center truncate w-full" style={{ color }}>
                  {w.weapon.name}
                </span>
                <input
                  type="range" min={1} max={w.weapon.maxLevel}
                  value={w.level}
                  onChange={(e) => updateLevel(idx, parseInt(e.target.value))}
                  className="w-full"
                  style={{ accentColor: color }}
                />
                <span className="text-caption tabular-nums" style={{ color: 'var(--text-tertiary)' }}>Lv {w.level}/{w.weapon.maxLevel}</span>
                <button onClick={() => removeWeapon(idx)} className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
            );
          })}
          {[...Array(6 - cfg.weapons.length)].map((_, i) => (
            <div key={`empty-${i}`} className="p-2 rounded flex items-center justify-center" style={{ background: 'var(--bg-primary)', opacity: 0.3 }}>
              <Plus className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
            </div>
          ))}
        </div>

        {/* 추가 가능 무기 목록 */}
        <div className="flex items-center gap-1 flex-wrap">
          {WEAPON_PRESETS.filter((w) => !cfg.weapons.some((cw) => cw.weapon.id === w.id)).map((w) => {
            const Icon = ELEMENT_ICON[w.element ?? 'physical'] ?? Skull;
            const color = ELEMENT_COLOR[w.element ?? 'physical'];
            return (
              <button
                key={w.id}
                onClick={() => addWeapon(w)}
                disabled={cfg.weapons.length >= 6}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-caption disabled:opacity-30"
                style={{ background: `${color}20`, color }}
              >
                <Icon className="w-3 h-3" /> {w.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* 시뮬 차트 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="text-label font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
          {t('hordeSurvivor.survivalTimeline')}
        </div>
        <div className="h-56">
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
              <XAxis dataKey="min" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="l" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line yAxisId="l" type="monotone" dataKey="dps" stroke="#ef4444" strokeWidth={2} name="Player DPS" dot={false} />
              <Line yAxisId="r" type="monotone" dataKey="hp" stroke="#10b981" strokeWidth={2} name="HP" dot={false} />
              <Line yAxisId="r" type="monotone" dataKey="overflow" stroke="#f59e0b" strokeWidth={2} name="Overflow" dot={false} strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {result.crisisPeakSec > 0 && (
          <p className="text-caption mt-1" style={{ color: '#f59e0b' }}>
            {t('hordeSurvivor.crisisPeak', { m: Math.floor(result.crisisPeakSec / 60), s: (result.crisisPeakSec % 60).toString().padStart(2, '0') })}
          </p>
        )}
      </div>

      <p className="text-caption italic" style={{ color: 'var(--text-tertiary)' }}>
        {t('hordeSurvivor.standardNote')}
      </p>
    </PanelShell>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)', border: `1px solid ${color}` }}>
      <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>{label}</div>
      <div className="text-heading font-bold tabular-nums" style={{ color }}>{value}</div>
      {sub && <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>{sub}</div>}
    </div>
  );
}
