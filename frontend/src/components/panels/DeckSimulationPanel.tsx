'use client';

/**
 * 덱빌더 확률 시뮬 패널 — Slay the Spire / Monster Train 계열.
 *
 * 덱 구성 · 턴당 에너지/드로우 · Monte Carlo → 평균 DPT · deadHand · 에너지 낭비율
 */

import { useState, useMemo } from 'react';
import { Layers, Plus, Trash2, BarChart3 } from 'lucide-react';
import PanelShell from '@/components/ui/PanelShell';
import { simulateDeck, CARD_PRESETS, type Card, type DeckConfig, type EnemyMob } from '@/lib/deckSimulation';

interface Props {
  onClose: () => void;
}

export default function DeckSimulationPanel({ onClose }: Props) {
  const [cards, setCards] = useState<Card[]>(CARD_PRESETS);
  const [handSize, setHandSize] = useState(5);
  const [baseEnergy, setBaseEnergy] = useState(3);
  const [turns, setTurns] = useState(5);
  const [runs, setRuns] = useState(2000);

  // Slay the Spire Act 1 기본 몹 근사 (공식 위키 참고)
  const [enemies, setEnemies] = useState<EnemyMob[]>([
    { id: 'cultist', name: 'Cultist', hp: 50 },
    { id: 'jaw-worm', name: 'Jaw Worm', hp: 42 },
  ]);

  const cfg: DeckConfig = useMemo(
    () => ({ cards, handSize, baseEnergy, turnsPerCombat: turns, enemies }),
    [cards, handSize, baseEnergy, turns, enemies],
  );
  const result = useMemo(() => simulateDeck(cfg, runs), [cfg, runs]);

  const addCard = () => {
    setCards((prev) => [
      ...prev,
      { id: `card-${Date.now()}`, name: '신규 카드', type: 'attack', cost: 1, damage: 6 },
    ]);
  };

  const updateCard = <K extends keyof Card>(idx: number, key: K, value: Card[K]) => {
    setCards((prev) => prev.map((c, i) => (i === idx ? { ...c, [key]: value } : c)));
  };

  const removeCard = (idx: number) => setCards((prev) => prev.filter((_, i) => i !== idx));

  const addEnemy = () => setEnemies((prev) => [...prev, { id: `mob-${Date.now()}`, name: '몹', hp: 50 }]);
  const updateEnemy = <K extends keyof EnemyMob>(idx: number, key: K, value: EnemyMob[K]) =>
    setEnemies((prev) => prev.map((e, i) => (i === idx ? { ...e, [key]: value } : e)));
  const removeEnemy = (idx: number) => setEnemies((prev) => prev.filter((_, i) => i !== idx));

  return (
    <PanelShell
      title="덱빌더 확률 시뮬"
      subtitle="Slay the Spire · 카드 기반 Monte Carlo"
      icon={Layers}
      iconColor="#8b5cf6"
      onClose={onClose}
      bodyClassName="p-3 space-y-3 overflow-y-auto"
    >
      {/* 전역 설정 */}
      <div className="p-3 rounded-lg grid grid-cols-2 gap-2" style={{ background: 'var(--bg-tertiary)' }}>
        <NumRow label="턴당 드로우" value={handSize} min={3} max={10} onChange={setHandSize} />
        <NumRow label="턴당 에너지" value={baseEnergy} min={1} max={10} onChange={setBaseEnergy} />
        <NumRow label="전투 턴 수" value={turns} min={1} max={20} onChange={setTurns} />
        <NumRow label="반복 수" value={runs} min={500} max={10000} step={500} onChange={setRuns} />
      </div>

      {/* 결과 요약 */}
      <div className="grid grid-cols-2 gap-2">
        <Stat label="평균 DPT" value={result.avgDpt.toFixed(1)} sub={`중위 ${result.medianDpt.toFixed(1)}`} color="#ef4444" />
        <Stat label="최악(P10)~최선(P90)" value={`${result.p10Dpt.toFixed(0)}~${result.p90Dpt.toFixed(0)}`} sub="80% 신뢰 구간" color="#3b82f6" />
        <Stat label="Dead Hand" value={`${Math.round(result.deadHandRate * 100)}%`} sub="플레이 불가 턴 비율" color="#f59e0b" />
        <Stat label="에너지 낭비" value={`${Math.round(result.avgEnergyWaste * 100)}%`} sub="미사용 에너지 비율" color="#10b981" />
      </div>

      {/* 몹 킬 통계 (enemies 있을 때만) */}
      {result.avgKills !== undefined && (
        <div className="grid grid-cols-3 gap-2">
          <Stat
            label="평균 킬 수"
            value={result.avgKills.toFixed(2)}
            sub={`총 ${enemies.length}몹 중`}
            color="#ef4444"
          />
          <Stat
            label="전체 클리어율"
            value={`${Math.round((result.clearRate ?? 0) * 100)}%`}
            sub="모든 몹 처치한 run"
            color="#10b981"
          />
          <Stat
            label="첫 킬 평균 턴"
            value={(result.avgTurnToFirstKill ?? 0).toFixed(1)}
            sub="처음 몹 눕힌 시점"
            color="#f59e0b"
          />
        </div>
      )}

      {/* 몹 편집 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-label font-medium" style={{ color: 'var(--text-primary)' }}>
            상대 몹 시퀀스 ({enemies.length})
          </span>
          <button onClick={addEnemy} className="btn-primary text-caption inline-flex items-center gap-1">
            <Plus className="w-3 h-3" /> 몹 추가
          </button>
        </div>
        <p className="text-caption italic mb-2" style={{ color: 'var(--text-tertiary)' }}>
          왼쪽부터 순서대로 등장. 덱 DPT 를 누적해 처치 — 턴 안에 쓰러뜨리면 다음 몹.
        </p>
        <div className="space-y-1">
          {enemies.map((enemy, idx) => {
            const killRate = result.mobKillRates?.[enemy.id] ?? 0;
            return (
              <div key={enemy.id} className="flex items-center gap-2 p-1.5 rounded-md" style={{ background: 'var(--bg-primary)' }}>
                <span className="text-caption tabular-nums w-6 text-center" style={{ color: 'var(--text-tertiary)' }}>
                  #{idx + 1}
                </span>
                <input
                  value={enemy.name}
                  onChange={(e) => updateEnemy(idx, 'name', e.target.value)}
                  className="input-compact flex-1 min-w-0"
                />
                <label className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
                  HP
                </label>
                <input
                  type="number"
                  value={enemy.hp}
                  min={1}
                  onChange={(e) => updateEnemy(idx, 'hp', parseInt(e.target.value) || 1)}
                  className="input-compact hide-spinner"
                  style={{ width: 70 }}
                />
                <span
                  className="text-caption tabular-nums w-12 text-right font-semibold"
                  style={{ color: killRate >= 0.8 ? '#10b981' : killRate >= 0.5 ? '#f59e0b' : '#ef4444' }}
                  title="이 몹 처치율"
                >
                  {Math.round(killRate * 100)}%
                </span>
                <button onClick={() => removeEnemy(idx)} className="p-1 rounded hover:bg-[var(--bg-tertiary)]">
                  <Trash2 className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
                </button>
              </div>
            );
          })}
          {enemies.length === 0 && (
            <p className="text-caption italic text-center py-4" style={{ color: 'var(--text-tertiary)' }}>
              몹을 추가하면 킬 수/클리어율 분석이 표시됩니다
            </p>
          )}
        </div>
      </div>

      {/* 카드 사용 빈도 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          <span className="text-label font-medium" style={{ color: 'var(--text-primary)' }}>
            카드별 평균 사용 횟수 (전투당)
          </span>
        </div>
        <div className="space-y-1">
          {Object.entries(result.cardUsage)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 8)
            .map(([id, count]) => {
              const card = cards.find((c) => c.id === id);
              const max = Math.max(...Object.values(result.cardUsage));
              const pct = (count / max) * 100;
              return (
                <div key={id} className="flex items-center gap-2">
                  <span className="text-caption w-24 truncate" style={{ color: 'var(--text-secondary)' }}>
                    {card?.name ?? id}
                  </span>
                  <div className="flex-1 h-4 rounded overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
                    <div className="h-full" style={{ width: `${pct}%`, background: '#8b5cf6' }} />
                  </div>
                  <span className="text-caption font-semibold tabular-nums w-12 text-right" style={{ color: 'var(--text-primary)' }}>
                    {count.toFixed(1)}
                  </span>
                </div>
              );
            })}
        </div>
      </div>

      {/* 덱 편집 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-label font-medium" style={{ color: 'var(--text-primary)' }}>
            덱 ({cards.length}장)
          </span>
          <button onClick={addCard} className="btn-primary text-caption inline-flex items-center gap-1">
            <Plus className="w-3 h-3" /> 카드 추가
          </button>
        </div>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {cards.map((card, idx) => (
            <div key={card.id} className="flex items-center gap-1.5 p-1.5 rounded-md" style={{ background: 'var(--bg-primary)' }}>
              <input
                type="text"
                value={card.name}
                onChange={(e) => updateCard(idx, 'name', e.target.value)}
                className="input-compact flex-1 min-w-0"
              />
              <select
                value={card.type}
                onChange={(e) => updateCard(idx, 'type', e.target.value as Card['type'])}
                className="input-compact"
                style={{ width: 80 }}
              >
                <option value="attack">공격</option>
                <option value="skill">스킬</option>
                <option value="power">파워</option>
              </select>
              <input
                type="number"
                value={card.cost}
                min={0}
                max={3}
                onChange={(e) => updateCard(idx, 'cost', parseInt(e.target.value) || 0)}
                className="input-compact hide-spinner"
                style={{ width: 50 }}
                title="비용"
              />
              <input
                type="number"
                value={card.damage ?? 0}
                onChange={(e) => updateCard(idx, 'damage', parseInt(e.target.value) || 0)}
                className="input-compact hide-spinner"
                style={{ width: 60 }}
                title="피해"
                placeholder="피해"
              />
              <input
                type="number"
                value={card.block ?? 0}
                onChange={(e) => updateCard(idx, 'block', parseInt(e.target.value) || 0)}
                className="input-compact hide-spinner"
                style={{ width: 60 }}
                title="방어"
                placeholder="방어"
              />
              <button onClick={() => removeCard(idx)} className="p-1 rounded hover:bg-[var(--bg-tertiary)]">
                <Trash2 className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="text-caption italic" style={{ color: 'var(--text-tertiary)' }}>
        DPT = Damage Per Turn · 매 턴 가장 비싼 플레이 가능 카드부터 자동 플레이
      </div>
    </PanelShell>
  );
}

function NumRow({ label, value, min, max, step = 1, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-label" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className="text-label font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>{value}</span>
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
    <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)', border: `1px solid ${color}` }}>
      <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>{label}</div>
      <div className="text-heading font-bold tabular-nums" style={{ color }}>{value}</div>
      {sub && <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>{sub}</div>}
    </div>
  );
}
