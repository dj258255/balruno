// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync;

import java.util.UUID;

/**
 * Public surface of the sync module — the only contract other modules
 * (currently {@code project}) call into. Controllers and services in
 * {@code sync.internal} stay package-private; cross-module access goes
 * through this interface so Spring Modulith's {@code ApplicationModules.verify()}
 * stays green.
 *
 * Method count is intentionally small. WebSocket op flow (cell.update,
 * tree.add, …) goes through the {@code /ws/projects/{id}} channel and
 * doesn't need a Java-side cross-module handle. The only operation
 * that benefits from one is "I just mutated project state outside the
 * WS path — please tell every connected client to re-hydrate", which
 * is what {@link #broadcastFullStateSnapshot} does.
 */
public interface ProjectSyncApi {

    /**
     * Snapshot the project's current data + sheet_tree + doc_tree +
     * three matching versions inside a read-only transaction, then
     * send the resulting {@code sync.full} frame to every WebSocket
     * session currently registered against this project.
     *
     * Idempotent and safe to call after any successful project
     * mutation. Returns immediately after the snapshot — individual
     * session sends are best-effort (see SyncBroadcaster's quiet send
     * semantics) so a single misbehaving client can't block the others.
     *
     * Used by Stage F (template import) where one HTTP POST mutates a
     * batch of sheets + tree leaves; without this call peers wouldn't
     * see the new sheets until their next reconnect.
     */
    void broadcastFullStateSnapshot(UUID projectId);

    /**
     * Broadcast an arbitrary event envelope to every session of the
     * given project. The envelope is a plain Map → JSON; callers
     * supply the {@code type} (e.g. "comment.added", "comment.deleted")
     * and the payload as a Java object the JSON mapper can serialise.
     *
     * Unlike op-log broadcasts (cell.update etc.), these don't go
     * through op_idempotency or version columns — they're used for
     * lightweight peer notifications where loss tolerance is high
     * (worst case the peer re-fetches on next interaction).
     *
     * Sender exclusion is *not* applied here — the caller is HTTP,
     * not a WebSocket session, so every wss session needs the
     * notification. The local user gets it too and dedupes on its
     * own (REST response provides the canonical row before the
     * broadcast arrives).
     */
    void broadcastEvent(UUID projectId, String type, Object payload);
}
