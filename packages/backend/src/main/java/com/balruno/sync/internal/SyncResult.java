// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync.internal;

/**
 * Op log apply result — three outcomes per ADR 0008 §3:
 *   - {@link Acked}: op applied, version bumped, op_idempotency
 *     written. Carries the broadcast JSON the handler ships to the
 *     other sessions in the project.
 *   - {@link Conflict}: baseVersion stale, no version bump. Sender
 *     gets a conflict reply with the current server version so it
 *     can re-fetch + re-apply.
 *   - {@link Cached}: clientMsgId already in op_idempotency — replay
 *     the cached server response (op.acked or whichever) verbatim,
 *     no re-broadcast. Reconnect-replay path.
 *
 * Sealed so the handler exhaustively switches; no fall-through bugs
 * when a new outcome lands (e.g. CYCLE_DETECTED for tree.move).
 */
sealed interface SyncResult {

    /**
     * @param version          new monotonic version after this op
     * @param broadcastPayload JSON the handler sends to every other
     *                         session on this project (op shape echo
     *                         with server-assigned version + ts), and
     *                         the same string we cache in
     *                         op_idempotency.result_payload for replay.
     */
    record Acked(long version, String broadcastPayload) implements SyncResult {}

    record Conflict(long serverVersion) implements SyncResult {}

    record Cached(long version, String payload) implements SyncResult {}
}
