'use client';

/**
 * 시뮬 리플레이 타임라인 — Overwatch kill cam / Dota 2 replay 방식.
 *
 * 기존 simulateBattleWithSkills 의 BattleLogEntry[] 를 받아 시각화.
 *  - Scrubber 로 임의 시점 탐색
 *  - 이벤트 타입별 아이콘 + 색상 (attack/skill/heal/death/invincible)
 *  - 현재 시점 HP 게이지 실시간 표시
 *  - Step-by-step (prev/next) 키보드 조작
 *
 * 업계 레퍼런스:
 *  - Overwatch 2 "Highlight" 시스템 (킬캠)
 *  - Rocket League 리플레이 scrubber
 *  - Dota 2 timeline 중 death/fight filter
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Rewind, Swords, Heart, Shield, Skull, Zap, RefreshCw, Sparkles } from 'lucide-react';
import PanelShell from '@/components/ui/PanelShell';
import { simulateBattleWithSkills } from '@/lib/simulation/battleEngine';
import type { UnitStats, Skill, BattleLogEntry } from '@/lib/simulation/types';

interface Props {
  onClose: () => void;
}

// ============================================================================
// 샘플 시나리오 — 데모용 (실제 프로젝트에선 context 에서 유닛/스킬 주입)
// ============================================================================

function defaultScenario(): { unit1: UnitStats; unit2: UnitStats; skills1: Skill[]; skills2: Skill[] } {
  return {
    unit1: {
      id: 'hero', name: '영웅', hp: 800, maxHp: 800, atk: 80, def: 10, speed: 1.2,
      critRate: 0.2, critDamage: 1.5,
    },
    unit2: {
      id: 'boss', name: '보스', hp: 1200, maxHp: 1200, atk: 60, def: 20, speed: 0.8,
      critRate: 0.1, critDamage: 2.0,
    },
    skills1: [
      { id: 'heal', name: '회복', damage: 0, damageType: 'flat', cooldown: 8,
        skillType: 'heal', healAmount: 30, healType: 'percent',
        trigger: { type: 'hp_below', value: 50, chance: 1 } },
      { id: 'strike', name: '강타', damage: 2.5, damageType: 'multiplier', cooldown: 5,
        skillType: 'damage' },
    ],
    skills2: [
      { id: 'rage', name: '광폭', damage: 3.0, damageType: 'multiplier', cooldown: 10,
        skillType: 'damage',
        trigger: { type: 'hp_below', value: 40, chance: 1 } },
    ],
  };
}

// ============================================================================
// 이벤트 메타 (아이콘 + 색상)
// ============================================================================

const ACTION_META: Record<BattleLogEntry['action'], { Icon: typeof Swords; color: string; label: string }> = {
  attack:          { Icon: Swords,     color: '#ef4444', label: '공격' },
  skill:           { Icon: Sparkles,   color: '#8b5cf6', label: '스킬' },
  buff:            { Icon: Zap,        color: '#f59e0b', label: '버프' },
  debuff:          { Icon: Zap,        color: '#6b7280', label: '디버프' },
  heal:            { Icon: Heart,      color: '#10b981', label: '회복' },
  hot_tick:        { Icon: Heart,      color: '#34d399', label: 'HoT 틱' },
  hot_end:         { Icon: Heart,      color: '#6b7280', label: 'HoT 종료' },
  death:           { Icon: Skull,      color: '#71717a', label: '사망' },
  invincible:      { Icon: Shield,     color: '#3b82f6', label: '무적' },
  invincible_end:  { Icon: Shield,     color: '#6b7280', label: '무적 해제' },
  revive:          { Icon: RefreshCw,  color: '#ec4899', label: '부활' },
};

// ============================================================================
// 메인 패널
// ============================================================================

export default function ReplayTimelinePanel({ onClose }: Props) {
  const scenario = useMemo(() => defaultScenario(), []);
  const [seed, setSeed] = useState(0); // 재시뮬 트리거
  const [cursorIdx, setCursorIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const result = useMemo(() => {
    void seed; // force re-run
    return simulateBattleWithSkills(
      scenario.unit1, scenario.unit2,
      scenario.skills1, scenario.skills2,
      { maxDuration: 120, timeStep: 0.1 },
    );
  }, [scenario, seed]);

  const log = result.log;
  const cursor = log[Math.min(cursorIdx, log.length - 1)];
  const totalDuration = log.length > 0 ? log[log.length - 1].time : 0;

  // playback
  useEffect(() => {
    if (!playing) return;
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

  // 현재 시점까지의 누적 HP 복원
  const { unit1Hp, unit2Hp } = useMemo(() => {
    let u1 = scenario.unit1.maxHp;
    let u2 = scenario.unit2.maxHp;
    for (let i = 0; i <= cursorIdx && i < log.length; i++) {
      const e = log[i];
      if (e.action === 'attack' || e.action === 'skill') {
        if (!e.isMiss && e.damage) {
          if (e.target === scenario.unit1.name) u1 -= e.damage;
          else if (e.target === scenario.unit2.name) u2 -= e.damage;
        }
      } else if (e.action === 'heal' || e.action === 'hot_tick') {
        if (e.healAmount) {
          if (e.actor === scenario.unit1.name) u1 = Math.min(scenario.unit1.maxHp, u1 + e.healAmount);
          else if (e.actor === scenario.unit2.name) u2 = Math.min(scenario.unit2.maxHp, u2 + e.healAmount);
        }
      }
    }
    return { unit1Hp: Math.max(0, u1), unit2Hp: Math.max(0, u2) };
  }, [cursorIdx, log, scenario]);

  const keyStep = useCallback((delta: number) => {
    setCursorIdx((i) => Math.max(0, Math.min(log.length - 1, i + delta)));
    setPlaying(false);
  }, [log.length]);

  return (
    <PanelShell
      title="시뮬 리플레이"
      subtitle="타임라인 scrubber · step-by-step 디버깅"
      icon={Play}
      iconColor="#8b5cf6"
      onClose={onClose}
      bodyClassName="p-3 space-y-3 overflow-y-auto"
    >
      {/* 컨트롤 바 */}
      <div className="p-3 rounded-lg flex items-center gap-2" style={{ background: 'var(--bg-tertiary)' }}>
        <button
          onClick={() => setSeed((s) => s + 1)}
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-caption"
          style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}
          title="새 시뮬 (다른 난수 seed)"
        >
          <Rewind className="w-3 h-3" /> 재시뮬
        </button>
        <button
          onClick={() => keyStep(-1)}
          disabled={cursorIdx === 0}
          className="p-1.5 rounded disabled:opacity-30"
          style={{ background: 'var(--bg-primary)' }}
        >
          <SkipBack className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        </button>
        <button
          onClick={() => setPlaying((p) => !p)}
          className="p-1.5 rounded"
          style={{ background: playing ? 'var(--accent)' : 'var(--bg-primary)' }}
        >
          {playing ? (
            <Pause className="w-4 h-4" style={{ color: playing ? 'white' : 'var(--text-secondary)' }} />
          ) : (
            <Play className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          )}
        </button>
        <button
          onClick={() => keyStep(1)}
          disabled={cursorIdx >= log.length - 1}
          className="p-1.5 rounded disabled:opacity-30"
          style={{ background: 'var(--bg-primary)' }}
        >
          <SkipForward className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
        </button>
        <div className="flex items-center gap-1 ml-2">
          <span className="text-caption" style={{ color: 'var(--text-tertiary)' }}>속도</span>
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
            이벤트 {cursorIdx + 1}/{log.length}
          </span>
        </div>
      </div>

      {/* Scrubber */}
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
        {/* 이벤트 밀도 막대 — 이벤트 타입별 색상 도트 */}
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
                title={`${entry.time.toFixed(2)}s ${meta.label}`}
              />
            );
          })}
        </div>
      </div>

      {/* HP 게이지 */}
      <div className="grid grid-cols-2 gap-2">
        <HpGauge name={scenario.unit1.name} hp={unit1Hp} maxHp={scenario.unit1.maxHp} color="#3b82f6" />
        <HpGauge name={scenario.unit2.name} hp={unit2Hp} maxHp={scenario.unit2.maxHp} color="#ef4444" />
      </div>

      {/* 현재 이벤트 카드 */}
      {cursor && (
        <div
          className="p-3 rounded-lg flex items-center gap-3"
          style={{
            background: 'var(--bg-tertiary)',
            borderLeft: `4px solid ${ACTION_META[cursor.action].color}`,
          }}
        >
          <div
            className="p-2 rounded-lg"
            style={{ background: `${ACTION_META[cursor.action].color}20` }}
          >
            {(() => {
              const Icon = ACTION_META[cursor.action].Icon;
              return <Icon className="w-6 h-6" style={{ color: ACTION_META[cursor.action].color }} />;
            })()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-label font-semibold" style={{ color: 'var(--text-primary)' }}>
              {cursor.actor} {ACTION_META[cursor.action].label}
              {cursor.target && <span style={{ color: 'var(--text-tertiary)' }}> → {cursor.target}</span>}
              {cursor.skillName && <span style={{ color: '#8b5cf6' }}> · {cursor.skillName}</span>}
            </div>
            <div className="text-caption" style={{ color: 'var(--text-secondary)' }}>
              t = {cursor.time.toFixed(2)}s
              {cursor.damage !== undefined && (
                <span className="ml-2">
                  피해 <span className="font-bold tabular-nums" style={{ color: '#ef4444' }}>{cursor.damage.toFixed(0)}</span>
                  {cursor.isCrit && <span className="ml-1 px-1 rounded text-caption" style={{ background: '#f59e0b30', color: '#f59e0b' }}>CRIT</span>}
                  {cursor.isMiss && <span className="ml-1 px-1 rounded text-caption" style={{ background: '#6b728030', color: '#6b7280' }}>MISS</span>}
                </span>
              )}
              {cursor.healAmount !== undefined && (
                <span className="ml-2">
                  회복 <span className="font-bold tabular-nums" style={{ color: '#10b981' }}>{cursor.healAmount.toFixed(0)}</span>
                </span>
              )}
              {cursor.remainingHp !== undefined && (
                <span className="ml-2" style={{ color: 'var(--text-tertiary)' }}>
                  남은 HP {cursor.remainingHp.toFixed(0)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 결과 요약 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="text-label font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
          전투 결과
        </div>
        <div className="grid grid-cols-3 gap-2">
          <ResultChip
            label="승자"
            value={result.winner === 'unit1' ? scenario.unit1.name : result.winner === 'unit2' ? scenario.unit2.name : '무승부'}
            color={result.winner === 'unit1' ? '#3b82f6' : result.winner === 'unit2' ? '#ef4444' : '#6b7280'}
          />
          <ResultChip label="지속" value={`${result.duration.toFixed(1)}s`} color="#8b5cf6" />
          <ResultChip label="이벤트" value={log.length.toString()} color="#10b981" />
        </div>
      </div>

      {/* 이벤트 목록 (최근 주변 +- 10개) */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="text-label font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
          이벤트 스트림
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
                  <span className="font-semibold">{entry.actor}</span>
                  <span style={{ color: 'var(--text-tertiary)' }}> {meta.label}</span>
                  {entry.target && <span> → {entry.target}</span>}
                  {entry.damage !== undefined && <span style={{ color: '#ef4444' }}> ({entry.damage.toFixed(0)})</span>}
                  {entry.isCrit && <span style={{ color: '#f59e0b' }}> CRIT</span>}
                  {entry.isMiss && <span style={{ color: '#6b7280' }}> MISS</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </PanelShell>
  );
}

// ============================================================================
// 서브 컴포넌트
// ============================================================================

function HpGauge({ name, hp, maxHp, color }: { name: string; hp: number; maxHp: number; color: string }) {
  const pct = Math.max(0, (hp / maxHp) * 100);
  const dead = hp <= 0;
  return (
    <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)', borderLeft: `4px solid ${color}`, opacity: dead ? 0.5 : 1 }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-label font-semibold" style={{ color }}>
          {name}
          {dead && <Skull className="w-3 h-3 inline ml-1" style={{ color: '#6b7280' }} />}
        </span>
        <span className="text-caption tabular-nums" style={{ color: 'var(--text-secondary)' }}>
          {Math.round(hp)} / {maxHp}
        </span>
      </div>
      <div className="h-2 rounded overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
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
