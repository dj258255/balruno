'use client';

/**
 * Loot/Gacha Simulator 패널 — 드롭 테이블 + 천장 시스템 시뮬.
 *
 * 디자이너 워크플로우:
 *   1. 드롭 테이블 입력 (이름, weight, rarity)
 *   2. 천장 (pity) 규칙 설정 (선택)
 *   3. pulls / simulations 지정
 *   4. 결과: 등급별 분포, 첫 SSR 평균, 천장 발동률
 */

import { useState } from 'react';
import { Dice5, Plus, Trash2, Play, Loader2 } from 'lucide-react';
import {
  runLootSimulationAsync,
  DEFAULT_GACHA_TABLE,
  DEFAULT_PITY,
  type LootItem,
  type PityRule,
  type LootSimResult,
} from '@/lib/lootSimulator';
import ProgressBar from '@/components/ui/ProgressBar';
import PanelShell from '@/components/ui/PanelShell';

interface Props {
  onClose: () => void;
}

const RARITY_COLORS: Record<string, string> = {
  N: '#94a3b8',
  R: '#3b82f6',
  SR: '#a855f7',
  SSR: '#f59e0b',
  UR: '#ef4444',
};

export default function LootSimulatorPanel({ onClose }: Props) {
  const [items, setItems] = useState<LootItem[]>(DEFAULT_GACHA_TABLE);
  const [pity, setPity] = useState<PityRule[]>(DEFAULT_PITY);
  const [pulls, setPulls] = useState(100);
  const [simulations, setSimulations] = useState(5000);

  // 피쳐드 배너 (50/50 시스템)
  const [bannerEnabled, setBannerEnabled] = useState(false);
  const [featuredItemIds, setFeaturedItemIds] = useState<Set<string>>(new Set());
  const [featuredRate, setFeaturedRate] = useState(0.5);
  const [guaranteeAfterLoss, setGuaranteeAfterLoss] = useState(true);

  // 컴플리트 분석
  const [collectRarity, setCollectRarity] = useState<string>('');

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<LootSimResult | null>(null);

  const totalWeight = items.reduce((s, it) => s + it.weight, 0);

  const updateItem = (idx: number, field: keyof LootItem, value: string | number) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: `item${Date.now()}`, name: 'New Item', weight: 1, rarity: 'N' },
    ]);
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updatePity = (idx: number, field: keyof PityRule, value: string | number | undefined) => {
    setPity((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const addPity = () => {
    setPity((prev) => [...prev, { rarity: 'SSR', threshold: 90 }]);
  };

  const removePity = (idx: number) => {
    setPity((prev) => prev.filter((_, i) => i !== idx));
  };

  const run = async () => {
    setRunning(true);
    setResult(null);
    setProgress(0);
    try {
      const res = await runLootSimulationAsync({
        items, pity, pulls, simulations,
        banner: bannerEnabled && featuredItemIds.size > 0
          ? {
              itemIds: Array.from(featuredItemIds),
              featuredRate,
              guaranteeAfterLoss,
            }
          : undefined,
        collectRarity: collectRarity || undefined,
        onProgress: setProgress,
      });
      setResult(res);
    } finally {
      setRunning(false);
    }
  };

  const toggleFeatured = (itemId: string) => {
    setFeaturedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const uniqueRarities = Array.from(new Set(items.map((i) => i.rarity)));

  return (
    <PanelShell
      title="Loot / Gacha Simulator"
      subtitle="드롭 테이블 + pity 몬테카를로"
      icon={Dice5}
      onClose={onClose}
    >
      <div className="space-y-4">
        {/* 드롭 테이블 */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>드롭 테이블</h4>
            <button onClick={addItem} className="text-xs flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--bg-tertiary)]" style={{ color: 'var(--accent)' }}>
              <Plus size={12} /> 추가
            </button>
          </div>

          <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
            합계 weight: <span className="font-mono">{totalWeight.toFixed(2)}</span> ({items.length} 아이템)
          </div>

          <div className="space-y-1 max-h-56 overflow-y-auto">
            {items.map((item, i) => (
              <div key={item.id} className="grid grid-cols-[1fr_60px_60px_24px] gap-1 items-center">
                <input
                  value={item.name}
                  onChange={(e) => updateItem(i, 'name', e.target.value)}
                  className="px-1.5 py-0.5 text-xs rounded border bg-transparent"
                  style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                />
                <input
                  type="number"
                  step="0.1"
                  value={item.weight}
                  onChange={(e) => updateItem(i, 'weight', parseFloat(e.target.value) || 0)}
                  className="px-1.5 py-0.5 text-xs rounded border bg-transparent font-mono"
                  style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                />
                <input
                  value={item.rarity}
                  onChange={(e) => updateItem(i, 'rarity', e.target.value.toUpperCase())}
                  className="px-1.5 py-0.5 text-xs rounded border bg-transparent font-mono text-center"
                  style={{
                    borderColor: 'var(--border-primary)',
                    color: RARITY_COLORS[item.rarity] ?? 'var(--text-primary)',
                  }}
                />
                <button
                  onClick={() => removeItem(i)}
                  className="p-1 rounded hover:bg-[var(--bg-tertiary)]"
                  aria-label="Remove"
                >
                  <Trash2 size={12} style={{ color: 'var(--text-secondary)' }} />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* 천장 */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>천장 (Pity) 규칙</h4>
            <button onClick={addPity} className="text-xs flex items-center gap-1 px-2 py-1 rounded hover:bg-[var(--bg-tertiary)]" style={{ color: 'var(--accent)' }}>
              <Plus size={12} /> 추가
            </button>
          </div>
          <div className="space-y-1">
            {pity.map((rule, i) => (
              <div key={i} className="grid grid-cols-[60px_60px_60px_60px_24px] gap-1 items-center">
                <input
                  value={rule.rarity}
                  onChange={(e) => updatePity(i, 'rarity', e.target.value.toUpperCase())}
                  className="px-1 py-0.5 text-xs rounded border bg-transparent font-mono text-center"
                  style={{ borderColor: 'var(--border-primary)' }}
                  title="등급"
                />
                <input
                  type="number"
                  value={rule.threshold}
                  onChange={(e) => updatePity(i, 'threshold', parseInt(e.target.value) || 1)}
                  className="px-1 py-0.5 text-xs rounded border bg-transparent font-mono"
                  style={{ borderColor: 'var(--border-primary)' }}
                  title="hard pity 임계"
                />
                <input
                  type="number"
                  placeholder="soft"
                  value={rule.softFromPull ?? ''}
                  onChange={(e) => updatePity(i, 'softFromPull', e.target.value ? parseInt(e.target.value) : undefined)}
                  className="px-1 py-0.5 text-xs rounded border bg-transparent font-mono"
                  style={{ borderColor: 'var(--border-primary)' }}
                  title="soft pity 시작"
                />
                <input
                  type="number"
                  step="0.1"
                  placeholder="x"
                  value={rule.softMultiplier ?? ''}
                  onChange={(e) => updatePity(i, 'softMultiplier', e.target.value ? parseFloat(e.target.value) : undefined)}
                  className="px-1 py-0.5 text-xs rounded border bg-transparent font-mono"
                  style={{ borderColor: 'var(--border-primary)' }}
                  title="soft 배율"
                />
                <button onClick={() => removePity(i)} className="p-1 rounded hover:bg-[var(--bg-tertiary)]">
                  <Trash2 size={12} style={{ color: 'var(--text-secondary)' }} />
                </button>
              </div>
            ))}
            <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
              순서: 등급 / hard pity 임계 / soft pity 시작 (선택) / soft 배율 (선택)
            </p>
          </div>
        </section>

        {/* 피쳐드 50/50 */}
        <section className="space-y-2 p-2 rounded border" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)' }}>
          <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--text-primary)' }}>
            <input
              type="checkbox"
              checked={bannerEnabled}
              onChange={(e) => setBannerEnabled(e.target.checked)}
            />
            <span className="font-semibold">피쳐드 배너 (50/50 시스템)</span>
          </label>
          {bannerEnabled && (
            <div className="space-y-2 pl-5">
              <div>
                <div className="text-[10px] mb-1" style={{ color: 'var(--text-secondary)' }}>피쳐드 아이템 (클릭 토글)</div>
                <div className="flex flex-wrap gap-1">
                  {items.map((it) => (
                    <button
                      key={it.id}
                      onClick={() => toggleFeatured(it.id)}
                      className="text-[10px] px-1.5 py-0.5 rounded border"
                      style={{
                        borderColor: featuredItemIds.has(it.id)
                          ? RARITY_COLORS[it.rarity] ?? 'var(--accent)'
                          : 'var(--border-primary)',
                        background: featuredItemIds.has(it.id)
                          ? `${RARITY_COLORS[it.rarity] ?? 'var(--accent)'}22`
                          : 'transparent',
                        color: featuredItemIds.has(it.id)
                          ? RARITY_COLORS[it.rarity] ?? 'var(--text-primary)'
                          : 'var(--text-secondary)',
                      }}
                    >
                      {it.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs w-28" style={{ color: 'var(--text-secondary)' }}>피쳐드 확률</label>
                <input
                  type="number"
                  step="0.05"
                  min={0}
                  max={1}
                  value={featuredRate}
                  onChange={(e) => setFeaturedRate(Math.max(0, Math.min(1, parseFloat(e.target.value) || 0)))}
                  className="flex-1 px-2 py-0.5 text-xs rounded border bg-transparent font-mono"
                  style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
                />
                <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                  {(featuredRate * 100).toFixed(0)}%
                </span>
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: 'var(--text-primary)' }}>
                <input
                  type="checkbox"
                  checked={guaranteeAfterLoss}
                  onChange={(e) => setGuaranteeAfterLoss(e.target.checked)}
                />
                <span>50/50 패배 후 다음 SSR 피쳐드 확정 (Genshin)</span>
              </label>
            </div>
          )}
        </section>

        {/* 컴플리트 분석 */}
        <section className="space-y-1.5 p-2 rounded border" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)' }}>
          <div className="flex items-center gap-2">
            <label className="text-xs w-28" style={{ color: 'var(--text-secondary)' }}>컴플리트 등급</label>
            <select
              value={collectRarity}
              onChange={(e) => setCollectRarity(e.target.value)}
              className="flex-1 px-2 py-0.5 text-xs rounded border bg-transparent font-mono"
              style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
            >
              <option value="">— 분석 안 함 —</option>
              {uniqueRarities.map((r) => (
                <option key={r} value={r}>{r} 전체 수집 확률</option>
              ))}
            </select>
          </div>
          <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
            선택한 등급의 모든 아이템을 한 번 이상 뽑을 확률을 측정합니다.
          </p>
        </section>

        {/* 시뮬 설정 */}
        <section className="space-y-1.5 p-2 rounded border" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)' }}>
          <div className="flex items-center gap-2">
            <label className="text-xs w-24" style={{ color: 'var(--text-secondary)' }}>한 번당 뽑기</label>
            <input
              type="number"
              value={pulls}
              min={1}
              onChange={(e) => setPulls(Math.max(1, parseInt(e.target.value) || 1))}
              className="flex-1 px-2 py-0.5 text-xs rounded border bg-transparent font-mono"
              style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs w-24" style={{ color: 'var(--text-secondary)' }}>시뮬레이션 횟수</label>
            <input
              type="number"
              value={simulations}
              min={100}
              max={50000}
              step={100}
              onChange={(e) => setSimulations(Math.max(100, parseInt(e.target.value) || 100))}
              className="flex-1 px-2 py-0.5 text-xs rounded border bg-transparent font-mono"
              style={{ borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}
            />
          </div>
        </section>

        <button
          onClick={run}
          disabled={running || items.length === 0}
          className="w-full px-3 py-2 rounded text-xs font-semibold flex items-center justify-center gap-2"
          style={{
            background: running ? 'var(--bg-tertiary)' : 'var(--accent)',
            color: running ? 'var(--text-secondary)' : 'white',
          }}
        >
          {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {running ? '시뮬레이션 중...' : `${simulations.toLocaleString()} 회 실행`}
        </button>

        {running && (
          <ProgressBar
            value={progress}
            label="Monte Carlo 진행"
            detail={`${Math.round(progress * simulations).toLocaleString()} / ${simulations.toLocaleString()}`}
          />
        )}

        {result && <Results result={result} />}
      </div>
    </PanelShell>
  );
}

function Results({ result }: { result: LootSimResult }) {
  const maxAvg = Math.max(...result.rarityStats.map((r) => r.p95), 1);

  return (
    <div className="space-y-3">
      {/* 핵심 지표 */}
      <div className="grid grid-cols-2 gap-2">
        <Card label="평균 첫 SSR" value={result.avgFirstRarePull > 0 ? `${result.avgFirstRarePull.toFixed(1)}연` : 'N/A'} />
        <Card
          label="천장 발동/시뮬"
          value={Object.keys(result.pityActivationRate).length > 0
            ? Object.entries(result.pityActivationRate).map(([r, v]) => `${r}: ${v.toFixed(2)}회`).join(', ')
            : '없음'}
        />
      </div>

      {/* 피쳐드 50/50 통계 */}
      {result.featuredStats && (
        <section className="p-2 rounded border space-y-1.5" style={{ borderColor: 'var(--primary-purple)', background: 'var(--primary-purple-light)' }}>
          <h4 className="text-xs font-semibold" style={{ color: 'var(--primary-purple)' }}>
            피쳐드 배너 (50/50) 통계
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <Card
              label="평균 피쳐드 획득"
              value={`${result.featuredStats.avgFeaturedCount.toFixed(2)}회`}
            />
            <Card
              label="평균 비피쳐드"
              value={`${result.featuredStats.avgNonFeaturedCount.toFixed(2)}회`}
            />
            <Card
              label="첫 피쳐드까지"
              value={result.featuredStats.avgFirstFeaturedPull > 0
                ? `${result.featuredStats.avgFirstFeaturedPull.toFixed(1)}연`
                : 'N/A'}
            />
            <Card
              label="첫 SSR = 피쳐드 확률"
              value={`${(result.featuredStats.winRateAtFirstSSR * 100).toFixed(1)}%`}
            />
          </div>
        </section>
      )}

      {/* 컴플리트 */}
      {result.completeRate !== undefined && (
        <section className="p-2 rounded border" style={{ borderColor: '#f59e0b', background: 'rgba(245, 158, 11, 0.08)' }}>
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold" style={{ color: '#f59e0b' }}>전체 수집 확률</span>
            <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
              {(result.completeRate * 100).toFixed(1)}%
            </span>
          </div>
        </section>
      )}

      {/* 등급별 분포 */}
      <section className="space-y-1.5">
        <h4 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
          등급별 분포 ({result.totalPulls}회 ×{result.totalSimulations.toLocaleString()} 시뮬)
        </h4>
        {result.rarityStats.map((rs) => (
          <div key={rs.rarity} className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-mono font-semibold" style={{ color: RARITY_COLORS[rs.rarity] ?? 'var(--text-primary)' }}>
                {rs.rarity}
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                평균 <span className="font-mono">{rs.avgCount.toFixed(2)}</span>회
                · P5/P50/P95 <span className="font-mono">{rs.p5}/{rs.p50}/{rs.p95}</span>
                · 1+확률 <span className="font-mono">{(rs.atLeastOneRate * 100).toFixed(1)}%</span>
              </span>
            </div>
            <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
              <div
                className="absolute inset-y-0 left-0"
                style={{
                  width: `${(rs.avgCount / maxAvg) * 100}%`,
                  background: RARITY_COLORS[rs.rarity] ?? 'var(--accent)',
                }}
              />
            </div>
          </div>
        ))}
      </section>

      {/* Top items */}
      <section className="space-y-1">
        <h4 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>가장 많이 뽑힌 아이템 Top 5</h4>
        {result.topItems.map((it) => (
          <div key={it.name} className="flex items-center justify-between text-[11px]">
            <span style={{ color: 'var(--text-primary)' }}>{it.name}</span>
            <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
              {it.count.toLocaleString()} ({(it.rate * 100).toFixed(2)}%)
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 rounded border" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)' }}>
      <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{label}</div>
      <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}
