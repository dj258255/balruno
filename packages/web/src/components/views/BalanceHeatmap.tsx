/**
 * Balance Heatmap — color-intensity matrix over a sheet's numeric columns.
 *
 * Picks every column whose values are mostly numeric, normalizes per-column
 * (min..max → 0..1), and renders cells as a heat-mapped grid. Game designers
 * use this to spot outliers across characters/items at a glance.
 *
 * Inputs the active sheet (rows + columns) directly from projectStore — no
 * separate config required for the basic view. Future enhancement: column
 * weighting, group-by-row-tag, bipolar (red/blue) palette for diff overlays.
 */

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useProjectStore } from '@/stores/projectStore';

interface BalanceHeatmapProps {
  sheetId: string;
}

export function BalanceHeatmap({ sheetId }: BalanceHeatmapProps) {
  const t = useTranslations('views.heatmap');
  const sheet = useProjectStore((s) => {
    const project = s.projects.find((p) => p.id === s.currentProjectId);
    return project?.sheets.find((sh) => sh.id === sheetId) ?? null;
  });

  const matrix = useMemo(() => buildMatrix(sheet), [sheet]);

  if (!sheet) {
    return (
      <div className="p-6 text-sm" style={{ color: 'var(--text-tertiary)' }}>
        {t('noSheet')}
      </div>
    );
  }

  if (matrix.numericColumns.length === 0) {
    return (
      <div className="p-6 text-sm" style={{ color: 'var(--text-tertiary)' }}>
        {t('noNumericColumns')}
      </div>
    );
  }

  return (
    <div className="overflow-auto p-3">
      <table className="border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 px-2 py-1 text-left font-semibold"
                style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
              {t('rowHeader')}
            </th>
            {matrix.numericColumns.map((c) => (
              <th
                key={c.id}
                className="px-2 py-1 font-semibold whitespace-nowrap"
                style={{ color: 'var(--text-secondary)', minWidth: 60 }}
              >
                {c.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row) => (
            <tr key={row.id}>
              <td
                className="sticky left-0 px-2 py-1 font-medium whitespace-nowrap"
                style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
              >
                {row.label}
              </td>
              {row.cells.map((cell, i) => (
                <td
                  key={i}
                  className="px-2 py-1 text-center"
                  style={{
                    background: cell.t == null ? 'transparent' : heatColor(cell.t),
                    color: cell.t == null ? 'var(--text-tertiary)' : '#fff',
                    fontWeight: 500,
                  }}
                  title={cell.value == null ? '—' : String(cell.value)}
                >
                  {cell.value == null ? '—' : formatNum(cell.value)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-center gap-2 mt-3 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
        <span>{t('legendLow')}</span>
        <div
          className="w-32 h-2 rounded"
          style={{
            background: 'linear-gradient(90deg, hsl(220 80% 50%), hsl(60 80% 50%), hsl(0 80% 50%))',
          }}
        />
        <span>{t('legendHigh')}</span>
      </div>
    </div>
  );
}

interface MatrixCell {
  value: number | null;
  t: number | null; // 0..1 normalized
}

interface MatrixRow {
  id: string;
  label: string;
  cells: MatrixCell[];
}

interface ColumnInfo {
  id: string;
  name: string;
  min: number;
  max: number;
}

function buildMatrix(
  sheet: { columns: { id: string; name: string }[]; rows: { id: string; cells: Record<string, unknown> }[] } | null,
): { numericColumns: ColumnInfo[]; rows: MatrixRow[] } {
  if (!sheet) return { numericColumns: [], rows: [] };

  const candidateCols = sheet.columns.filter((col) => {
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

  const numericColumns: ColumnInfo[] = candidateCols.map((col) => {
    let min = Infinity;
    let max = -Infinity;
    for (const r of sheet.rows) {
      const v = Number(r.cells[col.id]);
      if (!isFinite(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    return { id: col.id, name: col.name, min: isFinite(min) ? min : 0, max: isFinite(max) ? max : 0 };
  });

  const rows: MatrixRow[] = sheet.rows.map((r, idx) => {
    const labelCol = sheet.columns[0];
    const labelRaw = labelCol ? r.cells[labelCol.id] : '';
    const label = labelRaw != null && labelRaw !== '' ? String(labelRaw) : `${idx + 1}`;
    const cells = numericColumns.map<MatrixCell>((col) => {
      const v = r.cells[col.id];
      const num = v == null || v === '' ? null : Number(v);
      if (num == null || !isFinite(num)) return { value: null, t: null };
      const range = col.max - col.min;
      const t = range === 0 ? 0.5 : (num - col.min) / range;
      return { value: num, t };
    });
    return { id: r.id, label, cells };
  });

  return { numericColumns, rows };
}

function heatColor(t: number): string {
  // Cool → warm: blue (220) → yellow (60) → red (0). Saturation/lightness fixed.
  const clamped = Math.max(0, Math.min(1, t));
  const hue = 220 - clamped * 220;
  const lightness = 50 - clamped * 8;
  return `hsl(${hue} 75% ${lightness}%)`;
}

function formatNum(v: number): string {
  if (Math.abs(v) >= 1000) return v.toFixed(0);
  if (Math.abs(v) >= 1) return v.toFixed(1);
  return v.toFixed(2);
}
