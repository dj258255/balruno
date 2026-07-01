/**
 * Panel adapters for the salvaged game-balancing analysis views.
 *
 * The views under `@/components/views/*` render straight from projectStore's
 * current sheet and take a bare `sheetId` prop. The DockedToolbox panel slot,
 * however, hands every tool an `onClose` / `isPanel` pair and expects the
 * component to sit inside the shared dock shell (which already draws the
 * header + close button). These thin wrappers bridge the two: they pull the
 * active sheet id from the store and forward it, so each view is reachable as
 * a first-class dock tool without touching the pristine salvaged files.
 */

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useProjectStore } from '@/stores/projectStore';
import { useSnapshotsStore } from '@/stores/snapshotsStore';
import { BalanceHeatmap } from '@/components/views/BalanceHeatmap';
import { CurveOverlay } from '@/components/views/CurveOverlay';
import { ProbabilityTree } from '@/components/views/ProbabilityTree';
import { SheetDiffView } from '@/components/views/SheetDiffView';

interface PanelProps {
  onClose?: () => void;
  isPanel?: boolean;
}

export function BalanceHeatmapPanel(_props: PanelProps) {
  const sheetId = useProjectStore((s) => s.currentSheetId);
  return <BalanceHeatmap sheetId={sheetId ?? ''} />;
}

export function CurveOverlayPanel(_props: PanelProps) {
  const sheetId = useProjectStore((s) => s.currentSheetId);
  return <CurveOverlay sheetId={sheetId ?? ''} />;
}

export function ProbabilityTreePanel(_props: PanelProps) {
  const sheetId = useProjectStore((s) => s.currentSheetId);
  return <ProbabilityTree sheetId={sheetId ?? ''} />;
}

const CURRENT_ID = '__current__';

/** Mirrors the structural shape SheetDiffView accepts for before/after. */
interface ProjectLike {
  sheets?: {
    id: string;
    name: string;
    columns: { id: string; name: string }[];
    rows: { id: string; cells: Record<string, unknown> }[];
  }[];
}

interface DiffSource {
  id: string;
  label: string;
  project: ProjectLike | null;
}

export function SheetDiffPanel(_props: PanelProps) {
  const t = useTranslations('views.diff');
  const currentSheetId = useProjectStore((s) => s.currentSheetId);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const currentProject = useProjectStore(
    (s) => s.projects.find((p) => p.id === s.currentProjectId) ?? null,
  );
  const byProject = useSnapshotsStore((s) => s.byProject);

  const sources: DiffSource[] = useMemo(() => {
    const snaps = currentProjectId ? byProject[currentProjectId] ?? [] : [];
    const sorted = [...snaps].sort((a, b) => b.createdAt - a.createdAt);
    return [
      { id: CURRENT_ID, label: t('currentSource'), project: currentProject },
      ...sorted.map((s) => ({
        id: s.id,
        label: s.name,
        project: (s.payload as ProjectLike | null) ?? null,
      })),
    ];
  }, [byProject, currentProjectId, currentProject, t]);

  // Default: newest snapshot (if any) → current live sheet.
  const firstSnapshotId = sources.find((s) => s.id !== CURRENT_ID)?.id ?? CURRENT_ID;
  const [beforeId, setBeforeId] = useState<string>(firstSnapshotId);
  const [afterId, setAfterId] = useState<string>(CURRENT_ID);

  const beforeSource = sources.find((s) => s.id === beforeId) ?? sources[0];
  const afterSource = sources.find((s) => s.id === afterId) ?? sources[0];

  const selectStyle = {
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    borderColor: 'var(--border-primary)',
  } as const;

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex items-center gap-3 flex-wrap px-3 py-2 border-b text-xs"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <label className="flex items-center gap-1.5">
          <span style={{ color: 'var(--text-secondary)' }}>{t('beforePicker')}</span>
          <select
            value={beforeId}
            onChange={(e) => setBeforeId(e.target.value)}
            className="px-2 py-1 rounded border"
            style={selectStyle}
          >
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <span style={{ color: 'var(--text-tertiary)' }}>→</span>
        <label className="flex items-center gap-1.5">
          <span style={{ color: 'var(--text-secondary)' }}>{t('afterPicker')}</span>
          <select
            value={afterId}
            onChange={(e) => setAfterId(e.target.value)}
            className="px-2 py-1 rounded border"
            style={selectStyle}
          >
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex-1 overflow-hidden">
        <SheetDiffView
          sheetId={currentSheetId ?? ''}
          before={beforeSource?.project ?? null}
          after={afterSource?.project ?? null}
          beforeLabel={beforeSource?.label}
          afterLabel={afterSource?.label}
        />
      </div>
    </div>
  );
}
