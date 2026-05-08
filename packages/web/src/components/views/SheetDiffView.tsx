/**
 * Sheet Diff View — compares two snapshots of the same sheet and highlights
 * cell changes. Useful for "what changed in patch 1.2 vs main", branch merges,
 * and named-snapshot reviews.
 *
 * Inputs:
 *   - `sheetId` to identify the sheet within both snapshots.
 *   - `before` and `after` Project payloads (taken from snapshotsStore or branches).
 *
 * Output: a row × column grid where each cell carries a status —
 *   added | removed | changed | unchanged
 */

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

interface ProjectLike {
  sheets?: { id: string; name: string; columns: { id: string; name: string }[]; rows: { id: string; cells: Record<string, unknown> }[] }[];
}

interface SheetDiffViewProps {
  sheetId: string;
  before: ProjectLike | null;
  after: ProjectLike | null;
  beforeLabel?: string;
  afterLabel?: string;
}

type CellStatus = 'unchanged' | 'changed' | 'added' | 'removed';

export function SheetDiffView({
  sheetId,
  before,
  after,
  beforeLabel = 'Before',
  afterLabel = 'After',
}: SheetDiffViewProps) {
  const t = useTranslations('views.diff');

  const result = useMemo(() => buildDiff(sheetId, before, after), [sheetId, before, after]);

  if (!result) {
    return (
      <div className="p-6 text-sm" style={{ color: 'var(--text-tertiary)' }}>
        {t('noSheetInBoth')}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center justify-between gap-3 px-3 py-2 border-b text-xs"
        style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
      >
        <div className="flex items-center gap-3">
          <Stat label={t('added')} count={result.summary.added} color="#22c55e" />
          <Stat label={t('changed')} count={result.summary.changed} color="#f59e0b" />
          <Stat label={t('removed')} count={result.summary.removed} color="#ef4444" />
          <Stat label={t('unchanged')} count={result.summary.unchanged} color="var(--text-tertiary)" />
        </div>
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--text-tertiary)' }}>
            {beforeLabel} → {afterLabel}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10" style={{ background: 'var(--bg-primary)' }}>
            <tr>
              <th
                className="sticky left-0 px-2 py-1.5 text-left font-semibold border-b"
                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
              >
                {t('rowHeader')}
              </th>
              {result.columns.map((c) => (
                <th
                  key={c.id}
                  className="px-2 py-1.5 font-semibold border-b whitespace-nowrap"
                  style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
                >
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row) => (
              <tr
                key={row.id}
                style={{
                  background:
                    row.status === 'added'
                      ? 'rgba(34,197,94,0.08)'
                      : row.status === 'removed'
                        ? 'rgba(239,68,68,0.08)'
                        : 'transparent',
                }}
              >
                <td
                  className="sticky left-0 px-2 py-1 font-medium whitespace-nowrap border-b"
                  style={{
                    background: 'var(--bg-primary)',
                    borderColor: 'var(--border-primary)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {row.label}
                </td>
                {row.cells.map((cell, i) => (
                  <td
                    key={i}
                    className="px-2 py-1 text-center align-middle border-b"
                    style={{
                      borderColor: 'var(--border-primary)',
                      background: cellBg(cell.status),
                      color: cell.status === 'unchanged' ? 'var(--text-secondary)' : 'var(--text-primary)',
                    }}
                  >
                    {renderCell(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
      <strong style={{ color: 'var(--text-primary)' }}>{count}</strong>
      <span>{label}</span>
    </span>
  );
}

interface DiffCell {
  status: CellStatus;
  before?: unknown;
  after?: unknown;
}

interface DiffRow {
  id: string;
  label: string;
  status: CellStatus;
  cells: DiffCell[];
}

function buildDiff(
  sheetId: string,
  before: ProjectLike | null,
  after: ProjectLike | null,
): { columns: { id: string; name: string }[]; rows: DiffRow[]; summary: Record<CellStatus, number> } | null {
  const beforeSheet = before?.sheets?.find((s) => s.id === sheetId) ?? null;
  const afterSheet = after?.sheets?.find((s) => s.id === sheetId) ?? null;
  if (!beforeSheet && !afterSheet) return null;

  // Union of columns, after takes precedence for ordering.
  const columnsMap = new Map<string, { id: string; name: string }>();
  for (const c of beforeSheet?.columns ?? []) columnsMap.set(c.id, c);
  for (const c of afterSheet?.columns ?? []) columnsMap.set(c.id, c);
  const columns = [...columnsMap.values()];

  const beforeRows = new Map<string, { cells: Record<string, unknown>; label: string }>();
  for (const r of beforeSheet?.rows ?? []) {
    const labelCol = beforeSheet!.columns[0];
    const label = labelCol ? String(r.cells[labelCol.id] ?? r.id) : r.id;
    beforeRows.set(r.id, { cells: r.cells, label });
  }
  const afterRows = new Map<string, { cells: Record<string, unknown>; label: string }>();
  for (const r of afterSheet?.rows ?? []) {
    const labelCol = afterSheet!.columns[0];
    const label = labelCol ? String(r.cells[labelCol.id] ?? r.id) : r.id;
    afterRows.set(r.id, { cells: r.cells, label });
  }

  const allRowIds = Array.from(new Set([...beforeRows.keys(), ...afterRows.keys()]));
  const summary: Record<CellStatus, number> = { added: 0, removed: 0, changed: 0, unchanged: 0 };

  const rows: DiffRow[] = allRowIds.map((id) => {
    const b = beforeRows.get(id);
    const a = afterRows.get(id);
    const status: CellStatus = !b ? 'added' : !a ? 'removed' : 'unchanged';
    const label = a?.label ?? b?.label ?? id;
    let rowChanged: CellStatus = status;
    const cells: DiffCell[] = columns.map((col) => {
      const bv = b?.cells[col.id];
      const av = a?.cells[col.id];
      let cellStatus: CellStatus;
      if (status === 'added') cellStatus = av != null && av !== '' ? 'added' : 'unchanged';
      else if (status === 'removed') cellStatus = bv != null && bv !== '' ? 'removed' : 'unchanged';
      else cellStatus = serialize(bv) === serialize(av) ? 'unchanged' : 'changed';
      summary[cellStatus] += 1;
      if (cellStatus === 'changed' && rowChanged === 'unchanged') rowChanged = 'changed';
      return { status: cellStatus, before: bv, after: av };
    });
    return { id, label, status: rowChanged === 'unchanged' && status !== 'unchanged' ? status : rowChanged, cells };
  });

  return { columns, rows, summary };
}

function serialize(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function cellBg(status: CellStatus): string {
  switch (status) {
    case 'added':
      return 'rgba(34,197,94,0.18)';
    case 'changed':
      return 'rgba(245,158,11,0.18)';
    case 'removed':
      return 'rgba(239,68,68,0.18)';
    default:
      return 'transparent';
  }
}

function renderCell(cell: DiffCell) {
  if (cell.status === 'changed') {
    return (
      <span className="inline-flex flex-col text-[11px] leading-tight">
        <span style={{ color: '#dc2626', textDecoration: 'line-through' }}>
          {String(cell.before ?? '—')}
        </span>
        <span style={{ color: '#16a34a' }}>{String(cell.after ?? '—')}</span>
      </span>
    );
  }
  if (cell.status === 'added') return String(cell.after ?? '—');
  if (cell.status === 'removed') return String(cell.before ?? '—');
  return String(cell.after ?? cell.before ?? '');
}
