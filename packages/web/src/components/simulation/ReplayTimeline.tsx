/**
 * ReplayTimeline — 전투 로그 timeline 재생기 (1v1 + 다대다 통합).
 *
 * SimulationPanel 안에서 inline 으로 렌더되며, 1회 전투 결과를 props 로 받음.
 * 단독 패널 (PanelShell) 아님 — 시뮬 결과 영역 아래에 자연스럽게 흐름.
 *
 * 다중 유닛 지원:
 *  - units 배열로 N 개 유닛 받음 (1v1 = 2개, 팀 전투 = 2-12개)
 *  - 각 유닛에 team 정보 (team1/team2/undef) 로 색상 자동 결정
 *  - log 의 actor/target 이 id 또는 name 일 수 있어 둘 다 매칭 (1v1=name, 팀=id 의 호환층)
 *
 * 업계 레퍼런스:
 *  - Overwatch 2 "Highlight" 시스템 (킬캠)
 *  - Rocket League 리플레이 scrubber
 *  - Dota 2 timeline 의 death/fight filter
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Swords, Heart, Shield, Skull, Zap, RefreshCw, Sparkles } from 'lucide-react';
import type { BattleLogEntry } from '@/lib/simulation/types';
import { useTranslations } from 'next-intl';

export interface ReplayUnit {
  id: string;
  name: string;
  maxHp: number;
  team?: 'team1' | 'team2';
}

export interface ReplaySummary {
  winnerLabel?: string;
  duration?: number;
}

interface Props {
  units: ReplayUnit[];
  log: BattleLogEntry[];
  summary?: ReplaySummary;
}

const ACTION_META: Record<BattleLogEntry['action'], { Icon: typeof Swords; color: string; labelKey: string }> = {
  attack:          { Icon: Swords,     color: '#ef4444', labelKey: 'replayTimeline.evAttack' },
  skill:           { Icon: Sparkles,   color: '#8b5cf6', labelKey: 'replayTimeline.evSkill' },
  buff:            { Icon: Zap,        color: '#f59e0b', labelKey: 'replayTimeline.evBuff' },
  debuff:          { Icon: Zap,        color: '#6b7280', labelKey: 'replayTimeline.evDebuff' },
  heal:            { Icon: Heart,      color: '#10b981', labelKey: 'replayTimeline.evHeal' },
  hot_tick:        { Icon: Heart,      color: '#34d399', labelKey: 'replayTimeline.evHotTick' },
  hot_end:         { Icon: Heart,      color: '#6b7280', labelKey: 'replayTimeline.evHotEnd' },
  death:           { Icon: Skull,      color: '#71717a', labelKey: 'replayTimeline.evDeath' },
  invincible:      { Icon: Shield,     color: '#3b82f6', labelKey: 'replayTimeline.evInvincible' },
  invincible_end:  { Icon: Shield,     color: '#6b7280', labelKey: 'replayTimeline.evInvincibleEnd' },
  revive:          { Icon: RefreshCw,  color: '#ec4899', labelKey: 'replayTimeline.evRevive' },
};

const TEAM_COLOR: Record<string, string> = {
  team1: '#3b82f6', // 파랑
  team2: '#ef4444', // 빨강
};
const NEUTRAL_COLOR = '#8b5cf6';

const matchesUnit = (u: ReplayUnit, key: string | undefined): boolean =>
  key !== undefined && (u.id === key || u.name === key);

export default function ReplayTimeline({ units, log, summary }: Props) {
  const t = useTranslations();
  const [cursorIdx, setCursorIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  // log 가 바뀌면 (새 시뮬 결과) cursor 리셋
  useEffect(() => {
    setCursorIdx(0);
    setPlaying(false);
  }, [log]);

  const cursor = log[Math.min(cursorIdx, log.length - 1)];
  const totalDuration = log.length > 0 ? log[log.length - 1].time : 0;

  // 자동 재생
  useEffect(() => {
    if (!playing || log.length === 0) return;
    const timer = setInterval(() => {
      setCursorIdx((i) => {
        const next = i + 1;
        if (next >= log.length) {
          setPlaying(false);
          return log.length - 1;
        }
        return next;
      });
    }, 300 / speed);
    return () => clearInterval(timer);
  }, [playing, speed, log.length]);

  // 현재 시점까지의 누적 HP — 모든 유닛 id 별 추적
  const currentHpByUnitId = useMemo(() => {
    const hp = new Map<string, number>();
    for (const u of units) hp.set(u.id, u.maxHp);
    for (let i = 0; i <= cursorIdx && i < log.length; i++) {
      const e = log[i];
      const target = units.find((u) => matchesUnit(u, e.target));
      const actor = units.find((u) => matchesUnit(u, e.actor));
      if ((e.action === 'attack' || e.action === 'skill') && target && !e.isMiss && e.damage) {
        hp.set(target.id, Math.max(0, (hp.get(target.id) ?? target.maxHp) - e.damage));
      } else if ((e.action === 'heal' || e.action === 'hot_tick') && actor && e.healAmount) {
        hp.set(actor.id, Math.min(actor.maxHp, (hp.get(actor.id) ?? actor.maxHp) + e.healAmount));
      } else if (e.action === 'death' && actor) {
        hp.set(actor.id, 0);
      } else if (e.action === 'revive' && actor && e.remainingHp !== undefined) {
        hp.set(actor.id, e.remainingHp);
      }
    }
    return hp;
  }, [cursorIdx, log, units]);

  const keyStep = useCallback(
    (delta: number) => {
      setCursorIdx((i) => Math.max(0, Math.min(log.length - 1, i + delta)));
      setPlaying(false);
    },
    [log.length],
  );

  if (log.length === 0) {
    return (
      <div
        className="p-3 rounded-lg text-caption"
        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}
      >
        {t('replayTimeline.noLog')}
      </div>
    );
  }

  // 팀별 그룹핑 — 다중 유닛일 때 시각적 구분
  const team1Units = units.filter((u) => u.team === 'team1');
  const team2Units = units.filter((u) => u.team === 'team2');
  const neutralUnits = units.filter((u) => !u.team);

  return (
    <div className="space-y-3">
      {/* 컨트롤 바 */}
      <div className="p-3 rounded-lg flex items-center gap-2 flex-wrap" style={{ background: 'var(--bg-tertiary)' }}>
        <button
          onClick={() => keyStep(-1)}
          disabled={cursorIdx === 0}
          className="p-1.5 rounded disabled:opacity-30"
          style={{ background: 'var(--bg-primary)' }}
          aria-label={t('replayTimeline.prevAria')}
        >
          <SkipBack className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        </button>
        <button
          onClick={() => setPlaying((p) => !p)}
          className="p-1.5 rounded"
          style={{ background: playing ? 'var(--accent)' : 'var(--bg-primary)' }}
          aria-label={playing ? t('replayTimeline.pauseAria') : t('replayTimeline.playAria')}
        >
          {playing ? (
            <Pause className="w-4 h-4" style={{ color: 'white' }} />
          ) : (
            <Play className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          )}
        </button>
        <button
          onClick={() => keyStep(1)}
          disabled={cursorIdx >= log.length - 1}
          className="p-1.5 rounded disabled:opacity-30"
          style={{ background: 'var(--bg-primary)' }}
          aria-label={t('replayTimeline.nextAria')}
        >
          <SkipForward className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        </button>
        <div className="flex items-center gap-1 ml-2">
          <span className="text-caption" style={{ color: 'var(--text-tertiary)' }}>{t('replayTimeline.speedLabel')}</span>
          {[0.5, 1, 2, 4].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className="px-1.5 py-0.5 rounded text-caption font-semibold"
              style={{
                background: speed === s ? 'var(--accent)' : 'var(--bg-primary)',
                color: speed === s ? 'white' : 'var(--text-tertiary)',
              }}
            >
              {s}×
            </button>
          ))}
        </div>
        <div className="ml-auto text-caption tabular-nums" style={{ color: 'var(--text-secondary)' }}>
          {cursor ? `${cursor.time.toFixed(2)}s / ${totalDuration.toFixed(2)}s` : '—'}
          {' · '}
          <span style={{ color: 'var(--text-tertiary)' }}>
            {t('replayTimeline.eventCounter', { n: cursorIdx + 1, total: log.length })}
          </span>
        </div>
      </div>

      {/* Scrubber + 이벤트 밀도 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <input
          type="range"
          min={0}
          max={Math.max(0, log.length - 1)}
          value={cursorIdx}
          onChange={(e) => setCursorIdx(parseInt(e.target.value))}
          className="w-full"
          style={{ accentColor: 'var(--accent)' }}
        />
        <div className="relative h-2 mt-1 rounded overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
          {log.map((entry, i) => {
            const pct = log.length > 1 ? (i / (log.length - 1)) * 100 : 0;
            const active = i <= cursorIdx;
            const meta = ACTION_META[entry.action];
            return (
              <div
                key={i}
                className="absolute top-0 bottom-0 w-0.5 transition-opacity"
                style={{
                  left: `${pct}%`,
                  background: meta.color,
                  opacity: active ? 0.9 : 0.3,
                }}
                title={`${entry.time.toFixed(2)}s ${t(meta.labelKey as 'replayTimeline.evAttack')}`}
              />
            );
          })}
        </div>
      </div>

      {/* HP 게이지 — 팀별 그룹 + 다중 유닛 */}
      {(team1Units.length > 0 || team2Units.length > 0) ? (
        <div className="grid grid-cols-2 gap-3">
          <TeamColumn label="Team 1" color={TEAM_COLOR.team1} units={team1Units} hpMap={currentHpByUnitId} />
          <TeamColumn label="Team 2" color={TEAM_COLOR.team2} units={team2Units} hpMap={currentHpByUnitId} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {neutralUnits.map((u) => (
            <HpGauge
              key={u.id}
              name={u.name}
              hp={currentHpByUnitId.get(u.id) ?? u.maxHp}
              maxHp={u.maxHp}
              color={NEUTRAL_COLOR}
            />
          ))}
        </div>
      )}

      {/* 현재 이벤트 카드 */}
      {cursor && (
        <div
          className="p-3 rounded-lg flex items-center gap-3"
          style={{
            background: 'var(--bg-tertiary)',
            borderLeft: `4px solid ${ACTION_META[cursor.action].color}`,
          }}
        >
          <div className="p-2 rounded-lg" style={{ background: `${ACTION_META[cursor.action].color}20` }}>
            {(() => {
              const Icon = ACTION_META[cursor.action].Icon;
              return <Icon className="w-6 h-6" style={{ color: ACTION_META[cursor.action].color }} />;
            })()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-label font-semibold" style={{ color: 'var(--text-primary)' }}>
              {displayName(cursor.actor, units)} {t(ACTION_META[cursor.action].labelKey as 'replayTimeline.evAttack')}
              {cursor.target && (
                <span style={{ color: 'var(--text-tertiary)' }}> → {displayName(cursor.target, units)}</span>
              )}
              {cursor.skillName && <span style={{ color: '#8b5cf6' }}> · {cursor.skillName}</span>}
            </div>
            <div className="text-caption" style={{ color: 'var(--text-secondary)' }}>
              t = {cursor.time.toFixed(2)}s
              {cursor.damage !== undefined && cursor.damage > 0 && (
                <span className="ml-2">
                  {t('replayTimeline.damageLabel')} <span className="font-bold tabular-nums" style={{ color: '#ef4444' }}>{cursor.damage.toFixed(0)}</span>
                  {cursor.isCrit && <span className="ml-1 px-1 rounded text-caption" style={{ background: '#f59e0b30', color: '#f59e0b' }}>CRIT</span>}
                  {cursor.isMiss && <span className="ml-1 px-1 rounded text-caption" style={{ background: '#6b728030', color: '#6b7280' }}>MISS</span>}
                </span>
              )}
              {cursor.healAmount !== undefined && (
                <span className="ml-2">
                  {t('replayTimeline.healLabel')} <span className="font-bold tabular-nums" style={{ color: '#10b981' }}>{cursor.healAmount.toFixed(0)}</span>
                </span>
              )}
              {cursor.remainingHp !== undefined && (
                <span className="ml-2" style={{ color: 'var(--text-tertiary)' }}>
                  {t('replayTimeline.remainingHp', { hp: cursor.remainingHp.toFixed(0) })}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 결과 요약 */}
      {summary && (
        <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
          <div className="text-label font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
            {t('replayTimeline.battleResult')}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <ResultChip label={t('replayTimeline.winner')} value={summary.winnerLabel ?? '—'} color="#3b82f6" />
            <ResultChip label={t('replayTimeline.duration')} value={summary.duration !== undefined ? `${summary.duration.toFixed(1)}s` : '—'} color="#8b5cf6" />
            <ResultChip label={t('replayTimeline.events')} value={log.length.toString()} color="#10b981" />
          </div>
        </div>
      )}

      {/* 이벤트 스트림 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="text-label font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
          {t('replayTimeline.eventStream')}
        </div>
        <div className="space-y-0.5 max-h-72 overflow-y-auto" style={{ fontSize: 11 }}>
          {log.map((entry, i) => {
            const meta = ACTION_META[entry.action];
            const active = i === cursorIdx;
            return (
              <button
                key={i}
                onClick={() => setCursorIdx(i)}
                className="w-full flex items-center gap-2 py-0.5 px-1.5 rounded text-left"
                style={{
                  background: active ? `${meta.color}30` : 'transparent',
                  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  opacity: i > cursorIdx ? 0.4 : 1,
                }}
              >
                <span className="tabular-nums font-mono" style={{ color: 'var(--text-tertiary)', minWidth: 50 }}>
                  {entry.time.toFixed(2)}s
                </span>
                <meta.Icon className="w-3 h-3 shrink-0" style={{ color: meta.color }} />
                <span className="truncate">
                  <span className="font-semibold">{displayName(entry.actor, units)}</span>
                  <span style={{ color: 'var(--text-tertiary)' }}> {t(meta.labelKey as 'replayTimeline.evAttack')}</span>
                  {entry.target && <span> → {displayName(entry.target, units)}</span>}
                  {entry.damage !== undefined && entry.damage > 0 && <span style={{ color: '#ef4444' }}> ({entry.damage.toFixed(0)})</span>}
                  {entry.isCrit && <span style={{ color: '#f59e0b' }}> CRIT</span>}
                  {entry.isMiss && <span style={{ color: '#6b7280' }}> MISS</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function displayName(key: string | undefined, units: ReplayUnit[]): string {
  if (!key) return '—';
  const match = units.find((u) => matchesUnit(u, key));
  return match?.name ?? key;
}

function TeamColumn({
  label,
  color,
  units,
  hpMap,
}: {
  label: string;
  color: string;
  units: ReplayUnit[];
  hpMap: Map<string, number>;
}) {
  return (
    <div className="space-y-2">
      <div className="text-caption font-semibold" style={{ color }}>
        {label} ({units.length})
      </div>
      <div className="space-y-1.5">
        {units.map((u) => (
          <HpGauge
            key={u.id}
            name={u.name}
            hp={hpMap.get(u.id) ?? u.maxHp}
            maxHp={u.maxHp}
            color={color}
          />
        ))}
      </div>
    </div>
  );
}

function HpGauge({ name, hp, maxHp, color }: { name: string; hp: number; maxHp: number; color: string }) {
  const pct = Math.max(0, (hp / maxHp) * 100);
  const dead = hp <= 0;
  return (
    <div className="p-2 rounded-lg" style={{ background: 'var(--bg-tertiary)', borderLeft: `3px solid ${color}`, opacity: dead ? 0.5 : 1 }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-caption font-semibold truncate" style={{ color }}>
          {name}
          {dead && <Skull className="w-3 h-3 inline ml-1" style={{ color: '#6b7280' }} />}
        </span>
        <span className="text-caption tabular-nums" style={{ color: 'var(--text-secondary)' }}>
          {Math.round(hp)} / {maxHp}
        </span>
      </div>
      <div className="h-1.5 rounded overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
        <div className="h-full transition-all duration-200" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function ResultChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="p-2 rounded" style={{ background: 'var(--bg-primary)' }}>
      <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>{label}</div>
      <div className="text-label font-bold tabular-nums" style={{ color }}>{value}</div>
    </div>
  );
}
