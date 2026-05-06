// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync.internal;

import com.balruno.sync.SyncMessage;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Sheet cell region op log writer — cell.update / row.* / column.*
 * (ADR 0008 v2.0 §3.1).
 *
 * Stage B.2 scope: stub. Real implementation in B.4 — native jsonb_set
 * patch on {@code projects.data}, version++ inside the same
 * transaction, op_idempotency insert, conflict detection on
 * {@code baseVersion != current data_version}.
 */
@Service
class SheetCellOpService {

    /**
     * Stub: returns the current version unchanged so the handler can
     * still ack the client during early integration smoke tests. Will
     * be replaced wholesale by the SQL implementation in B.4.
     */
    @Transactional
    SyncResult apply(UUID projectId, UUID userId, SyncMessage op) {
        return SyncResult.acked(0L);
    }
}
