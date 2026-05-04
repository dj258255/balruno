/**
 * Probability Tree — visualizes drop tables / gacha pools as a hierarchical
 * tree with cumulative probability boxes. Useful for verifying that pools sum
 * to 100% and for spotting under/over-weighted entries.
 *
 * Convention:
 *   - column "name" / "id" / "item"  → label
 *   - column "weight" or "probability" / "rate" → numeric weight
 *   - optional column "tier" / "rarity" / "group" → grouping at the top level
 *
 * If no grouping column exists, all rows form a single flat bucket.
 */

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useProjectStore } from '@/stores/projectStore';

interface ProbabilityTreeProps {
  sheetId: string;
}

interface Entry {
  label: string;
  weight: number;
  group?: string;
}

export function ProbabilityTree({ sheetId }: ProbabilityTreeProps) {
  const t = useTranslations('views.probability');
  const sheet = useProjectStore((s) => {
    const project = s.projects.find((p) => p.id === s.currentProjectId);
    return project?.sheets.find((sh) => sh.id === sheetId) ?? null;
  });

  const tree = useMemo(() => buildTree(sheet), [sheet]);

  if (!sheet) {
    return <Empty t={t} k="noSheet" />;
  }
  if (!tree) {
    return <Empty t={t} k="cantInfer" />;
  }

  return (
    <div className="p-4 overflow-y-auto">
      <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
        {t('inferredHint', { weight: tree.weightCol, label: tree.labelCol })}
      </p>

      {tree.groups.map((g) => (
        <div key={g.name} className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {g.name}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {t('groupTotal', { count: g.entries.length, total: formatPct(g.totalWeight / tree.totalWeight) })}
            </span>
          </div>
          <div className="space-y-1">
            {g.entries.map((e) => {
              const ratio = g.totalWeight > 0 ? e.weight / g.totalWeight : 0;
              const overall = tree.totalWeight > 0 ? e.weight / tree.totalWeight : 0;
              return (
                <div
                  key={e.label}
                  className="relative h-7 rounded overflow-hidden border"
                  style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)' }}
                >
                  <div
                    className="absolute inset-y-0 left-0"
                    style={{
                      width: `${ratio * 100}%`,
                      background: 'linear-gradient(90deg, var(--accent), var(--accent-light))',
                      opacity: 0.5,
                    }}
                  />
                  <div className="relative flex items-center justify-between h-full px-2 text-xs">
                    <span className="font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {e.label}
                    </span>
                    <span className="ml-2 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                      {formatPct(ratio)} <span style={{ color: 'var(--text-tertiary)' }}>· {formatPct(overall)} {t('overall')}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {Math.abs(tree.totalWeight - 1) < 0.01 ? null : (
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {t('weightsNote', { total: tree.totalWeight.toFixed(2) })}
        </p>
      )}
    </div>
  );
}

function Empty({ t, k }: { t: ReturnType<typeof useTranslations<'views.probability'>>; k: 'noSheet' | 'cantInfer' }) {
  return (
    <div className="p-6 text-sm" style={{ color: 'var(--text-tertiary)' }}>
      {t(k)}
    </div>
  );
}

function buildTree(
  sheet: { columns: { id: string; name: string }[]; rows: { cells: Record<string, unknown> }[] } | null,
): { groups: { name: string; entries: Entry[]; totalWeight: number }[]; totalWeight: number; weightCol: string; labelCol: string } | null {
  if (!sheet || sheet.rows.length === 0 || sheet.columns.length === 0) return null;

  const labelCol = pickColumn(sheet, ['name', 'id', 'item', '아이템', '이름']) ?? sheet.columns[0];
  const weightCol = pickColumn(sheet, ['weight', 'probability', 'rate', '확률', '가중치']);
  const groupCol = pickColumn(sheet, ['tier', 'rarity', 'group', '등급']);

  if (!weightCol) return null;

  const entries: Entry[] = sheet.rows.map((r) => {
    const label = String(r.cells[labelCol.id] ?? '?');
    const weight = Number(r.cells[weightCol.id]);
    const group = groupCol ? String(r.cells[groupCol.id] ?? t_default) : t_default;
    return { label, weight: isFinite(weight) ? weight : 0, group };
  });

  const groupMap = new Map<string, Entry[]>();
  for (const e of entries) {
    const key = e.group ?? t_default;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(e);
  }

  const groups = Array.from(groupMap.entries()).map(([name, items]) => {
    const totalWeight = items.reduce((s, x) => s + x.weight, 0);
    items.sort((a, b) => b.weight - a.weight);
    return { name, entries: items, totalWeight };
  });
  groups.sort((a, b) => b.totalWeight - a.totalWeight);

  const totalWeight = groups.reduce((s, g) => s + g.totalWeight, 0);

  return { groups, totalWeight, weightCol: weightCol.name, labelCol: labelCol.name };
}

const t_default = 'Default';

function pickColumn(
  sheet: { columns: { id: string; name: string }[] },
  candidates: string[],
): { id: string; name: string } | null {
  const lcCols = sheet.columns.map((c) => ({ ...c, lc: c.name.toLowerCase() }));
  for (const cand of candidates) {
    const hit = lcCols.find((c) => c.lc === cand.toLowerCase());
    if (hit) return hit;
  }
  for (const cand of candidates) {
    const hit = lcCols.find((c) => c.lc.includes(cand.toLowerCase()));
    if (hit) return hit;
  }
  return null;
}

function formatPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}
