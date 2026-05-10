// SPDX-License-Identifier: AGPL-3.0-or-later
package com.balruno.storage.internal;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

/**
 * Persistence layer for the {@code workspace_storage} counter.
 *
 * Three operations matter here:
 *   1. {@link #findForUpdate} — pessimistic-locked read used inside
 *      the quota pre-check; native FOR UPDATE so concurrent uploads
 *      against the same workspace serialise on the row.
 *   2. {@link #addBytes} — atomic increment after the quota gate
 *      passes. Atomic SQL avoids a Hibernate dirty-check race.
 *   3. {@link #subtractBytes} — clamped decrement on attachment
 *      delete; GREATEST(0, …) keeps the counter non-negative even
 *      if accounting drifts between the table and R2 reality.
 *
 * Reads use the repository's stock {@code findById} (no lock).
 */
interface WorkspaceStorageRepository extends JpaRepository<WorkspaceStorageEntity, UUID> {

    /**
     * Pessimistic-locked read — picks up a row lock that holds for
     * the duration of the surrounding transaction. Using a native
     * query (rather than {@code @Lock(PESSIMISTIC_WRITE)}) keeps
     * the SQL explicit + readable: it's the *exact* shape Postgres
     * sees, no Hibernate translation guessing.
     */
    @Query(value = "SELECT * FROM workspace_storage WHERE workspace_id = :id FOR UPDATE",
           nativeQuery = true)
    Optional<WorkspaceStorageEntity> findForUpdate(@Param("id") UUID id);

    /**
     * Atomic increment — serves both the upload (addBytes &gt; 0) and
     * accounting reconciliation paths. Returns the affected row count
     * so callers can detect missing workspace rows (pre-V28 fixtures).
     *
     * {@code clearAutomatically} evicts the cached entity after the
     * UPDATE so a follow-up {@code findById} in the same persistence
     * context reads fresh DB state, not stale L1 cache. Without this
     * a long-running tx (integration test increment-then-read) saw
     * the pre-increment value (the integration test that uncovered
     * this discrepancy is the load-bearing reason).
     * {@code flushAutomatically} forces any pending dirty state to
     * disk before the UPDATE so a prior {@code findForUpdate}'s lock
     * is honoured by the UPDATE's row scan.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "UPDATE workspace_storage "
                 + "   SET total_bytes = total_bytes + :delta, updated_at = now() "
                 + " WHERE workspace_id = :id",
           nativeQuery = true)
    int addBytes(@Param("id") UUID id, @Param("delta") long delta);

    /**
     * Atomic decrement, clamped to zero. {@link Math#max} doesn't
     * exist as SQL; GREATEST is the Postgres-native equivalent.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = "UPDATE workspace_storage "
                 + "   SET total_bytes = GREATEST(0, total_bytes - :delta), updated_at = now() "
                 + " WHERE workspace_id = :id",
           nativeQuery = true)
    int subtractBytes(@Param("id") UUID id, @Param("delta") long delta);
}
