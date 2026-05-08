/**
 * 덱빌더 확률 시뮬 패널 — Slay the Spire / Monster Train 계열.
 *
 * 덱 구성 · 턴당 에너지/드로우 · Monte Carlo → 평균 DPT · deadHand · 에너지 낭비율
 */

import { useState, useMemo } from 'react';
import { Layers, Plus, Trash2, BarChart3, Swords, Shield, ArrowUp, Ban, Moon, HelpCircle } from 'lucide-react';
import PanelShell from '@/components/ui/PanelShell';
import { simulateDeck, CARD_PRESETS, resolveIntent, type Card, type DeckConfig, type EnemyMob, type MobIntent, type IntentKind } from '@/lib/deckSimulation';
import { useTranslations } from 'next-intl';

interface Props {
  onClose: () => void;
}

export default function DeckSimulationPanel({ onClose }: Props) {
  const t = useTranslations();
  const [cards, setCards] = useState<Card[]>(CARD_PRESETS);
  const [handSize, setHandSize] = useState(5);
  const [baseEnergy, setBaseEnergy] = useState(3);
  const [turns, setTurns] = useState(5);
  const [runs, setRuns] = useState(2000);

  // Slay the Spire Act 1 기본 몹 — 공식 intent 패턴 (StS Wiki 참조)
  //  - Cultist: turn0 Incantation (+3 str), turn1+ attack (6 + 누적 str)
  //  - Jaw Worm: 랜덤화 단순 — Chomp(11) / Thrash(7+Block5) / Bellow(+3str+Block6)
  const [enemies, setEnemies] = useState<EnemyMob[]>([
    {
      id: 'cultist',
      name: 'Cultist',
      hp: 50,
      intentPattern: [
        { kind: 'buff', strength: 3, label: 'Incantation' },
        { kind: 'attack', damage: 6, label: 'Dark Strike' },
      ],
    },
    {
      id: 'jaw-worm',
      name: 'Jaw Worm',
      hp: 42,
      intentPattern: [
        { kind: 'attack', damage: 11, label: 'Chomp' },
        { kind: 'defend', block: 6, label: 'Bellow' },
        { kind: 'attack', damage: 7, label: 'Thrash' },
      ],
    },
  ]);
  const [playerHp, setPlayerHp] = useState(80);
  const [survivalMode, setSurvivalMode] = useState(true);

  const cfg: DeckConfig = useMemo(
    () => ({
      cards,
      handSize,
      baseEnergy,
      turnsPerCombat: turns,
      enemies,
      ...(survivalMode && { player: { maxHp: playerHp } }),
    }),
    [cards, handSize, baseEnergy, turns, enemies, survivalMode, playerHp],
  );
  const result = useMemo(() => simulateDeck(cfg, runs), [cfg, runs]);

  const addCard = () => {
    const t = useTranslations();
    setCards((prev) => [
      ...prev,
      { id: `card-${Date.now()}`, name: t('deckSim.newCard'), type: 'attack', cost: 1, damage: 6 },
    ]);
  };

  const updateCard = <K extends keyof Card>(idx: number, key: K, value: Card[K]) => {
    setCards((prev) => prev.map((c, i) => (i === idx ? { ...c, [key]: value } : c)));
  };

  const removeCard = (idx: number) => setCards((prev) => prev.filter((_, i) => i !== idx));

  const addEnemy = () => setEnemies((prev) => [...prev, { id: `mob-${Date.now()}`, name: t('deckSim.newMob'), hp: 50 }]);
  const updateEnemy = <K extends keyof EnemyMob>(idx: number, key: K, value: EnemyMob[K]) =>
    setEnemies((prev) => prev.map((e, i) => (i === idx ? { ...e, [key]: value } : e)));
  const removeEnemy = (idx: number) => setEnemies((prev) => prev.filter((_, i) => i !== idx));

  const addIntent = (mobIdx: number) =>
    setEnemies((prev) =>
      prev.map((e, i) =>
        i === mobIdx ? { ...e, intentPattern: [...(e.intentPattern ?? []), { kind: 'attack' as IntentKind, damage: 5 }] } : e,
      ),
    );
  const updateIntent = (mobIdx: number, intentIdx: number, patch: Partial<MobIntent>) =>
    setEnemies((prev) =>
      prev.map((e, i) => {
        if (i !== mobIdx || !e.intentPattern) return e;
        const next = [...e.intentPattern];
        next[intentIdx] = { ...next[intentIdx], ...patch };
        return { ...e, intentPattern: next };
      }),
    );
  const removeIntent = (mobIdx: number, intentIdx: number) =>
    setEnemies((prev) =>
      prev.map((e, i) => {
        if (i !== mobIdx || !e.intentPattern) return e;
        const next = e.intentPattern.filter((_, j) => j !== intentIdx);
        return { ...e, intentPattern: next.length > 0 ? next : undefined };
      }),
    );

  return (
    <PanelShell
      title={t('deckSim.titleHeader')}
      subtitle={t('deckSim.subtitleHeader')}
      icon={Layers}
      iconColor="#8b5cf6"
      onClose={onClose}
      bodyClassName="p-3 space-y-3 overflow-y-auto"
    >
      {/* 전역 설정 */}
      <div className="p-3 rounded-lg grid grid-cols-2 gap-2" style={{ background: 'var(--bg-tertiary)' }}>
        <NumRow label={t('deckSim.drawPerTurn')} value={handSize} min={3} max={10} onChange={setHandSize} />
        <NumRow label={t('deckSim.energyPerTurn')} value={baseEnergy} min={1} max={10} onChange={setBaseEnergy} />
        <NumRow label={t('deckSim.turns')} value={turns} min={1} max={20} onChange={setTurns} />
        <NumRow label={t('deckSim.iterations')} value={runs} min={500} max={10000} step={500} onChange={setRuns} />
      </div>

      {/* 결과 요약 */}
      <div className="grid grid-cols-2 gap-2">
        <Stat label={t('deckSim.avgDpt')} value={result.avgDpt.toFixed(1)} sub={t('deckSim.medianSub', { n: result.medianDpt.toFixed(1) })} color="#ef4444" />
        <Stat label={t('deckSim.p10p90')} value={`${result.p10Dpt.toFixed(0)}~${result.p90Dpt.toFixed(0)}`} sub={t('deckSim.p10p90Sub')} color="#3b82f6" />
        <Stat label={t('deckSim.deadHand')} value={`${Math.round(result.deadHandRate * 100)}%`} sub={t('deckSim.deadHandSub')} color="#f59e0b" />
        <Stat label={t('deckSim.energyWaste')} value={`${Math.round(result.avgEnergyWaste * 100)}%`} sub={t('deckSim.energyWasteSub')} color="#10b981" />
      </div>

      {/* 생존 시뮬 스위치 + 생존률 stats */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="flex items-center justify-between mb-2">
          <label className="flex items-center gap-2 text-label font-medium cursor-pointer" style={{ color: 'var(--text-primary)' }}>
            <input type="checkbox" checked={survivalMode} onChange={(e) => setSurvivalMode(e.target.checked)} />
            {t('deckSim.survivalMode')}
          </label>
          {survivalMode && (
            <div className="flex items-center gap-2">
              <span className="text-caption" style={{ color: 'var(--text-tertiary)' }}>{t('deckSim.playerHp')}</span>
              <input
                type="number"
                value={playerHp}
                min={1}
                onChange={(e) => setPlayerHp(parseInt(e.target.value) || 1)}
                className="input-compact hide-spinner"
                style={{ width: 70 }}
              />
            </div>
          )}
        </div>
        {survivalMode && result.survivalRate !== undefined && (
          <div className="grid grid-cols-4 gap-2">
            <Stat
              label={t('deckSim.survivalRate')}
              value={`${Math.round(result.survivalRate * 100)}%`}
              sub={t('deckSim.survivalSub', { hp: playerHp })}
              color={result.survivalRate >= 0.7 ? '#10b981' : result.survivalRate >= 0.3 ? '#f59e0b' : '#ef4444'}
            />
            <Stat label={t('deckSim.avgEndHp')} value={result.avgEndHp!.toFixed(1)} sub={`/ ${playerHp}`} color="#3b82f6" />
            <Stat label={t('deckSim.avgDmgTaken')} value={result.avgDamageTaken!.toFixed(1)} sub={t('deckSim.avgDmgTakenSub')} color="#ef4444" />
            <Stat label={t('deckSim.avgBlocked')} value={result.avgDamageBlocked!.toFixed(1)} sub={t('deckSim.avgBlockedSub')} color="#8b5cf6" />
          </div>
        )}
      </div>

      {/* 몹 킬 통계 (enemies 있을 때만) */}
      {result.avgKills !== undefined && (
        <div className="grid grid-cols-3 gap-2">
          <Stat
            label={t('deckSim.avgKills')}
            value={result.avgKills.toFixed(2)}
            sub={t('deckSim.avgKillsSub', { n: enemies.length })}
            color="#ef4444"
          />
          <Stat
            label={t('deckSim.allClearRate')}
            value={`${Math.round((result.clearRate ?? 0) * 100)}%`}
            sub={t('deckSim.allClearSub')}
            color="#10b981"
          />
          <Stat
            label={t('deckSim.firstKillTurn')}
            value={(result.avgTurnToFirstKill ?? 0).toFixed(1)}
            sub={t('deckSim.firstKillSub')}
            color="#f59e0b"
          />
        </div>
      )}

      {/* 몹 편집 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-label font-medium" style={{ color: 'var(--text-primary)' }}>
            {t('deckSim.enemySequence', { n: enemies.length })}
          </span>
          <button onClick={addEnemy} className="btn-primary text-caption inline-flex items-center gap-1">
            <Plus className="w-3 h-3" /> {t('deckSim.addMob')}
          </button>
        </div>
        <p className="text-caption italic mb-2" style={{ color: 'var(--text-tertiary)' }}>
          {t('deckSim.enemySequenceHelp')}
        </p>
        <div className="space-y-1">
          {enemies.map((enemy, idx) => {
            const killRate = result.mobKillRates?.[enemy.id] ?? 0;
            const nextIntent = resolveIntent(enemy, 0);
            const hasPattern = !!enemy.intentPattern && enemy.intentPattern.length > 0;
            return (
              <div key={enemy.id} className="rounded-md" style={{ background: 'var(--bg-primary)' }}>
                <div className="flex items-center gap-2 p-1.5">
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
                  {!hasPattern && (
                    <>
                      <label className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
                        ATK
                      </label>
                      <input
                        type="number"
                        value={enemy.attackDamage ?? 0}
                        min={0}
                        onChange={(e) => updateEnemy(idx, 'attackDamage', parseInt(e.target.value) || 0)}
                        className="input-compact hide-spinner"
                        style={{ width: 60 }}
                        title={t('deckSim.attackPerTurnTitle')}
                      />
                    </>
                  )}
                  {nextIntent && <IntentBadge intent={nextIntent} label={t('deckSim.nextTurnLabel')} />}
                  <span
                    className="text-caption tabular-nums w-12 text-right font-semibold"
                    style={{ color: killRate >= 0.8 ? '#10b981' : killRate >= 0.5 ? '#f59e0b' : '#ef4444' }}
                    title={t('deckSim.mobKillRateTitle')}
                  >
                    {Math.round(killRate * 100)}%
                  </span>
                  <button onClick={() => removeEnemy(idx)} className="p-1 rounded hover:bg-[var(--bg-tertiary)]">
                    <Trash2 className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
                  </button>
                </div>
                <IntentEditor
                  pattern={enemy.intentPattern}
                  onAdd={() => addIntent(idx)}
                  onUpdate={(iIdx, patch) => updateIntent(idx, iIdx, patch)}
                  onRemove={(iIdx) => removeIntent(idx, iIdx)}
                />
              </div>
            );
          })}
          {enemies.length === 0 && (
            <p className="text-caption italic text-center py-4" style={{ color: 'var(--text-tertiary)' }}>
              {t('deckSim.addMobsForAnalysis')}
            </p>
          )}
        </div>
      </div>

      {/* 카드 사용 빈도 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          <span className="text-label font-medium" style={{ color: 'var(--text-primary)' }}>
            {t('deckSim.cardUsage')}
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
            {t('deckSim.deckHeader', { n: cards.length })}
          </span>
          <button onClick={addCard} className="btn-primary text-caption inline-flex items-center gap-1">
            <Plus className="w-3 h-3" /> {t('deckSim.addCard')}
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
                <option value="attack">{t('deckSim.cardAttack')}</option>
                <option value="skill">{t('deckSim.cardSkill')}</option>
                <option value="power">{t('deckSim.cardPower')}</option>
              </select>
              <input
                type="number"
                value={card.cost}
                min={0}
                max={3}
                onChange={(e) => updateCard(idx, 'cost', parseInt(e.target.value) || 0)}
                className="input-compact hide-spinner"
                style={{ width: 50 }}
                title={t('deckSim.costTitle')}
              />
              <input
                type="number"
                value={card.damage ?? 0}
                onChange={(e) => updateCard(idx, 'damage', parseInt(e.target.value) || 0)}
                className="input-compact hide-spinner"
                style={{ width: 60 }}
                title={t('deckSim.damageTitle')}
                placeholder={t('deckSim.damagePlaceholder')}
              />
              <input
                type="number"
                value={card.block ?? 0}
                onChange={(e) => updateCard(idx, 'block', parseInt(e.target.value) || 0)}
                className="input-compact hide-spinner"
                style={{ width: 60 }}
                title={t('deckSim.defenseTitle')}
                placeholder={t('deckSim.defensePlaceholder')}
              />
              <button onClick={() => removeCard(idx)} className="p-1 rounded hover:bg-[var(--bg-tertiary)]">
                <Trash2 className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="text-caption italic" style={{ color: 'var(--text-tertiary)' }}>
        {t('deckSim.dptNote')}
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

// Slay the Spire 아이콘 매핑: noggle(attack), shield(defend), up(buff), ban(debuff), moon(stun), ?(unknown)
const INTENT_META: Record<IntentKind, { Icon: typeof Swords; color: string; bg: string; labelKey: string }> = {
  attack:  { Icon: Swords,     color: '#ef4444', bg: '#ef444420', labelKey: 'deckSim.intentAttack' },
  defend:  { Icon: Shield,     color: '#3b82f6', bg: '#3b82f620', labelKey: 'deckSim.intentDefend' },
  buff:    { Icon: ArrowUp,    color: '#f59e0b', bg: '#f59e0b20', labelKey: 'deckSim.intentBuff' },
  debuff:  { Icon: Ban,        color: '#8b5cf6', bg: '#8b5cf620', labelKey: 'deckSim.intentDebuff' },
  stun:    { Icon: Moon,       color: '#6b7280', bg: '#6b728020', labelKey: 'deckSim.intentStun' },
  unknown: { Icon: HelpCircle, color: '#94a3b8', bg: '#94a3b820', labelKey: 'deckSim.intentAttack' },
};

function IntentBadge({ intent, label }: { intent: MobIntent; label?: string }) {
  const t = useTranslations();
  const meta = INTENT_META[intent.kind];
  const val = intent.damage ?? intent.block ?? intent.strength;
  const title = [label, intent.label ?? (intent.kind === 'unknown' ? '?' : t(meta.labelKey as 'deckSim.intentAttack')), val != null ? `${val}` : '']
    .filter(Boolean)
    .join(' · ');
  return (
    <span
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-caption font-semibold tabular-nums"
      style={{ background: meta.bg, color: meta.color }}
      title={title}
    >
      <meta.Icon className="w-3 h-3" />
      {val != null && val}
    </span>
  );
}

function IntentEditor({
  pattern,
  onAdd,
  onUpdate,
  onRemove,
}: {
  pattern?: MobIntent[];
  onAdd: () => void;
  onUpdate: (idx: number, patch: Partial<MobIntent>) => void;
  onRemove: (idx: number) => void;
}) {
  const t = useTranslations();
  return (
    <div className="px-2 pb-2 flex items-center gap-1 flex-wrap">
      <span className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
        {t('deckSim.intentCycle')}
      </span>
      {(pattern ?? []).map((intent, i) => {
        const meta = INTENT_META[intent.kind];
        const val = intent.damage ?? intent.block ?? intent.strength ?? 0;
        return (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-1 py-0.5 rounded"
            style={{ background: meta.bg }}
          >
            <select
              value={intent.kind}
              onChange={(e) => {
                const kind = e.target.value as IntentKind;
                // kind 변경 시 기본 필드 초기화
                const patch: Partial<MobIntent> =
                  kind === 'attack' ? { kind, damage: val || 5, block: undefined, strength: undefined }
                  : kind === 'defend' ? { kind, block: val || 5, damage: undefined, strength: undefined }
                  : kind === 'buff' ? { kind, strength: val || 2, damage: undefined, block: undefined }
                  : { kind, damage: undefined, block: undefined, strength: undefined };
                onUpdate(i, patch);
              }}
              className="bg-transparent text-caption border-none outline-none font-semibold"
              style={{ color: meta.color }}
            >
              <option value="attack">{t('deckSim.intentAttack')}</option>
              <option value="defend">{t('deckSim.intentDefend')}</option>
              <option value="buff">{t('deckSim.intentBuff')}</option>
              <option value="debuff">{t('deckSim.intentDebuff')}</option>
              <option value="stun">{t('deckSim.intentStun')}</option>
            </select>
            {(intent.kind === 'attack' || intent.kind === 'defend' || intent.kind === 'buff') && (
              <input
                type="number"
                value={
                  intent.kind === 'attack' ? (intent.damage ?? 0)
                  : intent.kind === 'defend' ? (intent.block ?? 0)
                  : (intent.strength ?? 0)
                }
                min={0}
                onChange={(e) => {
                  const v = parseInt(e.target.value) || 0;
                  onUpdate(i,
                    intent.kind === 'attack' ? { damage: v }
                    : intent.kind === 'defend' ? { block: v }
                    : { strength: v },
                  );
                }}
                className="bg-transparent text-caption font-bold tabular-nums hide-spinner w-8 outline-none border-b"
                style={{ color: meta.color, borderColor: meta.color }}
              />
            )}
            <button onClick={() => onRemove(i)} className="opacity-40 hover:opacity-100">
              <Trash2 className="w-2.5 h-2.5" style={{ color: meta.color }} />
            </button>
          </span>
        );
      })}
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-caption hover:bg-[var(--bg-tertiary)]"
        style={{ color: 'var(--text-secondary)' }}
        title={t('deckSim.addTurnIntent')}
      >
        <Plus className="w-3 h-3" />
        turn
      </button>
    </div>
  );
}
