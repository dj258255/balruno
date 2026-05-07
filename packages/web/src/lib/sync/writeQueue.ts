/**
 * Sync write queue — module-level bridge between zustand store
 * actions and the WebSocket send() of {@link useProjectSync}
 * (ADR 0018 Stage B).
 *
 * Why a module singleton instead of a store slice:
 *   - The store middleware that calls emitOp() runs synchronously
 *     during a zustand action and has no React render context, so
 *     it cannot consume hooks. The module setter pattern lets a
 *     React component (the project detail page) register the live
 *     sender at mount time and clear it at unmount.
 *   - One project is open at a time. There is no list of senders —
 *     the previous registration is replaced.
 *
 * Why three baseVersions instead of one:
 *   - ADR 0008 v2.0 §3 splits the project state into three regions
 *     (projects.data / sheet_tree / doc_tree) with independent
 *     version columns. A cell.update has to ride the data version,
 *     a tree.add(treeKind=SHEET) the sheet_tree version, and a
 *     tree.add(treeKind=DOC) the doc_tree version. {@link emitOp}
 *     does the region routing so the store middleware can stay
 *     region-agnostic.
 *
 * The queue is intentionally fire-and-forget. Optimistic local
 * apply happens in the store; failure recovery on conflict is the
 * conflict-handler's job (ADR 0018 Stage E). emitOp returns false
 * when no sender is registered (e.g. local-only mode) so the store
 * middleware can decide whether to skip or warn.
 */

import { mapStoreActionToOp, type StoreActionIntent, type MappedClientOp } from './opMapper';
import type { ClientOp } from '@/hooks/useProjectSync';

/**
 * Sender contract. useProjectSync.send takes the full ClientOp
 * union (including presence). emitOp narrows to MappedClientOp via
 * the op mapper; emitPresence sidesteps the mapper for fire-and-
 * forget frames so the writeQueue stays the single emit edge.
 */
type Sender = (op: ClientOp) => boolean;

/** Region key — matches the three baseVersion columns in projects. */
type Region = 'data' | 'sheetTree' | 'docTree';

interface RegionVersions {
  data: number;
  sheetTree: number;
  docTree: number;
}

let currentSender: Sender | null = null;
let versions: RegionVersions = { data: 0, sheetTree: 0, docTree: 0 };

/**
 * Register the live WebSocket sender. Pass {@code null} on
 * unmount; subsequent emitOp calls will return false until a new
 * sender registers.
 */
export function setSyncSender(sender: Sender | null): void {
  currentSender = sender;
}

/**
 * Replace the full version triple — typically called when sync.full
 * arrives (initial hydrate or post-conflict resync).
 */
export function setVersions(next: RegionVersions): void {
  versions = next;
}

/**
 * Bump a single region's version — typically called from
 * useProjectSync.onMessage on op.acked (sender's own op landed) or
 * on a broadcast frame (peer's op landed).
 *
 * The {@link Math.max} guard tolerates the ack/broadcast race: if a
 * broadcast for version N+1 arrives slightly before our ack for N,
 * the broadcast already moved versions[region] forward and the
 * later ack is a no-op rather than a regression.
 */
export function bumpVersion(region: Region, newVersion: number): void {
  versions = { ...versions, [region]: Math.max(versions[region], newVersion) };
}

/** Read the current version of a region — useful for tests / inspection. */
export function getVersion(region: Region): number {
  return versions[region];
}

/**
 * Convert a store-action intent to a wire frame and dispatch it on
 * the registered sender. Returns false when no sender is registered
 * (the caller should treat that as "local-only mode, skip emit").
 */
export function emitOp(intent: StoreActionIntent): boolean {
  if (!currentSender) return false;
  const region = regionOf(intent);
  const op = mapStoreActionToOp(intent, versions[region]);
  return currentSender(op);
}

/**
 * Fire-and-forget presence frame. Skips the op mapper / version /
 * idempotency path used by emitOp — backend's Presence handler
 * doesn't persist or version. The userId field on the wire is a
 * placeholder; backend overrides with the authenticated session
 * subject (see ProjectWebSocketHandler.resolveUserId).
 */
export function emitPresence(cursor: unknown): boolean {
  if (!currentSender) return false;
  return currentSender({ type: 'presence', userId: 'self', cursor });
}

/** Test-only — reset module state between cases. */
export function __resetWriteQueueForTests(): void {
  currentSender = null;
  versions = { data: 0, sheetTree: 0, docTree: 0 };
}

function regionOf(intent: StoreActionIntent): Region {
  switch (intent.kind) {
    case 'cell.update':
    case 'row.add':
    case 'row.delete':
    case 'row.move':
    case 'column.add':
    case 'column.update':
    case 'column.delete':
      return 'data';
    case 'tree.add':
    case 'tree.move':
    case 'tree.delete':
    case 'tree.rename':
      return intent.treeKind === 'SHEET' ? 'sheetTree' : 'docTree';
  }
}
