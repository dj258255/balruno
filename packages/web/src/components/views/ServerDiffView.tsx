'use client';

/**
 * ServerDiffView — wrapper around SheetDiffView that reconstructs a
 * historical baseline from op_idempotency entries.
 *
 * The Diff view compares two project snapshots. Server-canonical mode
 * doesn't keep historical snapshots in memory, so we synthesise the
 * "before" project by:
 *   1. fetching the user's recent reversible op_idempotency entries
 *      (already exposed by ADR 0021 v3.0 Phase 5 — fetchUndoStack)
 *   2. taking the current project as "after"
 *   3. applying inverse_payload of each picked entry to a clone of
 *      "after", in newest-first order, to walk backward in time
 *   4. that walked-back clone becomes "before"
 *
 * Limitations: scope is per-user + per-tab (matches Baserow undo
 * scope). Other users' edits inside the same window aren't on the
 * picker. Once Diff has real users, extend recentReversible to
 * project-wide. For solo dev that's fine — the user almost always
 * wants to see "what did *I* change since N minutes ago".
 */

import { useEffect, useMemo, useState } from 'react';
import { History } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { fetchUndoStack, type UndoStackEntry } from '@/lib/backend/undo';
import { applyOpsToProject } from '@/lib/undo/applyToProject';
import type { Project } from '@/types';
import type { UndoableOp } from '@/lib/undo/undoStack';
import { SheetDiffView } from './SheetDiffView';

interface ServerDiffViewProps {
  projectId: string;
  sheetId: string;
}

export default function ServerDiffView({ projectId, sheetId }: ServerDiffViewProps) {
  const currentProject = useProjectStore((s) =>
    s.projects.find((p) => p.id === projectId) ?? null,
  );
  const [stack, setStack] = useState<UndoStackEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The picker stores how many recent ops to walk backward. Default
  // 1 = "compare to just before the last edit". 0 disables the diff
  // (before === after, so nothing changed).
  const [opsBack, setOpsBack] = useState(1);

  useEffect(() => {
    let cancelled = false;
    fetchUndoStack(projectId, 30)
      .then((rows) => {
        if (cancelled) return;
        // Server returns newest-first. Filter to only entries that
        // are *not* undone — we want the live forward chain.
        setStack(rows.filter((r) => !r.undone));
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load history');
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const baseline = useMemo<Project | null>(() => {
    if (!currentProject || !stack) return null;
    if (opsBack === 0) return currentProject;
    const slice = stack.slice(0, opsBack);
    // Each entry's inverse_payload is an array of UndoableOp; flatten
    // newest-first then apply in order. This walks the project state
    // backward op-by-op from the present.
    const inverses = slice.flatMap((e) => (e.inverse ?? []) as UndoableOp[]);
    return applyOpsToProject(currentProject, inverses);
  }, [currentProject, stack, opsBack]);

  if (error) {
    return (
      <div className="p-6 text-sm" style={{ color: 'var(--text-tertiary)' }}>
        Diff 히스토리 로드 실패: {error}
      </div>
    );
  }
  if (!stack || !currentProject) {
    return (
      <div className="p-6 text-sm" style={{ color: 'var(--text-tertiary)' }}>
        Diff 히스토리 로딩 중...
      </div>
    );
  }
  if (stack.length === 0) {
    return (
      <div className="p-6 text-sm" style={{ color: 'var(--text-tertiary)' }}>
        비교할 변경 이력이 없습니다. 시트를 편집한 뒤 Diff 뷰로 돌아오세요.
      </div>
    );
  }

  const opLabel = (n: number) =>
    n === 1
      ? '직전 편집'
      : `${n}개 편집 전`;

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex items-center gap-3 border-b px-3 py-2 text-xs"
        style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}
      >
        <History className="h-4 w-4" />
        <span>비교 기준</span>
        <select
          value={opsBack}
          onChange={(e) => setOpsBack(Number(e.target.value))}
          className="rounded border bg-transparent px-2 py-1 text-xs"
          style={{
            borderColor: 'var(--border-primary)',
            color: 'var(--text-primary)',
          }}
        >
          {[1, 2, 5, 10, Math.min(20, stack.length), stack.length]
            .filter((n, i, arr) => n > 0 && n <= stack.length && arr.indexOf(n) === i)
            .map((n) => (
              <option key={n} value={n}>
                {opLabel(n)}
              </option>
            ))}
        </select>
        <span style={{ color: 'var(--text-tertiary)' }}>
          ({stack.length}개 이력 · 본인 편집 한정 · 120분 이내)
        </span>
      </div>
      <div className="flex-1 overflow-hidden">
        <SheetDiffView
          sheetId={sheetId}
          before={baseline}
          after={currentProject}
          beforeLabel={`${opsBack}개 전`}
          afterLabel="현재"
        />
      </div>
    </div>
  );
}
