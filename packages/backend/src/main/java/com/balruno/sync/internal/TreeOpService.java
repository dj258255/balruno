// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync.internal;

import com.balruno.sync.SyncMessage;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Tree region op log writer — tree.add / tree.move / tree.delete /
 * tree.rename, parametrised by {@link SyncMessage.TreeKind} (sheet vs
 * doc). ADR 0008 v2.0 §3.4-§3.5.
 *
 * Stage B.2 scope: stub. Real implementation in B.5 — jsonb_set patch
 * on {@code projects.sheet_tree} or {@code projects.doc_tree},
 * version++ inside the same transaction, application-level BFS for
 * cycle prevention on tree.move, cascade delete for tree.delete with
 * treeKind=DOC (soft-delete the matching documents row).
 */
@Service
class TreeOpService {

    @Transactional
    SyncResult apply(UUID projectId, UUID userId, SyncMessage op) {
        // Stage B.5 placeholder — ack with version 0 + empty broadcast so
        // handler stays compilable. Real implementation in B.5 mirrors
        // SheetCellOpService's pattern but on sheet_tree / doc_tree.
        return new SyncResult.Acked(0L, "{}");
    }
}
