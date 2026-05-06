/**
 * Project sync wiring — connects {@link useProjectSync} to the
 * module-level write queue (ADR 0018 Stage B).
 *
 * The page component calls this hook instead of useProjectSync
 * directly. It does three jobs:
 *
 *   1. Mount useProjectSync as before (the WS connect /
 *      sync.full / op.acked / broadcast lifecycle is unchanged).
 *   2. Register the hook's send() function on the writeQueue at
 *      mount and clear it on unmount, so any zustand action that
 *      calls writeQueue.emitOp during this page's lifetime
 *      reaches the live socket.
 *   3. Watch the inbound traffic (sync.full + op.acked + broadcast
 *      frames) and update the writeQueue's per-region baseVersions
 *      so the next outbound op carries a fresh version.
 *
 * The store middleware that emits ops is plugged in at Stage C;
 * this hook just provides the live transport. The bridge keeps
 * the project detail page free of imperative wiring code — the
 * page only reads {status} for display.
 */

import { useEffect } from 'react';

import { useProjectSync, type ServerMsg } from './useProjectSync';
import { setSyncSender, setVersions, bumpVersion } from '@/lib/sync/writeQueue';

interface UseProjectSyncBridgeOptions {
  projectId: string | null;
  enabled?: boolean;
}

export function useProjectSyncBridge({
  projectId,
  enabled = true,
}: UseProjectSyncBridgeOptions): { status: ReturnType<typeof useProjectSync>['status'] } {
  const { status, send } = useProjectSync({
    projectId,
    enabled,
    onMessage: handleServerMsg,
  });

  // Register the live sender for the page's lifetime. The cleanup
  // clears it so a navigation away from the page doesn't leave a
  // dangling ref that points at a closed socket.
  useEffect(() => {
    if (!enabled || !projectId) return;
    setSyncSender(send);
    return () => {
      setSyncSender(null);
    };
  }, [enabled, projectId, send]);

  return { status };
}

/**
 * Translate inbound frames into writeQueue version updates. Pulled
 * out of the hook body so the same logic can be unit-tested
 * without rendering React.
 */
function handleServerMsg(msg: ServerMsg): void {
  switch (msg.type) {
    case 'sync.full':
      setVersions(msg.versions);
      break;
    case 'op.acked':
      // We don't yet know which region this ack belongs to — the
      // op.acked frame carries only clientMsgId + version. The
      // store middleware (Stage C) tracks pending ops by clientMsgId
      // and will route the version bump to the right region. For
      // now bump all three monotonically; bumpVersion's Math.max
      // guard keeps that safe.
      bumpVersion('data', msg.version);
      bumpVersion('sheetTree', msg.version);
      bumpVersion('docTree', msg.version);
      break;
    case 'conflict':
      // sync.full will follow per ADR 0018 Stage E; nothing to bump
      // proactively — let the next sync.full reset the versions.
      break;
    default:
      // Broadcast frames (cell.update / row.* / column.* / tree.*)
      // bump exactly one region. Switch on the type — same routing
      // table as writeQueue.regionOf.
      if (msg.type === 'cell.update' ||
          msg.type === 'row.add' || msg.type === 'row.delete' || msg.type === 'row.move' ||
          msg.type === 'column.add' || msg.type === 'column.update' || msg.type === 'column.delete') {
        bumpVersion('data', msg.version);
      } else if (msg.type === 'tree.add' || msg.type === 'tree.move' ||
                 msg.type === 'tree.delete' || msg.type === 'tree.rename') {
        // The broadcast envelope carries the op fields under msg.op;
        // treeKind tells us which tree was changed.
        const treeKind = (msg.op as { treeKind?: 'SHEET' | 'DOC' } | null)?.treeKind;
        if (treeKind === 'SHEET') bumpVersion('sheetTree', msg.version);
        else if (treeKind === 'DOC') bumpVersion('docTree', msg.version);
      }
      break;
  }
}
