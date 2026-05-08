/**
 * Curve Overlay — multi-series line chart for comparing growth curves.
 *
 * Pick an X column (e.g. `level`) and one or more Y columns (e.g. `hp`, `atk`,
 * `xpReq`). Each Y series is overlaid in the same chart so designers can spot
 * curve shape mismatches across stats. Game-domain version of the "small
 * multiples in one frame" pattern.
 */

import { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTranslations } from 'next-intl';
import { useProjectStore } from '@/stores/projectStore';

interface CurveOverlayProps {
  sheetId: string;
}

const PALETTE = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#db2777'];

export function CurveOverlay({ sheetId }: CurveOverlayProps) {
  const t = useTranslations('views.curve');
  const sheet = useProjectStore((s) => {
    const project = s.projects.find((p) => p.id === s.currentProjectId);
    return project?.sheets.find((sh) => sh.id === sheetId) ?? null;
  });

  const numericCols = useMemo(() => detectNumericColumns(sheet), [sheet]);
  const [xColumnId, setXColumnId] = useState<string | null>(null);
  const [ySelected, setYSelected] = useState<Set<string>>(new Set());

  const effectiveX = xColumnId ?? numericCols[0]?.id ?? null;
  const effectiveYs = ySelected.size > 0 ? [...ySelected] : numericCols.slice(1, 4).map((c) => c.id);

  const chartData = useMemo(() => {
    if (!sheet || !effectiveX) return [];
    return [...sheet.rows]
      .map((row) => {
        const x = Number(row.cells[effectiveX]);
        if (!isFinite(x)) return null;
        const point: Record<string, number | string> = { x };
        for (const yId of effectiveYs) {
          const v = Number(row.cells[yId]);
          if (isFinite(v)) point[yId] = v;
        }
        return point;
      })
      .filter((p): p is Record<string, number | string> => !!p)
      .sort((a, b) => (a.x as number) - (b.x as number));
  }, [sheet, effectiveX, effectiveYs]);

  if (!sheet) {
    return <Empty t={t} key_="noSheet" />;
  }
  if (numericCols.length < 2) {
    return <Empty t={t} key_="needTwoNumericColumns" />;
  }

  const xColumnName = sheet.columns.find((c) => c.id === effectiveX)?.name ?? '';

  const toggleY = (id: string) =>
    setYSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col h-full p-3 gap-3">
      <div className="flex items-center gap-3 flex-wrap text-xs">
        <label>
          <span style={{ color: 'var(--text-secondary)' }} className="mr-1.5">
            {t('xAxisLabel')}
          </span>
          <select
            value={effectiveX ?? ''}
            onChange={(e) => setXColumnId(e.target.value)}
            className="px-2 py-1 rounded border"
            style={{
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              borderColor: 'var(--border-primary)',
            }}
          >
            {numericCols.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <span style={{ color: 'var(--text-secondary)' }}>{t('seriesLabel')}</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {numericCols
            .filter((c) => c.id !== effectiveX)
            .map((c, i) => {
              const active = ySelected.has(c.id) || (ySelected.size === 0 && i < 3);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleY(c.id)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px]"
                  style={{
                    borderColor: 'var(--border-primary)',
                    background: active ? 'var(--bg-tertiary)' : 'transparent',
                    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ background: PALETTE[i % PALETTE.length] }}
                  />
                  {c.name}
                </button>
              );
            })}
        </div>
      </div>

      <div className="flex-1 min-h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <XAxis dataKey="x" tick={{ fontSize: 11 }} label={{ value: xColumnName, position: 'insideBottom', offset: -2 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {effectiveYs.map((yId, i) => {
              const col = sheet.columns.find((c) => c.id === yId);
              return (
                <Line
                  key={yId}
                  type="monotone"
                  dataKey={yId}
                  name={col?.name ?? yId}
                  stroke={PALETTE[i % PALETTE.length]}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Empty({ t, key_ }: { t: ReturnType<typeof useTranslations<'views.curve'>>; key_: 'noSheet' | 'needTwoNumericColumns' }) {
  return (
    <div className="p-6 text-sm" style={{ color: 'var(--text-tertiary)' }}>
      {t(key_)}
    </div>
  );
}

function detectNumericColumns(
  sheet: { columns: { id: string; name: string }[]; rows: { cells: Record<string, unknown> }[] } | null,
): { id: string; name: string }[] {
  if (!sheet) return [];
  return sheet.columns.filter((col) => {
    let nums = 0;
    let total = 0;
    for (const r of sheet.rows) {
      const v = r.cells[col.id];
      if (v == null || v === '') continue;
      total++;
      if (typeof v === 'number' || (!isNaN(Number(v)) && v !== '')) nums++;
    }
    return total > 0 && nums / total >= 0.6;
  });
}
