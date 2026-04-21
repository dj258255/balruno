'use client';

/**
 * MOBA 라인전 시뮬 패널 — LoL/Dota 2 laning phase 분석.
 *
 * UI:
 *  - 양 팀 챔피언 선택 + 스탯 수정
 *  - 라인 유형 1v1 / 2v2
 *  - 시뮬 실행 → gold/xp/cs 곡선 차트 + dominance score
 *  - 올인 승률 · 1코어 타이밍 비교
 */

import { useState, useMemo } from 'react';
import { Swords, Trophy, Clock, Coins } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import PanelShell from '@/components/ui/PanelShell';
import {
  simulateLaning,
  CHAMPION_PRESETS,
  type LaneChampion,
  type LaneSimConfig,
} from '@/lib/mobaLaning';

interface Props {
  onClose: () => void;
}

export default function MobaLaningPanel({ onClose }: Props) {
  const [blue, setBlue] = useState<LaneChampion>(CHAMPION_PRESETS[0]);
  const [red, setRed] = useState<LaneChampion>(CHAMPION_PRESETS[1]);
  const [duration, setDuration] = useState(840); // 14 min
  const [laneType, setLaneType] = useState<'1v1' | '2v2'>('1v1');

  const cfg: LaneSimConfig = useMemo(() => ({
    blue, red, laneType,
    durationSec: duration,
    minionsPerWave: laneType === '2v2' ? 6 : 6,
    waveIntervalSec: 30,
    cannonEveryNWaves: 6,
  }), [blue, red, laneType, duration]);

  const result = useMemo(() => simulateLaning(cfg), [cfg]);

  const chartData = result.samples.map((s) => ({
    minute: (s.timeSec / 60).toFixed(1),
    blueGold: s.blueGold,
    redGold: s.redGold,
    blueCs: s.blueCs,
    redCs: s.redCs,
  }));

  const domScore = Math.round(result.laneDominanceScore);
  const domColor = domScore > 20 ? '#3b82f6' : domScore < -20 ? '#ef4444' : '#6b7280';
  const domLabel = domScore > 40 ? '블루 압승'
    : domScore > 15 ? '블루 우세'
    : domScore < -40 ? '레드 압승'
    : domScore < -15 ? '레드 우세'
    : '호각';

  return (
    <PanelShell
      title="MOBA 라인전 시뮬"
      subtitle="LoL/Dota · CS/gold/XP 곡선 · 올인 승률"
      icon={Swords}
      iconColor="#3b82f6"
      onClose={onClose}
      bodyClassName="p-3 space-y-3 overflow-y-auto"
    >
      {/* 챔피언 선택 */}
      <div className="grid grid-cols-2 gap-2">
        <ChampCard champ={blue} setChamp={setBlue} label="블루" color="#3b82f6" />
        <ChampCard champ={red}  setChamp={setRed}  label="레드" color="#ef4444" />
      </div>

      {/* 라인 설정 */}
      <div className="p-3 rounded-lg flex items-center gap-4" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="flex gap-1">
          {(['1v1', '2v2'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setLaneType(t)}
              className="px-3 py-1 rounded text-label font-medium"
              style={{
                background: laneType === t ? 'var(--accent)' : 'var(--bg-primary)',
                color: laneType === t ? 'white' : 'var(--text-secondary)',
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-1">
          <span className="text-label" style={{ color: 'var(--text-secondary)' }}>
            시뮬 시간
          </span>
          <input
            type="range"
            min={60}
            max={1200}
            step={30}
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value))}
            className="flex-1"
            style={{ accentColor: 'var(--accent)' }}
          />
          <span className="text-label font-semibold tabular-nums w-16 text-right" style={{ color: 'var(--text-primary)' }}>
            {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* 라인 dominance 요약 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)', border: `2px solid ${domColor}` }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-label" style={{ color: 'var(--text-tertiary)' }}>Lane Dominance Score</div>
            <div className="text-3xl font-bold tabular-nums" style={{ color: domColor }}>
              {domScore > 0 ? '+' : ''}{domScore}
            </div>
            <div className="text-caption" style={{ color: domColor }}>{domLabel}</div>
          </div>
          {/* 바 표시 -100~+100 */}
          <div className="flex-1 mx-6 relative h-4 rounded-full overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
            <div
              className="absolute top-0 bottom-0 transition-all"
              style={{
                left: domScore < 0 ? `${50 + domScore / 2}%` : '50%',
                width: `${Math.abs(domScore) / 2}%`,
                background: domColor,
              }}
            />
            <div
              className="absolute top-0 bottom-0"
              style={{ left: '50%', width: 1, background: 'var(--text-tertiary)' }}
            />
          </div>
        </div>
      </div>

      {/* 주요 지표 */}
      <div className="grid grid-cols-4 gap-2">
        <Stat label="골드 리드" value={`${result.finalGoldDiff > 0 ? '+' : ''}${Math.round(result.finalGoldDiff)}`} sub="blue 기준" color="#f59e0b" icon={Coins} />
        <Stat label="경험치 리드" value={`${result.finalXpDiff > 0 ? '+' : ''}${Math.round(result.finalXpDiff)}`} sub={`Lv ${result.finalLevelDiff > 0 ? '+' : ''}${result.finalLevelDiff}`} color="#8b5cf6" icon={Trophy} />
        <Stat label="올인 승률" value={`${Math.round(result.blueAllInWinRate * 100)}%`} sub="blue 올인" color="#ef4444" icon={Swords} />
        <Stat label="1코어 타이밍" value={`${Math.round(result.blueTimeToFirstItem / 60 * 10) / 10}분`} sub={`Red ${Math.round(result.redTimeToFirstItem / 60 * 10) / 10}분`} color="#10b981" icon={Clock} />
      </div>

      {/* Gold 곡선 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="text-label font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
          골드 곡선 (분)
        </div>
        <div className="h-56">
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
              <XAxis dataKey="minute" tick={{ fontSize: 10 }} label={{ value: '분', position: 'insideBottomRight', offset: -5, fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="blueGold" stroke="#3b82f6" strokeWidth={2} name={blue.name} dot={false} />
              <Line type="monotone" dataKey="redGold"  stroke="#ef4444" strokeWidth={2} name={red.name}  dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* CS 곡선 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="text-label font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
          CS 곡선 — 라인 farm 효율
        </div>
        <div className="h-40">
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
              <XAxis dataKey="minute" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="blueCs" stroke="#3b82f6" strokeWidth={2} name={`${blue.name} CS`} dot={false} />
              <Line type="monotone" dataKey="redCs"  stroke="#ef4444" strokeWidth={2} name={`${red.name} CS`}  dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p className="text-caption italic" style={{ color: 'var(--text-tertiary)' }}>
        LoL 2024 미니언 값 (melee 21g, caster 14g, cannon 58g · time growth 2%/min) 기준. 올인 승률은 현재 레벨 + DPS race.
      </p>
    </PanelShell>
  );
}

function ChampCard({
  champ, setChamp, label, color,
}: {
  champ: LaneChampion;
  setChamp: (c: LaneChampion) => void;
  label: string;
  color: string;
}) {
  const update = <K extends keyof LaneChampion>(key: K, value: LaneChampion[K]) =>
    setChamp({ ...champ, [key]: value });
  const loadPreset = (id: string) => {
    const p = CHAMPION_PRESETS.find((c) => c.id === id);
    if (p) setChamp({ ...p });
  };

  return (
    <div className="p-3 rounded-lg space-y-2" style={{ background: 'var(--bg-tertiary)', border: `2px solid ${color}` }}>
      <div className="flex items-center gap-2">
        <span className="text-label font-semibold" style={{ color }}>{label}</span>
        <select
          value={champ.id}
          onChange={(e) => loadPreset(e.target.value)}
          className="input-compact flex-1"
        >
          {CHAMPION_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <NumField label="HP" value={champ.baseHp} onChange={(v) => update('baseHp', v)} />
        <NumField label="HP+/Lv" value={champ.hpPerLevel} step={1} onChange={(v) => update('hpPerLevel', v)} />
        <NumField label="AD" value={champ.baseAd} onChange={(v) => update('baseAd', v)} />
        <NumField label="AD+/Lv" value={champ.adPerLevel} step={0.1} onChange={(v) => update('adPerLevel', v)} />
        <NumField label="스킬 dmg" value={champ.abilityDamage} onChange={(v) => update('abilityDamage', v)} />
        <NumField label="스킬 CD" value={champ.abilityCooldown} onChange={(v) => update('abilityCooldown', v)} />
      </div>

      <SliderRow label="CS 실력" value={champ.csSkill}        onChange={(v) => update('csSkill', v)} />
      <SliderRow label="공격성"   value={champ.aggression}     onChange={(v) => update('aggression', v)} />
      <SliderRow label="올인 성향" value={champ.allInTendency} onChange={(v) => update('allInTendency', v)} />
    </div>
  );
}

function NumField({ label, value, step = 1, onChange }: {
  label: string; value: number; step?: number; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>{label}</div>
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="input-compact hide-spinner w-full"
      />
    </div>
  );
}

function SliderRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-caption" style={{ color: 'var(--text-tertiary)' }}>{label}</span>
        <span className="text-caption font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
          {Math.round(value * 100)}%
        </span>
      </div>
      <input
        type="range"
        min={0} max={1} step={0.05}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
        style={{ accentColor: 'var(--accent)' }}
      />
    </div>
  );
}

function Stat({ label, value, sub, color, icon: Icon }: { label: string; value: string; sub?: string; color: string; icon: typeof Swords }) {
  return (
    <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)', border: `1px solid ${color}` }}>
      <div className="flex items-center gap-1 text-caption" style={{ color: 'var(--text-tertiary)' }}>
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className="text-heading font-bold tabular-nums" style={{ color }}>{value}</div>
      {sub && <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>{sub}</div>}
    </div>
  );
}
