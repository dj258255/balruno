/**
 * 격투 프레임 데이터 패널 — Street Fighter / Tekken / Guilty Gear 밸런싱.
 * 기술 분석 + 콤보 라우트 검증.
 */

import { useState, useMemo } from 'react';
import { Zap, Plus, Trash2, GitBranch } from 'lucide-react';
import PanelShell from '@/components/ui/PanelShell';
import { analyzeMove, analyzeComboRoute, getCancelRoutes, MOVE_PRESETS, type FrameData } from '@/lib/frameData';
import { useTranslations } from 'next-intl';

interface Props {
  onClose: () => void;
}

const TIER_COLOR: Record<string, string> = {
  'heavily-plus': '#10b981',
  'plus': '#3b82f6',
  'neutral': '#94a3b8',
  'minus': '#f59e0b',
  'heavily-minus': '#ef4444',
};

const TIER_LABEL: Record<string, string> = {
  'heavily-plus': 'frameData.tierHeavyPlus',
  'plus': 'frameData.tierPlus',
  'neutral': 'frameData.tierNeutral',
  'minus': 'frameData.tierMinus',
  'heavily-minus': 'frameData.tierHeavyMinus',
};

export default function FrameDataPanel({ onClose }: Props) {
  const t = useTranslations();
  const [moves, setMoves] = useState<FrameData[]>(MOVE_PRESETS);
  const [routeIds, setRouteIds] = useState<string[]>(['lp', 'mp', 'hadouken']);
  const [cancelStartId, setCancelStartId] = useState<string>('lp');

  const routeMoves = useMemo(() => routeIds.map((id) => moves.find((m) => m.id === id)).filter(Boolean) as FrameData[], [routeIds, moves]);
  const routeResult = useMemo(() => analyzeComboRoute(routeMoves), [routeMoves]);
  const cancelStart = useMemo(() => moves.find((m) => m.id === cancelStartId), [moves, cancelStartId]);
  const cancelRoutes = useMemo(
    () => (cancelStart ? getCancelRoutes(cancelStart, moves, 4) : []),
    [cancelStart, moves],
  );
  // 피해 많은 순 정렬 → 최적 루트 상단
  const topCancelRoutes = useMemo(
    () => [...cancelRoutes].sort((a, b) => b.totalDamage - a.totalDamage).slice(0, 8),
    [cancelRoutes],
  );

  const updateMove = <K extends keyof FrameData>(idx: number, key: K, value: FrameData[K]) => {
    setMoves((prev) => prev.map((m, i) => (i === idx ? { ...m, [key]: value } : m)));
  };

  const addMove = () => {
    const t = useTranslations();
    setMoves((prev) => [
      ...prev,
      { id: `move-${Date.now()}`, name: t('frameData.newMoveName'), startup: 7, active: 3, recovery: 14, hitstun: 17, blockstun: 13, damage: 50 },
    ]);
  };

  const removeMove = (id: string) => setMoves((prev) => prev.filter((m) => m.id !== id));
  const addToRoute = (id: string) => setRouteIds((prev) => [...prev, id]);
  const removeFromRoute = (idx: number) => setRouteIds((prev) => prev.filter((_, i) => i !== idx));

  return (
    <PanelShell
      title={t('frameData.titleHeader')}
      subtitle={t('frameData.subtitleHeader')}
      icon={Zap}
      iconColor="#f59e0b"
      onClose={onClose}
      bodyClassName="p-3 space-y-3 overflow-y-auto"
    >
      {/* 기술 목록 + 분석 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-label font-medium" style={{ color: 'var(--text-primary)' }}>
            {t('frameData.movesHeader', { n: moves.length })}
          </span>
          <button onClick={addMove} className="btn-primary text-caption inline-flex items-center gap-1">
            <Plus className="w-3 h-3" /> {t('frameData.addBtn')}
          </button>
        </div>
        <div className="space-y-1 max-h-80 overflow-y-auto">
          <div className="grid grid-cols-12 gap-1 text-caption px-2" style={{ color: 'var(--text-tertiary)' }}>
            <div className="col-span-3">{t('frameData.colName')}</div>
            <div className="col-span-1 text-center">{t('frameData.colStartup')}</div>
            <div className="col-span-1 text-center">{t('frameData.colActive')}</div>
            <div className="col-span-1 text-center">{t('frameData.colRecovery')}</div>
            <div className="col-span-1 text-center">{t('frameData.colDamage')}</div>
            <div className="col-span-1 text-center">{t('frameData.colHitstun')}</div>
            <div className="col-span-1 text-center">{t('frameData.colBlockstun')}</div>
            <div className="col-span-1 text-center">H+</div>
            <div className="col-span-1 text-center">B+</div>
            <div className="col-span-1"></div>
          </div>
          {moves.map((m, idx) => {
            const a = analyzeMove(m);
            return (
              <div key={m.id} className="space-y-1">
              <div className="grid grid-cols-12 gap-1 items-center p-1.5 rounded-md" style={{ background: 'var(--bg-primary)' }}>
                <input className="input-compact col-span-3" value={m.name} onChange={(e) => updateMove(idx, 'name', e.target.value)} />
                <input type="number" className="input-compact hide-spinner col-span-1 text-center" value={m.startup} onChange={(e) => updateMove(idx, 'startup', parseInt(e.target.value) || 0)} />
                <input type="number" className="input-compact hide-spinner col-span-1 text-center" value={m.active} onChange={(e) => updateMove(idx, 'active', parseInt(e.target.value) || 0)} />
                <input type="number" className="input-compact hide-spinner col-span-1 text-center" value={m.recovery} onChange={(e) => updateMove(idx, 'recovery', parseInt(e.target.value) || 0)} />
                <input type="number" className="input-compact hide-spinner col-span-1 text-center" value={m.damage} onChange={(e) => updateMove(idx, 'damage', parseInt(e.target.value) || 0)} />
                <input type="number" className="input-compact hide-spinner col-span-1 text-center" value={m.hitstun} onChange={(e) => updateMove(idx, 'hitstun', parseInt(e.target.value) || 0)} />
                <input type="number" className="input-compact hide-spinner col-span-1 text-center" value={m.blockstun} onChange={(e) => updateMove(idx, 'blockstun', parseInt(e.target.value) || 0)} />
                <span
                  className="col-span-1 text-center font-bold tabular-nums text-label rounded px-1"
                  style={{ color: TIER_COLOR[a.advantageHit], background: `${TIER_COLOR[a.advantageHit]}20` }}
                  title={`${TIER_LABEL[a.advantageHit]} (${a.onHit >= 0 ? '+' : ''}${a.onHit})`}
                >
                  {a.onHit >= 0 ? `+${a.onHit}` : a.onHit}
                </span>
                <span
                  className="col-span-1 text-center font-bold tabular-nums text-label rounded px-1"
                  style={{ color: TIER_COLOR[a.advantageBlock], background: `${TIER_COLOR[a.advantageBlock]}20` }}
                  title={t('frameData.tierBlockTooltip', { tier: t(TIER_LABEL[a.advantageBlock] as 'frameData.tierPlus'), sign: a.onBlock >= 0 ? '+' : '', val: a.onBlock, punish: a.punishableOnBlock ? t('frameData.punishable') : '' })}
                >
                  {a.onBlock >= 0 ? `+${a.onBlock}` : a.onBlock}
                </span>
                <div className="col-span-1 flex items-center gap-0.5">
                  <button onClick={() => addToRoute(m.id)} className="p-0.5 rounded hover:bg-[var(--bg-hover)]" title={t('frameData.addToCombo')}>
                    <Plus className="w-3 h-3" style={{ color: 'var(--accent)' }} />
                  </button>
                  <button onClick={() => removeMove(m.id)} className="p-0.5 rounded hover:bg-[var(--bg-hover)]">
                    <Trash2 className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
                  </button>
                </div>
              </div>
              {/* INV/CH 배지 라인 — 있는 경우만 */}
              {(a.invincibleRange || (m.counterHitMultiplier && m.counterHitMultiplier !== 1)) && (
                <div className="flex items-center gap-1 pl-2">
                  {a.invincibleRange && (
                    <span
                      className="text-caption font-bold px-1.5 py-0.5 rounded"
                      style={{ background: '#10b98130', color: '#10b981' }}
                      title={t('frameData.invincibleTooltip', { from: a.invincibleRange.from, to: a.invincibleRange.to, type: a.invincibleRange.type })}
                    >
                      INV {a.invincibleRange.from}-{a.invincibleRange.to}f
                    </span>
                  )}
                  {m.counterHitMultiplier && m.counterHitMultiplier !== 1 && (
                    <span
                      className="text-caption font-bold px-1.5 py-0.5 rounded"
                      style={{ background: '#f59e0b30', color: '#f59e0b' }}
                      title={t('frameData.counterHitTooltip', { dmg: a.counterHitDamage, mul: m.counterHitMultiplier.toFixed(1), plus: a.counterHitOnHit })}
                    >
                      CH ×{m.counterHitMultiplier.toFixed(1)} → {a.counterHitDamage}dmg, +{a.counterHitOnHit}f
                    </span>
                  )}
                </div>
              )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 프레임 타임라인 시각화 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="text-label font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
          {t('frameData.frameTimeline')}
        </div>
        <div className="space-y-1">
          {moves.map((m) => (
            <FrameTimeline key={m.id} move={m} />
          ))}
        </div>
        <div className="flex gap-3 mt-3 text-caption" style={{ color: 'var(--text-tertiary)' }}>
          <LegendDot color="#94a3b8" label={t('frameData.legendStartup')} />
          <LegendDot color="#ef4444" label={t('frameData.legendActive')} />
          <LegendDot color="#3b82f6" label={t('frameData.legendRecovery')} />
        </div>
      </div>

      {/* 캔슬 루트 탐색 — gatling/rekka/special cancel 자동 생성 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="inline-flex items-center gap-1.5 text-label font-medium" style={{ color: 'var(--text-primary)' }}>
            <GitBranch className="w-4 h-4" />
            {t('frameData.cancelRoute')}
          </span>
          <select
            value={cancelStartId}
            onChange={(e) => setCancelStartId(e.target.value)}
            className="input-compact"
            style={{ width: 120 }}
          >
            {moves.map((m) => (
              <option key={m.id} value={m.id}>
                {t('frameData.fromMove', { move: m.name })}
              </option>
            ))}
          </select>
        </div>
        {topCancelRoutes.length === 0 ? (
          <p className="text-caption italic" style={{ color: 'var(--text-tertiary)' }}>
            {t('frameData.noCancellable')}
          </p>
        ) : (
          <div className="space-y-1">
            {topCancelRoutes.map((route, i) => (
              <div
                key={i}
                className="flex items-center gap-1 p-1.5 rounded-md"
                style={{ background: 'var(--bg-primary)' }}
              >
                <span className="text-caption w-6 tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                  #{i + 1}
                </span>
                <div className="flex items-center gap-1 flex-1 min-w-0 overflow-hidden">
                  {route.moves.map((m, mIdx) => (
                    <span key={mIdx} className="inline-flex items-center gap-1 shrink-0">
                      <span
                        className="px-1.5 py-0.5 rounded text-caption font-medium"
                        style={{
                          background:
                            m.category === 'super' ? '#f59e0b30'
                            : m.category === 'special' ? '#8b5cf630'
                            : m.category === 'heavy' ? '#ef444430'
                            : m.category === 'medium' ? '#3b82f630'
                            : '#94a3b830',
                          color:
                            m.category === 'super' ? '#f59e0b'
                            : m.category === 'special' ? '#8b5cf6'
                            : m.category === 'heavy' ? '#ef4444'
                            : m.category === 'medium' ? '#3b82f6'
                            : '#94a3b8',
                        }}
                      >
                        {m.name}
                      </span>
                      {mIdx < route.moves.length - 1 && (
                        <span className="text-caption" style={{ color: '#10b981' }}>→</span>
                      )}
                    </span>
                  ))}
                </div>
                <span
                  className="text-caption font-bold tabular-nums ml-auto shrink-0"
                  style={{ color: '#ef4444' }}
                >
                  {route.totalDamage} dmg
                </span>
                <button
                  onClick={() => setRouteIds(route.moves.map((m) => m.id))}
                  className="text-caption px-2 py-0.5 rounded shrink-0"
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--accent)' }}
                  title={t('frameData.analyzeRoute')}
                >
                  {t('frameData.analyzeBtn')}
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="text-caption italic mt-2" style={{ color: 'var(--text-tertiary)' }}>
          {t('frameData.cancelExplain')}
        </p>
      </div>

      {/* 콤보 라우트 분석 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-label font-medium" style={{ color: 'var(--text-primary)' }}>
            {t('frameData.comboRoute')}
          </span>
          <span
            className="text-caption font-semibold px-2 py-0.5 rounded"
            style={{
              background: routeResult.feasible ? '#10b98130' : '#ef444430',
              color: routeResult.feasible ? '#10b981' : '#ef4444',
            }}
          >
            {routeResult.feasible ? t('frameData.feasible') : t('frameData.notFeasible')}
          </span>
        </div>

        {routeMoves.length === 0 ? (
          <p className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
            {t('frameData.comboHelp')}
          </p>
        ) : (
          <>
            <div className="flex items-center gap-1 flex-wrap mb-2">
              {routeMoves.map((m, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  <span className="px-2 py-1 rounded-md text-label font-medium" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
                    {m.name}
                    <button onClick={() => removeFromRoute(idx)} className="ml-1 opacity-40 hover:opacity-100">
                      <Trash2 className="w-2.5 h-2.5 inline" />
                    </button>
                  </span>
                  {idx < routeMoves.length - 1 && (
                    <span
                      className="text-caption px-1"
                      style={{
                        color: routeResult.links[idx].connects ? '#10b981' : '#ef4444',
                      }}
                    >
                      {routeResult.links[idx].connects ? '→' : '✗'}
                      {' '}
                      {routeResult.links[idx].frameGap >= 0 ? `+${routeResult.links[idx].frameGap}` : routeResult.links[idx].frameGap}f
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Metric label={t('frameData.totalDamage')} value={routeResult.totalDamage.toString()} />
              <Metric label={t('frameData.totalFrames')} value={t('frameData.frameUnit', { n: routeResult.totalFrames })} sub={`${(routeResult.totalFrames * 16.67).toFixed(0)}ms`} />
              <Metric label={t('frameData.movesCount')} value={routeMoves.length.toString()} />
            </div>
          </>
        )}
      </div>

      <div className="text-caption italic" style={{ color: 'var(--text-tertiary)' }}>
        {t('frameData.legendNote')}
      </div>
    </PanelShell>
  );
}

/** 기술 한 개의 타임라인 — startup(회색) / active(빨강) / recovery(파랑) 막대 */
function FrameTimeline({ move }: { move: FrameData }) {
  const total = move.startup + move.active + move.recovery;
  // max 는 가장 긴 기술에 맞춰 정규화 — 여기선 60프레임 기준 cap
  const maxCap = 80;
  const normalizer = Math.max(total, maxCap) / 100;
  const startupPct = (move.startup / normalizer);
  const activePct = (move.active / normalizer);
  const recoveryPct = (move.recovery / normalizer);

  return (
    <div className="flex items-center gap-2">
      <span className="text-caption w-16 truncate" style={{ color: 'var(--text-secondary)' }} title={move.name}>
        {move.name}
      </span>
      <div className="flex-1 relative h-5 rounded overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
        <div className="absolute inset-y-0 left-0 flex h-full text-caption font-semibold text-white">
          <div
            className="flex items-center justify-center"
            style={{ width: `${startupPct}%`, background: '#94a3b8', minWidth: startupPct > 0 ? 18 : 0 }}
            title={`Startup ${move.startup}f`}
          >
            {move.startup}
          </div>
          <div
            className="flex items-center justify-center"
            style={{ width: `${activePct}%`, background: '#ef4444', minWidth: activePct > 0 ? 18 : 0 }}
            title={`Active ${move.active}f`}
          >
            {move.active}
          </div>
          <div
            className="flex items-center justify-center"
            style={{ width: `${recoveryPct}%`, background: '#3b82f6', minWidth: recoveryPct > 0 ? 18 : 0 }}
            title={`Recovery ${move.recovery}f`}
          >
            {move.recovery}
          </div>
        </div>
      </div>
      <span className="text-caption tabular-nums w-16 text-right" style={{ color: 'var(--text-tertiary)' }}>
        {total}f · {Math.round(total * 16.67)}ms
      </span>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-2.5 h-2.5 rounded" style={{ background: color }} />
      {label}
    </span>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="p-2 rounded-md" style={{ background: 'var(--bg-primary)' }}>
      <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>{label}</div>
      <div className="text-subhead font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>{value}</div>
      {sub && <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>{sub}</div>}
    </div>
  );
}
