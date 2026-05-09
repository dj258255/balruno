// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.history;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * List-view metadata for a {@code doc_snapshots} row (ADR 0038 stage C).
 *
 * The page-history list never ships the full {@code yjs_state} bytes
 * to keep the response light — the frontend pulls the binary on
 * demand via the dedicated state endpoint when the user picks a
 * moment to restore.
 */
public record DocSnapshot(
        UUID id,
        UUID docId,
        UUID projectId,
        UUID actorUserId,
        String summary,
        OffsetDateTime createdAt
) {}
