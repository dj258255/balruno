// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.history;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Public read API for the doc body page-history surface (ADR 0038
 * stage C).
 *
 * Authorisation: list / get gate on the doc's project's workspace
 * membership (Viewer+). The retention cutoff (workspace plan's
 * {@code historyRetentionDays}) is applied inside the service so a
 * stale row past the cutoff isn't returned even if cleanup hasn't
 * run yet.
 */
public interface DocSnapshotService {

    /**
     * List metadata for the snapshots of a document, newest first.
     * Limit is clamped to [1, 200].
     */
    List<DocSnapshot> listForDoc(UUID docId, UUID callerUserId, int limit);

    /**
     * Returns the raw yjs state bytes for a single snapshot. The
     * frontend feeds them into {@code Y.applyUpdate} on a fresh
     * Y.Doc to render that historical version. Empty optional when
     * the snapshot doesn't exist or isn't reachable by the caller.
     */
    Optional<byte[]> readState(UUID snapshotId, UUID callerUserId);
}
