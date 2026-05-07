// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.sync.internal;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

/**
 * PK lookup is the V8 idempotency hot path — handler reads on every op
 * write. V14 (ADR 0021 v2.3 Phase 5) added the undo + redo queries —
 * latest reversible / redoable action for a user in a session, served
 * by partial indexes.
 */
interface OpIdempotencyRepository extends JpaRepository<OpIdempotencyEntity, UUID> {

    /**
     * Latest reversible non-undone action for a user in a project,
     * scoped to a single browser tab (clientSessionId). Used by
     * UndoServiceImpl.undo. Filters out:
     *   - rows without inverse_payload (V8 idempotency-only)
     *   - rows past their reversibleUntil (Cmd+Z window expired)
     *   - rows already undone (waiting in redo stack)
     *
     * The partial index op_idempotency_undo_lookup (V14) serves this
     * query in O(log n).
     */
    @Query("""
        SELECT o FROM OpIdempotencyEntity o
        WHERE o.userId = :userId
          AND o.projectId = :projectId
          AND o.clientSessionId = :clientSessionId
          AND o.undone = false
          AND o.inversePayload IS NOT NULL
          AND o.reversibleUntil > :now
        ORDER BY o.createdAt DESC
        LIMIT 1
    """)
    Optional<OpIdempotencyEntity> findLatestReversible(
            @Param("userId") UUID userId,
            @Param("projectId") UUID projectId,
            @Param("clientSessionId") UUID clientSessionId,
            @Param("now") OffsetDateTime now);

    /**
     * Latest already-undone action ready to redo. Mirrors the undo
     * query — same filters except undone = true. Cmd+Shift+Z pops this
     * and re-applies forward_payload.
     */
    @Query("""
        SELECT o FROM OpIdempotencyEntity o
        WHERE o.userId = :userId
          AND o.projectId = :projectId
          AND o.clientSessionId = :clientSessionId
          AND o.undone = true
          AND o.forwardPayload IS NOT NULL
          AND o.reversibleUntil > :now
        ORDER BY o.undoneAt DESC
        LIMIT 1
    """)
    Optional<OpIdempotencyEntity> findLatestRedoable(
            @Param("userId") UUID userId,
            @Param("projectId") UUID projectId,
            @Param("clientSessionId") UUID clientSessionId,
            @Param("now") OffsetDateTime now);

    /**
     * Hydrate query — last N reversible (or recently-undone) actions
     * for a user in a session, newest first. Used by the
     * GET /api/v1/projects/{id}/undo-stack endpoint to refill the
     * client's local stack after a page refresh.
     *
     * Includes both is_undone = false (Cmd+Z eligible) and is_undone
     * = true (Cmd+Shift+Z eligible) — the client decodes via the
     * undone field on each entry to populate its own past + future
     * stacks.
     */
    @Query("""
        SELECT o FROM OpIdempotencyEntity o
        WHERE o.userId = :userId
          AND o.projectId = :projectId
          AND o.clientSessionId = :clientSessionId
          AND o.inversePayload IS NOT NULL
          AND o.reversibleUntil > :now
        ORDER BY o.createdAt DESC
    """)
    java.util.List<OpIdempotencyEntity> findRecentReversible(
            @Param("userId") UUID userId,
            @Param("projectId") UUID projectId,
            @Param("clientSessionId") UUID clientSessionId,
            @Param("now") OffsetDateTime now,
            org.springframework.data.domain.Pageable pageable);
}
