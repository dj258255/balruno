'use client';

/**
 * FPS 팀 전투 시뮬 — 3v3 / 5v5 Valorant/CS2/Apex 스타일.
 * trade-kill · first blood · clutch · 개별 K/D 분석.
 */

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Users, Swords } from 'lucide-react';
import PanelShell from '@/components/ui/PanelShell';
import {
  simulateFpsTeamBattle,
  type FpsTeamPlayer,
} from '@/lib/fpsTeamSimulation';
import { WEAPON_PRESETS, aimSkillToProfile } from '@/lib/fpsSimulation';

interface Props {
  onClose: () => void;
}

const DEFAULT_SHIELD = { hp: 100, shield: 50, armor: 0.1 };

function makeDefaultTeam(prefix: string, size: number, aim: number): FpsTeamPlayer[] {
  return Array.from({ length: size }, (_, i) => ({
    id: `${prefix}${i + 1}`,
    name: `${prefix.toUpperCase()}${i + 1}`,
    weapon: { ...WEAPON_PRESETS[0] },
    player: { ...DEFAULT_SHIELD },
    aim: aimSkillToProfile(aim),
  }));
}

export default function FPSTeamSimulationPanel({ onClose }: Props) {
  const t = useTranslations();
  const [teamSize, setTeamSize] = useState<3 | 5>(3);
  const [aimA, setAimA] = useState(60);
  const [aimB, setAimB] = useState(60);
  const [distance, setDistance] = useState(15);
  const [runs, setRuns] = useState(2000);

  const teamA = useMemo(() => makeDefaultTeam('a', teamSize, aimA), [teamSize, aimA]);
  const teamB = useMemo(() => makeDefaultTeam('b', teamSize, aimB), [teamSize, aimB]);

  const result = useMemo(
    () => simulateFpsTeamBattle(teamA, teamB, { distance, startDelayMs: 0 }, runs),
    [teamA, teamB, distance, runs],
  );

  return (
    <PanelShell
      title={t('fpsTeamSim.titleHeader')}
      subtitle={t('fpsTeamSim.subtitleHeader')}
      icon={Users}
      iconColor="#8b5cf6"
      onClose={onClose}
      bodyClassName="p-3 space-y-3 overflow-y-auto"
    >
      {/* 설정 */}
      <div className="p-3 rounded-lg space-y-3" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="flex items-center gap-2">
          <span className="text-label" style={{ color: 'var(--text-secondary)' }}>{t('fpsTeamSim.teamComposition')}</span>
          <div className="flex gap-1">
            {[3, 5].map((s) => (
              <button
                key={s}
                onClick={() => setTeamSize(s as 3 | 5)}
                className="px-3 py-1 rounded-md text-label font-medium"
                style={{
                  background: teamSize === s ? 'var(--accent)' : 'var(--bg-primary)',
                  color: teamSize === s ? 'white' : 'var(--text-secondary)',
                  border: '1px solid var(--border-primary)',
                }}
              >
                {s}v{s}
              </button>
            ))}
          </div>
        </div>

        <RangeRow label={t('fpsTeamSim.teamAimA')} value={aimA} min={0} max={100} step={5} onChange={setAimA} />
        <RangeRow label={t('fpsTeamSim.teamAimB')} value={aimB} min={0} max={100} step={5} onChange={setAimB} />
        <RangeRow label={t('fpsTeamSim.engagementDistance')} value={distance} unit="m" min={1} max={60} step={1} onChange={setDistance} />
        <RangeRow label={t('fpsTeamSim.iterations')} value={runs} min={500} max={10000} step={500} onChange={setRuns} />
      </div>

      {/* 팀 승률 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="flex items-center gap-2 mb-2">
          <Swords className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          <span className="text-label font-medium" style={{ color: 'var(--text-primary)' }}>{t('fpsTeamSim.teamWinrate')}</span>
          <span className="ml-auto text-caption" style={{ color: 'var(--text-tertiary)' }}>
            {t('fpsTeamSim.avgDuration', { ms: Math.round(result.avgDurationMs) })}
          </span>
        </div>
        <div className="flex h-7 rounded-md overflow-hidden">
          <div
            className="flex items-center justify-center text-caption font-bold text-white"
            style={{ background: '#3b82f6', width: `${Math.round(result.teamAWinRate * 100)}%` }}
          >
            {result.teamAWinRate > 0.08 && `A ${Math.round(result.teamAWinRate * 100)}%`}
          </div>
          {1 - result.teamAWinRate - result.teamBWinRate > 0 && (
            <div
              className="flex items-center justify-center text-caption text-white"
              style={{
                background: 'var(--text-tertiary)',
                width: `${Math.round((1 - result.teamAWinRate - result.teamBWinRate) * 100)}%`,
              }}
            >
              {(1 - result.teamAWinRate - result.teamBWinRate) > 0.05 && t('fpsTeamSim.tieMark')}
            </div>
          )}
          <div
            className="flex items-center justify-center text-caption font-bold text-white"
            style={{ background: '#ef4444', width: `${Math.round(result.teamBWinRate * 100)}%` }}
          >
            {result.teamBWinRate > 0.08 && `B ${Math.round(result.teamBWinRate * 100)}%`}
          </div>
        </div>
      </div>

      {/* 핵심 지표 */}
      <div className="grid grid-cols-4 gap-2">
        <Stat label="First Blood A" value={`${Math.round(result.firstBloodA * 100)}%`} color="#3b82f6" />
        <Stat label="First Blood B" value={`${Math.round(result.firstBloodB * 100)}%`} color="#ef4444" />
        <Stat label={t('fpsTeamSim.tradeKill')} value={`${Math.round(result.tradeKillRate * 100)}%`} sub={t('fpsTeamSim.tradeKillSub')} color="#f59e0b" />
        <Stat label={t('fpsTeamSim.avgSurvivorWinner')} value={result.avgSurvivorsWinner.toFixed(1)} color="#10b981" />
      </div>

      {/* Clutch */}
      <div className="grid grid-cols-2 gap-2">
        <Stat label={t('fpsTeamSim.clutchA')} value={result.clutchWinsA.toString()} sub={t('fpsTeamSim.clutchSub', { runs })} color="#3b82f6" />
        <Stat label={t('fpsTeamSim.clutchB')} value={result.clutchWinsB.toString()} sub={t('fpsTeamSim.clutchSub', { runs })} color="#ef4444" />
      </div>

      {/* 개별 K/D */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="text-label font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
          {t('fpsTeamSim.individualAvg')}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-caption mb-1" style={{ color: '#3b82f6' }}>Team A</div>
            <PlayerKdTable players={teamA} stats={result.playerStats} />
          </div>
          <div>
            <div className="text-caption mb-1" style={{ color: '#ef4444' }}>Team B</div>
            <PlayerKdTable players={teamB} stats={result.playerStats} />
          </div>
        </div>
      </div>

      <div className="text-caption italic" style={{ color: 'var(--text-tertiary)' }}>
        {t('fpsTeamSim.tradeNote')}
      </div>
    </PanelShell>
  );
}

function PlayerKdTable({
  players,
  stats,
}: {
  players: FpsTeamPlayer[];
  stats: Record<string, { kills: number; deaths: number; damage: number }>;
}) {
  const t = useTranslations();
  return (
    <div className="space-y-0.5">
      <div className="grid grid-cols-4 gap-1 text-caption px-1" style={{ color: 'var(--text-tertiary)' }}>
        <span>{t('fpsTeamSim.nameLabel')}</span>
        <span className="text-center">K</span>
        <span className="text-center">D</span>
        <span className="text-right">DMG</span>
      </div>
      {players.map((p) => {
        const s = stats[p.id] ?? { kills: 0, deaths: 0, damage: 0 };
        return (
          <div key={p.id} className="grid grid-cols-4 gap-1 text-caption p-1 rounded" style={{ background: 'var(--bg-primary)' }}>
            <span className="truncate" style={{ color: 'var(--text-primary)' }}>{p.name}</span>
            <span className="text-center tabular-nums font-semibold" style={{ color: 'var(--text-primary)' }}>{s.kills.toFixed(2)}</span>
            <span className="text-center tabular-nums" style={{ color: 'var(--text-secondary)' }}>{s.deaths.toFixed(2)}</span>
            <span className="text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{Math.round(s.damage)}</span>
          </div>
        );
      })}
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
}: {
  label: string;
  value: number;
  unit?: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-label" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className="text-label font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
          {value}{unit ?? ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full"
        style={{ accentColor: 'var(--accent)' }}
      />
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="p-2 rounded-lg" style={{ background: 'var(--bg-tertiary)', border: `1px solid ${color}` }}>
      <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>{label}</div>
      <div className="text-subhead font-bold tabular-nums" style={{ color }}>{value}</div>
      {sub && <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>{sub}</div>}
    </div>
  );
}
