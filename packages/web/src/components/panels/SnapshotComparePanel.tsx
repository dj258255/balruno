'use client';

/**
 * 시뮬 스냅샷 비교 패널 — rebalance 전후 / A/B 테스트 diff view.
 *
 * 기능:
 *  - 저장된 스냅샷 목록 (localStorage 기반)
 *  - 2 개 선택 → metric diff 표 (before/after/delta/deltaPct)
 *  - 색상: 개선(녹색) / 악화(빨강) / 중립(회색)
 *  - 샘플 시나리오 "현재 기본 시뮬 저장" 버튼으로 빠른 체험
 */

import { useState, useEffect, useMemo } from 'react';
import { Camera, Plus, Trash2, ArrowRight, TrendingUp, TrendingDown, Minus, Save, Pencil } from 'lucide-react';
import PanelShell from '@/components/ui/PanelShell';
import {
  loadSnapshots,
  saveSnapshot,
  deleteSnapshot,
  renameSnapshot,
  diffSnapshots,
  classifyChange,
  inferDirection,
  type SimSnapshot,
  type SnapshotDomain,
} from '@/lib/simSnapshots';
import { simulateBattle } from '@/lib/simulation/battleEngine';
import { useTranslations } from 'next-intl';

interface Props {
  onClose: () => void;
}

// ============================================================================
// 데모용 샘플 시뮬 러너
// ============================================================================

function captureDemoUnitSnapshot(label: string, atk: number, def: number): Omit<SimSnapshot, 'id' | 'createdAt'> {
  const t = useTranslations();
  const unit1 = { id: 'a', name: t('snapshotCompare.demoHero'), hp: 800, maxHp: 800, atk, def, speed: 1.2 };
  const unit2 = { id: 'b', name: t('snapshotCompare.demoBoss'), hp: 1200, maxHp: 1200, atk: 60, def: 20, speed: 0.8 };

  // 200 런 Monte Carlo
  let aWins = 0;
  let durSum = 0;
  let dmgSum = 0;
  const runs = 200;
  for (let i = 0; i < runs; i++) {
    const r = simulateBattle(unit1, unit2, [], [], { maxDuration: 120, timeStep: 0.1 });
    if (r.winner === 'unit1') aWins++;
    durSum += r.duration;
    dmgSum += r.unit1TotalDamage;
  }

  return {
    name: label,
    domain: 'unit' as SnapshotDomain,
    config: { atk, def, unit1, unit2 },
    metrics: {
      winRate: aWins / runs,
      avgDuration: durSum / runs,
      avgTotalDamage: dmgSum / runs,
    },
  };
}

// ============================================================================
// 메인 패널
// ============================================================================

export default function SnapshotComparePanel({ onClose }: Props) {
  const t = useTranslations();
  const [snapshots, setSnapshots] = useState<SimSnapshot[]>([]);
  const [selectedIds, setSelectedIds] = useState<[string | null, string | null]>([null, null]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // localStorage 에서 초기 로드
  useEffect(() => {
    setSnapshots(loadSnapshots());
  }, []);

  const reload = () => setSnapshots(loadSnapshots());

  const saveDemo = (label: string, atk: number, def: number) => {
    saveSnapshot(captureDemoUnitSnapshot(label, atk, def));
    reload();
  };

  const handleDelete = (id: string) => {
    deleteSnapshot(id);
    setSelectedIds(([a, b]) => [a === id ? null : a, b === id ? null : b]);
    reload();
  };

  const handleRename = (id: string, name: string) => {
    renameSnapshot(id, name);
    setEditingId(null);
    reload();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(([a, b]) => {
      if (a === id) return [null, b];
      if (b === id) return [a, null];
      if (a === null) return [id, b];
      if (b === null) return [a, id];
      // 둘 다 있으면 오래된 걸 교체
      return [b, id];
    });
  };

  const before = snapshots.find((s) => s.id === selectedIds[0]) ?? null;
  const after = snapshots.find((s) => s.id === selectedIds[1]) ?? null;
  const diff = useMemo(() => {
    if (!before || !after) return null;
    return diffSnapshots(before, after);
  }, [before, after]);

  return (
    <PanelShell
      title={t('snapshotCompare.titleHeader')}
      subtitle={t('snapshotCompare.subtitleHeader')}
      icon={Camera}
      iconColor="#ec4899"
      onClose={onClose}
      bodyClassName="p-3 space-y-3 overflow-y-auto"
    >
      {/* 데모 스냅샷 저장 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="text-label font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
          {t('snapshotCompare.demoFastSection')}
        </div>
        <div className="flex gap-1 flex-wrap">
          <DemoButton label={t('snapshotCompare.demoBaseLabel')}   onClick={() => saveDemo(t('snapshotCompare.demoBaseName'), 80, 10)} />
          <DemoButton label={t('snapshotCompare.demoAtkBuffLabel')} onClick={() => saveDemo(t('snapshotCompare.demoAtkBuffName'), 100, 10)} />
          <DemoButton label={t('snapshotCompare.demoDefNerfLabel')} onClick={() => saveDemo(t('snapshotCompare.demoDefNerfName'), 80, 5)} />
          <DemoButton label={t('snapshotCompare.demoTankLabel')} onClick={() => saveDemo(t('snapshotCompare.demoTankName'), 60, 25)} />
        </div>
      </div>

      {/* 스냅샷 목록 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-label font-medium" style={{ color: 'var(--text-primary)' }}>
            {t('snapshotCompare.savedSnapshots', { n: snapshots.length })}
          </span>
          <span className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
            {t('snapshotCompare.pickTwoForCompare')}
          </span>
        </div>
        {snapshots.length === 0 ? (
          <p className="text-caption italic text-center py-6" style={{ color: 'var(--text-tertiary)' }}>
            {t('snapshotCompare.createFirstSnap')}
          </p>
        ) : (
          <div className="space-y-1">
            {snapshots.map((snap) => {
              const role = selectedIds[0] === snap.id ? 'before'
                         : selectedIds[1] === snap.id ? 'after' : null;
              const date = new Date(snap.createdAt);
              return (
                <div
                  key={snap.id}
                  className="flex items-center gap-2 p-1.5 rounded-md transition-colors"
                  style={{
                    background: role ? (role === 'before' ? '#3b82f620' : '#ec489920') : 'var(--bg-primary)',
                    border: role ? `1px solid ${role === 'before' ? '#3b82f6' : '#ec4899'}` : '1px solid transparent',
                  }}
                >
                  {role && (
                    <span
                      className="text-caption font-bold px-1.5 rounded"
                      style={{ background: role === 'before' ? '#3b82f6' : '#ec4899', color: 'white' }}
                    >
                      {role === 'before' ? 'A' : 'B'}
                    </span>
                  )}
                  {editingId === snap.id ? (
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => handleRename(snap.id, editName.trim() || snap.name)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(snap.id, editName.trim() || snap.name);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      className="input-compact flex-1 min-w-0"
                    />
                  ) : (
                    <button
                      onClick={() => toggleSelect(snap.id)}
                      className="flex-1 min-w-0 text-left text-label font-medium truncate"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {snap.name}
                    </button>
                  )}
                  <span className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
                    {snap.domain}
                  </span>
                  <span className="text-caption tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                    {date.getMonth() + 1}/{date.getDate()} {date.getHours()}:{date.getMinutes().toString().padStart(2, '0')}
                  </span>
                  <button
                    onClick={() => { setEditingId(snap.id); setEditName(snap.name); }}
                    className="p-1 rounded hover:bg-[var(--bg-tertiary)]"
                    title={t('snapshotCompare.renameTitle')}
                  >
                    <Pencil className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
                  </button>
                  <button
                    onClick={() => handleDelete(snap.id)}
                    className="p-1 rounded hover:bg-[var(--bg-tertiary)]"
                    title={t('snapshotCompare.deleteTitle')}
                  >
                    <Trash2 className="w-3 h-3" style={{ color: 'var(--text-tertiary)' }} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Diff 결과 */}
      {before && after && diff && (
        <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1 text-label">
              <span className="px-2 py-0.5 rounded font-bold" style={{ background: '#3b82f6', color: 'white' }}>A</span>
              <span style={{ color: 'var(--text-primary)' }}>{before.name}</span>
            </span>
            <ArrowRight className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
            <span className="inline-flex items-center gap-1 text-label">
              <span className="px-2 py-0.5 rounded font-bold" style={{ background: '#ec4899', color: 'white' }}>B</span>
              <span style={{ color: 'var(--text-primary)' }}>{after.name}</span>
            </span>
          </div>
          <table className="w-full text-caption">
            <thead>
              <tr style={{ color: 'var(--text-tertiary)' }}>
                <th className="text-left px-2 py-1">{t('snapshotCompare.metricLabel')}</th>
                <th className="text-right px-2 py-1">Before (A)</th>
                <th className="text-right px-2 py-1">After (B)</th>
                <th className="text-right px-2 py-1">Δ</th>
                <th className="text-right px-2 py-1">%</th>
              </tr>
            </thead>
            <tbody>
              {diff.rows.map((row) => {
                const dir = inferDirection(row.key);
                const cls = classifyChange(row.delta, dir);
                const color = cls === 'improved' ? '#10b981' : cls === 'regressed' ? '#ef4444' : '#6b7280';
                const Icon = cls === 'improved' ? TrendingUp : cls === 'regressed' ? TrendingDown : Minus;
                return (
                  <tr key={row.key} style={{ borderTop: '1px solid var(--border-primary)' }}>
                    <td className="px-2 py-1 font-medium" style={{ color: 'var(--text-primary)' }}>
                      {row.key}
                      <span className="ml-1 text-caption" style={{ color: 'var(--text-tertiary)' }}>
                        ({dir === 'higher-better' ? '↑' : '↓'} better)
                      </span>
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      {row.before.toFixed(2)}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      {row.after.toFixed(2)}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums font-semibold" style={{ color }}>
                      <Icon className="w-3 h-3 inline mr-1" />
                      {row.delta >= 0 ? '+' : ''}{row.delta.toFixed(2)}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums font-semibold" style={{ color }}>
                      {row.deltaPct === null ? '—' : `${row.deltaPct >= 0 ? '+' : ''}${row.deltaPct.toFixed(1)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {diff.rows.length === 0 && (
            <p className="text-caption italic text-center py-4" style={{ color: 'var(--text-tertiary)' }}>
              {t('snapshotCompare.noCommonMetric')}
            </p>
          )}
        </div>
      )}

      {(!before || !after) && snapshots.length >= 2 && (
        <p className="text-caption italic text-center" style={{ color: 'var(--text-tertiary)' }}>
          {t('snapshotCompare.pickBeforeAfter')}
        </p>
      )}

      <p className="text-caption italic" style={{ color: 'var(--text-tertiary)' }}>
        {t('snapshotCompare.storageNote')}
      </p>
    </PanelShell>
  );
}

function DemoButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2 py-1 rounded text-caption"
      style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}
    >
      <Save className="w-3 h-3" /> {label}
    </button>
  );
}
