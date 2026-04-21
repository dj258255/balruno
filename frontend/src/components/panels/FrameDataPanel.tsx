'use client';

/**
 * 격투 프레임 데이터 패널 — Street Fighter / Tekken / Guilty Gear 밸런싱.
 * 기술 분석 + 콤보 라우트 검증.
 */

import { useState, useMemo } from 'react';
import { Zap, Plus, Trash2 } from 'lucide-react';
import PanelShell from '@/components/ui/PanelShell';
import { analyzeMove, analyzeComboRoute, MOVE_PRESETS, type FrameData } from '@/lib/frameData';

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
  'heavily-plus': '크게 유리',
  'plus': '유리',
  'neutral': '호각',
  'minus': '불리',
  'heavily-minus': '크게 불리',
};

export default function FrameDataPanel({ onClose }: Props) {
  const [moves, setMoves] = useState<FrameData[]>(MOVE_PRESETS);
  const [routeIds, setRouteIds] = useState<string[]>(['lp', 'mp', 'hadouken']);

  const routeMoves = useMemo(() => routeIds.map((id) => moves.find((m) => m.id === id)).filter(Boolean) as FrameData[], [routeIds, moves]);
  const routeResult = useMemo(() => analyzeComboRoute(routeMoves), [routeMoves]);

  const updateMove = <K extends keyof FrameData>(idx: number, key: K, value: FrameData[K]) => {
    setMoves((prev) => prev.map((m, i) => (i === idx ? { ...m, [key]: value } : m)));
  };

  const addMove = () => {
    setMoves((prev) => [
      ...prev,
      { id: `move-${Date.now()}`, name: '신규 기술', startup: 7, active: 3, recovery: 14, hitstun: 17, blockstun: 13, damage: 50 },
    ]);
  };

  const removeMove = (id: string) => setMoves((prev) => prev.filter((m) => m.id !== id));
  const addToRoute = (id: string) => setRouteIds((prev) => [...prev, id]);
  const removeFromRoute = (idx: number) => setRouteIds((prev) => prev.filter((_, i) => i !== idx));

  return (
    <PanelShell
      title="프레임 데이터 시뮬"
      subtitle="격투게임 · 유리/불리 · 콤보 라우트"
      icon={Zap}
      iconColor="#f59e0b"
      onClose={onClose}
      bodyClassName="p-3 space-y-3 overflow-y-auto"
    >
      {/* 기술 목록 + 분석 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-label font-medium" style={{ color: 'var(--text-primary)' }}>
            기술 목록 ({moves.length})
          </span>
          <button onClick={addMove} className="btn-primary text-caption inline-flex items-center gap-1">
            <Plus className="w-3 h-3" /> 추가
          </button>
        </div>
        <div className="space-y-1 max-h-80 overflow-y-auto">
          <div className="grid grid-cols-12 gap-1 text-caption px-2" style={{ color: 'var(--text-tertiary)' }}>
            <div className="col-span-3">이름</div>
            <div className="col-span-1 text-center">발</div>
            <div className="col-span-1 text-center">유</div>
            <div className="col-span-1 text-center">경</div>
            <div className="col-span-1 text-center">피</div>
            <div className="col-span-1 text-center">피스</div>
            <div className="col-span-1 text-center">가스</div>
            <div className="col-span-1 text-center">H+</div>
            <div className="col-span-1 text-center">B+</div>
            <div className="col-span-1"></div>
          </div>
          {moves.map((m, idx) => {
            const a = analyzeMove(m);
            return (
              <div key={m.id} className="grid grid-cols-12 gap-1 items-center p-1.5 rounded-md" style={{ background: 'var(--bg-primary)' }}>
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
                  title={`${TIER_LABEL[a.advantageBlock]} (${a.onBlock >= 0 ? '+' : ''}${a.onBlock})${a.punishableOnBlock ? ' — 펀시 가능' : ''}`}
                >
                  {a.onBlock >= 0 ? `+${a.onBlock}` : a.onBlock}
                </span>
                <div className="col-span-1 flex items-center gap-0.5">
                  <button onClick={() => addToRoute(m.id)} className="p-0.5 rounded hover:bg-[var(--bg-hover)]" title="콤보에 추가">
                    <Plus className="w-3 h-3" style={{ color: 'var(--accent)' }} />
                  </button>
                  <button onClick={() => removeMove(m.id)} className="p-0.5 rounded hover:bg-[var(--bg-hover)]">
                    <Trash2 className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 콤보 라우트 분석 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-label font-medium" style={{ color: 'var(--text-primary)' }}>
            콤보 라우트
          </span>
          <span
            className="text-caption font-semibold px-2 py-0.5 rounded"
            style={{
              background: routeResult.feasible ? '#10b98130' : '#ef444430',
              color: routeResult.feasible ? '#10b981' : '#ef4444',
            }}
          >
            {routeResult.feasible ? '연결 가능' : '연결 불가'}
          </span>
        </div>

        {routeMoves.length === 0 ? (
          <p className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
            기술 옆 + 버튼으로 콤보 추가
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
              <Metric label="총 피해" value={routeResult.totalDamage.toString()} />
              <Metric label="총 프레임" value={`${routeResult.totalFrames}f`} sub={`${(routeResult.totalFrames * 16.67).toFixed(0)}ms`} />
              <Metric label="기술 수" value={routeMoves.length.toString()} />
            </div>
          </>
        )}
      </div>

      <div className="text-caption italic" style={{ color: 'var(--text-tertiary)' }}>
        발=발동, 유=유지, 경=경직, 피=피해, 피스=피격경직, 가스=가드경직, H+=onHit, B+=onBlock · 60fps 기준 (1f = 16.67ms)
      </div>
    </PanelShell>
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
