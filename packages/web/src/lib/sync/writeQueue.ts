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
 * Why two baseVersions instead of one:
 *   - ADR 0008 v2.0 §3 splits the project state into regions
 *     (projects.data / sheet_tree) with independent version columns.
 *     A cell.update has to ride the data version and a
 *     tree.add(treeKind=SHEET) the sheet_tree version. {@link emitOp}
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
import type { ClientOp, UndoMeta } from '@/hooks/useProjectSync';

/**
 * Sender contract. useProjectSync.send takes the full ClientOp
 * union (including presence). emitOp narrows to MappedClientOp via
 * the op mapper; emitPresence sidesteps the mapper for fire-and-
 * forget frames so the writeQueue stays the single emit edge.
 */
type Sender = (op: ClientOp) => boolean;

/** Region key — matches the baseVersion columns in projects. */
type Region = 'data' | 'sheetTree';

interface RegionVersions {
  data: number;
  sheetTree: number;
}

let currentSender: Sender | null = null;
let versions: RegionVersions = { data: 0, sheetTree: 0 };

/**
 * Register the live WebSocket sender. Pass {@code null} on
 * unmount; subsequent emitOp calls will return false until a new
 * sender registers.
 */
export function setSyncSender(sender: Sender | null): void {
  currentSender = sender;
}

/**
 * Replace the full version set — typically called when sync.full
 * arrives (initial hydrate or post-conflict resync). Reads only the
 * regions we track; any extra fields (legacy docTree) are ignored.
 */
export function setVersions(next: RegionVersions): void {
  versions = { data: next.data, sheetTree: next.sheetTree };
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

/**
 * Force a single region's version to an exact value — used on a
 * {@code conflict} reply to adopt the server's authoritative version.
 * Unlike {@link bumpVersion} this is NOT a Math.max: a conflict means
 * our local counter ran ahead of the server (e.g. it was wrongly
 * inflated by a cross-region ack), so we must be able to move it
 * *down* to the server value, otherwise the next op rides the same
 * stale-high baseVersion and conflicts again forever.
 */
export function setRegionVersion(region: Region, version: number): void {
  versions = { ...versions, [region]: version };
}

/** Read the current version of a region — useful for tests / inspection. */
export function getVersion(region: Region): number {
  return versions[region];
}

/**
 * Convert a store-action intent to a wire frame and dispatch it on
 * the registered sender. Returns false when no sender is registered
 * (the caller should treat that as "local-only mode, skip emit").
 *
 * Optional undo metadata (ADR 0021 v2.3 Phase 5 — Pattern C) attaches
 * the action's forward + inverse op arrays so the backend can serve
 * Cmd+Z / Cmd+Shift+Z on the resulting op_idempotency row. Omit it
 * for ops the user shouldn't be able to undo (none today, but the
 * shape is forward-compatible).
 */
/**
 * Throttled user-facing warning for silent op drops. Without this the
 * user just sees the local mutation flash on screen and disappear on
 * reload, with no signal that anything went wrong. Throttled to 5s so
 * a flurry of dropped ops (e.g. dragging a row while disconnected)
 * shows one toast, not twenty.
 *
 * Lazy import on sonner so writeQueue.test.ts doesn't pull the toast
 * stack into module init — the unit tests register a fake sender
 * directly and shouldn't trigger any UI.
 */
let lastSilentDropToastAt = 0;
function notifySilentDrop(reason: string): void {
  const now = Date.now();
  if (now - lastSilentDropToastAt < 5000) return;
  lastSilentDropToastAt = now;
  void import('sonner').then(({ toast }) => {
    toast.error(reason, { duration: 6000 });
  }).catch(() => {
    // Toast lib unavailable — the console.warn above is the floor.
  });
}

export function emitOp(intent: StoreActionIntent, undo?: UndoMeta | null): boolean {
  if (!currentSender) {
    // Silent drop is the prod-bug class the user surfaced as "새 문서
    // 만들었는데 저장 안 됨" — store mutates locally, the op never
    // reaches the backend, reload wipes the unsaved write.
    console.warn(
      '[writeQueue] dropping op — no sync sender registered (WS disconnected or page not yet bridged):',
      intent.kind,
      intent,
    );
    notifySilentDrop('연결이 끊긴 상태라 변경사항이 저장되지 않았습니다. 새로고침 후 다시 시도해주세요.');
    return false;
  }
  const region = regionOf(intent);
  const op = mapStoreActionToOp(intent, versions[region], undo ?? undefined);
  const sent = currentSender(op);
  if (!sent) {
    console.warn(
      '[writeQueue] sender refused op (likely WS not OPEN yet):',
      intent.kind,
      op.type,
    );
    notifySilentDrop('백엔드 연결 중입니다. 잠시 후 다시 시도해주세요.');
  }
  return sent;
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

/**
 * Whether a server-canonical sender is currently registered.
 * Callers (e.g. cellSlice) use this to choose between the
 * direct-setState fast path (server-canonical) and the Y.Doc
 * mutation path (local mode). True only while a project page is
 * mounted with an active wss connection.
 */
export function hasSender(): boolean {
  return currentSender !== null;
}

/** Test-only — reset module state between cases. */
export function __resetWriteQueueForTests(): void {
  currentSender = null;
  versions = { data: 0, sheetTree: 0 };
}

function regionOf(intent: StoreActionIntent): Region {
  switch (intent.kind) {
    case 'cell.update':
    case 'cell.style.update':
    case 'sheet.metadata.update':
    case 'row.add':
    case 'row.update':
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
      return 'sheetTree';
  }
}
