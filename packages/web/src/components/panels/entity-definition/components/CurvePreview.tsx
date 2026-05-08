import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceDot,
} from 'recharts';
import type { EntityDefinition, StatOverride } from '@/types';

interface CurvePreviewProps {
  entity: EntityDefinition;
  curveData: Record<string, { level: number; value: number; isOverridden?: boolean }[]>;
  overrides?: StatOverride[];
}

const STAT_COLORS: Record<string, string> = {
  HP: '#22c55e',
  ATK: '#ef4444',
  DEF: '#3b82f6',
  SPD: '#f59e0b',
  CRIT: '#a855f7',
};

export default function CurvePreview({ entity, curveData, overrides = [] }: CurvePreviewProps) {
  const t = useTranslations('entityDefinition');
  // 모든 스탯 데이터를 하나의 배열로 통합 (차트용)
  const chartData = useMemo(() => {
    const statNames = Object.keys(curveData);
    if (statNames.length === 0) return [];

    const firstStat = curveData[statNames[0]];
    if (!firstStat) return [];

    return firstStat.map((point, index) => {
      const dataPoint: Record<string, number | boolean> = { level: point.level };

      for (const statName of statNames) {
        const statData = curveData[statName];
        if (statData && statData[index]) {
          dataPoint[statName] = statData[index].value;
          dataPoint[`${statName}_overridden`] = statData[index].isOverridden || false;
        }
      }

      return dataPoint;
    });
  }, [curveData]);

  // 오버라이드 포인트들 추출 (차트에 마커로 표시)
  const overridePoints = useMemo(() => {
    const points: { level: number; statName: string; value: number; color: string }[] = [];

    for (const override of overrides) {
      for (const [statName, value] of Object.entries(override.stats)) {
        if (value !== undefined) {
          points.push({
            level: override.level,
            statName,
            value,
            color: STAT_COLORS[statName] || '#888',
          });
        }
      }
    }

    return points;
  }, [overrides]);

  const statNames = Object.keys(curveData);

  if (statNames.length === 0) {
    return (
      <div
        className="p-4 rounded-lg text-center text-sm"
        style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}
      >
        {t('noCurveData')}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
        {t('curvePreview')}
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap gap-3">
        {statNames.map((statName) => {
          const curve = entity.growthCurves[statName];
          const color = STAT_COLORS[statName] || '#888';
          const hasOverride = overridePoints.some(p => p.statName === statName);

          return (
            <div key={statName} className="flex items-center gap-1.5 text-xs">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ background: color }}
              />
              <span style={{ color: 'var(--text-secondary)' }}>
                {statName}
              </span>
              {curve && (
                <span style={{ color: 'var(--text-tertiary)' }}>
                  ({curve.curveType}, ×{curve.growthRate})
                </span>
              )}
              {hasOverride && (
                <span
                  className="px-1 rounded text-caption"
                  style={{ background: `${color}20`, color }}
                >
                  {t('overrideBadge')}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* 오버라이드 안내 */}
      {overridePoints.length > 0 && (
        <div
          className="flex items-center gap-2 text-xs px-2 py-1.5 rounded"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}
        >
          <div className="w-3 h-3 rounded-full border-2 border-white" style={{ background: '#888' }} />
          <span>{t('overrideHelp', { count: overridePoints.length })}</span>
        </div>
      )}

      {/* 차트 */}
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border-primary)"
              opacity={0.5}
            />
            <XAxis
              dataKey="level"
              tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-primary)' }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--text-tertiary)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-primary)' }}
              width={50}
              tickFormatter={(value) => {
                if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
                return value;
              }}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-primary)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              labelStyle={{ color: 'var(--text-primary)' }}
              formatter={(value: number, name: string) => [
                value.toLocaleString(),
                name,
              ]}
              labelFormatter={(label) => t('levelLabel', { n: label as number })}
            />
            {statNames.map((statName) => (
              <Line
                key={statName}
                type="monotone"
                dataKey={statName}
                stroke={STAT_COLORS[statName] || '#888'}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
            {/* 오버라이드 포인트 마커 */}
            {overridePoints.map((point, index) => (
              <ReferenceDot
                key={`override-${index}`}
                x={point.level}
                y={point.value}
                r={6}
                fill={point.color}
                stroke="white"
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
