'use client';

import { useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid, Cell } from 'recharts';
import { useProjectStore } from '@/stores/projectStore';
import { analyzeVelocity } from '@/lib/velocityAnalysis';

/**
 * Velocity — 최근 N 개 Sprint 의 완료 points 막대 차트.
 * 평균선 overlay 로 "팀이 한 스프린트에 얼마나 해낼 수 있는지" 가시화.
 * Scrum / Linear Cycles 의 velocity 개념 그대로.
 */
export default function VelocityWidget() {
  const projects = useProjectStore((s) => s.projects);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);

  const result = useMemo(() => {
    const project = projects.find((p) => p.id === currentProjectId);
    if (!project) return null;
    return analyzeVelocity(project, 6);
  }, [projects, currentProjectId]);

  if (!result || !result.eligible || result.points.length === 0) {
    return null;
  }

  const chartData = result.points.map((p) => ({
    label: p.label.length > 14 ? p.label.slice(0, 12) + '…' : p.label,
    fullLabel: p.label,
    completed: p.completedPoints,
    total: p.totalPoints,
    rate: Math.round(p.completionRate * 100),
  }));

  return (
    <div className="glass-card p-4" style={{ borderLeft: '3px solid #10b981' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4" style={{ color: '#10b981' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Velocity
          </h3>
        </div>
        <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
          평균 {result.averageCompleted} {result.points[0].unit === 'points' ? 'pts' : '개'} / sprint
        </div>
      </div>

      <div style={{ width: '100%', height: 180 }}>
        <ResponsiveContainer>
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" opacity={0.4} />
            <XAxis
              dataKey="label"
              stroke="var(--text-tertiary)"
              fontSize={10}
            />
            <YAxis
              stroke="var(--text-tertiary)"
              fontSize={10}
              width={28}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-primary)',
                borderRadius: 6,
                fontSize: 12,
              }}
              formatter={(value, _name, ctx) => {
                const payload = ctx?.payload as typeof chartData[number] | undefined;
                if (!payload) return [String(value), '완료'];
                return [
                  `${value} / ${payload.total} (${payload.rate}%)`,
                  '완료',
                ];
              }}
              labelFormatter={(_, items) => {
                const payload = items?.[0]?.payload as typeof chartData[number] | undefined;
                return payload?.fullLabel ?? '';
              }}
            />
            <ReferenceLine
              y={result.averageCompleted}
              stroke="#10b981"
              strokeDasharray="3 3"
              label={{ value: '평균', fontSize: 10, fill: '#10b981', position: 'right' }}
            />
            <Bar dataKey="completed" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={entry.rate >= 80 ? '#10b981' : entry.rate >= 50 ? '#f59e0b' : '#ef4444'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-caption mt-2" style={{ color: 'var(--text-tertiary)' }}>
        막대 색상: 완료율 80%+ 녹색, 50~80% 주황, 50% 미만 빨강
      </p>
    </div>
  );
}
