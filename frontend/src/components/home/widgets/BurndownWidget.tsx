'use client';

import { useMemo, useState } from 'react';
import { Flame } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from 'recharts';
import { useTranslations } from 'next-intl';
import { useProjectStore } from '@/stores/projectStore';
import { detectPmSheet } from '@/lib/pmSheetDetection';
import { analyzeBurndown, type BurndownResult } from '@/lib/burndownAnalysis';

export default function BurndownWidget() {
  const t = useTranslations('home');
  const projects = useProjectStore((s) => s.projects);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const setCurrentSheet = useProjectStore((s) => s.setCurrentSheet);

  // 활성 프로젝트에서 sprint 타입 시트를 모두 찾고, 사용자가 선택 가능.
  // ID 기준 dedupe — 데이터 손상으로 같은 ID 시트가 두 번 들어오면 React key
  // 충돌이 발생하므로 방어적으로 한 번 거른다.
  const sprintSheets = useMemo(() => {
    const project = projects.find((p) => p.id === currentProjectId);
    if (!project) return [];
    const filtered = project.sheets.filter((s) => {
      const pm = detectPmSheet(s);
      return pm.type === 'sprint' || pm.type === 'generic-pm';
    });
    const seen = new Set<string>();
    return filtered.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }, [projects, currentProjectId]);

  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);
  const activeSheetId = selectedSheetId ?? sprintSheets[0]?.id ?? null;

  const result: BurndownResult | null = useMemo(() => {
    const project = projects.find((p) => p.id === currentProjectId);
    const sheet = project?.sheets.find((s) => s.id === activeSheetId);
    if (!project || !sheet) return null;
    return analyzeBurndown({ sheet, changelog: project.changelog ?? [] });
  }, [projects, currentProjectId, activeSheetId]);

  if (sprintSheets.length === 0) {
    return null; // 스프린트 시트 없으면 위젯 숨김
  }

  return (
    <div className="glass-card p-4" style={{ borderLeft: '3px solid #ef4444' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Flame className="w-4 h-4 shrink-0" style={{ color: '#ef4444' }} />
          <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
            {t('burndown')}
          </h3>
          {sprintSheets.length > 1 && (
            <select
              value={activeSheetId ?? ''}
              onChange={(e) => setSelectedSheetId(e.target.value)}
              className="text-xs px-1.5 py-0.5 rounded border focus:outline-none"
              style={{
                background: 'var(--bg-secondary)',
                borderColor: 'var(--border-primary)',
                color: 'var(--text-secondary)',
              }}
            >
              {sprintSheets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {activeSheetId && (
          <button
            onClick={() => setCurrentSheet(activeSheetId)}
            className="text-xs hover:underline shrink-0"
            style={{ color: 'var(--accent)' }}
          >
            {t('openSheet')}
          </button>
        )}
      </div>

      {!result?.eligible ? (
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {result?.reason ?? t('noSprintSheet')}
        </p>
      ) : result.totalStart === 0 ? (
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {t('noTasks')}
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-3 mb-2">
            <div>
              <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {result.totalStart - result.completed}
              </div>
              <div className="text-caption" style={{ color: 'var(--text-tertiary)' }}>
                {t('remaining', { unit: result.unit === 'points' ? t('unitSp') : t('unitTasks') })}
              </div>
            </div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {t('totalDoneSummary', { total: result.totalStart, done: result.completed })}
            </div>
          </div>
          <div className="h-32 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={result.points} margin={{ top: 5, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="var(--border-primary)" opacity={0.3} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--border-primary)' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 9, fill: 'var(--text-tertiary)' }}
                  tickLine={false}
                  axisLine={false}
                  width={28}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 6,
                    fontSize: 11,
                  }}
                  labelStyle={{ color: 'var(--text-primary)' }}
                  formatter={(value: number | string) => {
                    if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
                    return Math.round(value * 10) / 10;
                  }}
                />
                <ReferenceLine y={0} stroke="var(--border-primary)" />
                <Line
                  type="linear"
                  dataKey="ideal"
                  stroke="#94a3b8"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  dot={false}
                  name={t('ideal')}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="remaining"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ r: 2, fill: '#ef4444' }}
                  name={t('actual')}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex items-center justify-between text-caption" style={{ color: 'var(--text-tertiary)' }}>
            <span>{result.startDate} → {result.endDate}</span>
            <span>
              {t('progressPct', { pct: Math.round((result.completed / result.totalStart) * 100) })}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
