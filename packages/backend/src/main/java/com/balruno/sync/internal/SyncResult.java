// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync.internal;

/**
 * Op log apply result — three outcomes per ADR 0008 §3:
 *   - {@link Acked}: op applied, broadcast to siblings, send op.acked
 *     back to sender.
 *   - {@link Conflict}: baseVersion stale, send conflict to sender,
 *     no broadcast, no version bump.
 *   - {@link Cached}: clientMsgId already in op_idempotency — replay,
 *     return cached version + payload, no broadcast.
 *
 * Sealed so the handler exhaustively switches; no fall-through bugs
 * when a new outcome lands (e.g. CYCLE_DETECTED for tree.move).
 */
sealed interface SyncResult {

    record Acked(long version) implements SyncResult {}
    record Conflict(long serverVersion) implements SyncResult {}
    record Cached(long version, String payload) implements SyncResult {}

    static SyncResult acked(long version) {
        return new Acked(version);
    }
}
