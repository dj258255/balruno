'use client';

/**
 * Auto Battler 시뮬 패널 — TFT / HS Battlegrounds 경제 vs 템포 trade-off.
 */

import { useState, useMemo } from 'react';
import { Dices, Coins, TrendingUp, Trophy } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import PanelShell from '@/components/ui/PanelShell';
import {
  simulateAutoBattler,
  compareStrategies,
  defaultAutoBattlerConfig,
  type AutoBattlerStrategy,
} from '@/lib/autoBattler';
import { useTranslations } from 'next-intl';

interface Props {
  onClose: () => void;
}

const STRATEGY_LABEL: Record<AutoBattlerStrategy, string> = {
  'greedy-econ': 'autoBattler.stratGreedy',
  'fast-level': 'autoBattler.stratFastLevel',
  'balanced': 'autoBattler.stratBalanced',
};

const STRATEGY_COLOR: Record<AutoBattlerStrategy, string> = {
  'greedy-econ': '#f59e0b',
  'fast-level': '#ef4444',
  'balanced': '#8b5cf6',
};

export default function AutoBattlerPanel({ onClose }: Props) {
  const t = useTranslations();
  const [strategy, setStrategy] = useState<AutoBattlerStrategy>('balanced');
  const [runs, setRuns] = useState(200);
  const [seed, setSeed] = useState(0);

  const singleRun = useMemo(() => {
    void seed;
    return simulateAutoBattler(defaultAutoBattlerConfig(strategy));
  }, [strategy, seed]);

  const comparison = useMemo(
    () => compareStrategies(defaultAutoBattlerConfig('balanced'), runs),
    [runs, seed],
  );

  const roundData = singleRun.rounds.map((r) => ({
    round: r.round,
    gold: r.gold,
    level: r.level,
    power: r.teamPower,
    hp: r.hp,
    winLoss: r.won ? 1 : 0,
  }));

  return (
    <PanelShell
      title={t('autoBattler.titleHeader')}
      subtitle={t('autoBattler.subtitleHeader')}
      icon={Dices}
      iconColor="#f59e0b"
      onClose={onClose}
      bodyClassName="p-3 space-y-3 overflow-y-auto"
    >
      {/* 전략 탭 */}
      <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        {(['greedy-econ', 'fast-level', 'balanced'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStrategy(s)}
            className="flex-1 py-2 rounded text-label font-medium"
            style={{
              background: strategy === s ? STRATEGY_COLOR[s] : 'transparent',
              color: strategy === s ? 'white' : 'var(--text-secondary)',
            }}
          >
            {t(STRATEGY_LABEL[s] as 'autoBattler.stratGreedy')}
          </button>
        ))}
      </div>

      {/* 단일 run 요약 */}
      <div className="grid grid-cols-4 gap-2">
        <Stat
          label={t('autoBattler.finalRank')}
          value={t('autoBattler.rankSuffix', { n: singleRun.placement })}
          sub={singleRun.survived ? t('autoBattler.survivedLabel') : t('autoBattler.hp0Label')}
          color={singleRun.placement === 1 ? '#fbbf24' : singleRun.placement <= 4 ? '#10b981' : '#ef4444'}
          icon={Trophy}
        />
        <Stat
          label={t('autoBattler.powerSpike')}
          value={`R${singleRun.peakPowerRound}`}
          sub={t('autoBattler.powerSpikeAvg', { avg: Math.round(singleRun.avgPower) })}
          color="#8b5cf6"
          icon={TrendingUp}
        />
        <Stat
          label={t('autoBattler.totalInterest')}
          value={`+${singleRun.totalInterestEarned}g`}
          sub={t('autoBattler.totalInterestSub')}
          color="#f59e0b"
          icon={Coins}
        />
        <Stat
          label={t('autoBattler.rerollCost')}
          value={`-${singleRun.totalRerollSpent}g`}
          sub={t('autoBattler.rerollCostSub')}
          color="#ef4444"
          icon={Dices}
        />
      </div>

      {/* 라운드 차트 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="text-label font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
          {t('autoBattler.roundChartTitle')}
        </div>
        <div className="h-56">
          <ResponsiveContainer>
            <LineChart data={roundData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
              <XAxis dataKey="round" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="l" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line yAxisId="l" type="monotone" dataKey="gold" stroke="#f59e0b" strokeWidth={2} name="Gold" dot={false} />
              <Line yAxisId="l" type="monotone" dataKey="power" stroke="#8b5cf6" strokeWidth={2} name="Team Power" dot={false} />
              <Line yAxisId="r" type="monotone" dataKey="hp" stroke="#ef4444" strokeWidth={2} name="HP" dot={false} />
              <Line yAxisId="r" type="stepAfter" dataKey="level" stroke="#10b981" strokeWidth={2} name="Level" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-1 mt-2 flex-wrap">
          <span className="text-caption" style={{ color: 'var(--text-tertiary)' }}>{t('autoBattler.roundWlLabel')}</span>
          {singleRun.rounds.map((r) => (
            <span
              key={r.round}
              className="w-4 h-4 rounded text-caption text-center leading-4 font-bold text-white"
              style={{ background: r.won ? '#10b981' : '#ef4444' }}
              title={t('autoBattler.roundTooltip', { r: r.round, wl: r.won ? t('autoBattler.winShort') : t('autoBattler.lossShort'), lvl: r.level, pw: r.teamPower })}
            >
              {r.won ? 'W' : 'L'}
            </span>
          ))}
        </div>
        <button onClick={() => setSeed((s) => s + 1)} className="mt-2 text-caption px-2 py-1 rounded" style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
          {t('autoBattler.rerunSeed')}
        </button>
      </div>

      {/* 전략 비교 */}
      <div className="p-3 rounded-lg" style={{ background: 'var(--bg-tertiary)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-label font-medium" style={{ color: 'var(--text-primary)' }}>
            {t('autoBattler.stratCompare', { n: runs })}
          </span>
          <div className="flex items-center gap-2">
            <input
              type="range" min={50} max={1000} step={50}
              value={runs} onChange={(e) => setRuns(parseInt(e.target.value))}
              className="w-24" style={{ accentColor: 'var(--accent)' }}
            />
            <span className="text-caption tabular-nums w-12" style={{ color: 'var(--text-primary)' }}>{runs}</span>
          </div>
        </div>

        {/* Comparison bar chart */}
        <div className="h-48 mb-2">
          <ResponsiveContainer>
            <BarChart data={comparison.map((r) => ({
              strategy: t(STRATEGY_LABEL[r.strategy] as 'autoBattler.stratGreedy'),
              [t('autoBattler.avgRank')]: Math.round(r.avgPlacement * 10) / 10,
              [t('autoBattler.winRatePct')]: Math.round(r.winRate * 100),
              'Top 4 (%)': Math.round(r.top4Rate * 100),
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
              <XAxis dataKey="strategy" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey={t('autoBattler.avgRank')} fill="#ef4444" />
              <Bar dataKey={t('autoBattler.winRatePct')} fill="#fbbf24" />
              <Bar dataKey="Top 4 (%)" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <table className="w-full text-caption">
          <thead>
            <tr style={{ color: 'var(--text-tertiary)' }}>
              <th className="text-left px-2 py-1">{t('autoBattler.tableStrategy')}</th>
              <th className="text-right px-2 py-1">{t('autoBattler.avgRank')}</th>
              <th className="text-right px-2 py-1">{t('autoBattler.tableTopOne')}</th>
              <th className="text-right px-2 py-1">Top 4</th>
              <th className="text-right px-2 py-1">{t('autoBattler.tableAvgHp')}</th>
              <th className="text-right px-2 py-1">{t('autoBattler.tableAvgPeak')}</th>
            </tr>
          </thead>
          <tbody>
            {comparison.map((r) => (
              <tr key={r.strategy} style={{ borderTop: '1px solid var(--border-primary)' }}>
                <td className="px-2 py-1 font-semibold" style={{ color: STRATEGY_COLOR[r.strategy] }}>
                  {t(STRATEGY_LABEL[r.strategy] as 'autoBattler.stratGreedy')}
                </td>
                <td className="px-2 py-1 text-right tabular-nums">{r.avgPlacement.toFixed(2)}</td>
                <td className="px-2 py-1 text-right tabular-nums">{Math.round(r.winRate * 100)}%</td>
                <td className="px-2 py-1 text-right tabular-nums">{Math.round(r.top4Rate * 100)}%</td>
                <td className="px-2 py-1 text-right tabular-nums">{Math.round(r.avgHp)}</td>
                <td className="px-2 py-1 text-right tabular-nums">{Math.round(r.avgPeakPower)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-caption italic" style={{ color: 'var(--text-tertiary)' }}>
        {t('autoBattler.tftReference')}
      </p>
    </PanelShell>
  );
}

function Stat({ label, value, sub, color, icon: Icon }: { label: string; value: string; sub?: string; color: string; icon: typeof Dices }) {
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
