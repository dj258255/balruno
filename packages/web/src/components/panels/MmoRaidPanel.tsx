/**
 * MMO Raid DPS Race 패널 — WoW/FFXIV/Lost Ark 레이드 밸런싱.
 */

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Sword, Shield, Heart, Skull, Timer, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import PanelShell from '@/components/ui/PanelShell';
import {
  simulateRaid,
  defaultRaidParty,
  BOSS_PRESETS,
  type Raider,
  type RaidBoss,
  type RaiderRole,
} from '@/lib/mmoRaid';

interface Props {
  onClose: () => void;
}

const ROLE_ICON: Record<RaiderRole, typeof Sword> = {
  tank: Shield,
  healer: Heart,
  dps: Sword,
};

const ROLE_COLOR: Record<RaiderRole, string> = {
  tank: '#3b82f6',
  healer: '#10b981',
  dps: '#ef4444',
};

export default function MmoRaidPanel({ onClose }: Props) {
  const t = useTranslations();
  const [raiders, setRaiders] = useState<Raider[]>(defaultRaidParty());
  const [boss, setBoss] = useState<RaidBoss>(BOSS_PRESETS[0]);

  const result = useMemo(
    () => simulateRaid({ raiders, boss, maxDurationSec: boss.enrageAtSec + 60 }),
    [raiders, boss],
  );

  const outcomeColor =
    result.outcome === 'kill'   ? '#10b981'
    : result.outcome === 'wipe'   ? '#ef4444'
    : '#f59e0b';
  const outcomeIcon =
    result.outcome === 'kill'   ? CheckCircle
    : result.outcome === 'wipe'   ? Skull
    : Timer;
  const outcomeLabel =
    result.outcome === 'kill'   ? t('mmoRaid.killOutcome', { m: (result.durationSec / 60).toFixed(1) })
    : result.outcome === 'wipe'   ? t('mmoRaid.wipeOutcome')
    : t('mmoRaid.enrageOutcome');

  const updateRaider = <K extends keyof Raider>(idx: number, key: K, value: Raider[K]) =>
    setRaiders((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));

  return (
    <PanelShell
      title="MMO Raid DPS Race"
      subtitle={t('mmoRaid.subtitleHeader')}
      icon={Sword}
      iconColor="#ef4444"
      onClose={onClose}
      bodyClassName="p-3 space-y-3 overflow-y-auto"
    >
      {/* 보스 선택 */}
      <div className="p-3 rounded-lg flex items-center gap-3" style={{ background: 'var(--bg-tertiary)' }}>
        <span className="text-label font-medium" style={{ color: 'var(--text-primary)' }}>{t('mmoRaid.bossLabel')}</span>
        <select
          value={boss.id}
          onChange={(e) => {
            const p = BOSS_PRESETS.find((b) => b.id === e.target.value);
            if (p) setBoss(p);
          }}
          className="input-compact flex-1"
        >
          {BOSS_PRESETS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <span className="text-caption tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
          {t('mmoRaid.hpEnrage', { hp: (boss.totalHp / 1_000_000).toFixed(1), min: Math.floor(boss.enrageAtSec / 60) })}
        </span>
      </div>

      {/* 결과 */}
      <div className="p-4 rounded-lg flex items-center gap-4" style={{ background: 'var(--bg-tertiary)', border: `2px solid ${outcomeColor}` }}>
        {(() => { const Icon = outcomeIcon; return <Icon className="w-10 h-10" style={{ color: outcomeColor }} />; })()}
        <div className="flex-1">
          <div className="text-heading font-bold" style={{ color: outcomeColor }}>{outcomeLabel}</div>
          <div className="text-caption" style={{ color: 'var(--text-secondary)' }}>
            {t('mmoRaid.bossHpRemain', { pct: Math.round(result.bossHpPct * 100) })}
            {t('mmoRaid.survivors', { n: result.survivors, total: raiders.length })}
            {t('mmoRaid.avgRaidDps', { dps: Math.round(result.averageRaidDps).toLocaleString() })}
            {t('mmoRaid.avgRaidHps', { hps: Math.round(result.averageRaidHps).toLocaleString() })}
          </div>
        </div>
        <div>
          <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>{t('mmoRaid.killNeededDps')}</div>
          <div className="text-2xl font-bold tabular-nums" style={{ color: '#ef4444' }}>
            {Math.round(result.requiredDpsForKill).toLocaleString()}
          </div>
        </div>
      </div>

      {/* 페이즈 타임라인 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="text-label font-medium mb-2" style={{ color: 'var(--text-primary)' }}>{t('mmoRaid.phaseTimeline')}</div>
        <div className="space-y-1">
          {boss.phases.map((phase, idx) => {
            const entered = result.phaseEnterTimes[idx];
            const color = phase.isEnrage ? '#ef4444' : idx === 0 ? '#10b981' : idx === 1 ? '#f59e0b' : '#8b5cf6';
            return (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-14 text-caption font-mono tabular-nums" style={{ color: entered >= 0 ? color : 'var(--text-tertiary)' }}>
                  {entered >= 0 ? `${Math.floor(entered / 60)}:${(entered % 60).toString().padStart(2, '0')}` : '—'}
                </span>
                <div className="flex-1 h-6 rounded relative overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
                  <div
                    className="absolute top-0 bottom-0"
                    style={{
                      left: 0,
                      width: entered >= 0 ? '100%' : '0%',
                      background: `${color}30`,
                    }}
                  />
                  <span className="absolute inset-0 flex items-center px-2 text-caption font-semibold" style={{ color }}>
                    {phase.label} · raid {phase.raidWideDps} / tank {phase.tankDps}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 사망 타임라인 */}
      {result.deaths.length > 0 && (
        <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)', borderLeft: '3px solid #ef4444' }}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4" style={{ color: '#ef4444' }} />
            <span className="text-label font-medium" style={{ color: 'var(--text-primary)' }}>
              {t('mmoRaid.deaths', { d: result.deaths.length, total: raiders.length })}
            </span>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {result.deaths.map((d) => {
              const r = raiders.find((x) => x.id === d.raiderId);
              return (
                <span key={d.raiderId} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-caption" style={{ background: 'var(--bg-primary)' }}>
                  <Skull className="w-3 h-3" style={{ color: '#6b7280' }} />
                  <span style={{ color: r ? ROLE_COLOR[r.role] : 'var(--text-secondary)' }}>{r?.name ?? d.raiderId}</span>
                  <span className="tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                    {Math.floor(d.timeSec / 60)}:{(d.timeSec % 60).toString().padStart(2, '0')}
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* 공대원 편집 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="text-label font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
          {t('mmoRaid.raidersHeader', { n: raiders.length })}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {raiders.map((r, idx) => {
            const Icon = ROLE_ICON[r.role];
            const color = ROLE_COLOR[r.role];
            const dead = result.deaths.some((d) => d.raiderId === r.id);
            return (
              <div
                key={r.id}
                className="p-2 rounded flex items-center gap-1.5"
                style={{
                  background: 'var(--bg-primary)',
                  borderLeft: `3px solid ${color}`,
                  opacity: dead ? 0.5 : 1,
                }}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" style={{ color }} />
                <input
                  value={r.name}
                  onChange={(e) => updateRaider(idx, 'name', e.target.value)}
                  className="input-compact w-20 text-caption"
                />
                <label className="text-caption" style={{ color: 'var(--text-tertiary)' }}>HP</label>
                <input
                  type="number"
                  value={r.hp}
                  step={5000}
                  onChange={(e) => updateRaider(idx, 'hp', parseInt(e.target.value) || 0)}
                  className="input-compact hide-spinner w-16"
                />
                <label className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
                  {r.role === 'healer' ? 'HPS' : 'DPS'}
                </label>
                <input
                  type="number"
                  value={r.output}
                  step={500}
                  onChange={(e) => updateRaider(idx, 'output', parseInt(e.target.value) || 0)}
                  className="input-compact hide-spinner w-16"
                />
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-caption italic" style={{ color: 'var(--text-tertiary)' }}>
        <Clock className="w-3 h-3 inline" />{t('mmoRaid.mechanicsNote')}
      </p>
    </PanelShell>
  );
}
