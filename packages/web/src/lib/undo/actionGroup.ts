/**
 * Action group id rotation (ADR 0021 v2.3 Phase 5 — Pattern C).
 *
 * Baserow's `MAX_UNDOABLE_ACTIONS_PER_ACTION_GROUP = 20` + client-driven
 * `ClientUndoRedoActionGroupId` header. Same group is undone in one
 * Cmd+Z press — typing "hello" then Cmd+Z deletes the whole word.
 *
 * Group rotation triggers (matches Baserow / Notion behaviour):
 *   - 30 seconds of idle
 *   - Group reaches 20 actions
 *   - Explicit boundary call (e.g. user clicked a different cell)
 *
 * Group lifetime is tab-scoped — a fresh tab starts with a fresh group.
 * After a rotate, subsequent emits join the new group.
 */

const IDLE_ROTATE_MS = 30_000;
const MAX_OPS_PER_GROUP = 20;

let currentGroupId: string | null = null;
let groupCount = 0;
let lastEmitMs = 0;

/**
 * Get the current group id, rotating when needed. Each call increments
 * the count for the active group; if the count reaches the cap or the
 * idle window has elapsed since the last call, a fresh UUID is
 * generated.
 */
export function nextActionGroupId(): string {
  const now = Date.now();
  const idleElapsed = now - lastEmitMs > IDLE_ROTATE_MS;
  if (currentGroupId === null || groupCount >= MAX_OPS_PER_GROUP || idleElapsed) {
    currentGroupId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : '00000000-0000-4000-8000-000000000000';
    groupCount = 0;
  }
  groupCount++;
  lastEmitMs = now;
  return currentGroupId;
}

/**
 * Force the next emit to start a new group — useful when the user
 * shifts intent (e.g. clicked a different cell, switched sheets).
 * Without this, two unrelated edits made within 30 s of each other
 * would land in the same group and a single Cmd+Z would undo both.
 */
export function rotateActionGroup(): void {
  currentGroupId = null;
  groupCount = 0;
}

/** Test-only reset. */
export function __resetActionGroupForTests(): void {
  currentGroupId = null;
  groupCount = 0;
  lastEmitMs = 0;
}
