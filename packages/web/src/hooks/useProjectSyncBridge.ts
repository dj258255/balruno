/**
 * Project sync wiring — connects {@link useProjectSync} to the
 * module-level write queue and the zustand project store
 * (ADR 0018 Stages B + D).
 *
 * The page component calls this hook instead of useProjectSync
 * directly. It does four jobs:
 *
 *   1. Mount useProjectSync as before (WS connect / sync.full /
 *      op.acked / broadcast lifecycle).
 *   2. Register the hook's send() function on the writeQueue at
 *      mount and clear it on unmount.
 *   3. Watch inbound traffic and update the writeQueue's per-region
 *      baseVersions so the next outbound op carries a fresh version.
 *   4. Apply broadcast frames (peer ops) back into the project store
 *      with origin='remote' so the local UI mirrors remote edits and
 *      the dual-write guard prevents the store from echoing them
 *      back to the socket.
 *
 * Store apply is currently wired only for {@code cell.update} —
 * matches Stage C's outbound surface (the cellSlice.updateCell
 * dual-write). Other broadcast variants only update the version
 * counter; the store-apply for row / column / tree ops lands with
 * the corresponding outbound stage.
 */

import { useEffect } from 'react';

import { useProjectSync, type ServerMsg } from './useProjectSync';
import { setSyncSender, setVersions, bumpVersion } from '@/lib/sync/writeQueue';
import { useProjectStore } from '@/stores/projectStore';
import type { CellValue } from '@balruno/shared';

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
    onMessage: (msg) => {
      // projectId enters the handler's closure here so the apply
      // path can call store actions scoped to this project.
      if (projectId) handleServerMsg(msg, projectId);
    },
  });

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
 * Translate inbound frames into writeQueue version updates and
 * store-apply calls. Kept at module scope (not inline) so it can be
 * unit-tested without rendering React; the hook passes projectId in
 * as an argument rather than capturing it via closure.
 */
function handleServerMsg(msg: ServerMsg, projectId: string): void {
  switch (msg.type) {
    case 'sync.full':
      setVersions(msg.versions);
      // sync.full's full state hydrate — store rehydrate is Stage E.
      // The version bookkeeping above is enough for outbound ops to
      // ride the right baseVersion until then.
      break;
    case 'op.acked':
      // op.acked carries only clientMsgId + version. Without a
      // pending-ops tracker we cannot route to one region, so bump
      // all three monotonically; bumpVersion's Math.max guard keeps
      // it race-safe.
      bumpVersion('data', msg.version);
      bumpVersion('sheetTree', msg.version);
      bumpVersion('docTree', msg.version);
      break;
    case 'conflict':
      // sync.full will follow per ADR 0018 Stage E; let that reset
      // the versions and rehydrate the store.
      break;
    default:
      handleBroadcast(msg, projectId);
      break;
  }
}

function handleBroadcast(msg: Exclude<ServerMsg, { type: 'sync.full' | 'op.acked' | 'conflict' }>,
                          projectId: string): void {
  // Region version bump — same routing table as writeQueue.regionOf.
  if (msg.type === 'cell.update' ||
      msg.type === 'row.add' || msg.type === 'row.delete' || msg.type === 'row.move' ||
      msg.type === 'column.add' || msg.type === 'column.update' || msg.type === 'column.delete') {
    bumpVersion('data', msg.version);
  } else if (msg.type === 'tree.add' || msg.type === 'tree.move' ||
             msg.type === 'tree.delete' || msg.type === 'tree.rename') {
    const treeKind = (msg.op as { treeKind?: 'SHEET' | 'DOC' } | null)?.treeKind;
    if (treeKind === 'SHEET') bumpVersion('sheetTree', msg.version);
    else if (treeKind === 'DOC') bumpVersion('docTree', msg.version);
  }

  // Store apply — only cell.update is wired so far (Stage D first
  // cut matches Stage C's outbound surface). The sender's own ops
  // come back as broadcasts too (ADR 0008 v2.0 Q7); applying them
  // again with origin='remote' is idempotent because cellSlice's
  // recordChange uses an isSameValue guard and updateCell's set
  // is a no-op when prev === next.
  if (msg.type === 'cell.update') {
    const op = msg.op as {
      sheetId?: string;
      rowId?: string;
      columnId?: string;
      value?: CellValue;
    } | null;
    if (op?.sheetId && op.rowId && op.columnId) {
      useProjectStore.getState().updateCell(
        projectId,
        op.sheetId,
        op.rowId,
        op.columnId,
        op.value as CellValue,
        { origin: 'remote' },
      );
    }
  }
}
