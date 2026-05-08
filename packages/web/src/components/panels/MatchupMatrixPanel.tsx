/**
 * 범용 밸런스 매트릭스 패널 — Unit / FPS Weapon / Deck 도메인 매치업 heatmap.
 *
 * 업계 레퍼런스:
 *  - League of Legends Patch Notes: 챔피언 matchup table (Win% by matchup)
 *  - Smogon/Pokemon Showdown: 포켓몬 티어 매트릭스
 *  - Blizzard SC2 "Perfect Imbalance" (정재영 GDC talk)
 *
 * 기능:
 *  - 3 도메인 탭 (unit/fps/deck)
 *  - N×N heatmap 표 (빨강=이김 / 파랑=짐 / 회색=균형)
 *  - Dominant / Weak / Cycle / balanceScore 자동 분석
 *  - topImbalances 리스트
 */

import { useState, useMemo } from 'react';
import { GitCompare, Target, Layers, Crosshair } from 'lucide-react';
import PanelShell from '@/components/ui/PanelShell';
import {
  runMatchupMatrix,
  winRateToColor,
  type MatchupRunner,
  type MatchupResult,
} from '@/lib/matchupMatrix';
import { simulateBattle } from '@/lib/simulation/battleEngine';
import type { UnitStats } from '@/lib/simulation/types';
import {
  WEAPON_PRESETS,
  aimSkillToProfile,
  simulateFpsDuel,
  type WeaponStats,
} from '@/lib/fpsSimulation';
import {
  CARD_PRESETS,
  simulateDeck,
  type Card,
} from '@/lib/deckSimulation';
import { useTranslations } from 'next-intl';

interface Props {
  onClose: () => void;
}

type DomainId = 'unit' | 'fps' | 'deck';

// ============================================================================
// 도메인별 runner 정의
// ============================================================================

const unitRunner: MatchupRunner<UnitStats> = {
  id: (u) => u.id,
  label: (u) => u.name,
  runMatch: (a, b) => {
    const r = simulateBattle(a, b, [], [], { maxDuration: 120, timeStep: 0.1 });
    if (r.winner === 'unit1') return 'a';
    if (r.winner === 'unit2') return 'b';
    return 'draw';
  },
};

const fpsRunner: MatchupRunner<WeaponStats> = {
  id: (w) => w.id,
  label: (w) => w.name,
  runMatch: (a, b) => {
    const aim = aimSkillToProfile(50);
    const player = { hp: 100, shield: 0, armor: 0 };
    // 20 run 짧게 돌리고 bluffing 없는 동시 인지
    const d = simulateFpsDuel(
      a, aim, b, aim, player, player,
      { distance: 20, firstShot: 'both-aware', bothAwareDelayMs: 100 },
      20,
    );
    if (d.aWinRate > d.bWinRate) return 'a';
    if (d.bWinRate > d.aWinRate) return 'b';
    return 'draw';
  },
};

// 단순 deck runner — 덱 A 가 더 많이 클리어한 쪽이 "이김"
// (덱 대 덱 직접 전투는 도메인상 없으므로 "동일 더미에 더 강한 쪽") — Slay the Spire 스타일 평가
const deckRunner: MatchupRunner<{ id: string; name: string; cards: Card[] }> = {
  id: (d) => d.id,
  label: (d) => d.name,
  runMatch: (a, b) => {
    // 같은 몹 세트에 대해 각각 시뮬 → 클리어율 / DPT 높은 쪽 승
    const enemies = [{ id: 'dummy', name: 'Dummy', hp: 100 }];
    const ra = simulateDeck(
      { cards: a.cards, handSize: 5, baseEnergy: 3, turnsPerCombat: 5, enemies },
      200,
    );
    const rb = simulateDeck(
      { cards: b.cards, handSize: 5, baseEnergy: 3, turnsPerCombat: 5, enemies },
      200,
    );
    const scoreA = (ra.clearRate ?? 0) * 100 + ra.avgDpt;
    const scoreB = (rb.clearRate ?? 0) * 100 + rb.avgDpt;
    if (scoreA > scoreB * 1.05) return 'a';
    if (scoreB > scoreA * 1.05) return 'b';
    return 'draw';
  },
};

// ============================================================================
// 기본 샘플 데이터
// ============================================================================

function defaultUnits(): UnitStats[] {
  const t = useTranslations();
  const mk = (id: string, name: string, hp: number, atk: number, def: number, speed: number): UnitStats => ({
    id, name, hp, maxHp: hp, atk, def, speed,
  });
  return [
    mk('tank',    t('matchupMatrix.unitTank'),   1200, 45,  30, 0.8),
    mk('dps',     t('matchupMatrix.unitDealer'),   600,  100, 8,  1.5),
    mk('rogue',   t('matchupMatrix.unitRogue'),   450,  130, 4,  2.0),
    mk('healer',  t('matchupMatrix.unitHealer'),   700,  35,  15, 1.0),
    mk('mage',    t('matchupMatrix.unitMage'), 500,  115, 6,  1.2),
  ];
}

function defaultDecks(t: ReturnType<typeof useTranslations>): { id: string; name: string; cards: Card[] }[] {
  const defend = (i: number): Card => ({ id: `d${i}`, name: 'Defend', type: 'skill', cost: 1, block: 5 });
  const strike = (i: number): Card => ({ id: `s${i}`, name: 'Strike', type: 'attack', cost: 1, damage: 6 });
  const heavy = (i: number): Card => ({ id: `h${i}`, name: 'Heavy',  type: 'attack', cost: 2, damage: 14 });
  return [
    {
      id: 'ironclad',
      name: t('matchupMatrix.presetIronclad'),
      cards: CARD_PRESETS,
    },
    {
      id: 'rush',
      name: 'Rush',
      cards: Array.from({ length: 8 }, (_, i) => strike(i)).concat([heavy(9), heavy(10)]),
    },
    {
      id: 'defend',
      name: t('matchupMatrix.presetDefensive'),
      cards: Array.from({ length: 6 }, (_, i) => defend(i)).concat(
        Array.from({ length: 4 }, (_, i) => strike(i + 10)),
      ),
    },
    {
      id: 'balanced',
      name: t('matchupMatrix.presetBalanced'),
      cards: Array.from({ length: 4 }, (_, i) => strike(i))
        .concat(Array.from({ length: 4 }, (_, i) => defend(i + 20)))
        .concat([heavy(30), heavy(31)]),
    },
  ];
}

// ============================================================================
// 메인 패널
// ============================================================================

export default function MatchupMatrixPanel({ onClose }: Props) {
  const t = useTranslations();
  const [domain, setDomain] = useState<DomainId>('unit');
  const [runsPerMatch, setRunsPerMatch] = useState(30);

  const result: MatchupResult<unknown> = useMemo(() => {
    if (domain === 'unit') {
      return runMatchupMatrix(defaultUnits(), unitRunner, { runsPerMatch }) as MatchupResult<unknown>;
    }
    if (domain === 'fps') {
      return runMatchupMatrix(WEAPON_PRESETS, fpsRunner, { runsPerMatch: Math.max(5, Math.floor(runsPerMatch / 3)) }) as MatchupResult<unknown>;
    }
    return runMatchupMatrix(defaultDecks(t), deckRunner, { runsPerMatch: Math.max(3, Math.floor(runsPerMatch / 10)) }) as MatchupResult<unknown>;
  }, [domain, runsPerMatch]);

  return (
    <PanelShell
      title={t('matchupMatrix.titleHeader')}
      subtitle={t('matchupMatrix.subtitleHeader')}
      icon={GitCompare}
      iconColor="#8b5cf6"
      onClose={onClose}
      bodyClassName="p-3 space-y-3 overflow-y-auto"
    >
      {/* 도메인 탭 */}
      <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <DomainTab id="unit" current={domain} onClick={setDomain} icon={Target} label={t('matchupMatrix.tabUnit')} />
        <DomainTab id="fps"  current={domain} onClick={setDomain} icon={Crosshair} label={t('matchupMatrix.tabFps')} />
        <DomainTab id="deck" current={domain} onClick={setDomain} icon={Layers} label={t('matchupMatrix.tabDeck')} />
      </div>

      {/* 컨트롤 */}
      <div className="p-3 rounded-lg flex items-center gap-4" style={{ background: 'var(--bg-tertiary)' }}>
        <label className="text-label" style={{ color: 'var(--text-secondary)' }}>
          {t('matchupMatrix.matchupRunCount')}
        </label>
        <input
          type="range"
          min={5}
          max={100}
          step={5}
          value={runsPerMatch}
          onChange={(e) => setRunsPerMatch(parseInt(e.target.value))}
          className="flex-1"
          style={{ accentColor: 'var(--accent)' }}
        />
        <span className="text-label font-semibold tabular-nums w-12 text-right" style={{ color: 'var(--text-primary)' }}>
          {runsPerMatch}
        </span>
      </div>

      {/* 요약 통계 */}
      <div className="grid grid-cols-4 gap-2">
        <Stat
          label="Balance Score"
          value={result.balanceScore.toFixed(0)}
          sub={t('matchupMatrix.perfectBalance')}
          color={result.balanceScore >= 70 ? '#10b981' : result.balanceScore >= 50 ? '#f59e0b' : '#ef4444'}
        />
        <Stat
          label="Dominant"
          value={result.dominantIdx.length.toString()}
          sub={t('matchupMatrix.avgWinrate60')}
          color={result.dominantIdx.length === 0 ? '#10b981' : '#ef4444'}
        />
        <Stat
          label="Weak"
          value={result.weakIdx.length.toString()}
          sub={t('matchupMatrix.avgWinrate40')}
          color={result.weakIdx.length === 0 ? '#10b981' : '#3b82f6'}
        />
        <Stat
          label="Cycles"
          value={result.cycles.length.toString()}
          sub={t('matchupMatrix.rps')}
          color={result.cycles.length > 0 ? '#10b981' : '#6b7280'}
        />
      </div>

      {/* Heatmap 매트릭스 */}
      <div className="p-3 rounded-lg overflow-x-auto" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="text-label font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
          {t('matchupMatrix.matrixHeader')}
        </div>
        <table className="text-caption" style={{ borderCollapse: 'separate', borderSpacing: 2 }}>
          <thead>
            <tr>
              <th></th>
              {result.labels.map((lbl, i) => (
                <th
                  key={i}
                  className="font-medium"
                  style={{
                    // 45도 기울여서 가로 공간 절약 + 한글/영어 모두 자연스럽게 읽힘
                    // (vertical-rl 은 한글 자소 분리 문제)
                    height: 80,
                    minWidth: 50,
                    maxWidth: 80,
                    verticalAlign: 'bottom',
                    padding: '0 4px 4px',
                  }}
                >
                  <div
                    style={{
                      display: 'inline-block',
                      transform: 'rotate(-45deg)',
                      transformOrigin: 'left bottom',
                      whiteSpace: 'nowrap',
                      color: result.dominantIdx.includes(i) ? '#ef4444'
                        : result.weakIdx.includes(i) ? '#3b82f6'
                        : 'var(--text-secondary)',
                      fontWeight: 500,
                    }}
                    title={lbl}
                  >
                    {lbl}
                  </div>
                </th>
              ))}
              <th className="px-2 py-1 align-bottom" style={{ color: 'var(--text-tertiary)' }}>{t('matchupMatrix.avgCol')}</th>
            </tr>
          </thead>
          <tbody>
            {result.labels.map((lbl, i) => (
              <tr key={i}>
                <th
                  className="px-2 py-1 text-right font-medium"
                  style={{
                    color: result.dominantIdx.includes(i) ? '#ef4444'
                      : result.weakIdx.includes(i) ? '#3b82f6'
                      : 'var(--text-secondary)',
                  }}
                >
                  {lbl}
                </th>
                {result.winRates[i].map((rate, j) => (
                  <td
                    key={j}
                    className="px-2 py-1 text-center font-semibold tabular-nums"
                    style={{
                      background: i === j ? 'var(--bg-primary)' : winRateToColor(rate),
                      color: i === j ? 'var(--text-tertiary)' : 'var(--text-primary)',
                      minWidth: 50,
                    }}
                    title={`${lbl} vs ${result.labels[j]}: ${(rate * 100).toFixed(1)}%`}
                  >
                    {i === j ? '—' : `${Math.round(rate * 100)}`}
                  </td>
                ))}
                <td
                  className="px-2 py-1 text-center font-bold tabular-nums"
                  style={{
                    color: result.dominantIdx.includes(i) ? '#ef4444'
                      : result.weakIdx.includes(i) ? '#3b82f6'
                      : 'var(--text-primary)',
                  }}
                >
                  {Math.round(result.avgWinRate[i] * 100)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Top imbalances */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="text-label font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
          {t('matchupMatrix.mostImbalanced')}
        </div>
        <div className="space-y-1">
          {result.topImbalances.map((imb, idx) => {
            const winnerLabel = imb.winRate >= 0.5 ? result.labels[imb.aIdx] : result.labels[imb.bIdx];
            const loserLabel = imb.winRate >= 0.5 ? result.labels[imb.bIdx] : result.labels[imb.aIdx];
            const pct = imb.winRate >= 0.5 ? imb.winRate : 1 - imb.winRate;
            return (
              <div key={idx} className="flex items-center gap-2 p-1.5 rounded-md" style={{ background: 'var(--bg-primary)' }}>
                <span className="text-caption tabular-nums w-6" style={{ color: 'var(--text-tertiary)' }}>
                  #{idx + 1}
                </span>
                <span className="flex-1 text-caption">
                  <span className="font-semibold" style={{ color: '#ef4444' }}>{winnerLabel}</span>
                  <span className="mx-1" style={{ color: 'var(--text-tertiary)' }}>vs</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{loserLabel}</span>
                </span>
                <div className="flex-1 h-2 rounded overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                  <div style={{ width: `${pct * 100}%`, height: '100%', background: winRateToColor(pct) }} />
                </div>
                <span className="text-caption font-bold tabular-nums w-14 text-right" style={{ color: '#ef4444' }}>
                  {Math.round(pct * 100)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cycle (Perfect Imbalance) */}
      {result.cycles.length > 0 && (
        <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
          <div className="text-label font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
            {t('matchupMatrix.rpsCycle')}
          </div>
          <div className="space-y-1">
            {result.cycles.map((cycle, idx) => (
              <div key={idx} className="flex items-center gap-1 p-1.5 rounded-md" style={{ background: 'var(--bg-primary)' }}>
                {cycle.map((i, ci) => (
                  <span key={ci} className="inline-flex items-center">
                    <span
                      className="px-2 py-0.5 rounded text-caption font-medium"
                      style={{ background: '#10b98130', color: '#10b981' }}
                    >
                      {result.labels[i]}
                    </span>
                    {ci < cycle.length - 1 && (
                      <span className="mx-1" style={{ color: '#10b981' }}>→</span>
                    )}
                  </span>
                ))}
                <span className="mx-1" style={{ color: '#10b981' }}>→</span>
                <span
                  className="px-2 py-0.5 rounded text-caption font-medium"
                  style={{ background: '#10b98130', color: '#10b981' }}
                >
                  {result.labels[cycle[0]]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-caption italic" style={{ color: 'var(--text-tertiary)' }}>
        {t('matchupMatrix.perfectImbalanceNote')}
      </p>
    </PanelShell>
  );
}

// ============================================================================
// 서브 컴포넌트
// ============================================================================

function DomainTab({
  id, current, onClick, icon: Icon, label,
}: {
  id: DomainId;
  current: DomainId;
  onClick: (id: DomainId) => void;
  icon: typeof Target;
  label: string;
}) {
  const active = id === current;
  return (
    <button
      onClick={() => onClick(id)}
      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-md text-label font-medium transition-colors"
      style={{
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? 'white' : 'var(--text-secondary)',
      }}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
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
